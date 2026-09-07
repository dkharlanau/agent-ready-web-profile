import assert from 'node:assert/strict';
import { buildTransformationBundle } from '../lib/transformation-engine.mjs';
import { compileBraidGraph } from '../lib/braid-graph.mjs';
import { createChangeReceipt, reviseChangeReceipt } from '../lib/change-receipt.mjs';
import {
  visibilitySnapshotToChangeOutcomes,
  agentEvalReceiptToChangeOutcomes,
  growthExperimentToChangeReceiptUpdates,
  artifactAdapterSummary
} from '../lib/change-receipt-adapters.mjs';

const upgrade = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/adaptive-upgrade-graph.schema.json',
  version: '0.1',
  generatedAt: '2026-09-07T16:40:00.000Z',
  site: 'https://example.com/',
  context: { verticals: ['general'], goals: ['search'] },
  knowledge: { registryVersion: 'fixture', ruleset: 'fixture', reviewedAt: '2026-09-07', current: 1, reviewDue: 0 },
  summary: { recommended: 1, conditional: 0, reviewDue: 0, byPriority: { P1: 1 }, byAutomationClass: { mechanical: 1 } },
  sourceDebt: { actionIds: [], verticalCheckIds: [] },
  recommendations: [{
    id: 'canonical-discovery',
    title: 'Canonical discovery fixture',
    priority: 'P1',
    lane: 'search',
    state: 'recommended',
    knowledgeState: 'current',
    authority: 'primary-platform-guidance',
    reason: 'Fixture recommendation.',
    condition: null,
    sources: ['https://example.org/guidance'],
    change: { automationClass: 'mechanical', targets: ['canonical-link'], recipe: ['Update canonical source.'] },
    verification: { checks: ['re-run canonical audit'], successState: 'canonical observed' },
    measurement: { signals: ['visibility', 'agent-runtime'], ownerDataRequired: true },
    dependencies: [],
    addresses: { actionIds: [], verticalCheckIds: [] },
    evidence: []
  }],
  waves: [{ priority: 'P1', recommendationIds: ['canonical-discovery'] }],
  guardrails: {
    noRankingGuarantee: true,
    noInventedFacts: true,
    ownerDataSeparate: true,
    productionMutationAuthorized: false,
    staleKnowledgeNeedsReview: true,
    negativeResultsPreserved: true
  }
};

const before = '<title>Before</title>\n';
const after = '<title>Before</title><link rel="canonical" href="https://example.com/">\n';
const bundle = buildTransformationBundle(upgrade, {
  repository: { fullName: 'example/site', baseRef: 'main', baseCommitSha: 'a'.repeat(40) },
  allowedPaths: ['index.html'],
  operations: [{
    recommendationId: 'canonical-discovery',
    operation: 'replace-file',
    path: 'index.html',
    beforeContent: before,
    content: after
  }]
}, { generatedAt: '2026-09-07T16:41:00.000Z' });
const graph = compileBraidGraph({ upgradeGraph: upgrade, transformationBundle: bundle });
const receipt = createChangeReceipt(bundle, graph, { createdAt: '2026-09-07T16:42:00.000Z' });
const operationId = receipt.mutation.changes[0].operationId;

const visibility = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/visibility-snapshot.schema.json',
  version: '0.1',
  site: 'https://example.com/',
  capturedAt: '2026-10-01T12:00:00.000Z',
  period: { start: '2026-09-15', end: '2026-09-30' },
  sources: [
    {
      provider: 'bing-webmaster-ai-performance',
      status: 'observed',
      metrics: { totalCitations: 4, groundingQueriesSampled: 9 },
      evidence: 'https://example.com/private-export-reference'
    },
    {
      provider: 'manual-observation',
      status: 'partial',
      metrics: {},
      notes: 'Observed source with no comparable numeric metric.'
    },
    {
      provider: 'referral-analytics',
      status: 'unavailable',
      metrics: {}
    }
  ],
  notes: [],
  guardrails: { noRankingInference: true, noCausalityInference: true, aggregateDataOnly: true }
};

const visibilityRows = visibilitySnapshotToChangeOutcomes(receipt, visibility, { operationId });
assert.equal(visibilityRows.length, 3);
assert.equal(visibilityRows.every(row => row.status === 'observed'), true, 'single absolute snapshots must not invent direction');
assert.equal(visibilityRows.some(row => row.metric === 'totalCitations' && row.value === 4), true);
assert.equal(visibilityRows.some(row => row.metric === null && row.value.sourceStatus === 'partial'), true);
assert.equal(visibilityRows.some(row => row.provider === 'referral-analytics'), false, 'unavailable sources are not observations');
assert.equal(visibilityRows.every(row => row.evidenceRefs.some(ref => ref.startsWith('visibility-snapshot:sha256:'))), true);

const agentEval = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/agent-eval-receipt.schema.json',
  version: '0.1',
  site: 'https://example.com/',
  capturedAt: '2026-10-02T12:00:00.000Z',
  runtime: { browser: 'Chromium', browserVersion: '140', runner: 'fixture', webmcpState: 'observed-runtime' },
  tasks: [{
    id: 'find-docs',
    description: 'Find the relevant documentation page.',
    variants: [
      { mode: 'ui', success: true, interactions: 5, retries: 0, toolCalls: 0, durationMs: 2000 },
      { mode: 'webmcp', success: false, interactions: 1, retries: 1, toolCalls: 2, durationMs: 900, errors: ['fixture failure'] }
    ]
  }],
  guardrails: { sameTaskDefinition: true, noSecretsInReceipt: true, runtimeEvidenceIsNotTrust: true }
};

const agentRows = agentEvalReceiptToChangeOutcomes(receipt, agentEval, { operationId });
assert.equal(agentRows.length, 2);
assert.equal(agentRows.every(row => row.status === 'observed'), true, 'task success/failure is recorded inside the value, not relabeled as causal product impact');
assert.equal(agentRows.find(row => row.metric.endsWith('.webmcp')).value.success, false);
assert.equal(agentRows.every(row => row.evidenceClass === 'browser-runtime-agent-eval'), true);

const growthExperiment = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/growth-experiment.schema.json',
  version: '0.1',
  id: 'fixture-growth-experiment',
  site: 'https://example.com/',
  hypothesisId: 'fixture-hypothesis',
  actionIds: ['canonical-discovery'],
  createdAt: '2026-09-07T16:43:00.000Z',
  status: 'reviewed',
  implementation: {
    commitSha: 'bbbbbbb',
    changeUri: 'https://github.com/example/site/pull/42',
    implementedAt: '2026-09-08T12:00:00.000Z'
  },
  evidence: {
    beforeGrowth: { snapshotId: `urn:sha256:${'1'.repeat(64)}`, digest: `sha256:${'2'.repeat(64)}`, observedAt: '2026-09-07T12:00:00.000Z', highPriorityDebt: 2 },
    afterGrowth: { snapshotId: `urn:sha256:${'3'.repeat(64)}`, digest: `sha256:${'4'.repeat(64)}`, observedAt: '2026-09-09T12:00:00.000Z', highPriorityDebt: 1 },
    beforeVisibility: { digest: `sha256:${'5'.repeat(64)}`, capturedAt: '2026-09-07T12:00:00.000Z', period: { start: '2026-08-01', end: '2026-08-31' } },
    afterVisibility: { digest: `sha256:${'6'.repeat(64)}`, capturedAt: '2026-10-01T12:00:00.000Z', period: { start: '2026-09-01', end: '2026-09-30' } }
  },
  evaluation: {
    evaluatedAt: '2026-10-01T13:00:00.000Z',
    actionResults: [{ id: 'canonical-discovery', state: 'resolved' }],
    implementationDiff: { actionsAdded: 0, actionsResolved: 1, actionsChanged: 0, highPriorityDebtDelta: -1 },
    visibility: { comparableMetrics: 2, positive: 0, negative: 2, unchanged: 0 },
    outcomeState: 'negative-observation',
    reviewRequired: true,
    interpretation: 'Negative owner-side movement is preserved as an observation. No causal inference is made.'
  },
  review: { decision: 'continue-measuring', reviewedAt: '2026-10-01T14:00:00.000Z', notes: 'Keep measuring despite negative observation.' },
  guardrails: { noRankingGuarantee: true, noCausalityInference: true, preserveNegativeResults: true, humanReviewBeforePromotion: true }
};

const experimentUpdates = growthExperimentToChangeReceiptUpdates(receipt, growthExperiment, { operationId });
assert.equal(experimentUpdates.outcomes.length, 1);
assert.equal(experimentUpdates.outcomes[0].status, 'negative');
assert.equal(experimentUpdates.review.decision, 'continue-measuring');
assert.ok(experimentUpdates.outcomes[0].evidenceRefs.some(ref => ref.startsWith('growth-experiment:sha256:')));

const adapted = artifactAdapterSummary(receipt, {
  visibilitySnapshots: [visibility],
  agentEvalReceipts: [agentEval],
  growthExperiments: [growthExperiment],
  operationId
});
assert.equal(adapted.summary.visibilitySnapshots, 1);
assert.equal(adapted.summary.agentEvalReceipts, 1);
assert.equal(adapted.summary.growthExperiments, 1);
assert.equal(adapted.summary.outcomeObservations, 6);
assert.equal(adapted.summary.reviewImported, true);
assert.equal(adapted.interpretation.artifactsAreObservedEvidenceNotCausality, true);

const revised = reviseChangeReceipt(receipt, {
  outcomes: adapted.outcomes,
  review: adapted.review
}, { createdAt: '2026-10-02T13:00:00.000Z' });
assert.equal(revised.revision, 2);
assert.equal(revised.outcomes.observations.length, 6);
assert.equal(revised.outcomes.status, 'mixed', 'observed + negative evidence remains a mixed evidence set');
assert.equal(revised.review.decision, 'continue-measuring');

assert.throws(
  () => visibilitySnapshotToChangeOutcomes(receipt, { ...visibility, site: 'https://other.example/' }),
  /site mismatch/
);
assert.throws(
  () => agentEvalReceiptToChangeOutcomes(receipt, agentEval, { operationId: 'missing-operation' }),
  /Unknown Change Receipt operationId/
);

console.log('Change Receipt canonical artifact adapter tests passed');
