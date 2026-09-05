import assert from 'node:assert/strict';
import { discoverArdSite } from '../lib/ard-site.mjs';

const PUBLIC_DNS = async () => [{ address: '93.184.216.34', family: 4 }];

function response(url, body, { status = 200, contentType = 'application/json', headers = {} } = {}) {
  const res = new Response(body, { status, headers: { 'content-type': contentType, ...headers } });
  Object.defineProperty(res, 'url', { value: url });
  return res;
}

const homepage = `<!doctype html><html><head>
<link rel="ard" href="/custom-ard.json" type="application/json">
<script type="application/ld+json">{
  "identifier":"urn:air:example.com:skill:inline",
  "displayName":"Inline Skill",
  "type":"application/ai-skill+md",
  "url":"https://example.com/skills/inline/SKILL.md",
  "representativeQueries":["summarize this","make a brief"],
  "@context":{"lab":"https://lab.example/#"},
  "lab:quality":"reviewed"
}</script>
</head><body>Example</body></html>`;

const manifests = {
  canonical: { entries: [{
    identifier: 'urn:air:example.com:server:canonical', displayName: 'Canonical MCP', type: 'application/mcp-server-card+json',
    url: 'https://example.com/mcp/canonical.json', representativeQueries: ['weather lookup', 'forecast lookup']
  }] },
  custom: { entries: [{
    identifier: 'urn:air:example.com:agent:custom', displayName: 'Custom Agent', type: 'application/a2a-agent-card+json',
    url: 'https://example.com/a2a/custom.json', representativeQueries: ['delegate research', 'ask custom agent']
  }] },
  agentmap: { entries: [{
    identifier: 'urn:air:catalog.example:skill:agentmap', displayName: 'Agentmap Skill', type: 'application/ai-skill+md',
    url: 'https://catalog.example/skills/agentmap/SKILL.md', representativeQueries: ['agentmap skill', 'catalog skill']
  }] },
  http: { entries: [{
    identifier: 'urn:air:example.com:api:http', displayName: 'HTTP ARD API', type: 'application/openapi+json',
    url: 'https://example.com/openapi.json', representativeQueries: ['inspect api', 'find api']
  }] },
  legacy: { entries: [{
    identifier: 'urn:air:example.com:legacy:old', displayName: 'Legacy', type: 'application/json',
    url: 'https://example.com/legacy-artifact.json', representativeQueries: ['legacy one', 'legacy two']
  }] }
};

const calls = [];
const fetchImpl = async (url, options = {}) => {
  const key = String(url);
  calls.push(`${options.method || 'GET'} ${key}`);
  if (key === 'https://example.com/' && options.method === 'HEAD') {
    return response(key, '', { contentType: 'text/html', headers: { link: '</http-ard.json>; rel="ard"; type="application/json"' } });
  }
  if (key === 'https://example.com/') return response(key, homepage, { contentType: 'text/html' });
  if (key === 'https://example.com/robots.txt') return response(key, 'User-agent: *\nAllow: /\nAgentmap: https://catalog.example/agentmap.json\n', { contentType: 'text/plain' });
  if (key === 'https://example.com/.well-known/ard.json') return response(key, JSON.stringify(manifests.canonical));
  if (key === 'https://example.com/custom-ard.json') return response(key, JSON.stringify(manifests.custom));
  if (key === 'https://catalog.example/agentmap.json') return response(key, JSON.stringify(manifests.agentmap));
  if (key === 'https://example.com/http-ard.json') return response(key, JSON.stringify(manifests.http));
  if (key === 'https://example.com/.well-known/ai-catalog.json') return response(key, JSON.stringify(manifests.legacy));
  return response(key, 'not found', { status: 404, contentType: 'text/plain' });
};

const discovered = await discoverArdSite('https://example.com/', { fetchImpl, resolveImpl: PUBLIC_DNS, timeoutMs: 1000 });
assert.equal(discovered.canonicalUrl, 'https://example.com/');
assert.equal(discovered.summary.inlineEntries, 1);
assert.equal(discovered.summary.validEntries, 5);
assert.equal(discovered.summary.invalidEntries, 0);
assert.equal(discovered.boundaries.recursiveCatalogFetch, false);
assert.equal(discovered.boundaries.registrySearch, false);
assert.equal(discovered.boundaries.resourcesExecuted, false);
assert.equal(discovered.boundaries.metadataGrantsAuthorization, false);
assert.ok(discovered.entries.some(item => item.identifier === 'urn:air:example.com:skill:inline' && item.extensionTerms['lab:quality'] === 'reviewed'));
assert.ok(discovered.entries.some(item => item.identifier === 'urn:air:example.com:server:canonical'));
assert.ok(discovered.entries.some(item => item.identifier === 'urn:air:example.com:agent:custom'));
assert.ok(discovered.entries.some(item => item.identifier === 'urn:air:catalog.example:skill:agentmap'));
assert.ok(discovered.entries.some(item => item.identifier === 'urn:air:example.com:api:http'));
assert.ok(discovered.sources.some(item => item.relation === 'legacy-well-known' && item.status === 'skipped'));
assert.equal(calls.includes('GET https://example.com/.well-known/ai-catalog.json'), false, 'predecessor conventional path must not be fetched once canonical ard.json resolves');
assert.ok(calls.includes('GET https://catalog.example/agentmap.json'));
assert.ok(calls.includes('GET https://example.com/http-ard.json'));
assert.match(discovered.note, /Nested catalogs, registry search, referrals, artifact execution and authorization/i);

const legacyCalls = [];
const legacyFetch = async (url, options = {}) => {
  const key = String(url);
  legacyCalls.push(`${options.method || 'GET'} ${key}`);
  if (key === 'https://legacy.example/' && options.method === 'HEAD') return response(key, '', { contentType: 'text/html' });
  if (key === 'https://legacy.example/') return response(key, '<html><head><title>Legacy</title></head></html>', { contentType: 'text/html' });
  if (key === 'https://legacy.example/robots.txt') return response(key, 'User-agent: *\nAllow: /\n', { contentType: 'text/plain' });
  if (key === 'https://legacy.example/.well-known/ard.json') return response(key, 'not found', { status: 404, contentType: 'text/plain' });
  if (key === 'https://legacy.example/.well-known/ai-catalog.json') return response(key, JSON.stringify(manifests.legacy));
  return response(key, 'not found', { status: 404, contentType: 'text/plain' });
};
const legacy = await discoverArdSite('https://legacy.example/', { fetchImpl: legacyFetch, resolveImpl: PUBLIC_DNS, timeoutMs: 1000 });
assert.ok(legacyCalls.includes('GET https://legacy.example/.well-known/ai-catalog.json'));
assert.ok(legacy.sources.some(item => item.relation === 'legacy-well-known' && item.status === 'resolved'));
assert.equal(legacy.entries[0].identifier, 'urn:air:example.com:legacy:old');

const invalidFetch = async (url, options = {}) => {
  const key = String(url);
  if (key === 'https://invalid.example/' && options.method === 'HEAD') return response(key, '', { contentType: 'text/html' });
  if (key === 'https://invalid.example/') return response(key, '<html></html>', { contentType: 'text/html' });
  if (key === 'https://invalid.example/robots.txt') return response(key, '', { status: 404, contentType: 'text/plain' });
  if (key === 'https://invalid.example/.well-known/ard.json') return response(key, JSON.stringify({ wrong: [] }));
  if (key === 'https://invalid.example/.well-known/ai-catalog.json') return response(key, 'not found', { status: 404, contentType: 'text/plain' });
  return response(key, 'not found', { status: 404, contentType: 'text/plain' });
};
const invalid = await discoverArdSite('https://invalid.example/', { fetchImpl: invalidFetch, resolveImpl: PUBLIC_DNS, timeoutMs: 1000 });
assert.ok(invalid.sources.some(item => item.status === 'invalid-manifest' && /entries array/.test(item.issue)));
assert.equal(invalid.summary.validEntries, 0);

await assert.rejects(() => discoverArdSite('https://127.0.0.1/', { fetchImpl, resolveImpl: PUBLIC_DNS }), /Private or reserved|not allowed/i);

console.log('PASS bounded ARD site discovery combines canonical manifest, HTML/HTTP rel=ard, JSON-LD and Agentmap evidence, skips predecessor probing after canonical success, and never executes/federates discovered resources');
