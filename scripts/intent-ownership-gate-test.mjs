import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateIntentOwnershipGate } from '../lib/intent-ownership-gate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(
  fs.readFileSync(path.join(root, 'benchmarks', 'intent-ownership', 'public-fixture.json'), 'utf8')
);

const gate = evaluateIntentOwnershipGate(fixture);
assert.equal(gate.valid, false);
assert.equal(gate.summary.servedFamilyCount, 4);
assert.equal(gate.summary.declinedFamilyCount, 1);
assert.equal(gate.summary.ownedServedFamilyCount, 1);
assert.equal(gate.summary.failingServedFamilyCount, 3);
assert.deepEqual(
  new Set(gate.failures.map(item => item.ownershipState)),
  new Set(['fragmented', 'unowned', 'blocked-owner'])
);
assert.equal(gate.boundaries.actualGoogleIndexingProven, false);
assert.equal(gate.boundaries.rankingOrCitationProven, false);
assert.equal(gate.boundaries.deploymentCommitProven, false);

const ready = structuredClone(fixture);
for (const family of ready.families) {
  if ((family.intentDisposition ?? 'serve') === 'serve') {
    family.ownerUrls = ['https://example.com/guide/clear-explanations/'];
  }
}
const readyGate = evaluateIntentOwnershipGate(ready);
assert.equal(readyGate.valid, true);
assert.equal(readyGate.summary.servedFamilyCount, 4);
assert.equal(readyGate.summary.declinedFamilyCount, 1);
assert.equal(readyGate.summary.ownedServedFamilyCount, 4);
assert.equal(readyGate.summary.failingServedFamilyCount, 0);
assert.deepEqual(readyGate.failures, []);

console.log('Intent Ownership readiness gate regression passed.');
