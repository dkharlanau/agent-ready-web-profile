import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEvidenceReceipt } from '../lib/evidence-receipt.mjs';
import { canonicalJson as transformCanonicalJson, sha256, applyTransformationToDirectory, rollbackTransformationReceipt, LOCAL_TRANSFORM_AUTHORIZATION } from '../lib/transformation-engine.mjs';
import { compileBraidGraph, braidSha256, canonicalBraidJson, validateBraidGraph, explainBraidGraph, impactBraidGraph } from '../lib/braid-graph.mjs';
import {
  createChangeReceipt,
  reviseChangeReceipt,
  validateChangeReceipt,
  verifyChangeReceipt,
  verifyChangeReceiptRevision,
  changeReceiptStatus
} from '../lib/change-receipt.mjs';
import { mergeChangeReceiptIntoBraidGraph, changeReceiptBraidReport } from '../lib/change-receipt-braid.mjs';

const before = '<!doctype html><html><head><title>Original Fixture</title></head><body>Before</body></html>\n';
const after = '<!doctype html><html><head><title>Original Fixture</title><link rel="canonical" href="https://example.com/"></head><body>Before</body></html>\n';

const upgradeGraph = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/adaptive-upgrade-graph.schema.json',
  version: '0.1',
  generatedAt: '2026-09-07T12:00:00.000Z',
  site: 'https://example.com/',
  context: { verticals: ['general'], goals: ['search'] },
  knowledge: { registryVersion: '0.1', ruleset: '2026.09', reviewedAt: '2026-09-07', current: 1, reviewDue: 0 },
  summary: { recommended: 1, conditional: 0, reviewDue: 0, byPriority: { P1: 1 }, byAutomationClass: { mechanical: 1 } },
  sourceDebt: { actionIds: [], verticalCheckIds: [] },
  recommendations: [
    {
      id: 'canonical-discovery',
      title: 'Expose one canonical page identity',
      priority: 'P1',
      lane: 'search',
      state: 'recommended',
      knowledgeState: 'current',
      authority: 'primary-platform-guidance',
      reason: 'Canonical identity is unresolved in the target fixture.',
      condition: null,
      sources: ['https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls'],
      change: { automationClass: 'mechanical', targets: ['canonical-link'], recipe: ['Wire the reviewed canonical URL into the owning source file.'] },
      verification: { checks: ['re-run canonical audit'], successState: 'canonical observed' },
      measurement: { signals: ['index coverage'], ownerDataRequired: true },
      dependencies: [],
      addresses: { actionIds: [], verticalCheckIds: [] },
      evidence: []
    }
  ],
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

const upgradeDigest = braidSha256(canonicalBraidJson(upgradeGraph));
const operationId = 'canonical-discovery:index.html:replace-file:fixture1234';
const transformationBundle = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/transformation-bundle.schema.json',
  version: '0.1',
  generatedAt: '2026-09-07T12:05:00.000Z',
  site: upgradeGraph.site,
  repository: { fullName: 'example/site', baseRef: 'main', baseCommitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  sourceUpgrade: { version: '0.1', generatedAt: upgradeGraph.generatedAt, sha256: upgradeDigest, selectedRecommendationIds: ['canonical-discovery'] },
  policy: {
    delivery: 'production-pr-first',
    allowedPaths: ['index.html'],
    blockedPrefixes: ['.git/', '.github/workflows/', '.github/actions/'],
    maxFiles: 25,
    maxTotalBytes: 2097152
  },
  summary: { operations: 1, files: 1, bytes: Buffer.byteLength(after), gatedRecommendations: 0, byOperation: { 'replace-file': 1 } },
  operations: [
    {
      id: operationId,
      recommendationId: 'canonical-discovery',
      automationClass: 'mechanical',
      operation: 'replace-file',
      path: 'index.html',
      mediaType: 'text/html',
      precondition: { exists: true, sha256: sha256(before) },
      after: { sha256: sha256(after), content: after },
      groundedEvidence: [],
      verification: ['re-run canonical audit'],
      humanReviewRequired: false
    }
  ],
  gatedRecommendations: [],
  guardrails: {
    explicitPathAllowlist: true,
    digestPreconditions: true,
    noDirectMainWrite: true,
    newBranchOnly: true,
    noForcePush: true,
    policyChangesNeverAutoPromoted: true,
    editorialChangesNeverAutoPromoted: true,
    ownerPlatformChangesNeverAutoPromoted: true,
    runtimeChangesNeverAutoPromoted: true,
    reviewDueKnowledgeNeverExecutes: true,
    noRankingGuarantee: true
  }
};

const graph = compileBraidGraph({ upgradeGraph, transformationBundle });
assert.equal(validateBraidGraph(graph).valid, true);

const evidenceReceipt = createEvidenceReceipt({
  target: 'https://example.com/',
  canonicalUrl: 'https://example.com/',
  resolverVersion: '0.1',
  summary: { sourcesAttempted: 0, sourcesResolved: 0, interfacesResolved: 0 },
  sources: [],
  plans: {},
  conflicts: [],
  metrics: {},
  upstreamStatus: {}
}, { observedAt: '2026-09-07T12:04:00.000Z' });

const planned = createChangeReceipt(transformationBundle, graph, {
  createdAt: '2026-09-07T12:10:00.000Z',
  evidenceReceipts: [{ receipt: evidenceReceipt, role: 'pre-change-resolver-observation' }]
});
assert.equal(validateChangeReceipt(planned).valid, true);
assert.equal(verifyChangeReceipt(planned).valid, true);
assert.equal(planned.revision, 1);
assert.equal(planned.previousReceiptId, null);
assert.equal(planned.mutation.state, 'planned');
assert.equal(planned.verification.status, 'unknown');
assert.equal(planned.outcomes.status, 'unknown');
assert.equal(planned.source.evidenceReceipts.length, 1);
assert.equal(planned.source.evidenceReceipts[0].receiptId, evidenceReceipt.receiptId);
assert.equal('sources' in planned.source.evidenceReceipts[0], false, 'full Resolver receipt payload must not be duplicated');
assert.equal(planned.outcomes.expectedSignals.includes('index coverage'), true);
assert.equal(changeReceiptStatus(planned).missing.includes('outcome-evidence'), true);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-change-receipt-'));
fs.writeFileSync(path.join(tmp, 'index.html'), before, 'utf8');
const localExecution = applyTransformationToDirectory(transformationBundle, {
  rootDir: tmp,
  authorization: LOCAL_TRANSFORM_AUTHORIZATION,
  appliedAt: '2026-09-07T12:11:00.000Z'
});
const applied = createChangeReceipt(transformationBundle, graph, {
  createdAt: '2026-09-07T12:12:00.000Z',
  execution: { kind: 'local', receipt: localExecution }
});
assert.equal(applied.mutation.state, 'applied-local');
assert.equal(applied.mutation.rollback.state, 'private-material-available');
assert.equal(JSON.stringify(applied).includes('Before</body>'), false, 'Change Receipt must not embed rollback/source content');
assert.equal(applied.boundaries.rollbackContentEmbedded, false);

const rollbackEvidence = rollbackTransformationReceipt(localExecution, {
  rootDir: tmp,
  authorization: LOCAL_TRANSFORM_AUTHORIZATION,
  rolledBackAt: '2026-09-07T12:13:00.000Z'
});
const rolledBack = reviseChangeReceipt(applied, {
  mutation: { state: 'rolled-back', observedAt: '2026-09-07T12:13:00.000Z', evidence: rollbackEvidence },
  review: { decision: 'revert', reviewedAt: '2026-09-07T12:14:00.000Z', note: 'Fixture rollback review.' }
}, { createdAt: '2026-09-07T12:14:00.000Z' });
assert.equal(rolledBack.revision, 2);
assert.equal(rolledBack.previousReceiptId, applied.receiptId);
assert.equal(rolledBack.mutation.state, 'rolled-back');
assert.equal(rolledBack.mutation.rollback.state, 'performed');
assert.equal(verifyChangeReceiptRevision(applied, rolledBack).valid, true);

const bundleDigest = planned.source.transformationBundle.digest;
const prEvidence = {
  version: '0.1',
  repository: transformationBundle.repository.fullName,
  base: transformationBundle.repository.baseRef,
  baseCommitSha: transformationBundle.repository.baseCommitSha,
  branch: 'arwp/transform-fixture',
  commitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  pullRequest: { number: 42, url: 'https://github.com/example/site/pull/42' },
  sourceBundleSha256: bundleDigest,
  operations: transformationBundle.operations.map(item => ({
    path: item.path,
    recommendationId: item.recommendationId,
    beforeSha256: item.precondition.sha256,
    afterSha256: item.after.sha256
  })),
  guardrails: { directBaseWrite: false, forcePush: false, newBranchOnly: true, mergePerformed: false, rankingImpactClaimed: false }
};

const prOpened = reviseChangeReceipt(planned, {
  execution: { kind: 'github-pr', receipt: prEvidence, observedAt: '2026-09-07T12:20:00.000Z' }
}, { createdAt: '2026-09-07T12:20:00.000Z' });
assert.equal(prOpened.mutation.state, 'pr-opened');
assert.equal(prOpened.mutation.github.pullRequestNumber, 42);
assert.equal(verifyChangeReceiptRevision(planned, prOpened).valid, true);

const merged = reviseChangeReceipt(prOpened, {
  mutation: {
    state: 'merged',
    observedAt: '2026-09-07T12:30:00.000Z',
    evidence: { mergeCommitSha: 'cccccccccccccccccccccccccccccccccccccccc', pullRequest: 42 }
  }
}, { createdAt: '2026-09-07T12:30:00.000Z' });
assert.equal(merged.mutation.state, 'merged');
assert.equal(merged.outcomes.status, 'unknown');
assert.equal(changeReceiptStatus(merged).missing.includes('outcome-evidence'), true);

const failedVerification = reviseChangeReceipt(prOpened, {
  verifications: [{
    id: 'verify-failed',
    operationId,
    status: 'failed',
    kind: 'build',
    observedAt: '2026-09-07T12:25:00.000Z',
    evidenceRefs: ['ci:failed-1']
  }]
}, { createdAt: '2026-09-07T12:25:00.000Z' });
assert.equal(failedVerification.verification.status, 'failed');

const measured = reviseChangeReceipt(merged, {
  verifications: [{
    id: 'verify-pass',
    operationId,
    status: 'passed',
    kind: 'build-and-audit',
    observedAt: '2026-09-07T12:31:00.000Z',
    evidenceRefs: ['ci:passed-1']
  }],
  deployment: {
    state: 'deployed',
    observedAt: '2026-09-07T12:35:00.000Z',
    commitSha: 'cccccccccccccccccccccccccccccccccccccccc',
    url: 'https://example.com/',
    evidenceRefs: ['deploy:fixture-1']
  },
  outcomes: [{
    id: 'outcome-negative',
    operationId,
    status: 'negative',
    kind: 'owner-search-observation',
    provider: 'owner-export',
    metric: 'visibility',
    value: -1,
    observedAt: '2026-10-07T12:00:00.000Z',
    evidenceClass: 'owner',
    evidenceRefs: ['owner-export:october']
  }],
  review: {
    decision: 'keep',
    reviewedAt: '2026-10-07T13:00:00.000Z',
    note: 'Implementation is correct; negative outcome is retained without causal interpretation.'
  }
}, { createdAt: '2026-10-07T13:00:00.000Z' });
assert.equal(measured.verification.status, 'passed');
assert.equal(measured.deployment.state, 'deployed');
assert.equal(measured.outcomes.status, 'negative');
assert.equal(measured.review.decision, 'keep');
assert.equal(changeReceiptStatus(measured).missing.includes('outcome-evidence'), false);
assert.equal(verifyChangeReceiptRevision(merged, measured).valid, true);

const changedKnowledgeGraph = structuredClone(graph);
const rule = changedKnowledgeGraph.nodes.find(node => node.type === 'rule' && node.data?.ruleId === 'canonical-discovery');
rule.versionKey = '0.2:2026-10-08';
rule.state = 'review-due';
changedKnowledgeGraph.generatedAt = '2026-10-08T10:00:00.000Z';
assert.equal(validateBraidGraph(changedKnowledgeGraph).valid, true);
const reviewDue = reviseChangeReceipt(measured, {
  braidGraph: changedKnowledgeGraph
}, { createdAt: '2026-10-08T10:05:00.000Z' });
assert.equal(reviewDue.knowledge.reReviewRequired, true);
assert.equal(reviewDue.knowledge.ruleStates[0].changed, true);
assert.equal(reviewDue.knowledge.ruleStates[0].currentState, 'review-due');
assert.equal(verifyChangeReceiptRevision(measured, reviewDue).valid, true);

let braid = mergeChangeReceiptIntoBraidGraph(graph, planned);
const plannedNode = braid.nodes.find(node => node.type === 'change-receipt' && node.data?.receiptId === planned.receiptId);
assert.ok(plannedNode);
const explained = explainBraidGraph(braid, { nodeId: plannedNode.id });
assert.ok(explained.lineage.nodes.some(node => node.type === 'transform'));
assert.ok(explained.lineage.nodes.some(node => node.type === 'rule'));
assert.ok(explained.lineage.nodes.some(node => node.type === 'source'));

braid = mergeChangeReceiptIntoBraidGraph(braid, prOpened);
braid = mergeChangeReceiptIntoBraidGraph(braid, merged);
let report = changeReceiptBraidReport(braid);
assert.equal(report.changes, 1);
assert.equal(report.queues.mergedButUnmeasured.length, 1);

braid = mergeChangeReceiptIntoBraidGraph(braid, measured);
report = changeReceiptBraidReport(braid);
assert.equal(report.queues.mergedButUnmeasured.length, 0);
assert.equal(report.latest[0].outcomeStatus, 'negative');

const impact = impactBraidGraph(braid, { rule: 'canonical-discovery' });
assert.ok((impact.affected.byType['change-receipt'] || []).length >= 1);
assert.ok((impact.affected.byType.measurement || []).length >= 1);

assert.throws(
  () => mergeChangeReceiptIntoBraidGraph(graph, prOpened),
  /Previous Change Receipt must be present/
);

const tampered = structuredClone(planned);
tampered.review.note = 'tampered';
assert.equal(verifyChangeReceipt(tampered).valid, false);

fs.rmSync(tmp, { recursive: true, force: true });
console.log('Change Receipt lifecycle and BraidGraph tests passed');
