import assert from 'node:assert/strict';
import {
  ARD_REGISTRY_DEFAULT_PAGE_SIZE,
  ARD_REGISTRY_MAX_PAGE_SIZE,
  buildArdSearchRequest,
  normalizeArdSearchResult,
  validateArdSearchResponse,
  searchArdRegistry
} from '../lib/ard-registry.mjs';

const PUBLIC_DNS = async () => [{ address: '93.184.216.34', family: 4 }];

const request = buildArdSearchRequest({
  text: 'find a weather lookup tool',
  filter: { type: ['application/mcp-server-card+json'], 'acme:region': ['eu'] },
  context: { acme: 'https://acme.example/vocab#' }
});
assert.equal(request.federation, 'none');
assert.equal(request.pageSize, ARD_REGISTRY_DEFAULT_PAGE_SIZE);
assert.equal(request.query.text, 'find a weather lookup tool');
assert.deepEqual(request.query['@context'], { acme: 'https://acme.example/vocab#' });
assert.deepEqual(request.query.filter.type, ['application/mcp-server-card+json']);

assert.throws(() => buildArdSearchRequest({ text: '' }), /text is required/i);
assert.throws(() => buildArdSearchRequest({ text: 'x', federation: 'wild' }), /federation/);
assert.throws(() => buildArdSearchRequest({ text: 'x', pageSize: ARD_REGISTRY_MAX_PAGE_SIZE + 1 }), /pageSize/);
assert.throws(() => buildArdSearchRequest({ text: 'x', filter: [] }), /filter must be an object/);

const normalized = normalizeArdSearchResult({
  '@context': { acme: 'https://acme.example/vocab#' },
  identifier: 'urn:air:weather.example:server:main',
  displayName: 'Weather Main',
  type: 'application/mcp-server-card+json',
  url: 'https://weather.example/server-card.json',
  score: 94,
  source: 'https://registry.example/api/',
  'acme:region': 'eu',
  futureRankingHint: { preserve: true }
});
assert.equal(normalized.valid, true);
assert.equal(normalized.score, 94);
assert.equal(normalized.scoreMeaning, 'semantic-relevance-not-trust');
assert.equal(normalized.extensionTerms['acme:region'], 'eu');
assert.deepEqual(normalized.unknownTerms.futureRankingHint, { preserve: true });

const partial = normalizeArdSearchResult({
  identifier: 'urn:air:weather.example:server:partial',
  score: 80,
  source: 'https://registry.example/api/'
});
assert.equal(partial.valid, true, 'SearchResultItem may omit displayName/type/url/data; only identifier, score, source are response requirements.');
assert.equal(partial.url, null);

const invalidScore = normalizeArdSearchResult({ identifier: 'urn:air:x:y:z', score: 101, source: 'https://registry.example/' });
assert.equal(invalidScore.valid, false);
assert.ok(invalidScore.issues.some(item => /score/.test(item)));

const responseValidation = validateArdSearchResponse({
  results: [
    { identifier: 'urn:air:weather.example:server:one', displayName: 'One', type: 'application/mcp-server-card+json', url: 'https://weather.example/one.json', score: 91, source: 'https://registry.example/api/' },
    { identifier: 'urn:air:weather.example:server:two', score: 88, source: 'https://registry.example/api/' }
  ],
  referrals: [
    { identifier: 'urn:air:other.example:registry:public', displayName: 'Other Registry', type: 'application/ai-registry+json', url: 'https://other.example/search' }
  ],
  pageToken: 'next-token'
});
assert.equal(responseValidation.valid, true, JSON.stringify(responseValidation.issues));
assert.equal(responseValidation.results.length, 2);
assert.equal(responseValidation.referrals.length, 1);
assert.equal(responseValidation.pageToken, 'next-token');

let observedRequest = null;
const fetchImpl = async (url, options = {}) => {
  observedRequest = { url: String(url), options };
  return new Response(JSON.stringify({
    results: [
      {
        identifier: 'urn:air:weather.example:server:main',
        displayName: 'Weather Main',
        type: 'application/mcp-server-card+json',
        url: 'https://weather.example/server-card.json',
        score: 94,
        source: 'https://registry.example/api/',
        'acme:region': 'eu'
      }
    ],
    referrals: [
      { identifier: 'urn:air:other.example:registry:public', displayName: 'Other', type: 'application/ai-registry+json', url: 'https://other.example/search' }
    ],
    pageToken: 'page-2'
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const metrics = { requests: 0, bytes: 0 };
const result = await searchArdRegistry('https://registry.example/api', {
  text: 'weather for Berlin',
  federation: 'referrals',
  pageSize: 5
}, { fetchImpl, resolveImpl: PUBLIC_DNS, timeoutMs: 1000, maxBytes: 128 * 1024, metrics });

assert.equal(result.ok, true);
assert.equal(observedRequest.url, 'https://registry.example/api/search');
assert.equal(observedRequest.options.method, 'POST');
assert.equal(observedRequest.options.redirect, 'manual');
const sent = JSON.parse(observedRequest.options.body);
assert.equal(sent.query.text, 'weather for Berlin');
assert.equal(sent.federation, 'referrals');
assert.equal(sent.pageSize, 5);
assert.equal(result.results[0].scoreMeaning, 'semantic-relevance-not-trust');
assert.equal(result.referrals.length, 1, 'Referral is returned as evidence, not followed.');
assert.equal(result.pageToken, 'page-2', 'Pagination token is returned, not followed.');
assert.equal(metrics.requests, 1, 'One explicit search call makes one registry request.');
assert.ok(metrics.bytes > 0);
assert.match(result.note, /never followed automatically/);

let referralCalls = 0;
const noFollowFetch = async (url, options = {}) => {
  referralCalls += 1;
  assert.equal(String(url), 'https://registry.example/search');
  return new Response(JSON.stringify({ results: [], referrals: [{ identifier: 'urn:air:next.example:registry:one', displayName: 'Next', type: 'application/ai-registry+json', url: 'https://next.example/search' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const noFollow = await searchArdRegistry('https://registry.example/', { text: 'anything', federation: 'referrals' }, { fetchImpl: noFollowFetch, resolveImpl: PUBLIC_DNS });
assert.equal(referralCalls, 1);
assert.equal(noFollow.referrals[0].url, 'https://next.example/search');

const redirectFetch = async () => new Response('', { status: 307, headers: { location: 'https://other.example/search' } });
await assert.rejects(() => searchArdRegistry('https://registry.example/', { text: 'x' }, { fetchImpl: redirectFetch, resolveImpl: PUBLIC_DNS }), /redirect is not followed automatically/i);

const invalidResponseFetch = async () => new Response(JSON.stringify({ results: [{ identifier: 'urn:air:x:y:z', score: 200, source: 'https://registry.example/' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
await assert.rejects(() => searchArdRegistry('https://registry.example/', { text: 'x' }, { fetchImpl: invalidResponseFetch, resolveImpl: PUBLIC_DNS }), /failed validation/i);

const errorFetch = async () => new Response(JSON.stringify({ errorCode: 'RATE_LIMITED', message: 'slow down' }), { status: 429, headers: { 'content-type': 'application/json' } });
const failed = await searchArdRegistry('https://registry.example/', { text: 'x' }, { fetchImpl: errorFetch, resolveImpl: PUBLIC_DNS });
assert.equal(failed.ok, false);
assert.equal(failed.status, 429);
assert.equal(failed.error.errorCode, 'RATE_LIMITED');

await assert.rejects(() => searchArdRegistry('https://127.0.0.1/', { text: 'x' }, { fetchImpl, resolveImpl: PUBLIC_DNS }), /Private or reserved|not allowed/i);
await assert.rejects(() => searchArdRegistry('http://registry.example/', { text: 'x' }, { fetchImpl, resolveImpl: PUBLIC_DNS }), /public HTTPS/i);

console.log('PASS bounded ARD registry search defaults to federation=none, preserves partial/extended result evidence, keeps semantic relevance separate from trust, and never follows referrals, pagination or redirects automatically');
