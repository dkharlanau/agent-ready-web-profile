import assert from 'node:assert/strict';
import { searchResolvedFederated, resolvedStaticIndexes } from '../router/resolved-federated.mjs';

const empty = () => ({ content: [], data: [], retrieval: [], apis: [], tools: [], skills: [], agents: [], browserTools: [], auth: [], trust: [] });
const stubResolve = async url => {
  if (url.includes('broken.example')) throw new Error('fixture resolution failure');
  const interfaces = empty();
  if (url.includes('searchable.example')) interfaces.retrieval.push({
    sourceId: 'arwp-profile:0', sourceAuthority: 'project-profile', kind: 'index', url: 'https://searchable.example/data/index.json', mediaType: 'application/json', format: 'json'
  });
  interfaces.apis.push({ sourceId: 'api-catalog:0', sourceAuthority: 'ietf-standard', kind: 'api-description', protocol: 'OpenAPI', url: `${new URL(url).origin}/openapi.json` });
  return {
    canonicalUrl: url,
    identity: { name: new URL(url).hostname },
    interfaces,
    conflicts: [],
    summary: { interfacesResolved: interfaces.retrieval.length + interfaces.apis.length }
  };
};

const fetchTextImpl = async url => {
  assert.equal(url, 'https://searchable.example/data/index.json');
  return {
    ok: true,
    status: 200,
    text: JSON.stringify([
      { id: 'one', title: 'Outside view', summary: 'Use reference classes instead of only an inside forecast.', url: 'https://searchable.example/outside-view/' },
      { id: 'two', title: 'Unrelated', summary: 'Other material.' }
    ])
  };
};

const indexes = resolvedStaticIndexes(await stubResolve('https://searchable.example/'));
assert.equal(indexes.length, 1);
assert.equal(indexes[0].format, 'json');

const result = await searchResolvedFederated('outside view', {
  sites: [
    { id: 'searchable', name: 'Searchable', url: 'https://searchable.example/' },
    { id: 'api-only', name: 'API only', url: 'https://api-only.example/' },
    { id: 'broken', name: 'Broken', url: 'https://broken.example/' }
  ],
  resolveImpl: stubResolve,
  fetchTextImpl,
  concurrency: 2
});

assert.equal(result.results.length, 1);
assert.equal(result.results[0].id, 'one');
assert.equal(result.results[0].site.id, 'searchable');
assert.equal(result.results[0].discovery.sourceId, 'arwp-profile:0');
assert.equal(result.results[0].interface.format, 'json');
assert.ok(result.skipped.some(item => item.id === 'api-only' && item.reason === 'no-supported-static-retrieval-index'));
assert.ok(result.skipped.some(item => item.id === 'broken' && item.reason === 'resolution-failed'));
assert.match(result.policy, /does not invent OpenAPI, MCP or A2A operations/);

console.log('PASS resolver-backed federation executes only supported static indexes and preserves discovery provenance');
