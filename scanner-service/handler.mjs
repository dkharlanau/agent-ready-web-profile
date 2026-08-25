import { scanSite } from '../lib/scanner.mjs';
import { resolveSite, explainResolvedSite, planResolvedSite } from '../lib/resolver.mjs';

const DEFAULT_BODY_LIMIT = 8 * 1024;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_REQUESTS_PER_WINDOW = 10;
const POST_ROUTES = new Set(['/scan', '/resolve', '/explain', '/plan']);

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(`${JSON.stringify(body, null, 2)}\n`, {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });
}

function normalizeAllowedOrigins(values) {
  const output = new Set();
  for (const raw of values || []) {
    const value = String(raw || '').trim();
    if (!value) continue;
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') throw new Error(`Scanner allowed origins must be HTTPS: ${value}`);
    output.add(parsed.origin);
  }
  return output;
}

function clientKey(request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('cf-connecting-ip') || 'anonymous';
}

async function readJsonBounded(request, maxBytes) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared && declared > maxBytes) throw Object.assign(new Error('Request body too large.'), { status: 413 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw Object.assign(new Error('Request body too large.'), { status: 413 });
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }); }
  return payload;
}

export function createScannerHandler({
  scanImpl = scanSite,
  resolveImpl = resolveSite,
  explainImpl = explainResolvedSite,
  planImpl = planResolvedSite,
  allowedOrigins = [],
  bodyLimit = DEFAULT_BODY_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
  requestsPerWindow = DEFAULT_REQUESTS_PER_WINDOW,
  now = () => Date.now()
} = {}) {
  const origins = normalizeAllowedOrigins(allowedOrigins);
  const buckets = new Map();

  function corsHeaders(request) {
    const origin = request.headers.get('origin');
    if (!origin) return {};
    if (!origins.has(origin)) return null;
    return { 'access-control-allow-origin': origin, 'vary': 'origin' };
  }

  function checkRateLimit(request) {
    const key = clientKey(request);
    const current = now();
    const bucket = buckets.get(key);
    if (!bucket || current - bucket.startedAt >= windowMs) {
      buckets.set(key, { startedAt: current, count: 1 });
      return;
    }
    bucket.count += 1;
    if (bucket.count > requestsPerWindow) throw Object.assign(new Error('Rate limit exceeded.'), { status: 429 });
  }

  return async function handle(request) {
    const url = new URL(request.url);
    const cors = corsHeaders(request);
    if (cors === null) return jsonResponse({ error: 'Origin is not allowed.' }, 403);

    if (request.method === 'OPTIONS') {
      if (!request.headers.get('origin')) return new Response(null, { status: 204 });
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '600'
        }
      });
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return jsonResponse({ ok: true, service: 'arwp-discovery', routes: ['/scan', '/resolve', '/explain', '/plan'] }, 200, cors || {});
    }

    if (!POST_ROUTES.has(url.pathname)) return jsonResponse({ error: 'Not found.' }, 404, cors || {});
    if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, { allow: 'POST, OPTIONS', ...(cors || {}) });

    try {
      checkRateLimit(request);
      const payload = await readJsonBounded(request, bodyLimit);
      const target = String(payload?.url || '').trim();
      if (!target) throw Object.assign(new Error('Field "url" is required.'), { status: 400 });

      if (url.pathname === '/scan') {
        const scan = await scanImpl(target);
        return jsonResponse({
          scan: {
            source: scan.source,
            finalUrl: scan.finalUrl,
            canonicalUrl: scan.canonicalUrl,
            identity: scan.identity,
            discovered: scan.discovered,
            existingProfile: scan.existingProfile,
            evidence: scan.evidence,
            capabilities: scan.capabilities,
            warnings: scan.warnings,
            draftWarnings: scan.draftWarnings
          },
          profile: scan.draftProfile
        }, 200, cors || {});
      }

      const resolution = await resolveImpl(target);
      if (url.pathname === '/resolve') return jsonResponse({ resolution }, 200, cors || {});
      if (url.pathname === '/explain') return jsonResponse({ canonicalUrl: resolution.canonicalUrl, explanation: explainImpl(resolution), conflicts: resolution.conflicts }, 200, cors || {});

      const intent = String(payload?.intent || '').trim().toLowerCase();
      if (!['read', 'search', 'structured', 'tools', 'agent'].includes(intent)) throw Object.assign(new Error('Field "intent" must be read, search, structured, tools or agent.'), { status: 400 });
      return jsonResponse({ canonicalUrl: resolution.canonicalUrl, plan: planImpl(resolution, intent), conflicts: resolution.conflicts }, 200, cors || {});
    } catch (error) {
      const status = Number(error?.status) || 400;
      return jsonResponse({ error: String(error?.message || error) }, status >= 400 && status <= 599 ? status : 500, cors || {});
    }
  };
}
