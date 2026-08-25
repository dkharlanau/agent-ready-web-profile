import assert from 'node:assert/strict';
import { collectDeclaredUrls, verifyProfileSource } from '../lib/verifier.mjs';
import { loadProfile } from '../lib/validator.mjs';

const profile = loadProfile('examples/minimal.site-profile.json');
const declared = collectDeclaredUrls(profile);
assert.deepEqual(declared.map(item => item.key), ['web.sitemap', 'web.robots']);

function response({ status = 200, url, contentType = 'text/plain' }) {
  return {
    status,
    ok: status >= 200 && status < 300,
    url,
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? contentType : null;
      }
    },
    body: {
      async cancel() {}
    }
  };
}

const successfulFetch = async (url, options = {}) => {
  if (options.method === 'HEAD') {
    return response({
      status: 200,
      url,
      contentType: url.endsWith('sitemap.xml') ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8'
    });
  }
  throw new Error(`Unexpected method ${options.method}`);
};

const success = await verifyProfileSource('examples/minimal.site-profile.json', {
  fetchImpl: successfulFetch,
  timeoutMs: 1000,
  concurrency: 2
});
assert.equal(success.valid, true);
assert.deepEqual(success.summary, { pass: 2, warn: 0, fail: 0, total: 2 });

const fallbackFetch = async (url, options = {}) => {
  if (options.method === 'HEAD') return response({ status: 405, url, contentType: 'text/plain' });
  return response({ status: 206, url, contentType: url.endsWith('sitemap.xml') ? 'application/xml' : 'text/plain' });
};

const fallback = await verifyProfileSource('examples/minimal.site-profile.json', {
  fetchImpl: fallbackFetch,
  timeoutMs: 1000
});
assert.equal(fallback.valid, true);
assert.ok(fallback.resources.every(item => item.method === 'GET'));

const failingFetch = async (url) => response({ status: 503, url, contentType: 'text/plain' });
const failed = await verifyProfileSource('examples/minimal.site-profile.json', {
  fetchImpl: failingFetch,
  timeoutMs: 1000
});
assert.equal(failed.valid, false);
assert.equal(failed.summary.fail, 2);

const mediaWarningFetch = async (url) => response({ status: 200, url, contentType: 'text/html' });
const warned = await verifyProfileSource('examples/minimal.site-profile.json', {
  fetchImpl: mediaWarningFetch,
  timeoutMs: 1000
});
assert.equal(warned.valid, true);
assert.equal(warned.summary.warn, 2);

console.log('PASS network verifier discovery, HEAD fallback, failures and media-type warnings');
