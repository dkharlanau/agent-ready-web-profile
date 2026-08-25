import http from 'node:http';
import { Readable } from 'node:stream';
import { createScannerHandler } from './handler.mjs';

// Keep ARWP_SCANNER_* environment names for backward compatibility with the 0.2.0 deployment artifacts.
const bind = process.env.ARWP_SCANNER_BIND || '127.0.0.1';
const port = Number(process.env.PORT || process.env.ARWP_SCANNER_PORT || 8787);
const allowedOrigins = String(process.env.ARWP_SCANNER_ALLOWED_ORIGINS || '')
  .split(',').map(value => value.trim()).filter(Boolean);
const requestsPerWindow = Number(process.env.ARWP_SCANNER_RATE_LIMIT || 10);
const windowMs = Number(process.env.ARWP_SCANNER_RATE_WINDOW_MS || 60_000);

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid discovery-service port: ${port}`);
if (!Number.isFinite(requestsPerWindow) || requestsPerWindow < 1) throw new Error('ARWP_SCANNER_RATE_LIMIT must be positive.');
if (!Number.isFinite(windowMs) || windowMs < 1000) throw new Error('ARWP_SCANNER_RATE_WINDOW_MS must be at least 1000.');

const handler = createScannerHandler({ allowedOrigins, requestsPerWindow, windowMs });

function toRequest(req) {
  const host = req.headers.host || `${bind}:${port}`;
  const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) for (const item of value) headers.append(key, item);
    else if (value != null) headers.set(key, String(value));
  }
  const init = { method: req.method, headers };
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    init.body = Readable.toWeb(req);
    init.duplex = 'half';
  }
  return new Request(`${protocol}://${host}${req.url || '/'}`, init);
}

async function sendResponse(res, response) {
  res.statusCode = response.status;
  for (const [key, value] of response.headers) res.setHeader(key, value);
  if (!response.body) return res.end();
  Readable.fromWeb(response.body).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const response = await handler(toRequest(req));
    await sendResponse(res, response);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(`${JSON.stringify({ error: String(error?.message || error) })}\n`);
  }
});

server.listen(port, bind, () => {
  console.log(`ARWP discovery service listening on http://${bind}:${port}`);
  console.log('Routes: GET /health; POST /scan, /resolve, /explain, /plan');
  console.log(`Allowed browser origins: ${allowedOrigins.length ? allowedOrigins.join(', ') : '(none)'}`);
});
