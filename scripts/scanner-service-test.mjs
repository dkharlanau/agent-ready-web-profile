import assert from 'node:assert/strict';
import { createScannerHandler } from '../scanner-service/handler.mjs';

const stubScan = async url => ({
  source: url,
  finalUrl: url,
  canonicalUrl: url,
  identity: { name: 'Example', description: 'Example site', languages: ['en'] },
  discovered: { sitemap: { url: `${url}sitemap.xml` }, feeds: [] },
  existingProfile: null,
  evidence: [{ key: 'web.homepage', status: 'detected', url, source: 'http' }],
  capabilities: { web: { status: 'assessed', detected: ['web.homepage'] }, mcp: { status: 'not-assessed' } },
  warnings: [],
  draftWarnings: [],
  draftProfile: { profileVersion: '0.1', id: 'example-site', name: 'Example', canonicalUrl: url, description: 'Example site' }
});

let now = 1000;
const handler = createScannerHandler({
  scanImpl: stubScan,
  allowedOrigins: ['https://dkharlanau.github.io'],
  requestsPerWindow: 2,
  windowMs: 60_000,
  now: () => now
});

let response = await handler(new Request('https://scanner.example/health'));
assert.equal(response.status, 200);
assert.equal((await response.json()).service, 'arwp-scanner');

response = await handler(new Request('https://scanner.example/scan', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
  body: JSON.stringify({ url: 'https://example.com/' })
}));
assert.equal(response.status, 403, 'unexpected browser origins must be rejected before scanning');

const makeScanRequest = () => new Request('https://scanner.example/scan', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://dkharlanau.github.io', 'x-forwarded-for': '203.0.113.5' },
  body: JSON.stringify({ url: 'https://example.com/' })
});

response = await handler(makeScanRequest());
assert.equal(response.status, 200);
assert.equal(response.headers.get('access-control-allow-origin'), 'https://dkharlanau.github.io');
const payload = await response.json();
assert.equal(payload.profile.id, 'example-site');
assert.equal(payload.scan.discovered.sitemap.url, 'https://example.com/sitemap.xml');

response = await handler(makeScanRequest());
assert.equal(response.status, 200);
response = await handler(makeScanRequest());
assert.equal(response.status, 429, 'bounded public scanner must rate-limit repeated clients');

now += 60_001;
response = await handler(makeScanRequest());
assert.equal(response.status, 200, 'rate bucket must reset after the configured window');

response = await handler(new Request('https://scanner.example/scan', { method: 'GET' }));
assert.equal(response.status, 405);
response = await handler(new Request('https://scanner.example/anything', { method: 'POST' }));
assert.equal(response.status, 404, 'scanner service must not become a general proxy endpoint');

console.log('PASS hosted scanner service enforces fixed routes, CORS, rate limits and returns a conservative generated profile');
