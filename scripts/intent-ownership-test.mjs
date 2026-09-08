import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildIntentOwnershipReport,
  validateIntentOwnershipLedger
} from '../lib/intent-ownership.mjs';

const fixturePath = path.resolve('benchmarks/intent-ownership/public-fixture.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const validation = validateIntentOwnershipLedger(fixture);
assert.equal(validation.valid, true, validation.errors.join('\n'));

const report = buildIntentOwnershipReport(fixture);
assert.deepEqual(report.summary.byState, {
  owned: 1,
  unowned: 1,
  declined: 1,
  fragmented: 1,
  'blocked-owner': 1
});
assert.equal(report.summary.familiesNeedingAttention, 4);
assert.deepEqual(report.summary.observationsByProvider, {
  'bing-ai-performance': { observationCount: 1, familyCount: 1 },
  'google-search-console': { observationCount: 1, familyCount: 1 }
});

const owned = report.families.find(item => item.id === 'explain-clearly');
assert.equal(owned.ownershipState, 'owned');
assert.equal(owned.ownerObserved, true);
assert.equal(owned.observedOffOwner, true);
assert.equal(owned.attention.some(item => item.code === 'review-observed-off-owner'), true);
assert.equal(owned.attention.some(item => item.code === 'strengthen-evidence-path'), false);

const fragmented = report.families.find(item => item.id === 'project-status-update');
assert.equal(fragmented.ownershipState, 'fragmented');
assert.equal(fragmented.attention.some(item => item.code === 'review-fragmented-ownership'), true);

const unowned = report.families.find(item => item.id === 'meeting-answer');
assert.equal(unowned.ownershipState, 'unowned');
assert.match(unowned.attention[0].message, /existing page/i);

const declined = report.families.find(item => item.id === 'declined-navigation-mismatch');
assert.equal(declined.ownershipState, 'declined');
assert.equal(declined.intentDisposition, 'decline');
assert.match(declined.dispositionReason, /navigational/i);
assert.deepEqual(declined.attention, []);

const blocked = report.families.find(item => item.id === 'blocked-draft-owner');
assert.equal(blocked.ownershipState, 'blocked-owner');
assert.equal(blocked.attention[0].priority, 'P0');

assert.equal(report.boundaries.queryVariantCreatesPage, false);
assert.equal(report.boundaries.declinedIntentCreatesPage, false);
assert.equal(report.boundaries.offOwnerObservationProvesCannibalization, false);
assert.equal(report.boundaries.providerMetricsCombined, false);
assert.equal(report.boundaries.productionMutationAuthorized, false);

const publicLeak = structuredClone(fixture);
publicLeak.disclosure.containsLiveQueries = true;
const leakValidation = validateIntentOwnershipLedger(publicLeak);
assert.equal(leakValidation.valid, false);
assert.equal(leakValidation.errors.some(message => message.includes('public records must not contain live query cohorts')), true);

const missingOwner = structuredClone(fixture);
missingOwner.families[0].ownerUrls = ['https://example.com/not-in-canonical-pages/'];
const missingOwnerValidation = validateIntentOwnershipLedger(missingOwner);
assert.equal(missingOwnerValidation.valid, false);
assert.equal(missingOwnerValidation.errors.some(message => message.includes('must reference canonicalPages')), true);

const badDecline = structuredClone(fixture);
const badDeclinedFamily = badDecline.families.find(item => item.id === 'declined-navigation-mismatch');
badDeclinedFamily.ownerUrls = ['https://example.com/guide/status-updates/'];
assert.equal(validateIntentOwnershipLedger(badDecline).valid, false);

const missingDeclineReason = structuredClone(fixture);
delete missingDeclineReason.families.find(item => item.id === 'declined-navigation-mismatch').dispositionReason;
assert.equal(validateIntentOwnershipLedger(missingDeclineReason).valid, false);

const badGuardrail = structuredClone(fixture);
badGuardrail.guardrails.noPagePerQueryVariant = false;
assert.equal(validateIntentOwnershipLedger(badGuardrail).valid, false);

console.log('Intent Ownership regression passed.');
