import assert from 'node:assert/strict';
import { resolveMany } from '../lib/resolver-batch.mjs';

let active = 0;
let maxActive = 0;
const activeOrigins = new Set();
let sameOriginOverlap = false;

const stubResolve = async url => {
  const origin = new URL(url).origin;
  if (activeOrigins.has(origin)) sameOriginOverlap = true;
  activeOrigins.add(origin);
  active += 1;
  maxActive = Math.max(maxActive, active);
  await new Promise(resolve => setTimeout(resolve, 10));
  active -= 1;
  activeOrigins.delete(origin);
  if (url.includes('fail.example')) throw new Error('fixture failure');
  return {
    canonicalUrl: url,
    identity: { name: new URL(url).hostname },
    interfaces: { content: [], data: [], retrieval: [], apis: [], tools: [], skills: [], agents: [], browserTools: [], auth: [], trust: [] },
    conflicts: url.includes('conflict') ? [{ kind: 'fixture-conflict' }] : [],
    summary: { interfacesResolved: 2 }
  };
};

const result = await resolveMany([
  { id: 'a1', url: 'https://a.example/one' },
  { id: 'a2', url: 'https://a.example/two' },
  { id: 'b', url: 'https://b.example/conflict' },
  { id: 'fail', url: 'https://fail.example/' }
], { resolveImpl: stubResolve, concurrency: 3 });

assert.equal(result.summary.resolved, 3);
assert.equal(result.summary.failed, 1);
assert.equal(result.summary.conflicts, 1);
assert.equal(result.summary.interfacesResolved, 6);
assert.ok(maxActive <= 3, 'global concurrency must remain bounded');
assert.equal(sameOriginOverlap, false, 'the same origin must not be resolved concurrently within one batch');
assert.equal(result.results[3].status, 'failed');
assert.match(result.results[3].error, /fixture failure/);

await assert.rejects(() => resolveMany(Array.from({ length: 101 }, (_, index) => `https://site${index}.example/`), { resolveImpl: stubResolve }), /at most 100/);
await assert.rejects(() => resolveMany(['https://example.com/'], { resolveImpl: stubResolve, concurrency: 11 }), /between 1 and 10/);

console.log('PASS resolveMany bounds concurrency, serializes same-origin work and isolates per-site failures');
