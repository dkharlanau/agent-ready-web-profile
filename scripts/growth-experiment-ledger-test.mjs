import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGrowthSnapshot } from '../lib/growth-history.mjs';
import { createGrowthExperiment, evaluateGrowthExperiment, reviewGrowthExperiment } from '../lib/growth-experiment.mjs';
import { loadGrowthExperimentLedger } from '../lib/growth-experiment-ledger.mjs';

const hypothesisRegistry = { hypotheses: [{ id: 'test-ledger-hypothesis' }] };
const basePlan = {
  profile: '2026-09-06', canonicalUrl: 'https://example.com/',
  observations: {
    entity: { present: false, sameAs: 0, types: [] },
    localSitemap: { ok: true, validLastmodCount: 2 },
    contentSignal: { observed: false, values: {} },
    article: { count: 1, missingAuthor: 0, missingDateModified: 0 },
    media: { images: 1, videos: 0, openGraphImage: true }
  },
  actions: [{ id: 'growth:ledger-action', priority: 'P1', lane: 'measurement', status: 'recommended', title: 'Ledger action', source: 'https://source.example/ledger', reason: 'test action' }]
};
const afterPlan = structuredClone(basePlan);
afterPlan.actions = [];
const beforeGrowth = createGrowthSnapshot(basePlan, { observedAt: '2026-09-01T08:00:00Z', toolVersion: '0.2.0' });
const afterGrowth = createGrowthSnapshot(afterPlan, { observedAt: '2026-09-20T08:00:00Z', toolVersion: '0.2.0' });
const beforeVisibility = {
  version: '0.1', site: 'https://example.com/', capturedAt: '2026-09-01T09:00:00Z',
  period: { start: '2026-08-01', end: '2026-08-31' },
  sources: [{ provider: 'referral-analytics', status: 'observed', metrics: { referrals: 5 } }],
  guardrails: { noRankingInference: true, noCausalityInference: true, aggregateDataOnly: true }
};
const afterVisibility = {
  version: '0.1', site: 'https://example.com/', capturedAt: '2026-10-01T09:00:00Z',
  period: { start: '2026-09-01', end: '2026-09-30' },
  sources: [{ provider: 'referral-analytics', status: 'observed', metrics: { referrals: 4 } }],
  guardrails: { noRankingInference: true, noCausalityInference: true, aggregateDataOnly: true }
};

function create(id, implementation = null) {
  return createGrowthExperiment({
    id,
    hypothesisId: 'test-ledger-hypothesis',
    actionIds: ['growth:ledger-action'],
    beforeGrowthSnapshot: beforeGrowth,
    createdAt: `2026-09-0${id.endsWith('1') ? '1' : id.endsWith('2') ? '2' : id.endsWith('3') ? '3' : '4'}T10:00:00Z`,
    implementation,
    hypothesisRegistry
  });
}

const planned = create('ledger-exp-1');
const implemented = create('ledger-exp-2', { commitSha: 'abcdef2', implementedAt: '2026-09-02T11:00:00Z' });
const measuredBase = create('ledger-exp-3', { commitSha: 'abcdef3', implementedAt: '2026-09-03T11:00:00Z' });
const measured = evaluateGrowthExperiment(measuredBase, {
  beforeGrowthSnapshot: beforeGrowth,
  afterGrowthSnapshot: afterGrowth,
  beforeVisibilitySnapshot: beforeVisibility,
  afterVisibilitySnapshot: afterVisibility,
  evaluatedAt: '2026-10-01T10:00:00Z'
});
const reviewedBase = create('ledger-exp-4', { commitSha: 'abcdef4', implementedAt: '2026-09-04T11:00:00Z' });
const reviewedMeasured = evaluateGrowthExperiment(reviewedBase, {
  beforeGrowthSnapshot: beforeGrowth,
  afterGrowthSnapshot: afterGrowth,
  beforeVisibilitySnapshot: beforeVisibility,
  afterVisibilitySnapshot: afterVisibility,
  evaluatedAt: '2026-10-01T10:05:00Z'
});
const reviewed = reviewGrowthExperiment(reviewedMeasured, {
  decision: 'revise', reviewedAt: '2026-10-02T10:00:00Z', notes: 'Negative owner-side observation retained; revise rather than hide it.'
});

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-growth-ledger-'));
try {
  for (const experiment of [planned, implemented, measured, reviewed]) {
    fs.writeFileSync(path.join(temp, `${experiment.id}.json`), `${JSON.stringify(experiment, null, 2)}\n`);
  }
  fs.writeFileSync(path.join(temp, 'broken.json'), '{not-json');

  const ledger = loadGrowthExperimentLedger(temp, { site: 'https://example.com/' });
  assert.equal(ledger.summary.total, 4);
  assert.equal(ledger.summary.awaitingImplementation, 1);
  assert.equal(ledger.summary.awaitingMeasurement, 1);
  assert.equal(ledger.summary.awaitingReview, 1);
  assert.equal(ledger.summary.reviewed, 1);
  assert.equal(ledger.summary.attentionRequired, 3);
  assert.equal(ledger.summary.invalid, 1);
  assert.deepEqual(ledger.attention.map(item => item.attention).sort(), ['awaiting-implementation', 'awaiting-measurement', 'awaiting-review']);
  assert.equal(ledger.experiments.find(item => item.id === reviewed.id).reviewDecision, 'revise');
  assert.equal(ledger.experiments.find(item => item.id === measured.id).outcomeState, 'negative-observation');
  assert.match(ledger.convention.defaultDirectory, /\.arwp-evidence\/growth\/experiments/);

  const empty = loadGrowthExperimentLedger(path.join(temp, 'missing'));
  assert.equal(empty.summary.total, 0);
  assert.equal(empty.summary.attentionRequired, 0);
  assert.equal(empty.summary.invalid, 0);

  console.log('PASS managed Growth experiment ledger surfaces implementation, measurement and review queues while preserving invalid evidence diagnostics');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
