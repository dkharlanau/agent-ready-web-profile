import assert from 'node:assert/strict';
import { createTrendSnapshot, diffTrendSnapshots, formatTrendDiff } from '../lib/trend-history.mjs';

const base = {
  version: '0.1',
  snapshot: '2026-09-06',
  reviewedAt: '2026-09-06',
  trends: [
    {
      id: 'example-watch', provider: 'example', detectedAt: '2026-09-01', stage: 'watch', confidence: 'medium', maturity: 'platform-guidance',
      title: 'Example watch trend', change: 'Initial observation', whyItMatters: 'Test history behavior', source: 'https://example.com/source', sourceReviewedAt: '2026-09-06',
      surfaces: ['search'], appliesTo: ['general'], attentionWindowDays: 90, actionRefs: [], measurementRefs: [], notes: 'watch only'
    },
    {
      id: 'stable-adopt', provider: 'example', detectedAt: '2026-08-01', stage: 'adopt', confidence: 'high', maturity: 'platform-tooling',
      title: 'Stable adopt trend', change: 'Existing tooling', whyItMatters: 'Stable item', source: 'https://example.com/stable', sourceReviewedAt: '2026-09-06',
      surfaces: ['measurement'], appliesTo: ['general'], attentionWindowDays: 120, actionRefs: ['growth:measurement'], measurementRefs: ['owner-data'], notes: ''
    }
  ]
};

const next = structuredClone(base);
next.snapshot = '2026-09-13';
next.reviewedAt = '2026-09-13';
next.trends[0].stage = 'adopt';
next.trends[0].confidence = 'high';
next.trends[0].sourceReviewedAt = '2026-09-13';
next.trends[0].change = 'Primary source now documents a concrete publisher action';
next.trends.push({
  id: 'new-trend', provider: 'example', detectedAt: '2026-09-12', stage: 'watch', confidence: 'medium', maturity: 'origin-trial',
  title: 'New trend', change: 'New source observation', whyItMatters: 'Needs review', source: 'https://example.com/new', sourceReviewedAt: '2026-09-13',
  surfaces: ['agent'], appliesTo: ['software-product'], attentionWindowDays: 60, actionRefs: [], measurementRefs: [], notes: 'new'
});

const before = createTrendSnapshot(base, { observedAt: '2026-09-06T10:00:00Z', toolVersion: '0.2.0' });
const after = createTrendSnapshot(next, { observedAt: '2026-09-13T10:00:00Z', toolVersion: '0.2.0' });

assert.equal(before.snapshotVersion, '0.1');
assert.match(before.snapshotId, /^urn:sha256:[a-f0-9]{64}$/);
assert.match(before.digest, /^sha256:[a-f0-9]{64}$/);
assert.equal(before.guardrails.stageChangeIsNotOutcomeEvidence, true);

const diff = diffTrendSnapshots(before, after);
assert.equal(diff.summary.trendsBefore, 2);
assert.equal(diff.summary.trendsAfter, 3);
assert.equal(diff.summary.added, 1);
assert.equal(diff.summary.removed, 0);
assert.equal(diff.summary.changed, 1);
assert.equal(diff.summary.stageTransitions['watch->adopt'], 1);
assert.equal(diff.summary.contentChanged, 1);
assert.equal(diff.guardrails.noSilentPromotion, true);
assert.match(formatTrendDiff(diff), /watch->adopt=1/);
assert.match(formatTrendDiff(diff), /not evidence/i);

const reordered = structuredClone(base);
reordered.trends.reverse();
const same = createTrendSnapshot(reordered, { observedAt: '2026-09-06T10:00:00Z', toolVersion: '0.2.0' });
assert.equal(same.snapshotId, before.snapshotId, 'registry order must not affect an otherwise identical Trend snapshot');

const removedRegistry = structuredClone(next);
removedRegistry.trends = removedRegistry.trends.filter(item => item.id !== 'stable-adopt');
const removedSnapshot = createTrendSnapshot(removedRegistry, { observedAt: '2026-09-20T10:00:00Z', toolVersion: '0.2.0' });
const removedDiff = diffTrendSnapshots(after, removedSnapshot);
assert.equal(removedDiff.summary.removed, 1);
assert.equal(removedDiff.removed[0].id, 'stable-adopt');

console.log('PASS Trend history creates deterministic immutable state snapshots and reports additions, removals, source/content changes and stage transitions without turning lifecycle movement into outcome evidence');
