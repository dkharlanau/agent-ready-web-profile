import assert from 'node:assert/strict';
import { canonicalJson, sha256Digest } from '../lib/evidence-receipt.mjs';
import { buildTransformationBundle } from '../lib/transformation-engine.mjs';
import { compileBraidGraph } from '../lib/braid-graph.mjs';
import {
  createChangeReceipt,
  reviseChangeReceipt,
  verifyChangeReceipt,
  verifyChangeReceiptRevision
} from '../lib/change-receipt.mjs';
import {
  reviseChangeReceiptWithTransitionEvidence,
  inspectGitHubTransitionEvidence
} from '../lib/change-receipt-transition.mjs';

const upgrade = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/adaptive-upgrade-graph.schema.json',
  version: '0.1',
  generatedAt: '2026-09-07T17:00:00.000Z',
  site: 'https://example.com/',
  context: { verticals: ['general'], goals: ['search'] },
  knowledge: { registryVersion: 'fixture', ruleset: 'fixture', reviewedAt: '2026-09-07', current: 1, reviewDue: 0 },
  summary: { recommended: 1, conditional: 0, reviewDue: 0, byPriority: { P1: 1 }, byAutomationClass: { mechanical: 1 } },
  sourceDebt: { actionIds: [], verticalCheckIds: [] },
  recommendations: [{
    id: 'canonical-discovery',
    title: 'Canonical fixture',
    priority: 'P1',
    lane: 'search',
    state: 'recommended',
    knowledgeState: 'current',
    authority: 'primary-platform-guidance',
    reason: 'Fixture.',
    condition: null,
    sources: ['https://example.org/guidance'],
    change: { automationClass: 'mechanical', targets: ['canonical-link'], recipe: ['Update canonical.'] },
    verification: { checks: ['re-run canonical audit'], successState: 'canonical observed' },
    measurement: { signals: ['visibility'], ownerDataRequired: true },
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

const bundle = buildTransformationBundle(upgrade, {
  repository: { fullName: 'example/site', baseRef: 'main', baseCommitSha: 'a'.repeat(40) },
  allowedPaths: ['index.html'],
  operations: [{
    recommendationId: 'canonical-discovery',
    operation: 'replace-file',
    path: 'index.html',
    beforeContent: '<title>Before</title>\n',
    content: '<title>Before</title><link rel="canonical" href="https://example.com/">\n'
  }]
}, { generatedAt: '2026-09-07T17:01:00.000Z' });
const graph = compileBraidGraph({ upgradeGraph: upgrade, transformationBundle: bundle });
const bundleDigest = sha256Digest(canonicalJson(bundle));
const operation = bundle.operations[0];

const prExecution = {
  version: '0.1',
  repository: 'example/site',
  base: 'main',
  baseCommitSha: 'a'.repeat(40),
  branch: 'arwp/fixture-change',
  commitSha: 'b'.repeat(40),
  pullRequest: { number: 42, url: 'https://github.com/example/site/pull/42' },
  sourceBundleSha256: bundleDigest,
  operations: [{
    path: operation.path,
    recommendationId: operation.recommendationId,
    beforeSha256: operation.precondition.sha256,
    afterSha256: operation.after.sha256
  }],
  guardrails: { directBaseWrite: false, forcePush: false, newBranchOnly: true, mergePerformed: false, rankingImpactClaimed: false }
};

const prOpened = createChangeReceipt(bundle, graph, {
  createdAt: '2026-09-07T17:02:00.000Z',
  execution: { kind: 'github-pr', receipt: prExecution, observedAt: '2026-09-07T17:02:00.000Z' }
});
assert.equal(prOpened.mutation.state, 'pr-opened');
assert.equal(verifyChangeReceipt(prOpened).valid, true);
assert.equal(inspectGitHubTransitionEvidence(prOpened).complete, false);

// Backward compatibility: the pre-hardening generic revision remains schema/integrity valid.
const legacyMerged = reviseChangeReceipt(prOpened, {
  mutation: {
    state: 'merged',
    observedAt: '2026-09-07T17:10:00.000Z',
    evidence: { mergeCommitSha: 'c'.repeat(40), pullRequest: 42 }
  }
}, { createdAt: '2026-09-07T17:10:00.000Z' });
assert.equal(legacyMerged.mutation.state, 'merged');
assert.equal(legacyMerged.mutation.github.mergeCommitSha, undefined);
assert.equal(verifyChangeReceipt(legacyMerged).valid, true, 'historical receipts without hardening fields must remain valid');
assert.equal(verifyChangeReceiptRevision(prOpened, legacyMerged).valid, true);

assert.throws(
  () => reviseChangeReceiptWithTransitionEvidence(prOpened, {
    mutation: { state: 'merged', mergeCommitSha: 'c'.repeat(40), mergedAt: '2026-09-07T17:10:00.000Z' }
  }, { createdAt: '2026-09-07T17:10:00.000Z' }),
  /requires at least one explicit evidenceRef/
);

const merged = reviseChangeReceiptWithTransitionEvidence(prOpened, {
  mutation: {
    state: 'merged',
    mergeCommitSha: 'c'.repeat(40),
    mergedAt: '2026-09-07T17:10:00.000Z',
    mergeUrl: 'https://github.com/example/site/pull/42',
    evidenceRefs: ['github-pr:42:merged']
  }
}, { createdAt: '2026-09-07T17:10:00.000Z' });
assert.equal(merged.mutation.state, 'merged');
assert.equal(merged.mutation.github.mergeCommitSha, 'c'.repeat(40));
assert.equal(merged.mutation.github.mergedAt, '2026-09-07T17:10:00.000Z');
assert.deepEqual(merged.mutation.github.mergeEvidenceRefs, ['github-pr:42:merged', 'https://github.com/example/site/pull/42']);
assert.equal(verifyChangeReceipt(merged).valid, true);
assert.equal(verifyChangeReceiptRevision(prOpened, merged).valid, true);
let inspected = inspectGitHubTransitionEvidence(merged);
assert.equal(inspected.complete, true);
assert.equal(inspected.github.pullRequestNumber, 42);
assert.equal(inspected.github.mergeCommitSha, 'c'.repeat(40));

assert.throws(
  () => reviseChangeReceiptWithTransitionEvidence(prOpened, {
    mutation: { state: 'deployed', observedAt: '2026-09-07T17:20:00.000Z' },
    deployment: {
      state: 'deployed',
      observedAt: '2026-09-07T17:20:00.000Z',
      commitSha: 'c'.repeat(40),
      url: 'https://example.com/',
      evidenceRefs: ['deployment:fixture']
    }
  }, { createdAt: '2026-09-07T17:20:00.000Z' }),
  /requires inspectable merge evidence/
);

assert.throws(
  () => reviseChangeReceiptWithTransitionEvidence(merged, {
    mutation: { state: 'deployed', observedAt: '2026-09-07T17:20:00.000Z' },
    deployment: {
      state: 'deployed',
      observedAt: '2026-09-07T17:20:00.000Z',
      commitSha: 'd'.repeat(40),
      url: 'https://example.com/',
      evidenceRefs: ['deployment:fixture']
    }
  }, { createdAt: '2026-09-07T17:20:00.000Z' }),
  /does not match recorded merge commit/
);

assert.throws(
  () => reviseChangeReceiptWithTransitionEvidence(merged, {
    mutation: { state: 'deployed', observedAt: '2026-09-07T17:20:00.000Z' },
    deployment: {
      state: 'deployed',
      observedAt: '2026-09-07T17:20:00.000Z',
      commitSha: 'c'.repeat(40),
      url: 'https://example.com/',
      evidenceRefs: []
    }
  }, { createdAt: '2026-09-07T17:20:00.000Z' }),
  /requires explicit deployment evidence/
);

const deployed = reviseChangeReceiptWithTransitionEvidence(merged, {
  mutation: { state: 'deployed', observedAt: '2026-09-07T17:20:00.000Z' },
  deployment: {
    state: 'deployed',
    observedAt: '2026-09-07T17:20:00.000Z',
    commitSha: 'c'.repeat(40),
    url: 'https://example.com/',
    evidenceRefs: ['github-pages:deployment-123']
  }
}, { createdAt: '2026-09-07T17:20:00.000Z' });
assert.equal(deployed.mutation.state, 'deployed');
assert.equal(deployed.deployment.commitSha, deployed.mutation.github.mergeCommitSha);
assert.equal(verifyChangeReceipt(deployed).valid, true);
assert.equal(verifyChangeReceiptRevision(merged, deployed).valid, true);
inspected = inspectGitHubTransitionEvidence(deployed);
assert.equal(inspected.complete, true);
assert.equal(inspected.deployment.evidenceRefs[0], 'github-pages:deployment-123');

const tampered = structuredClone(deployed);
tampered.mutation.github.mergeCommitSha = 'd'.repeat(40);
assert.equal(verifyChangeReceipt(tampered).valid, false, 'merge evidence is covered by receipt content identity');

console.log('Change Receipt merge/deployment hardening tests passed');
