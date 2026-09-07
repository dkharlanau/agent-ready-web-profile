import assert from 'node:assert/strict';
import { validateBraidGraph } from '../lib/braid-graph.mjs';
import { buildWatchImpactBundle, validateWatchImpactBundle, formatWatchImpactBundle } from '../lib/braid-watch.mjs';

const DIGEST = `sha256:${'a'.repeat(64)}`;

function summary(nodes, edges) {
  const byNodeType = {};
  const byEdgeType = {};
  for (const node of nodes) byNodeType[node.type] = (byNodeType[node.type] || 0) + 1;
  for (const edge of edges) byEdgeType[edge.type] = (byEdgeType[edge.type] || 0) + 1;
  return {
    nodes: nodes.length,
    edges: edges.length,
    byNodeType,
    byEdgeType,
    reviewDueRules: nodes.filter(node => node.type === 'rule' && node.state === 'review-due').length,
    transforms: nodes.filter(node => node.type === 'transform').length,
    verifiedTransforms: 0,
    measuredTransforms: 0
  };
}

function makeGraph(id, {
  ruleId = 'canonical-discovery',
  sourceUrl = 'https://example.org/guidance',
  ruleState = 'current',
  withEvent = false,
  withTransform = false,
  withReceipt = false,
  automationClass = 'mechanical',
  outcomeStatus = 'negative'
} = {}) {
  const site = `https://${id}.example/`;
  const sourceId = `source:${id}`;
  const ruleNodeId = `rule:${id}`;
  const oldRuleId = `historical:rule:${id}`;
  const recommendationId = `recommendation:${id}`;
  const transformId = `transform:${id}`;
  const fileId = `repo-file:${id}`;
  const surfaceId = `surface:${id}`;
  const receiptId = `change-receipt:${id}`;
  const measurementId = `measurement:${id}`;
  const nodes = [
    {
      id: sourceId,
      type: 'source',
      versionKey: '2026-09-07',
      state: 'current',
      data: { url: sourceUrl, authority: 'primary' },
      provenance: [{ artifact: 'fixture', ref: `${id}:source` }]
    },
    {
      id: ruleNodeId,
      type: 'rule',
      versionKey: '0.2:2026-09-07',
      state: ruleState,
      data: { ruleId, title: 'Fixture rule' },
      provenance: [{ artifact: 'fixture', ref: `${id}:rule` }]
    },
    {
      id: recommendationId,
      type: 'recommendation',
      versionKey: DIGEST,
      state: 'recommended',
      data: { recommendationId: ruleId, automationClass },
      provenance: [{ artifact: 'fixture', ref: `${id}:recommendation` }]
    }
  ];
  const edges = [
    {
      id: `edge:supports:${id}`,
      type: 'supports',
      from: sourceId,
      to: ruleNodeId,
      state: ruleState,
      observedAt: '2026-09-07T12:00:00.000Z',
      provenance: [{ artifact: 'fixture', ref: `${id}:supports` }]
    },
    {
      id: `edge:applies:${id}`,
      type: 'applies-to',
      from: ruleNodeId,
      to: recommendationId,
      state: 'recommended',
      observedAt: '2026-09-07T12:00:00.000Z',
      provenance: [{ artifact: 'fixture', ref: `${id}:applies` }]
    }
  ];

  if (withEvent) {
    nodes.push({
      id: oldRuleId,
      type: 'rule',
      versionKey: '0.1:2026-08-01',
      state: 'superseded',
      data: { ruleId, title: 'Prior fixture rule', historical: true, supersededBy: ruleNodeId },
      provenance: [{ artifact: 'fixture-history', ref: `${id}:old-rule` }]
    });
    edges.push({
      id: `edge:supersedes:${id}`,
      type: 'supersedes',
      from: ruleNodeId,
      to: oldRuleId,
      state: 'recorded-revision',
      observedAt: '2026-09-07T15:00:00.000Z',
      provenance: [{ artifact: 'fixture-history', ref: `${id}:revision` }]
    });
  }

  if (withTransform) {
    nodes.push(
      {
        id: transformId,
        type: 'transform',
        versionKey: `sha256:${'b'.repeat(64)}`,
        state: 'planned',
        data: { operationId: `operation-${id}`, path: 'index.html', beforeSha256: `sha256:${'c'.repeat(64)}`, afterSha256: `sha256:${'d'.repeat(64)}` },
        provenance: [{ artifact: 'fixture-transform', ref: `${id}:transform` }]
      },
      {
        id: fileId,
        type: 'repo-file',
        versionKey: `sha256:${'c'.repeat(64)}`,
        state: 'mapped',
        data: { repository: `owner/${id}`, path: 'index.html', beforeSha256: `sha256:${'c'.repeat(64)}`, plannedAfterSha256: `sha256:${'d'.repeat(64)}` },
        provenance: [{ artifact: 'fixture-transform', ref: `${id}:file` }]
      },
      {
        id: surfaceId,
        type: 'surface',
        versionKey: 'fixture-surface',
        state: 'observed',
        data: { surfaceKey: 'canonical:/', routePath: '/' },
        provenance: [{ artifact: 'fixture-map', ref: `${id}:surface` }]
      }
    );
    edges.push(
      {
        id: `edge:implements:${id}`,
        type: 'implements',
        from: transformId,
        to: recommendationId,
        state: 'planned',
        observedAt: '2026-09-07T13:00:00.000Z',
        provenance: [{ artifact: 'fixture-transform', ref: `${id}:implements` }]
      },
      {
        id: `edge:mutates:${id}`,
        type: 'mutates',
        from: transformId,
        to: fileId,
        state: 'planned',
        observedAt: '2026-09-07T13:00:00.000Z',
        provenance: [{ artifact: 'fixture-transform', ref: `${id}:mutates` }]
      },
      {
        id: `edge:renders:${id}`,
        type: 'renders',
        from: fileId,
        to: surfaceId,
        state: 'resolved',
        observedAt: '2026-09-07T13:00:00.000Z',
        provenance: [{ artifact: 'fixture-map', ref: `${id}:renders` }]
      }
    );
  }

  if (withReceipt) {
    nodes.push(
      {
        id: receiptId,
        type: 'change-receipt',
        versionKey: `urn:sha256:${'e'.repeat(64)}`,
        state: 'merged',
        data: {
          receiptId: `urn:sha256:${'e'.repeat(64)}`,
          changeId: `urn:sha256:${'f'.repeat(64)}`,
          revision: 3,
          mutationState: 'merged',
          verificationStatus: 'passed',
          deploymentState: 'unknown',
          outcomeStatus,
          reReviewRequired: true,
          reviewDecision: 'keep'
        },
        provenance: [{ artifact: 'change-receipt', ref: `urn:sha256:${'e'.repeat(64)}` }]
      },
      {
        id: measurementId,
        type: 'measurement',
        versionKey: '2026-10-01T00:00:00.000Z',
        state: outcomeStatus,
        data: { kind: 'owner-search-observation', evidenceClass: 'owner', value: -1 },
        provenance: [{ artifact: 'change-receipt', ref: `${id}:measurement` }]
      }
    );
    edges.push(
      {
        id: `edge:receipt-depends:${id}`,
        type: 'depends-on',
        from: receiptId,
        to: transformId,
        state: 'records-exact-transform',
        observedAt: '2026-09-07T14:00:00.000Z',
        provenance: [{ artifact: 'change-receipt', ref: `${id}:receipt` }]
      },
      {
        id: `edge:measurement:${id}`,
        type: 'observes',
        from: measurementId,
        to: receiptId,
        state: outcomeStatus,
        observedAt: '2026-10-01T00:00:00.000Z',
        provenance: [{ artifact: 'change-receipt', ref: `${id}:measurement-edge` }]
      }
    );
  }

  const graph = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/braid-graph.schema.json',
    version: '0.1',
    generatedAt: '2026-10-01T00:00:00.000Z',
    site,
    repository: { fullName: `owner/${id}`, baseRef: 'main', baseCommitSha: 'a'.repeat(40) },
    inputs: { adaptiveUpgrade: { kind: 'adaptive-upgrade-graph', version: '0.1', generatedAt: '2026-09-07T12:00:00.000Z', digest: DIGEST } },
    nodes,
    edges,
    summary: summary(nodes, edges),
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
  const validation = validateBraidGraph(graph);
  assert.equal(validation.valid, true, `${id}: ${JSON.stringify(validation.errors)}`);
  return graph;
}

const changedExecuted = makeGraph('changed-executed', { withEvent: true, withTransform: true, withReceipt: true });
const changedOwner = makeGraph('changed-owner', { withEvent: true, automationClass: 'policy-gated' });
const unchanged = makeGraph('unchanged', { withTransform: true });
const disabled = makeGraph('disabled', { withEvent: true, withTransform: true });

const changedBundle = buildWatchImpactBundle([
  { id: 'changed-executed', graph: changedExecuted, importance: 'critical', enabled: true, portfolioSiteId: 'portfolio-a' },
  { id: 'changed-owner', graph: changedOwner, importance: 'normal', enabled: true },
  { id: 'unchanged', graph: unchanged, importance: 'normal', enabled: true },
  { id: 'disabled', graph: disabled, importance: 'high', enabled: false }
], { changedSince: '2026-09-07T14:00:00.000Z' }, {
  generatedAt: '2026-10-01T12:00:00.000Z',
  portfolio: {
    sites: [{ id: 'portfolio-a', canonicalUrl: changedExecuted.site, repository: 'owner/changed-executed', name: 'Portfolio A', rollout: { enabled: true, mode: 'managed-issue' } }]
  }
});

let validation = validateWatchImpactBundle(changedBundle);
assert.equal(validation.valid, true, JSON.stringify(validation.errors));
assert.equal(changedBundle.mode, 'changed-since');
assert.equal(changedBundle.summary.targets, 4);
assert.equal(changedBundle.summary.impactedSites, 2);
assert.equal(changedBundle.summary.excludedSites, 2);
assert.equal(changedBundle.triggerEvents.length, 2);
assert.equal(changedBundle.impacts.some(row => row.siteId === 'unchanged'), false);
assert.equal(changedBundle.excludedSites.find(row => row.siteId === 'unchanged').reason, 'no-recorded-change-since');
assert.equal(changedBundle.excludedSites.find(row => row.siteId === 'disabled').reason, 'disabled');

const executedImpact = changedBundle.impacts.find(row => row.siteId === 'changed-executed');
assert.equal(executedImpact.classification, 'likely-update');
assert.equal(executedImpact.priority, 'P0');
assert.equal(executedImpact.portfolioSiteId, 'portfolio-a');
assert.deepEqual(executedImpact.repoPaths, ['index.html']);
assert.ok(executedImpact.surfaces.includes('canonical:/'));
assert.equal(executedImpact.changeReceipts.length, 1);
assert.equal(executedImpact.changeReceipts[0].outcomeStatus, 'negative', 'negative/no-change evidence remains visible in Watch');
assert.equal(executedImpact.changeReceipts[0].reviewDecision, 'keep');
assert.ok(executedImpact.historicalEvidenceNodeIds.some(id => id.startsWith('historical:rule:')));
assert.ok(executedImpact.priorityFactors.includes('executed-change-present'));

const ownerImpact = changedBundle.impacts.find(row => row.siteId === 'changed-owner');
assert.equal(ownerImpact.classification, 'blocked-owner-review');
assert.equal(ownerImpact.priority, 'P2');
assert.ok(ownerImpact.ownerReviewReasons.includes('recommendation:canonical-discovery:policy-gated'));
assert.equal(ownerImpact.transforms.length, 0);

const reviewDue = makeGraph('review-due', { ruleState: 'review-due', withTransform: true, withReceipt: true });
const reviewBundle = buildWatchImpactBundle([
  { id: 'review-due', graph: reviewDue, importance: 'high', enabled: true },
  { id: 'unaffected', graph: makeGraph('unaffected', { ruleId: 'different-rule' }), importance: 'normal', enabled: true }
], { rule: 'canonical-discovery' }, { generatedAt: '2026-10-01T12:00:00.000Z' });
assert.equal(reviewBundle.impacts.length, 1);
assert.equal(reviewBundle.impacts[0].classification, 're-review');
assert.equal(reviewBundle.impacts[0].priority, 'P1');
assert.equal(reviewBundle.excludedSites[0].reason, 'trigger-not-present');

const retired = makeGraph('retired', { ruleState: 'retired', withTransform: true, withReceipt: true });
const retiredBundle = buildWatchImpactBundle([
  { id: 'retired', graph: retired, importance: 'normal', enabled: true }
], { rule: 'canonical-discovery' }, { generatedAt: '2026-10-01T12:00:00.000Z' });
assert.equal(retiredBundle.impacts[0].classification, 'retire-candidate');
assert.equal(retiredBundle.impacts[0].priority, 'P1');

const sourceBundle = buildWatchImpactBundle([
  { id: 'changed-executed', graph: changedExecuted, importance: 'normal', enabled: true }
], { source: 'https://example.org/guidance' }, { generatedAt: '2026-10-01T12:00:00.000Z' });
assert.equal(sourceBundle.impacts.length, 1);
assert.equal(sourceBundle.triggerEvents[0].nodeType, 'source');

assert.throws(
  () => buildWatchImpactBundle([{ id: 'x', graph: unchanged, importance: 'normal', enabled: true }], { rule: 'a', source: 'https://example.org/guidance' }),
  /exactly one|either changedSince/
);
assert.throws(
  () => buildWatchImpactBundle([{ id: 'x', graph: unchanged, importance: 'unknown', enabled: true }], { rule: 'canonical-discovery' }),
  /Invalid Watch target importance/
);

const text = formatWatchImpactBundle(changedBundle);
assert.match(text, /P0 · changed-executed · likely-update/);
assert.match(text, /changed-owner · blocked-owner-review/);
assert.match(text, /does not prove breakage/i);

console.log('SignalBraid Watch multi-site blast-radius tests passed');
