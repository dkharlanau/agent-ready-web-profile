import assert from 'node:assert/strict';
import { searchResolvedFederated, resolvedStaticIndexes } from '../router/resolved-federated.mjs';

const empty = () => ({ content: [], data: [], retrieval: [], apis: [], tools: [], skills: [], agents: [], browserTools: [], auth: [], trust: [] });
const stubResolve = async url => {
  if (url.includes('broken.example')) throw new Error('fixture resolution failure');
  const interfaces = empty();
  if (url.includes('searchable.example')) interfaces.retrieval.push({
    sourceId: 'arwp-profile:0', sourceAuthority: 'project-profile', kind: 'index', url: 'https://searchable.example/data/index.json', mediaType: 'application/json', format: 'json'
  });
  if (url.includes('feed.example')) interfaces.content.push({
    sourceId: 'homepage-scan', sourceAuthority: 'observed-web', kind: 'feed', url: 'https://feed.example/feed.json', mediaType: 'application/feed+json'
  });
  interfaces.apis.push({ sourceId: 'api-catalog:0', sourceAuthority: 'ietf-standard', kind: 'api-description', protocol: 'OpenAPI', url: `${new URL(url).origin}/openapi.json` });
  return {
    canonicalUrl: url,
    identity: { name: new URL(url).hostname },
    interfaces,
    conflicts: [],
    summary: { interfacesResolved: interfaces.retrieval.length + interfaces.content.length + interfaces.apis.length }
  };
};

const fetchTextImpl = async url => {
  if (url === 'https://searchable.example/data/index.json') {
    return {
      ok: true,
      status: 200,
      text: JSON.stringify([
        { id: 'one', title: 'Outside view', summary: 'Use reference classes instead of only an inside forecast.', url: 'https://searchable.example/outside-view/' },
        { id: 'two', title: 'Unrelated', summary: 'Other material.' }
      ])
    };
  }
  assert.equal(url, 'https://feed.example/feed.json');
  return {
    ok: true,
    status: 200,
    text: JSON.stringify({
      version: 'https://jsonfeed.org/version/1.1',
      title: 'Example JSON Feed',
      items: [
        { id: 'feed-one', title: 'Reference classes', content_text: 'An outside view can improve a forecast.', url: 'https://feed.example/reference-classes/' }
      ]
    })
  };
};

const indexes = resolvedStaticIndexes(await stubResolve('https://searchable.example/'));
assert.equal(indexes.length, 1);
assert.equal(indexes[0].format, 'json');

const feedIndexes = resolvedStaticIndexes(await stubResolve('https://feed.example/'));
assert.equal(feedIndexes.length, 1);
assert.equal(feedIndexes[0].kind, 'feed');
assert.equal(feedIndexes[0].format, 'json');

const result = await searchResolvedFederated('outside view', {
  sites: [
    { id: 'searchable', name: 'Searchable', url: 'https://searchable.example/' },
    { id: 'feed', name: 'Feed', url: 'https://feed.example/' },
    { id: 'api-only', name: 'API only', url: 'https://api-only.example/' },
    { id: 'broken', name: 'Broken', url: 'https://broken.example/' }
  ],
  resolveImpl: stubResolve,
  fetchTextImpl,
  concurrency: 2
});

assert.equal(result.results.length, 2);
assert.ok(result.results.some(item => item.id === 'one' && item.site.id === 'searchable'));
assert.ok(result.results.some(item => item.id === 'feed-one' && item.site.id === 'feed'));
assert.equal(result.results.find(item => item.id === 'feed-one').summary, 'An outside view can improve a forecast.');
assert.equal(result.results.find(item => item.id === 'one').discovery.sourceId, 'arwp-profile:0');
assert.equal(result.results.find(item => item.id === 'one').interface.format, 'json');
assert.equal(result.executed.length, 2);
assert.ok(result.executed.some(item => item.siteId === 'feed' && item.interface.kind === 'feed' && item.interface.format === 'json'));
assert.ok(result.skipped.some(item => item.id === 'api-only' && item.reason === 'no-supported-static-retrieval-index'));
assert.ok(result.skipped.some(item => item.id === 'broken' && item.reason === 'resolution-failed'));
assert.match(result.policy, /does not invent OpenAPI, MCP or A2A operations/);

console.log('PASS resolver-backed federation executes supported static indexes and JSON Feed while preserving discovery provenance');
