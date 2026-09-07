import assert from 'node:assert/strict';
import {
  canonicalBraidJson,
  braidSha256,
  compileBraidGraph,
  validateBraidGraph,
  explainBraidGraph,
  impactBraidGraph,
  missingBraidEvidence
} from '../lib/braid-graph.mjs';

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
  summary: { operations: 1, files: 1, bytes: 54, gatedRecommendations: 0, byOperation: { 'replace-exact': 1 } },
  operations: [
    {
      id: 'canonical-discovery:index.html:replace-exact:123456789abc',
      recommendationId: 'canonical-discovery',
      automationClass: 'mechanical',
      operation: 'replace-exact',
      path: 'index.html',
      mediaType: 'text/html',
      precondition: { exists: true, sha256: `sha256:${'b'.repeat(64)}`, match: '<head>', matchCount: 1 },
      after: { sha256: `sha256:${'c'.repeat(64)}`, content: '<head><link rel="canonical" href="https://example.com/">' },
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
const validation = validateBraidGraph(graph);
assert.equal(validation.valid, true, JSON.stringify(validation.errors));
assert.equal(graph.summary.byNodeType.source, 1);
assert.equal(graph.summary.byNodeType.rule, 1);
assert.equal(graph.summary.byNodeType.recommendation, 1);
assert.equal(graph.summary.byNodeType.transform, 1);
assert.equal(graph.summary.byNodeType['repo-file'], 1);
assert.equal(graph.summary.byNodeType.policy, 1);
assert.equal(graph.summary.transforms, 1);
assert.equal(graph.summary.verifiedTransforms, 0);
assert.equal(graph.summary.measuredTransforms, 0);

const explained = explainBraidGraph(graph, { path: 'index.html' });
assert.ok(explained.lineage.nodes.some(node => node.type === 'source'));
assert.ok(explained.lineage.nodes.some(node => node.type === 'rule'));
assert.ok(explained.lineage.nodes.some(node => node.type === 'recommendation'));
assert.ok(explained.lineage.nodes.some(node => node.type === 'transform'));

const impact = impactBraidGraph(graph, { rule: 'canonical-discovery' });
assert.ok((impact.affected.byType.recommendation || []).length >= 1);
assert.ok((impact.affected.byType.transform || []).length >= 1);
assert.ok((impact.affected.byType['repo-file'] || []).length >= 1);

const missing = missingBraidEvidence(graph);
assert.equal(missing.transforms, 1);
assert.equal(missing.missingVerification, 1);
assert.equal(missing.missingOutcomeMeasurement, 1);

const operationId = transformationBundle.operations[0].id;
const evidencedGraph = compileBraidGraph({
  upgradeGraph,
  transformationBundle,
  verifications: [
    {
      id: 'verify-1',
      transformOperationId: operationId,
      status: 'passed',
      observedAt: '2026-09-07T12:06:00.000Z',
      kind: 'test',
      evidence: ['npm test passed']
    }
  ],
  measurements: [
    {
      id: 'measure-1',
      target: { type: 'transform', ref: operationId },
      status: 'observed',
      observedAt: '2026-09-07T12:07:00.000Z',
      kind: 'owner-search-observation',
      provider: 'fixture',
      metric: 'visibility',
      value: 1,
      evidenceClass: 'owner'
    }
  ]
});
const complete = missingBraidEvidence(evidencedGraph);
assert.equal(evidencedGraph.summary.verifiedTransforms, 1);
assert.equal(evidencedGraph.summary.measuredTransforms, 1);
assert.equal(complete.complete, 1);
assert.equal(complete.queue.length, 0);

const invalid = structuredClone(graph);
invalid.edges.push({
  id: 'edge:dangling-test',
  type: 'supports',
  from: 'source:does-not-exist',
  to: invalid.nodes.find(node => node.type === 'rule').id,
  state: 'active',
  observedAt: null,
  provenance: []
});
assert.equal(validateBraidGraph(invalid).valid, false);

console.log('BraidGraph tests passed');
