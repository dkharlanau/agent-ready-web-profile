import assert from 'node:assert/strict';
import { resolveSite, explainResolvedSite, planResolvedSite } from '../lib/resolver.mjs';

const PUBLIC_DNS = async () => [{ address: '93.184.216.34', family: 4 }];

function response(url, body, { status = 200, contentType = 'application/json', headers = {} } = {}) {
  const res = new Response(body, { status, headers: { 'content-type': contentType, ...headers } });
  Object.defineProperty(res, 'url', { value: url });
  return res;
}

const profile = {
  profileVersion: '0.1',
  id: 'example-site',
  name: 'Example Knowledge Site',
  canonicalUrl: 'https://example.com/',
  description: 'Resolver interoperability fixture.',
  web: { sitemap: 'https://example.com/sitemap.xml', robots: 'https://example.com/robots.txt', llms: 'https://example.com/llms.txt' },
  retrieval: { indexes: [{ name: 'Search', url: 'https://example.com/search.json', mediaType: 'application/json', format: 'json' }] },
  mcp: { servers: [{ name: 'com.example/knowledge', transport: 'streamable-http', url: 'https://example.com/mcp', readOnly: true }] }
};

const ardCatalog = {
  specVersion: '1.0',
  host: { displayName: 'Example Agentic Resources', identifier: 'did:web:example.com' },
  entries: [
    { '@context': 'https://agenticresourcediscovery.org/context/v1', identifier: 'urn:air:example.com:mcp:knowledge', displayName: 'Knowledge MCP', type: 'application/mcp-server-card+json', data: { name: 'com.example/knowledge', title: 'Knowledge MCP', version: '1.0.0', remotes: [{ url: 'https://example.com/mcp', type: 'streamable-http' }] } },
    { identifier: 'urn:air:example.com:agent:research', displayName: 'Research Agent', type: 'application/a2a-agent-card+json', url: 'https://example.com/agents/research-card.json', description: 'A referenced A2A Agent Card. The catalog URL itself is not callable.' },
    { identifier: 'urn:air:example.com:skill:summarize', displayName: 'Summarize Skill', type: 'application/ai-skill+md', url: 'https://example.com/skills/summarize/SKILL.md', description: 'Portable summarization procedure.' },
    { identifier: 'urn:air:example.com:registry:public', displayName: 'Example Registry', type: 'application/ai-registry+json', url: 'https://registry.example.com/api/v1/', description: 'Searchable ARD registry.' },
    { identifier: 'urn:air:example.com:catalog:engineering', displayName: 'Engineering Catalog', type: 'application/ai-catalog+json', url: 'https://example.com/catalogs/engineering.json' },
    { identifier: 'urn:air:example.com:data:reference', displayName: 'Reference Dataset', type: 'application/parquet', url: 'https://data.example.com/reference.parquet', tags: ['reference'] }
  ]
};

const routes = new Map([
  ['https://example.com/', ['<!doctype html><html lang="en"><head><title>Example Knowledge Site</title><meta name="description" content="Fixture"><link rel="canonical" href="https://example.com/"><link rel="describedby" type="application/json" href="/ai/site-profile.json"></head><body></body></html>', 'text/html']],
  ['https://example.com/robots.txt', ['User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n', 'text/plain']],
  ['https://example.com/sitemap.xml', ['<urlset></urlset>', 'application/xml']],
  ['https://example.com/llms.txt', ['# Example', 'text/plain']],
  ['https://example.com/ai/site-profile.json', [JSON.stringify(profile), 'application/json']],
  ['https://example.com/agents.txt', ['# agents.txt\n# JSON: https://example.com/agents.json\nMCP: https://example.com/mcp\nSkills: https://example.com/skills/search/SKILL.md\nA2A: https://example.com/.well-known/agent-card.json\n', 'text/plain']],
  ['https://example.com/agents.json', [JSON.stringify({ version: '1.0', standard: 'https://agents-txt.com', site: { name: 'Example Knowledge Site', url: 'https://example.com/' }, mcp: [{ url: 'https://example.com/mcp', type: 'streamable-http' }], skills: [{ url: 'https://example.com/skills/search/SKILL.md' }], a2a: [{ url: 'https://example.com/.well-known/agent-card.json' }] }), 'application/json']],
  ['https://example.com/.well-known/api-catalog', [JSON.stringify({ linkset: [{ anchor: 'https://example.com/api', 'service-desc': [{ href: 'https://example.com/openapi.json', type: 'application/json' }] }] }), 'application/linkset+json']],
  ['https://example.com/.well-known/oauth-protected-resource', [JSON.stringify({ resource: 'https://example.com/', authorization_servers: ['https://auth.example.com/'], scopes_supported: ['read'] }), 'application/json']],
  ['https://example.com/.well-known/agent-card.json', [JSON.stringify({ name: 'Example Agent', description: 'Searches the example library.', version: '1.0.0', supportedInterfaces: [{ url: 'https://example.com/a2a', protocolBinding: 'JSONRPC', protocolVersion: '1.0' }], capabilities: {}, defaultInputModes: ['text/plain'], defaultOutputModes: ['text/plain'], skills: [{ id: 'search', name: 'Search', description: 'Search knowledge', tags: [], examples: [] }] }), 'application/json']],
  ['https://example.com/.well-known/agent-skills/index.json', [JSON.stringify({ skills: [{ name: 'search', type: 'skill-md', url: 'https://example.com/skills/search/SKILL.md', digest: `sha256:${'a'.repeat(64)}` }] }), 'application/json']],
  ['https://example.com/.well-known/ard.json', [JSON.stringify(ardCatalog), 'application/ld+json']],
  // The predecessor route remains available but should not be fetched when canonical ARD succeeds.
  ['https://example.com/.well-known/ai-catalog.json', [JSON.stringify(ardCatalog), 'application/ai-catalog+json']],
  ['https://example.com/mcp/server-card', [JSON.stringify({ name: 'com.example/knowledge', title: 'Knowledge MCP', version: '1.0.0', remotes: [{ url: 'https://example.com/mcp', type: 'streamable-http' }] }), 'application/mcp-server-card+json']]
]);

const calls = [];
const fetchImpl = async (url, options = {}) => {
  const key = String(url);
  calls.push(`${options.method || 'GET'} ${key}`);
  const route = routes.get(key);
  if (!route) return response(key, 'not found', { status: 404, contentType: 'text/plain' });
  if (options.method === 'HEAD') return response(key, '', { contentType: route[1], headers: key === 'https://example.com/' ? { link: '</.well-known/ard.json>; rel="ard"; type="application/ld+json"' } : {} });
  return response(key, route[0], { contentType: route[1] });
};

const resolved = await resolveSite('https://example.com', { fetchImpl, resolveImpl: PUBLIC_DNS, timeoutMs: 1000, maxBytes: 128 * 1024 });
assert.equal(resolved.identity.name, 'Example Knowledge Site');
assert.ok(resolved.interfaces.retrieval.some(item => item.url === 'https://example.com/search.json'));
assert.ok(resolved.interfaces.apis.some(item => item.url === 'https://example.com/openapi.json'));
assert.ok(resolved.interfaces.tools.some(item => item.kind === 'mcp-server-card'));
assert.ok(resolved.interfaces.agents.some(item => item.protocol === 'A2A'));
assert.ok(resolved.interfaces.skills.some(item => item.protocol === 'Agent Skills'));
assert.ok(resolved.interfaces.skills.some(item => item.kind === 'ard-skill' && item.url === 'https://example.com/skills/summarize/SKILL.md'));
assert.ok(resolved.interfaces.data.some(item => item.kind === 'ard-a2a-card-reference' && item.url === 'https://example.com/agents/research-card.json'));
assert.ok(resolved.interfaces.data.some(item => item.kind === 'ard-registry' && item.url === 'https://registry.example.com/api/v1/'));
assert.ok(resolved.interfaces.data.some(item => item.kind === 'ard-catalog' && item.url === 'https://example.com/catalogs/engineering.json'));
assert.ok(resolved.interfaces.data.some(item => item.kind === 'ard-artifact' && item.mediaType === 'application/parquet'));
const catalogSource = resolved.sources.find(item => item.id === 'ard-catalog:0');
assert.equal(catalogSource.authority, 'multivendor-open-draft');
assert.ok(!calls.includes('GET https://example.com/.well-known/ai-catalog.json'), 'legacy ai-catalog path should not be fetched when canonical ARD resolves');
assert.equal(resolved.conflicts.length, 0);
assert.equal(planResolvedSite(resolved, 'read').selected.url, 'https://example.com/llms.txt');
assert.equal(planResolvedSite(resolved, 'search').selected.url, 'https://example.com/search.json');
assert.equal(planResolvedSite(resolved, 'structured').selected.url, 'https://example.com/openapi.json');
assert.equal(planResolvedSite(resolved, 'tools').selected.url, 'https://example.com/mcp');
assert.equal(planResolvedSite(resolved, 'agent').selected.url, 'https://example.com/a2a');
assert.equal(planResolvedSite(resolved, 'agent').selected.agentCardUrl, 'https://example.com/.well-known/agent-card.json');
assert.match(explainResolvedSite(resolved), /Recommended interfaces:/);
assert.equal(resolved.upstreamStatus.ARD, 'multivendor-open-draft');
assert.equal(resolved.upstreamStatus['MCP Server Card'], 'experimental-upstream');

const conflictRoutes = new Map(routes);
conflictRoutes.set('https://example.com/agents.json', [JSON.stringify({ version: '1.0', site: { name: 'Example Knowledge Site', url: 'https://example.com/' }, mcp: [{ url: 'https://example.com/other-mcp', type: 'streamable-http' }] }), 'application/json']);
const conflictFetch = async (url, options = {}) => {
  const key = String(url);
  const route = conflictRoutes.get(key);
  if (!route) return response(key, 'not found', { status: 404, contentType: 'text/plain' });
  if (options.method === 'HEAD') return response(key, '', { contentType: route[1] });
  return response(key, route[0], { contentType: route[1] });
};
const conflicted = await resolveSite('https://example.com', { fetchImpl: conflictFetch, resolveImpl: PUBLIC_DNS, timeoutMs: 1000, maxBytes: 128 * 1024 });
assert.ok(conflicted.conflicts.some(item => item.kind === 'source-mismatch'));

const legacyFetch = async (url, options = {}) => {
  const key = String(url);
  if (key === 'https://legacy.example/') {
    if (options.method === 'HEAD') return response(key, '', { contentType: 'text/html; charset=utf-8' });
    return response(key, '<!doctype html><html><head><title>Legacy ARD publisher</title></head><body></body></html>', { contentType: 'text/html; charset=utf-8' });
  }
  if (key === 'https://legacy.example/.well-known/ai-catalog.json') return response(key, JSON.stringify(ardCatalog), { contentType: 'application/ai-catalog+json' });
  return response(key, 'not found', { status: 404, contentType: 'text/plain' });
};
const legacy = await resolveSite('https://legacy.example/', { fetchImpl: legacyFetch, resolveImpl: PUBLIC_DNS, timeoutMs: 1000, maxBytes: 128 * 1024 });
assert.ok(legacy.sources.some(item => item.id === 'ard-catalog:0' && item.status === 'not-found'));
assert.ok(legacy.sources.some(item => item.id === 'ard-catalog-legacy:0' && item.status === 'resolved' && item.authority === 'multivendor-open-draft'));
assert.ok(legacy.interfaces.skills.some(item => item.kind === 'ard-skill'));

const plainFetch = async (url, options = {}) => {
  const key = String(url);
  if (key === 'https://plain.example/') {
    if (options.method === 'HEAD') return response(key, '', { contentType: 'text/html; charset=utf-8' });
    return response(key, '<!doctype html><html><head><title>Plain HTML Site</title><meta name="description" content="Only ordinary HTML"></head><body>Plain content</body></html>', { contentType: 'text/html; charset=utf-8' });
  }
  return response(key, 'not found', { status: 404, contentType: 'text/plain' });
};
const plain = await resolveSite('https://plain.example/', { fetchImpl: plainFetch, resolveImpl: PUBLIC_DNS, timeoutMs: 1000, maxBytes: 128 * 1024 });
assert.equal(planResolvedSite(plain, 'read').selected.url, 'https://plain.example/');
assert.equal(planResolvedSite(plain, 'read').selected.kind, 'html');
assert.equal(planResolvedSite(plain, 'search').selected, null);

const apiOnlyFetch = async (url, options = {}) => {
  const key = String(url);
  if (key === 'https://api-only.example/') {
    if (options.method === 'HEAD') return response(key, '', { contentType: 'text/html; charset=utf-8' });
    return response(key, '<!doctype html><html><head><title>API only</title></head><body></body></html>', { contentType: 'text/html; charset=utf-8' });
  }
  if (key === 'https://api-only.example/.well-known/api-catalog') {
    return response(key, JSON.stringify({ linkset: [{ anchor: 'https://api-only.example/api', 'service-desc': [{ href: 'https://api-only.example/openapi.json', type: 'application/json' }] }] }), { contentType: 'application/linkset+json' });
  }
  return response(key, 'not found', { status: 404, contentType: 'text/plain' });
};
const apiOnly = await resolveSite('https://api-only.example/', { fetchImpl: apiOnlyFetch, resolveImpl: PUBLIC_DNS, timeoutMs: 1000, maxBytes: 128 * 1024 });
assert.equal(planResolvedSite(apiOnly, 'structured').selected.url, 'https://api-only.example/openapi.json');
assert.equal(planResolvedSite(apiOnly, 'search').selected, null);

await assert.rejects(() => resolveSite('https://127.0.0.1', { fetchImpl, resolveImpl: PUBLIC_DNS }), /Private or reserved|public HTTPS|not allowed/i);
console.log('PASS resolver normalizes canonical ARD v0.91 plus predecessor ai-catalog fallback as conservative evidence, routes A2A cards to callable interfaces, and preserves existing intent decisions');
