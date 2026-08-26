import assert from 'node:assert/strict';
import { scanSite } from '../lib/scanner.mjs';
import { validateProfile } from '../lib/validator.mjs';

function headers(values = {}) {
  const normalized = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return {
    get(name) {
      return normalized.get(String(name).toLowerCase()) ?? null;
    }
  };
}

function response({ status = 200, contentType = 'text/plain', text = '', extraHeaders = {} } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: headers({ 'content-type': contentType, ...extraHeaders }),
    body: {
      async cancel() {}
    },
    async text() {
      return text;
    }
  };
}

const html = `<!doctype html>
<html lang="en">
<head>
  <title>Example Knowledge</title>
  <meta name="description" content="Reviewed example knowledge for humans and machines.">
  <link rel="canonical" href="https://example.com/">
  <link rel="alternate" type="application/rss+xml" title="Updates" href="/feed.xml">
  <link rel="alternate" type="application/json" title="JSON Feed" href="/feed.json">
  <link rel="alternate" type="application/json" title="API representation" href="/data.json">
  <link rel="service-desc" type="application/json" href="/openapi.json">
</head>
<body>
  <p>We discuss MCP, WebMCP, Agent Skills and A2A here, but page text is not capability evidence.</p>
</body>
</html>`;

const fixtures = new Map([
  ['GET https://example.com/', response({ status: 200, contentType: 'text/html; charset=utf-8', text: html })],
  ['GET https://example.com/robots.txt', response({ status: 200, text: 'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n' })],
  ['HEAD https://example.com/sitemap.xml', response({ status: 200, contentType: 'application/xml' })],
  ['HEAD https://example.com/llms.txt', response({ status: 200, contentType: 'text/plain' })],
  ['HEAD https://example.com/feed.xml', response({ status: 200, contentType: 'application/rss+xml' })],
  ['HEAD https://example.com/feed.json', response({ status: 200, contentType: 'application/json; charset=utf-8' })],
  ['HEAD https://example.com/data.json', response({ status: 200, contentType: 'application/json' })],
  ['HEAD https://example.com/openapi.json', response({ status: 200, contentType: 'application/json' })],
  ['GET https://example.com/ai/site-profile.json', response({ status: 404, contentType: 'application/json', text: '{}' })]
]);

const mockFetch = async (url, options = {}) => {
  const key = `${options.method || 'GET'} ${url}`;
  const item = fixtures.get(key);
  if (item) return item;
  if (key === 'HEAD https://example.com/robots.txt') return response({ status: 405 });
  return response({ status: 404 });
};

const resolvePublic = async () => [{ address: '93.184.216.34', family: 4 }];

const scan = await scanSite('example.com', {
  fetchImpl: mockFetch,
  resolveImpl: resolvePublic,
  timeoutMs: 1000,
  maxBytes: 64 * 1024
});

assert.equal(scan.canonicalUrl, 'https://example.com/');
assert.equal(scan.identity.name, 'Example Knowledge');
assert.deepEqual(scan.identity.languages, ['en']);
assert.equal(scan.discovered.robots.url, 'https://example.com/robots.txt');
assert.equal(scan.discovered.sitemap.url, 'https://example.com/sitemap.xml');
assert.equal(scan.discovered.llms.url, 'https://example.com/llms.txt');
assert.equal(scan.discovered.feeds[0].url, 'https://example.com/feed.xml');
assert.ok(scan.discovered.feeds.some(feed => feed.url === 'https://example.com/feed.json' && feed.mediaType === 'application/json'));
assert.equal(scan.discovered.feeds.some(feed => feed.url === 'https://example.com/data.json'), false);
assert.equal(scan.discovered.openapi.url, 'https://example.com/openapi.json');
assert.equal(scan.existingProfile, null);

const profile = scan.draftProfile;
assert.equal(profile.$schema, 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/v0.1.0/schema/site-profile.schema.json');
assert.equal(profile.web.robots, 'https://example.com/robots.txt');
assert.equal(profile.web.sitemap, 'https://example.com/sitemap.xml');
assert.equal(profile.web.llms, 'https://example.com/llms.txt');
assert.ok(profile.web.feeds.some(feed => feed.url === 'https://example.com/feed.json' && feed.mediaType === 'application/json'));
assert.equal(profile.data.openapi, 'https://example.com/openapi.json');
assert.equal(profile.agentSkills, undefined);
assert.equal(profile.agentWeb, undefined);
assert.equal(profile.mcp, undefined);
assert.equal(profile.a2a, undefined);
assert.equal(validateProfile(profile).valid, true);
assert.equal(scan.capabilities.agentWeb.status, 'not-assessed');
assert.ok(scan.evidence.some(item => item.key === 'data.openapi'));

await assert.rejects(
  () => scanSite('https://127.0.0.1/', { fetchImpl: mockFetch, resolveImpl: resolvePublic }),
  /Private or reserved address/
);

const redirectFetch = async (url, options = {}) => {
  if (url === 'https://example.com/' && options.method === 'GET') {
    return response({ status: 302, extraHeaders: { location: 'https://127.0.0.1/admin' } });
  }
  return response({ status: 404 });
};

await assert.rejects(
  () => scanSite('https://example.com/', {
    fetchImpl: redirectFetch,
    resolveImpl: resolvePublic,
    timeoutMs: 1000,
    maxBytes: 64 * 1024
  }),
  /Private or reserved address/
);

console.log('PASS bounded scanner detects explicit feed evidence, including conservative JSON Feed application/json fallbacks, generates a valid profile, and blocks private targets');
