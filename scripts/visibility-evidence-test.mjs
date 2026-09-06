import assert from 'node:assert/strict';
import { compareVisibilitySnapshots, formatVisibilityComparison, summarizeVisibilitySnapshot, validateVisibilitySnapshot } from '../lib/visibility-evidence.mjs';

const before = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/visibility-snapshot.schema.json',
  version: '0.1',
  site: 'https://example.com/',
  capturedAt: '2026-09-05T10:00:00Z',
  period: { start: '2026-08-01', end: '2026-08-31' },
  sources: [
    { provider: 'google-search-console-generative-ai', status: 'observed', metrics: { aiImpressions: 3200 }, evidence: 'https://evidence.example/google-before.csv' },
    { provider: 'bing-webmaster-ai-performance', status: 'observed', metrics: { totalCitations: 18, citedPages: 7, groundingQueriesSampled: 12 }, evidence: 'https://evidence.example/bing-before.csv' },
    { provider: 'referral-analytics', status: 'observed', metrics: { referrals: 47 }, evidence: 'https://evidence.example/referrals-before.csv' }
  ],
  guardrails: { noRankingInference: true, noCausalityInference: true, aggregateDataOnly: true }
};

const after = structuredClone(before);
after.capturedAt = '2026-10-05T10:00:00Z';
after.period = { start: '2026-09-01', end: '2026-09-30' };
after.sources[0].metrics.aiImpressions = 5100;
after.sources[0].evidence = 'https://evidence.example/google-after.csv';
after.sources[1].metrics.totalCitations = 31;
after.sources[1].metrics.citedPages = 11;
delete after.sources[1].metrics.groundingQueriesSampled;
after.sources[1].evidence = 'https://evidence.example/bing-after.csv';
after.sources[2].metrics.referrals = 35;
after.sources[2].evidence = 'https://evidence.example/referrals-after.csv';

assert.equal(validateVisibilitySnapshot(before).valid, true);
assert.equal(validateVisibilitySnapshot(after).valid, true);
const summary = summarizeVisibilitySnapshot(before);
assert.equal(summary.valid, true);
assert.equal(summary.metrics['google-search-console-generative-ai'].aiImpressions, 3200);
assert.equal(summary.metrics['bing-webmaster-ai-performance'].totalCitations, 18);
assert.equal(summary.providers[0].evidence, 'https://evidence.example/google-before.csv', 'summary must retain source provenance');

const comparison = compareVisibilitySnapshots(before, after);
assert.equal(comparison.valid, true);
const change = (provider, metric) => comparison.changes.find(item => item.provider === provider && item.metric === metric);
assert.equal(change('google-search-console-generative-ai', 'aiImpressions').delta, 1900, 'positive movement must be preserved');
assert.equal(change('bing-webmaster-ai-performance', 'totalCitations').delta, 13);
assert.equal(change('referral-analytics', 'referrals').delta, -12, 'negative movement must be preserved');
assert.equal(change('bing-webmaster-ai-performance', 'groundingQueriesSampled').comparable, false, 'missing after metric must remain non-comparable rather than becoming zero');
assert.equal(change('bing-webmaster-ai-performance', 'groundingQueriesSampled').after, null);
assert.equal(comparison.periodCompatibility.orderedNonOverlapping, true);
assert.equal(comparison.periodCompatibility.sameLength, false, 'different-length windows remain visible');
assert.equal(comparison.sourceEvidence.before[0].evidence, 'https://evidence.example/google-before.csv');
assert.equal(comparison.sourceEvidence.after[0].evidence, 'https://evidence.example/google-after.csv');
assert.equal(comparison.guardrails.noCausalityInference, true);
assert.equal(comparison.guardrails.preserveNegativeResults, true);
assert.match(comparison.interpretation, /do not prove/i);
const formatted = formatVisibilityComparison(comparison);
assert.match(formatted, /-12\s+referral-analytics referrals/);
assert.match(formatted, /Evidence:/);
assert.match(formatted, /google-before\.csv/);

const mismatch = structuredClone(after);
mismatch.site = 'https://other.example/';
assert.equal(compareVisibilitySnapshots(before, mismatch).valid, false);

const invalid = structuredClone(before);
invalid.guardrails.noCausalityInference = false;
assert.equal(validateVisibilitySnapshot(invalid).valid, false, 'measurement contract must forbid causal inference mode');

const inverted = structuredClone(before);
inverted.period = { start: '2026-09-01', end: '2026-08-01' };
assert.equal(validateVisibilitySnapshot(inverted).valid, false, 'inverted periods must not validate');

const overlapping = structuredClone(after);
overlapping.period = { start: '2026-08-15', end: '2026-09-14' };
const incompatible = compareVisibilitySnapshots(before, overlapping);
assert.equal(incompatible.valid, false, 'overlapping before/after windows must be rejected as incompatible longitudinal periods');
assert.match(incompatible.errors[0].errors[0], /incompatible before\/after periods/);

console.log('PASS visibility evidence preserves provenance, positive/negative/missing results and rejects incompatible longitudinal windows without causality inference');
