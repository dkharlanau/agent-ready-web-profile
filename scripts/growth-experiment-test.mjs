import assert from 'node:assert/strict';
import { createGrowthSnapshot } from '../lib/growth-history.mjs';
import {
  createGrowthExperiment,
  evaluateGrowthExperiment,
  formatGrowthExperiment,
  reviewGrowthExperiment,
  validateGrowthExperiment
} from '../lib/growth-experiment.mjs';

const hypothesisRegistry = { hypotheses: [{ id: 'test-entity-hypothesis' }] };
const basePlan = {
  profile: '2026-09-06',
  canonicalUrl: 'https://example.com/',
  observations: {
    entity: { present: false, sameAs: 0, types: [] },
    localSitemap: { ok: true, validLastmodCount: 3 },
    contentSignal: { observed: false, values: {} },
    article: { count: 1, missingAuthor: 0, missingDateModified: 0 },
    media: { images: 1, videos: 0, openGraphImage: true }
  },
  actions: [
    { id: 'growth:entity-identity', priority: 'P1', lane: 'entity-identity', status: 'recommended', title: 'Publish entity identity', source: 'https://source.example/entity', reason: 'identity evidence is incomplete' },
    { id: 'growth:measurement', priority: 'P1', lane: 'measurement', status: 'external-owner-data', title: 'Collect owner evidence', source: 'https://source.example/measurement', reason: 'owner data required' }
  ]
};

const afterPlan = structuredClone(basePlan);
afterPlan.observations.entity = { present: true, sameAs: 2, types: ['organization'] };
afterPlan.actions = [basePlan.actions[1]];

const beforeGrowth = createGrowthSnapshot(basePlan, { observedAt: '2026-09-06T08:00:00Z', toolVersion: '0.2.0' });
const afterGrowth = createGrowthSnapshot(afterPlan, { observedAt: '2026-09-20T08:00:00Z', toolVersion: '0.2.0' });

const beforeVisibility = {
  version: '0.1',
  site: 'https://example.com/',
  capturedAt: '2026-09-06T09:00:00Z',
  period: { start: '2026-08-23', end: '2026-09-05' },
  sources: [{ provider: 'referral-analytics', status: 'observed', metrics: { referrals: 5 } }],
  guardrails: { noRankingInference: true, noCausalityInference: true, aggregateDataOnly: true }
};
const afterVisibility = {
  version: '0.1',
  site: 'https://example.com/',
  capturedAt: '2026-09-20T09:00:00Z',
  period: { start: '2026-09-06', end: '2026-09-19' },
  sources: [{ provider: 'referral-analytics', status: 'observed', metrics: { referrals: 8 } }],
  guardrails: { noRankingInference: true, noCausalityInference: true, aggregateDataOnly: true }
};

const experiment = createGrowthExperiment({
  id: 'exp-entity-001',
  hypothesisId: 'test-entity-hypothesis',
  actionIds: ['growth:entity-identity'],
  beforeGrowthSnapshot: beforeGrowth,
  beforeVisibilitySnapshot: beforeVisibility,
  createdAt: '2026-09-06T09:05:00Z',
  implementation: { commitSha: 'abcdef1', implementedAt: '2026-09-06T10:00:00Z' },
  hypothesisRegistry
});

assert.equal(experiment.version, '0.1');
assert.equal(experiment.status, 'implemented');
assert.equal(experiment.guardrails.noCausalityInference, true);
assert.equal(validateGrowthExperiment(experiment).valid, true);

const evaluated = evaluateGrowthExperiment(experiment, {
  beforeGrowthSnapshot: beforeGrowth,
  afterGrowthSnapshot: afterGrowth,
  beforeVisibilitySnapshot: beforeVisibility,
  afterVisibilitySnapshot: afterVisibility,
  evaluatedAt: '2026-09-20T10:00:00Z'
});

assert.equal(evaluated.status, 'measured');
assert.equal(evaluated.evaluation.outcomeState, 'positive-observation');
assert.equal(evaluated.evaluation.visibility.comparableMetrics, 1);
assert.equal(evaluated.evaluation.visibility.positive, 1);
assert.equal(evaluated.evaluation.implementationDiff.highPriorityDebtDelta, -1);
assert.deepEqual(evaluated.evaluation.actionResults, [{ id: 'growth:entity-identity', state: 'resolved' }]);
assert.equal(evaluated.evaluation.reviewRequired, true);
assert.match(evaluated.evaluation.interpretation, /does not prove/i);
assert.match(formatGrowthExperiment(evaluated), /positive-observation/);

const reviewed = reviewGrowthExperiment(evaluated, {
  decision: 'keep',
  reviewedAt: '2026-09-20T11:00:00Z',
  notes: 'Keep the implementation, continue observing longer-term owner metrics.'
});
assert.equal(reviewed.status, 'reviewed');
assert.equal(reviewed.review.decision, 'keep');
assert.equal(validateGrowthExperiment(reviewed).valid, true);

assert.throws(() => createGrowthExperiment({
  id: 'exp-bad-action',
  hypothesisId: 'test-entity-hypothesis',
  actionIds: ['growth:not-active'],
  beforeGrowthSnapshot: beforeGrowth,
  hypothesisRegistry
}), /not active/);

assert.throws(() => evaluateGrowthExperiment(experiment, {
  beforeGrowthSnapshot: beforeGrowth,
  afterGrowthSnapshot: afterGrowth,
  beforeVisibilitySnapshot: beforeVisibility
}), /must be supplied together/);

console.log('PASS Growth experiments link a known hypothesis and active action to implementation-state and optional owner evidence while preserving review and no-causality guardrails');
