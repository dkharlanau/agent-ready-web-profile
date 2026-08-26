import assert from 'node:assert/strict';
import { probePublicHttpsUrl } from '../lib/public-fetch.mjs';

const resolveImpl = async () => [{ address: '93.184.216.34', family: 4 }];
let calls = 0;
let cancels = 0;
const response = (status, headers = {}) => ({
  status,
  headers: { get: name => headers[String(name).toLowerCase()] ?? null },
  body: { cancel: async () => { cancels += 1; } }
});

const fetchImpl = async url => {
  calls += 1;
  if (url === 'https://example.com/start') {
    return response(302, { location: 'https://example.net/final' });
  }
  return response(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': String(50 * 1024 * 1024) });
};

const result = await probePublicHttpsUrl('https://example.com/start', { fetchImpl, resolveImpl });
assert.equal(result.ok, true);
assert.equal(result.status, 200);
assert.equal(result.requestedUrl, 'https://example.com/start');
assert.equal(result.url, 'https://example.net/final');
assert.equal(result.redirected, true);
assert.equal(result.bytes, 0, 'liveness probe must not read response bodies');
assert.equal(calls, 2);
assert.equal(cancels, 2, 'redirect and terminal response bodies must both be cancelled');

let privateRedirectCalls = 0;
await assert.rejects(
  () => probePublicHttpsUrl('https://example.com/private', {
    resolveImpl,
    fetchImpl: async () => {
      privateRedirectCalls += 1;
      return response(302, { location: 'https://127.0.0.1/internal' });
    }
  }),
  /private or reserved address/i
);
assert.equal(privateRedirectCalls, 1, 'private redirect must be rejected before another request is sent');

await assert.rejects(() => probePublicHttpsUrl('https://example.com/', { resolveImpl, fetchImpl, timeoutMs: 0 }), /positive number/);
await assert.rejects(() => probePublicHttpsUrl('https://example.com/', { resolveImpl, fetchImpl, maxRedirects: 21 }), /between 0 and 20/);

console.log('PASS public URL probe follows only validated public HTTPS redirects and cancels bodies without downloading them');
