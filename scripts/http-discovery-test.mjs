import assert from 'node:assert/strict';
import { parseLinkHeader, fetchPublicHead, adaptHttpDiscovery } from '../lib/http-discovery.mjs';

const links = parseLinkHeader([
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</openapi.json>; rel="service-desc"; type="application/json"; title="API, current"',
  '</docs.md>; rel="alternate"; type="text/markdown"',
  '</ai/site-profile.json>; rel="describedby"; type="application/json"'
].join(', '), 'https://example.com/');
assert.equal(links.length, 4);
assert.equal(links[1].title, 'API, current');
assert.equal(links[1].url, 'https://example.com/openapi.json');

const adapted = adaptHttpDiscovery({
  url: 'https://example.com/',
  contentType: 'text/markdown; charset=utf-8',
  markdownNegotiated: true,
  links
});
assert.deepEqual(adapted.apiCatalogs, ['https://example.com/.well-known/api-catalog']);
assert.deepEqual(adapted.arwpProfiles, ['https://example.com/ai/site-profile.json']);
assert.ok(adapted.interfaces.apis.some(item => item.kind === 'api-description' && item.sourceAuthority === 'ietf-standard'));
assert.ok(adapted.interfaces.content.some(item => item.kind === 'markdown-negotiated'));
assert.ok(adapted.interfaces.content.some(item => item.kind === 'markdown-alternate'));

const PUBLIC_DNS = async () => [{ address: '93.184.216.34', family: 4 }];
let calls = 0;
const fetchImpl = async (url, options) => {
  calls += 1;
  assert.equal(options.method, 'HEAD');
  assert.match(options.headers.Accept, /text\/markdown/);
  if (calls === 1) return new Response(null, { status: 302, headers: { location: '/docs/' } });
  return new Response(null, {
    status: 200,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      link: '</openapi.json>; rel="service-desc"; type="application/json"'
    }
  });
};
const metrics = { requests: 0, bytes: 0 };
const head = await fetchPublicHead('https://example.com/', { fetchImpl, resolveImpl: PUBLIC_DNS, timeoutMs: 1000, metrics });
assert.equal(head.url, 'https://example.com/docs/');
assert.equal(head.markdownNegotiated, true);
assert.equal(head.links[0].url, 'https://example.com/openapi.json');
assert.equal(metrics.requests, 2);
assert.equal(metrics.bytes, 0, 'HEAD discovery must not claim downloaded body bytes');

await assert.rejects(() => fetchPublicHead('https://127.0.0.1/', { fetchImpl, resolveImpl: PUBLIC_DNS }), /Private or reserved|not allowed/i);

console.log('PASS HTTP discovery parses Link relations, observes Markdown negotiation and keeps public-HTTPS redirect boundaries');
