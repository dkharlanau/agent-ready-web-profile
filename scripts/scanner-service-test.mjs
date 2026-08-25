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

const stubResolve = async url => ({
  canonicalUrl: url,
  identity: { name: 'Example', canonicalUrl: url },
  interfaces: {
    content: [{ kind: 'llms', protocol: 'llms.txt', url: `${url}llms.txt`, sourceAuthority: 'observed-web' }],
    data: [], retrieval: [], apis: [], tools: [], skills: [], agents: [], browserTools: [], auth: [], trust: []
  },
  conflicts: [],
  summary: { sourcesAttempted: 1, sourcesResolved: 1, interfacesResolved: 1, conflicts: 0 }
});

const stubExplain = resolution => `Resolved ${resolution.canonicalUrl}`;
const stubPlan = (resolution, intent) => ({ intent, selected: resolution.interfaces.content[0], fallbacks: [], reason: 'fixture' });

let now = 1000;
const handler = createScannerHandler({
  scanImpl: stubScan,
  resolveImpl: stubResolve,
  explainImpl: stubExplain,
  planImpl: stubPlan,
  allowedOrigins: ['https://dkharlanau.github.io'],
  requestsPerWindow: 5,
  windowMs: 60_000,
  now: () => now
});

let response = await handler(new Request('https://scanner.example/health'));
assert.equal(response.status, 200);
const health = await response.json();
assert.equal(health.service, 'arwp-discovery');
assert.deepEqual(health.routes, ['/scan', '/resolve', '/explain', '/plan']);

response = await handler(new Request('https://scanner.example/scan', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
  body: JSON.stringify({ url: 'https://example.com/' })
}));
assert.equal(response.status, 403, 'unexpected browser origins must be rejected before scanning');

const makeRequest = (path, body = { url: 'https://example.com/' }) => new Request(`https://scanner.example${path}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://dkharlanau.github.io', 'x-forwarded-for': '203.0.113.5' },
  body: JSON.stringify(body)
});

response = await handler(makeRequest('/scan'));
assert.equal(response.status, 200);
assert.equal(response.headers.get('access-control-allow-origin'), 'https://dkharlanau.github.io');
let payload = await response.json();
assert.equal(payload.profile.id, 'example-site');
assert.equal(payload.scan.discovered.sitemap.url, 'https://example.com/sitemap.xml');

response = await handler(makeRequest('/resolve'));
assert.equal(response.status, 200);
payload = await response.json();
assert.equal(payload.resolution.identity.name, 'Example');

response = await handler(makeRequest('/explain'));
assert.equal(response.status, 200);
payload = await response.json();
assert.match(payload.explanation, /Resolved https:\/\/example\.com\//);

response = await handler(makeRequest('/plan', { url: 'https://example.com/', intent: 'read' }));
assert.equal(response.status, 200);
payload = await response.json();
assert.equal(payload.plan.selected.url, 'https://example.com/llms.txt');

response = await handler(makeRequest('/plan', { url: 'https://example.com/', intent: 'invalid' }));
assert.equal(response.status, 400);

response = await handler(makeRequest('/scan'));
assert.equal(response.status, 429, 'bounded public discovery service must rate-limit repeated clients across all expensive routes');

now += 60_001;
response = await handler(makeRequest('/scan'));
assert.equal(response.status, 200, 'rate bucket must reset after the configured window');

response = await handler(new Request('https://scanner.example/resolve', { method: 'GET' }));
assert.equal(response.status, 405);
response = await handler(new Request('https://scanner.example/anything', { method: 'POST' }));
assert.equal(response.status, 404, 'discovery service must not become a general proxy endpoint');

console.log('PASS hosted discovery service enforces fixed routes, CORS, shared rate limits and exposes scan/resolve/explain/plan without becoming a proxy');
