import assert from 'node:assert/strict';
import { compareVisibilitySnapshots, summarizeVisibilitySnapshot, validateVisibilitySnapshot } from '../lib/visibility-evidence.mjs';

const before = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/visibility-snapshot.schema.json',
  version: '0.1',
  site: 'https://example.com/',
  capturedAt: '2026-09-05T10:00:00Z',
  period: { start: '2026-08-01', end: '2026-08-31' },
  sources: [
    { provider: 'google-search-console-generative-ai', status: 'observed', metrics: { aiImpressions: 3200 } },
    { provider: 'bing-webmaster-ai-performance', status: 'observed', metrics: { totalCitations: 18, citedPages: 7, groundingQueriesSampled: 12 } },
    { provider: 'referral-analytics', status: 'observed', metrics: { referrals: 47 } }
  ],
  guardrails: { noRankingInference: true, noCausalityInference: true, aggregateDataOnly: true }
};

const after = structuredClone(before);
after.capturedAt = '2026-10-05T10:00:00Z';
after.period = { start: '2026-09-01', end: '2026-09-30' };
after.sources[0].metrics.aiImpressions = 5100;
after.sources[1].metrics.totalCitations = 31;
after.sources[1].metrics.citedPages = 11;
after.sources[1].metrics.groundingQueriesSampled = 17;
after.sources[2].metrics.referrals = 83;

assert.equal(validateVisibilitySnapshot(before).valid, true);
assert.equal(validateVisibilitySnapshot(after).valid, true);
const summary = summarizeVisibilitySnapshot(before);
assert.equal(summary.valid, true);
assert.equal(summary.metrics['google-search-console-generative-ai'].aiImpressions, 3200);
assert.equal(summary.metrics['bing-webmaster-ai-performance'].totalCitations, 18);

const comparison = compareVisibilitySnapshots(before, after);
assert.equal(comparison.valid, true);
const change = (provider, metric) => comparison.changes.find(item => item.provider === provider && item.metric === metric);
assert.equal(change('google-search-console-generative-ai', 'aiImpressions').delta, 1900);
assert.equal(change('bing-webmaster-ai-performance', 'totalCitations').delta, 13);
assert.equal(change('referral-analytics', 'referrals').delta, 36);
assert.equal(comparison.guardrails.noCausalityInference, true);
assert.equal(comparison.guardrails.preserveNegativeResults, true);
assert.match(comparison.interpretation, /do not prove/i);

const mismatch = structuredClone(after);
mismatch.site = 'https://other.example/';
assert.equal(compareVisibilitySnapshots(before, mismatch).valid, false);

const invalid = structuredClone(before);
invalid.guardrails.noCausalityInference = false;
assert.equal(validateVisibilitySnapshot(invalid).valid, false, 'measurement contract must forbid causal inference mode');

const inverted = structuredClone(before);
inverted.period = { start: '2026-09-01', end: '2026-08-01' };
assert.equal(validateVisibilitySnapshot(inverted).valid, false, 'inverted periods must not validate');

console.log('PASS visibility evidence records aggregate AI-search signals and compares deltas without ranking or causality inference');
