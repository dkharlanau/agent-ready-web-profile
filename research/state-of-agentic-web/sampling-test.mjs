import assert from 'node:assert/strict';
import {
  loadSamplingPlan,
  selectStratifiedSample,
  validateCandidateManifest,
  validateSamplingPlan
} from './sampling.mjs';

const plan = loadSamplingPlan();
const planValidation = validateSamplingPlan(plan);
assert.equal(planValidation.valid, true, planValidation.errors.join('\n'));
assert.equal(plan.strata.length, 5);
assert.equal(plan.targetDesign.targetSitesPerStratum, 10);
assert.equal(plan.targetDesign.targetIndependentSites, 50);
assert.equal(plan.targetDesign.targetDecisionCases, 250);
assert.equal(plan.representativeOfPublicWeb, false);
assert.equal(plan.selectionPolicy.frameFrozenBeforeOutcomeReview, true);
assert.equal(plan.selectionPolicy.selectedFailuresAreNotSilentlyReplaced, true);
assert.equal(plan.selectionPolicy.selectionUsesResolverOutput, false);
assert.equal(plan.guardrails.noGeneralWebAdoptionInference, true);

const candidates = [];
for (const stratum of plan.strata) {
  for (let index = 1; index <= 2; index += 1) {
    candidates.push({
      id: `${stratum.id}-${index}`,
      canonicalUrl: `https://${stratum.id}-${index}.example/`,
      ownerControlled: false,
      discoverySource: {
        url: `https://directory.example/${stratum.id}/${index}`,
        observedAt: '2026-09-07'
      },
      eligibleStrata: [stratum.id],
      eligibilityRationale: `Synthetic test record reviewed for the ${stratum.id} stratum only.`,
      preflightState: stratum.id === 'documentation' && index === 1 ? 'unreachable' : 'reachable'
    });
  }
}

candidates.push({
  id: 'documentation-1-duplicate',
  canonicalUrl: 'https://documentation-1.example/other-path',
  ownerControlled: false,
  discoverySource: {
    url: 'https://directory.example/documentation/duplicate',
    observedAt: '2026-09-07'
  },
  eligibleStrata: ['documentation'],
  eligibilityRationale: 'Synthetic duplicate canonical-host record retained as an explicit exclusion.',
  preflightState: 'reachable'
});

candidates.push({
  id: 'owner-controlled-agent-reference',
  canonicalUrl: 'https://owner-agent.example/',
  ownerControlled: true,
  discoverySource: {
    url: 'https://directory.example/agent-native/owner-reference',
    observedAt: '2026-09-07'
  },
  eligibleStrata: ['agent-native'],
  eligibilityRationale: 'Synthetic owner-controlled reference used to verify independent-aggregate exclusion.',
  preflightState: 'reachable'
});

candidates.push({
  id: 'overlap-agent-docs',
  canonicalUrl: 'https://overlap-agent-docs.example/',
  ownerControlled: false,
  discoverySource: {
    url: 'https://directory.example/overlap/agent-docs',
    observedAt: '2026-09-07'
  },
  eligibleStrata: ['documentation', 'agent-native'],
  eligibilityRationale: 'Synthetic overlap record used to verify fixed stratum assignment priority.',
  preflightState: 'reachable'
});

const manifest = {
  snapshotId: 'synthetic-stratified-frame-2026-09-07',
  evidenceDate: '2026-09-07',
  releaseSeed: 'arwp-next-stratified-v1',
  candidates
};

const manifestValidation = validateCandidateManifest(manifest, plan);
assert.equal(manifestValidation.valid, true, manifestValidation.errors.join('\n'));

const sample = selectStratifiedSample(manifest, plan);
assert.equal(sample.representativeOfPublicWeb, false);
assert.equal(sample.summary.rawCandidateRecords, 13);
assert.equal(sample.summary.canonicalHostsAfterDeduplication, 12);
assert.equal(sample.summary.duplicateHostRecordsRetainedAsExclusions, 1);
assert.equal(sample.summary.ownerControlledExcluded, 1);
assert.equal(sample.summary.independentEligible, 11);
assert.equal(sample.summary.selectedIndependentSites, 11);
assert.equal(sample.summary.totalShortfall, 39);
assert.equal(sample.exclusions.duplicateHosts.length, 1);
assert.equal(sample.exclusions.ownerControlled.length, 1);
assert.ok(sample.selected.some(item => item.candidateId === 'documentation-1' && item.preflightState === 'unreachable'), 'selected unreachable records must remain selected rather than being silently replaced');
assert.ok(sample.selected.some(item => item.candidateId === 'overlap-agent-docs' && item.assignedStratum === 'agent-native'), 'fixed priority must resolve overlap before outcome collection');
assert.ok(!sample.selected.some(item => item.candidateId === 'owner-controlled-agent-reference'));
assert.equal(sample.guardrails.selectionUsesResolverOutput, false);
assert.equal(sample.guardrails.selectionUsesProtocolOutcome, false);
assert.equal(sample.guardrails.selectedFailuresAreNotSilentlyReplaced, true);

const reordered = selectStratifiedSample({ ...manifest, candidates: [...manifest.candidates].reverse() }, plan);
assert.deepEqual(
  reordered.selected.map(item => [item.candidateId, item.assignedStratum, item.selectionKey]),
  sample.selected.map(item => [item.candidateId, item.assignedStratum, item.selectionKey]),
  'selection must not depend on candidate manifest ordering'
);

const leakingManifest = structuredClone(manifest);
leakingManifest.candidates[0].resolverOutcome = 'correct';
const leakingValidation = validateCandidateManifest(leakingManifest, plan);
assert.equal(leakingValidation.valid, false);
assert.ok(leakingValidation.errors.some(error => /forbidden outcome field/.test(error)));

const badPlan = structuredClone(plan);
badPlan.representativeOfPublicWeb = true;
assert.equal(validateSamplingPlan(badPlan).valid, false);

console.log('PASS stratified sampling contract freezes an outcome-independent candidate frame, deterministically assigns one stratum per host, retains failures/duplicates/shortfalls, and excludes owner-controlled references from the independent aggregate');
