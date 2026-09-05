import assert from 'node:assert/strict';
import { buildIndexNowPayload, publicIndexNowPayload, submitIndexNow, validateIndexNowKey } from '../lib/indexnow.mjs';

const key = 'ARWP-test-key-2026';
assert.equal(validateIndexNowKey(key), key);
assert.throws(() => validateIndexNowKey('short'), /8-128/);
assert.throws(() => validateIndexNowKey('invalid/key'), /letters, numbers or dashes/);

const payload = buildIndexNowPayload('https://example.com/', {
  key,
  keyLocation: 'https://example.com/indexnow-key.txt',
  urls: ['https://example.com/a', '/b', 'https://example.com/a#section']
});
assert.equal(payload.host, 'example.com');
assert.equal(payload.key, key);
assert.equal(payload.keyLocation, 'https://example.com/indexnow-key.txt');
assert.deepEqual(payload.urlList, ['https://example.com/a', 'https://example.com/b']);

const safe = publicIndexNowPayload(payload);
assert.equal('key' in safe, false, 'public payload view must never expose the IndexNow key');
assert.equal(safe.urlCount, 2);

assert.throws(() => buildIndexNowPayload('https://example.com/', { key, urls: ['https://other.example/a'] }), /host mismatch/i);
assert.throws(() => buildIndexNowPayload('https://example.com/', { key, keyLocation: 'https://other.example/key.txt', urls: ['/a'] }), /keyLocation must be hosted/i);
assert.throws(() => buildIndexNowPayload('https://example.com/', { key, urls: [] }), /at least one changed URL/i);

let sent = null;
const accepted = await submitIndexNow(payload, 'https://api.example.net/indexnow', {
  fetchImpl: async (url, options) => {
    sent = { url, options };
    return {
      status: 202,
      body: { cancel: async () => {} }
    };
  }
});
assert.equal(accepted.accepted, true);
assert.equal(accepted.status, 202);
assert.equal(accepted.urlCount, 2);
assert.match(accepted.note, /does not guarantee crawling or indexing/i);
assert.equal(sent.url, 'https://api.example.net/indexnow');
const posted = JSON.parse(sent.options.body);
assert.equal(posted.key, key, 'submission body must contain the real key');
assert.equal(JSON.stringify(accepted).includes(key), false, 'submission receipt must not leak the IndexNow key');
assert.throws(() => submitIndexNow(payload, 'http://api.example.net/indexnow', { fetchImpl: async () => ({}) }), /must use HTTPS/i);

console.log('PASS IndexNow helper validates host scope, never prints the key, caps submission semantics, and treats acceptance as receipt rather than indexing proof');
