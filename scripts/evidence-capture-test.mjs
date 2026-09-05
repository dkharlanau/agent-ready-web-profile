import assert from 'node:assert/strict';
import { captureSourceBodyDigests } from '../lib/evidence-capture.mjs';

function headers(values = {}) {
  const map = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return { get: name => map.get(String(name).toLowerCase()) ?? null };
}

function response(status, text = '', contentType = 'application/json') {
  const bytes = new TextEncoder().encode(text);
  return {
    status,
    headers: headers({ 'content-type': contentType, 'content-length': bytes.byteLength }),
    body: {
      getReader() {
        let done = false;
        return {
          async read() {
            if (done) return { done: true, value: undefined };
            done = true;
            return { done: false, value: bytes };
          },
          async cancel() { done = true; }
        };
      }
    }
  };
}

const resolution = {
  sources: [
    { id: 'http-head:0', type: 'http-head', url: 'https://example.com/', status: 'resolved' },
    { id: 'profile:0', type: 'arwp-profile', url: 'https://example.com/ai/site-profile.json', status: 'resolved' },
    { id: 'profile-copy:0', type: 'arwp-profile-link', url: 'https://example.com/ai/site-profile.json#fragment', status: 'resolved' },
    { id: 'ard:0', type: 'ard-catalog', url: 'https://example.com/.well-known/ard.json', status: 'resolved' },
    { id: 'missing:0', type: 'agents-json', url: 'https://example.com/agents.json', status: 'resolved' },
    { id: 'old:0', type: 'old-source', url: 'https://example.com/old.json', status: 'not-found' }
  ]
};

const bodies = new Map([
  ['https://example.com/ai/site-profile.json', response(200, '{"name":"Example"}')],
  ['https://example.com/.well-known/ard.json', response(200, '{"entries":[]}')],
  ['https://example.com/agents.json', response(404, '{}')]
]);
let calls = [];
const fetchImpl = async (url) => {
  calls.push(url);
  return bodies.get(url) || response(404, '{}');
};
const resolveImpl = async () => [{ address: '93.184.216.34', family: 4 }];

const capture = await captureSourceBodyDigests(resolution, {
  fetchImpl,
  resolveImpl,
  timeoutMs: 1000,
  maxBytes: 4096,
  maxSources: 8
});

assert.equal(capture.captureVersion, '0.1');
assert.equal(capture.candidates, 3, 'HEAD/not-found sources are excluded and duplicate URLs collapse');
assert.equal(capture.attempted, 3);
assert.equal(capture.captured, 2);
assert.equal(capture.failed, 1);
assert.equal(capture.omittedByLimit.length, 0);
assert.equal(capture.boundaries.headOnlySourcesSkipped, true);
assert.equal(capture.boundaries.rawWireBytesClaimed, false);
assert.equal(calls.includes('https://example.com/'), false, 'HEAD-only homepage must not be refetched for body hashing');

const profile = capture.digests.find(item => item.finalUrl === 'https://example.com/ai/site-profile.json');
assert.ok(profile);
assert.deepEqual(profile.sourceIds.sort(), ['profile-copy:0', 'profile:0']);
assert.equal(profile.digest, 'sha256:663c40c5fc625d44d00a597ae77ce292566b2bbf823cd8a7dc6d0333faded5fe');
assert.equal(profile.digestScope, 'decoded-utf8-complete-bounded-response-body');
assert.equal(profile.completeWithinBound, true);
assert.equal(profile.networkBytes, Buffer.byteLength('{"name":"Example"}', 'utf8'));
assert.equal(profile.hashedUtf8Bytes, Buffer.byteLength('{"name":"Example"}', 'utf8'));

assert.equal(capture.failures[0].httpStatus, 404);
assert.equal(capture.failures[0].reason, 'http-non-success');

const limited = await captureSourceBodyDigests(resolution, {
  fetchImpl,
  resolveImpl,
  timeoutMs: 1000,
  maxBytes: 4096,
  maxSources: 1
});
assert.equal(limited.attempted, 1);
assert.equal(limited.omittedByLimit.length, 2);
assert.ok(limited.omittedByLimit.every(item => item.reason === 'max-sources-limit'));

await assert.rejects(() => captureSourceBodyDigests(resolution, { fetchImpl, resolveImpl, maxSources: 0 }), /between 1 and 20/);
await assert.rejects(() => captureSourceBodyDigests(resolution, { fetchImpl, resolveImpl, maxBytes: 100 }), /at least 1024/);

console.log('PASS explicit evidence capture deduplicates resolved GET sources, skips HEAD-only observations, preserves failures/limits and publishes scoped decoded-UTF8 SHA-256 digests without claiming raw wire bytes');
