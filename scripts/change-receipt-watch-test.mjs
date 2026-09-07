import assert from 'node:assert/strict';
import { validateBraidGraph } from '../lib/braid-graph.mjs';
import {
  buildWatchProofQueueBundle,
  validateWatchProofQueueBundle,
  formatWatchProofQueueBundle
} from '../lib/change-receipt-watch.mjs';

const DIGEST = `sha256:${'a'.repeat(64)}`;

function summarize(nodes, edges) {
  const byNodeType = {};
  const byEdgeType = {};
  for (const node of nodes) byNodeType[node.type] = (byNodeType[node.type] || 0) + 1;
  for (const edge of edges) byEdgeType[edge.type] = (byEdgeType[edge.type] || 0) + 1;
  return {
    nodes: nodes.length,
    edges: edges.length,
    byNodeType,
    byEdgeType,
    reviewDueRules: 0,
    transforms: 0,
    verifiedTransforms: 0,
    measuredTransforms: 0
  };
}

function receiptNode(id, index, {
  changeKey = 'change-a',
  revision = 1,
  mutationState = 'merged',
  verificationStatus = 'unknown',
  deploymentState = 'unknown',
  outcomeStatus = 'unknown',
  reReviewRequired = false,
  reviewDecision = 'pending'
} = {}) {
  const receiptHex = String(index + 1).padStart(64, String((index + 1) % 10));
  const changeHex = changeKey === 'change-a' ? 'f'.repeat(64) : 'd'.repeat(64);
  return {
    id: `change-receipt:${id}:${index}`,
    type: 'change-receipt',
    versionKey: `urn:sha256:${receiptHex.slice(-64)}`,
    state: mutationState,
    data: {
      receiptId: `urn:sha256:${receiptHex.slice(-64)}`,
      changeId: `urn:sha256:${changeHex}`,
      revision,
      previousReceiptId: null,
      mutationState,
      verificationStatus,
      deploymentState,
      outcomeStatus,
      reReviewRequired,
      reviewDecision,
      evidenceReceiptIds: [],
      payloadDigest: `sha256:${'e'.repeat(64)}`
    },
    provenance: [{ artifact: 'fixture', ref: `${id}:${index}` }]
  };
}

function graph(id, receiptSpecs = []) {
  const nodes = receiptSpecs.map((spec, index) => receiptNode(id, index, spec));
  const edges = [];
  const value = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/braid-graph.schema.json',
    version: '0.1',
    generatedAt: '2026-09-07T18:30:00.000Z',
    site: `https://${id}.example/`,
    repository: { fullName: `owner/${id}`, baseRef: 'main', baseCommitSha: 'a'.repeat(40) },
    inputs: { adaptiveUpgrade: { kind: 'adaptive-upgrade-graph', version: '0.1', generatedAt: '2026-09-07T18:00:00.000Z', digest: DIGEST } },
    nodes,
    edges,
    summary: summarize(nodes, edges),
    guardrails: {
      graphIsIndexNotAuthority: true,
      recommendationIsNotAuthorization: true,
      verificationIsNotOutcome: true,
      measurementIsNotCausality: true,
      historyIsVersioned: true,
      ownerEvidenceMayRemainPrivate: true,
      noRankingGuarantee: true
    }
  };
  const validation = validateBraidGraph(value);
  assert.equal(validation.valid, true, `${id}: ${JSON.stringify(validation.errors)}`);
  return value;
}

const critical = graph('critical', [
  { revision: 1, mutationState: 'merged', verificationStatus: 'unknown', outcomeStatus: 'unknown' },
  { revision: 2, mutationState: 'deployed', deploymentState: 'deployed', verificationStatus: 'failed', outcomeStatus: 'unknown', reReviewRequired: true }
]);
const highGap = graph('high-gap', [
  { changeKey: 'change-b', revision: 1, mutationState: 'pr-opened', verificationStatus: 'unknown', outcomeStatus: 'unknown' }
]);
const measured = graph('measured', [
  { revision: 1, mutationState: 'deployed', deploymentState: 'deployed', verificationStatus: 'passed', outcomeStatus: 'positive', reviewDecision: 'keep' }
]);
const empty = graph('empty', []);
const disabled = graph('disabled', [
  { revision: 1, mutationState: 'merged', verificationStatus: 'failed', outcomeStatus: 'unknown' }
]);

const bundle = buildWatchProofQueueBundle([
  { id: 'critical', graph: critical, importance: 'critical', enabled: true, portfolioSiteId: 'portfolio-critical' },
  { id: 'high-gap', graph: highGap, importance: 'high', enabled: true },
  { id: 'measured', graph: measured, importance: 'normal', enabled: true },
  { id: 'empty', graph: empty, importance: 'normal', enabled: true },
  { id: 'disabled', graph: disabled, importance: 'critical', enabled: false }
], {
  generatedAt: '2026-09-07T19:00:00.000Z',
  portfolio: {
    sites: [{ id: 'portfolio-critical', canonicalUrl: critical.site, repository: 'owner/critical', name: 'Critical portfolio site' }]
  }
});

let validation = validateWatchProofQueueBundle(bundle);
assert.equal(validation.valid, true, JSON.stringify(validation.errors));
assert.equal(bundle.mode, 'change-receipt-queues');
assert.equal(bundle.summary.targets, 5);
assert.equal(bundle.summary.enabledTargets, 4);
assert.equal(bundle.summary.sitesWithAttention, 2);
assert.equal(bundle.summary.changesWithAttention, 2);
assert.equal(bundle.attention.length, 2, 'latest revisions are deduplicated by changeId');

const criticalRow = bundle.attention.find(row => row.siteId === 'critical');
assert.equal(criticalRow.revision, 2);
assert.equal(criticalRow.priority, 'P0');
assert.equal(criticalRow.portfolioSiteId, 'portfolio-critical');
assert.equal(criticalRow.portfolioName, 'Critical portfolio site');
assert.deepEqual(criticalRow.queues, ['failedVerification', 'reReviewRequired', 'mergedButUnmeasured']);
assert.deepEqual(criticalRow.reasons.map(reason => reason.classification), ['verification-failure', 'knowledge-re-review', 'measurement-gap']);
assert.ok(criticalRow.priorityFactors.includes('queue:failedVerification'));
assert.match(criticalRow.rationale, /not proof of Search\/AI outcome impact/i);

const gapRow = bundle.attention.find(row => row.siteId === 'high-gap');
assert.equal(gapRow.priority, 'P1');
assert.deepEqual(gapRow.queues, ['missingVerification']);
assert.equal(gapRow.reasons[0].classification, 'verification-gap');

assert.equal(bundle.excludedSites.find(row => row.siteId === 'measured').reason, 'no-proof-queue-items');
assert.equal(bundle.excludedSites.find(row => row.siteId === 'empty').reason, 'no-change-receipts');
assert.equal(bundle.excludedSites.find(row => row.siteId === 'disabled').reason, 'disabled');
assert.equal(bundle.interpretation.productionMutationAuthorized, false);
assert.equal(bundle.interpretation.missingOutcomeIsUnknownNotZero, true);

const text = formatWatchProofQueueBundle(bundle);
assert.match(text, /Proof queues/);
assert.match(text, /P0 · critical · verification-failure/);
assert.match(text, /failedVerification, reReviewRequired, mergedButUnmeasured/);
assert.match(text, /do not authorize production mutation/i);

const tampered = structuredClone(bundle);
tampered.interpretation.productionMutationAuthorized = true;
validation = validateWatchProofQueueBundle(tampered);
assert.equal(validation.valid, false);

assert.throws(
  () => buildWatchProofQueueBundle([{ id: 'bad', graph: measured, importance: 'urgent', enabled: true }]),
  /Invalid Watch target importance/
);

console.log('SignalBraid Watch Change Receipt portfolio queue tests passed');
