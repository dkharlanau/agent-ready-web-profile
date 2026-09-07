import assert from 'node:assert/strict';
import { validateBraidGraph, findBraidNode, impactBraidGraph, missingBraidEvidence } from '../lib/braid-graph.mjs';
import { enrichBraidHistory, revisionDigest } from '../lib/braid-history.mjs';

const sourceId = 'source:current-guidance:111111111111';
const ruleId = 'rule:canonical-discovery:222222222222';
const recommendationId = 'recommendation:canonical-discovery:333333333333';
const transformId = 'transform:canonical-op:444444444444';
const measurementId = 'measurement:negative:555555555555';

const base = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/braid-graph.schema.json',
  version: '0.1',
  generatedAt: '2026-09-07T12:00:00.000Z',
  site: 'https://example.com/',
  repository: null,
  inputs: {
    adaptiveUpgrade: {
      kind: 'adaptive-upgrade-graph',
      version: '0.1',
      generatedAt: '2026-09-07T12:00:00.000Z',
      digest: `sha256:${'a'.repeat(64)}`
    }
  },
  nodes: [
    {
      id: sourceId,
      type: 'source',
      versionKey: '2026-09-07',
      state: 'review-due',
      data: { url: 'https://example.org/guidance', reviewedAt: '2026-09-07', authority: 'primary' },
      provenance: [{ artifact: 'adaptive-upgrade-graph', ref: 'canonical-discovery' }]
    },
    {
      id: ruleId,
      type: 'rule',
      versionKey: '0.2:2026-09-07',
      state: 'review-due',
      data: { ruleId: 'canonical-discovery', title: 'Canonical discovery', sourceReviewedAt: '2026-09-07' },
      provenance: [{ artifact: 'adaptive-upgrade-graph', ref: 'canonical-discovery' }]
    },
    {
      id: recommendationId,
      type: 'recommendation',
      versionKey: `sha256:${'a'.repeat(64)}`,
      state: 'recommended',
      data: { recommendationId: 'canonical-discovery', knowledgeState: 'review-due' },
      provenance: [{ artifact: 'adaptive-upgrade-graph', ref: 'canonical-discovery' }]
    },
    {
      id: transformId,
      type: 'transform',
      versionKey: `sha256:${'b'.repeat(64)}`,
      state: 'planned',
      data: { operationId: 'canonical-op', path: 'index.html' },
      provenance: [{ artifact: 'transformation-bundle', ref: 'canonical-op' }]
    },
    {
      id: measurementId,
      type: 'measurement',
      versionKey: '2026-09-07T12:10:00.000Z',
      state: 'negative',
      data: { kind: 'owner-search-observation', evidenceClass: 'owner', value: -1 },
      provenance: [{ artifact: 'measurement-evidence', ref: 'negative-1' }]
    }
  ],
  edges: [
    {
      id: 'edge:supports:1',
      type: 'supports',
      from: sourceId,
      to: ruleId,
      state: 'review-due',
      observedAt: '2026-09-07T12:00:00.000Z',
      provenance: [{ artifact: 'adaptive-upgrade-graph', ref: 'canonical-discovery' }]
    },
    {
      id: 'edge:applies-to:1',
      type: 'applies-to',
      from: ruleId,
      to: recommendationId,
      state: 'recommended',
      observedAt: '2026-09-07T12:00:00.000Z',
      provenance: [{ artifact: 'adaptive-upgrade-graph', ref: 'canonical-discovery' }]
    },
    {
      id: 'edge:implements:1',
      type: 'implements',
      from: transformId,
      to: recommendationId,
      state: 'planned',
      observedAt: '2026-09-07T12:05:00.000Z',
      provenance: [{ artifact: 'transformation-bundle', ref: 'canonical-op' }]
    },
    {
      id: 'edge:observes:1',
      type: 'observes',
      from: measurementId,
      to: transformId,
      state: 'negative',
      observedAt: '2026-09-07T12:10:00.000Z',
      provenance: [{ artifact: 'measurement-evidence', ref: 'negative-1' }]
    }
  ],
  summary: {
    nodes: 5,
    edges: 4,
    byNodeType: { source: 1, rule: 1, recommendation: 1, transform: 1, measurement: 1 },
    byEdgeType: { supports: 1, 'applies-to': 1, implements: 1, observes: 1 },
    reviewDueRules: 1,
    transforms: 1,
    verifiedTransforms: 0,
    measuredTransforms: 1
  },
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

assert.equal(validateBraidGraph(base).valid, true);

const revisions = [
  {
    id: 'rule-revision-2026-09-07',
    entityType: 'rule',
    currentRef: 'canonical-discovery',
    previousVersionKey: '0.1:2026-08-01',
    previousState: 'superseded',
    observedAt: '2026-09-07T12:20:00.000Z',
    previousData: { sourceReviewedAt: '2026-08-01' },
    evidence: ['https://example.org/guidance#revision']
  },
  {
    id: 'source-revision-2026-09-07',
    entityType: 'source',
    currentRef: 'https://example.org/guidance',
    previousVersionKey: '2026-08-01',
    previousState: 'superseded',
    observedAt: '2026-09-07T12:20:00.000Z',
    previousData: { reviewedAt: '2026-08-01' },
    evidence: ['https://example.org/guidance#revision']
  }
];

const enriched = enrichBraidHistory(base, revisions);
const validation = validateBraidGraph(enriched);
assert.equal(validation.valid, true, JSON.stringify(validation.errors));
assert.equal(enriched.generatedAt, '2026-09-07T12:20:00.000Z');
assert.equal(enriched.summary.byEdgeType.supersedes, 2);
assert.equal(enriched.nodes.filter(node => node.state === 'superseded').length, 2);
assert.equal(enriched.nodes.filter(node => node.type === 'rule' && node.state === 'review-due').length, 1);
assert.equal(enriched.nodes.find(node => node.id === measurementId).state, 'negative');

// Human selectors must resolve the current version even though historical nodes keep the same rule/source identity.
assert.equal(findBraidNode(enriched, { rule: 'canonical-discovery' })?.id, ruleId);
assert.equal(findBraidNode(enriched, { source: 'https://example.org/guidance' })?.id, sourceId);

const ruleImpact = impactBraidGraph(enriched, { rule: 'canonical-discovery' });
assert.ok(ruleImpact.affected.nodes.some(node => node.type === 'recommendation'));
assert.ok(ruleImpact.affected.nodes.some(node => node.type === 'transform'));
assert.ok(ruleImpact.affected.nodes.some(node => node.type === 'measurement' && node.state === 'negative'));
assert.ok(ruleImpact.affected.nodes.some(node => node.type === 'rule' && node.state === 'superseded'));

const sourceImpact = impactBraidGraph(enriched, { source: 'https://example.org/guidance' });
assert.ok(sourceImpact.affected.nodes.some(node => node.id === ruleId));
assert.ok(sourceImpact.affected.nodes.some(node => node.type === 'source' && node.state === 'superseded'));
assert.ok(sourceImpact.affected.nodes.some(node => node.type === 'recommendation'));

const missing = missingBraidEvidence(enriched);
assert.equal(missing.missingVerification, 1);
assert.equal(missing.missingOutcomeMeasurement, 0);
assert.equal(missing.queue[0].missing.includes('verification'), true);
assert.equal(missing.queue[0].missing.includes('outcome-measurement'), false);

assert.equal(revisionDigest(revisions), revisionDigest(structuredClone(revisions)));
assert.match(revisionDigest(revisions), /^sha256:[0-9a-f]{64}$/);

assert.throws(
  () => enrichBraidHistory(base, [{ ...revisions[0], previousVersionKey: base.nodes.find(node => node.type === 'rule').versionKey }]),
  /equals the current node versionKey/
);
assert.throws(
  () => enrichBraidHistory(base, [{ ...revisions[0], currentRef: 'missing-rule' }]),
  /not found/
);

console.log('BraidGraph history tests passed');
