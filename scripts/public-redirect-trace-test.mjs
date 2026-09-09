import assert from 'node:assert/strict';
import { tracePublicHttpsRedirects } from '../lib/public-redirect-trace.mjs';

const resolveImpl = async () => [{ address: '93.184.216.34', family: 4 }];
let cancels = 0;
const response = (status, headers = {}) => ({
  status,
  headers: { get: name => headers[String(name).toLowerCase()] ?? null },
  body: { cancel: async () => { cancels += 1; } }
});

{
  const calls = [];
  const trace = await tracePublicHttpsRedirects('https://example.com/old', {
    resolveImpl,
    fetchImpl: async url => {
      calls.push(url);
      if (url === 'https://example.com/old') return response(301, { location: '/new' });
      return response(200, { 'content-type': 'text/html; charset=utf-8' });
    }
  });
  assert.deepEqual(calls, ['https://example.com/old', 'https://example.com/new']);
  assert.equal(trace.redirected, true);
  assert.equal(trace.redirectCount, 1);
  assert.equal(trace.finalUrl, 'https://example.com/new');
  assert.equal(trace.finalStatus, 200);
  assert.deepEqual(trace.hops, [
    { url: 'https://example.com/old', status: 301, location: 'https://example.com/new' },
    { url: 'https://example.com/new', status: 200, location: null }
  ]);
}

{
  const trace = await tracePublicHttpsRedirects('https://example.com/old', {
    resolveImpl,
    fetchImpl: async url => {
      if (url.endsWith('/old')) return response(308, { location: '/middle' });
      if (url.endsWith('/middle')) return response(301, { location: '/new' });
      return response(200);
    }
  });
  assert.equal(trace.redirectCount, 2);
  assert.deepEqual(trace.hops.map(item => item.status), [308, 301, 200]);
}

{
  const trace = await tracePublicHttpsRedirects('https://example.com/page', {
    resolveImpl,
    fetchImpl: async () => response(200, { 'content-type': 'text/html' })
  });
  assert.equal(trace.redirected, false);
  assert.equal(trace.redirectCount, 0);
  assert.equal(trace.finalUrl, 'https://example.com/page');
}

await assert.rejects(
  () => tracePublicHttpsRedirects('https://example.com/old', {
    resolveImpl,
    fetchImpl: async () => response(301, { location: 'https://127.0.0.1/internal' })
  }),
  /private or reserved address/i
);

await assert.rejects(
  () => tracePublicHttpsRedirects('https://example.com/old', {
    resolveImpl,
    maxRedirects: 1,
    fetchImpl: async url => response(301, { location: url.endsWith('/old') ? '/middle' : '/new' })
  }),
  /Too many redirects/
);

await assert.rejects(
  () => tracePublicHttpsRedirects('https://example.com/old', {
    resolveImpl,
    fetchImpl: async () => response(302)
  }),
  /Redirect without Location/
);

assert.ok(cancels >= 7, 'all terminal and redirect response bodies should be cancelled without downloading them');
console.log('PASS public redirect trace preserves bounded hop/status/location evidence while revalidating every destination against the public HTTPS boundary.');
