import assert from 'node:assert/strict';
import { createGrowthSnapshot, diffGrowthSnapshots, formatGrowthDiff } from '../lib/growth-history.mjs';

const basePlan = {
  profile: '2026-09-06',
  canonicalUrl: 'https://example.com/',
  guardrails: { noRankingPromise: true },
  observations: {
    entity: { present: false, sameAs: 0, types: [] },
    localSitemap: { ok: true, validLastmodCount: 4 },
    contentSignal: { observed: false, values: {} },
    article: { count: 1, missingAuthor: 1, missingDateModified: 1 },
    media: { images: 0, videos: 0, openGraphImage: false }
  },
  actions: [
    { id: 'growth:entity-identity', priority: 'P1', lane: 'entity-identity', status: 'recommended', title: 'Publish entity identity', source: 'https://source/entity', reason: 'missing identity' },
    { id: 'growth:article-authorship', priority: 'P1', lane: 'content-quality', status: 'recommended', title: 'Fix authorship', source: 'https://source/article', reason: 'missing author' },
    { id: 'growth:multiformat', priority: 'P2', lane: 'citation', status: 'recommended', title: 'Add useful visual evidence', source: 'https://source/media', reason: 'no media' }
  ]
};

const afterPlan = structuredClone(basePlan);
afterPlan.observations.entity = { present: true, sameAs: 2, types: ['person'] };
afterPlan.observations.article.missingAuthor = 0;
afterPlan.observations.media.images = 2;
afterPlan.actions = [
  { id: 'growth:multiformat', priority: 'P2', lane: 'citation', status: 'recommended', title: 'Add useful visual evidence', source: 'https://source/media', reason: 'media exists but expand diagrams' },
  { id: 'growth:google-generative-ai-measurement-global', priority: 'P1', lane: 'measurement', status: 'external-owner-data', title: 'Measure generative Search', source: 'https://source/measure', reason: 'owner data required' }
];

const before = createGrowthSnapshot(basePlan, { observedAt: '2026-09-06T06:00:00Z', toolVersion: '0.2.0' });
const after = createGrowthSnapshot(afterPlan, { observedAt: '2026-09-13T06:00:00Z', toolVersion: '0.2.0' });
assert.equal(before.snapshotVersion, '0.1');
assert.match(before.snapshotId, /^urn:sha256:[a-f0-9]{64}$/);
assert.equal(before.debt.p1, 2);
assert.equal(before.debt.highPriority, 2);
assert.equal(after.debt.p1, 1);
assert.equal(after.debt.highPriority, 1);
assert.equal(before.guardrails.snapshotTracksImplementationStateNotRanking, true);

const diff = diffGrowthSnapshots(before, after);
assert.equal(diff.summary.actionsResolved, 2);
assert.equal(diff.summary.actionsAdded, 1);
assert.equal(diff.summary.actionsChanged, 1, 'multiformat reason digest changed');
assert.equal(diff.summary.p1Delta, -1);
assert.equal(diff.summary.highPriorityDebtDelta, -1);
assert.equal(diff.summary.highPriorityResolved, 2);
assert.equal(diff.summary.highPriorityAdded, 1);
assert.equal(diff.interpretation.implementationStateImproved, true);
assert.ok(diff.resolved.some(item => item.id === 'growth:entity-identity'));
assert.ok(diff.resolved.some(item => item.id === 'growth:article-authorship'));
assert.ok(diff.added.some(item => item.id === 'growth:google-generative-ai-measurement-global'));
assert.ok(diff.observationChanges.some(item => item.path === 'entity.present'));
assert.ok(diff.observationChanges.some(item => item.path === 'media.images'));
assert.match(formatGrowthDiff(diff), /High-priority debt: 2 → 1/);
assert.match(formatGrowthDiff(diff), /does not prove better rankings/i);

const reordered = structuredClone(basePlan);
reordered.actions.reverse();
const same = createGrowthSnapshot(reordered, { observedAt: '2026-09-06T06:00:00Z', toolVersion: '0.2.0' });
assert.equal(same.snapshotId, before.snapshotId, 'action input order must not change a deterministic snapshot with identical observedAt');

const wrong = structuredClone(after);
wrong.canonicalUrl = 'https://other.example/';
assert.throws(() => diffGrowthSnapshots(before, wrong), /different canonical URLs/);

console.log('PASS Growth history creates deterministic snapshots and reports resolved/new/changed implementation debt without converting backlog reduction into a ranking claim');
