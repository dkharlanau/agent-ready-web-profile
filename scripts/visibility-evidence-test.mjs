import assert from 'node:assert/strict';
import {
  buildVisibilityFunnel,
  compareVisibilitySnapshots,
  formatVisibilityComparison,
  formatVisibilityFunnel,
  mergeVisibilitySnapshots,
  summarizeVisibilitySnapshot,
  validateVisibilitySnapshot
} from '../lib/visibility-evidence.mjs';

const before = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/visibility-snapshot.schema.json',
  version: '0.1',
  site: 'https://example.com/',
  capturedAt: '2026-09-05T10:00:00Z',
  period: { start: '2026-08-01', end: '2026-08-31' },
  sources: [
    { provider: 'google-search-console-generative-ai', status: 'observed', metrics: { aiImpressions: 3200, aiVisiblePages: 8 }, evidence: 'https://evidence.example/google-before.csv' },
    { provider: 'bing-webmaster-ai-performance', status: 'observed', metrics: { totalCitations: 18, citedPages: 6, groundingQueriesSampled: 12 }, evidence: 'https://evidence.example/bing-before.csv' },
    { provider: 'cloudflare-ai-crawl-control', status: 'observed', metrics: { aiCrawlerRequests: 100, aiCrawlerAllowedRequests: 90, aiCrawlerSuccessfulRequests: 86, aiCrawlerUnsuccessfulRequests: 14, aiCrawlerReferrals: 4 }, evidence: 'https://evidence.example/cloudflare-before.csv' },
    { provider: 'referral-analytics', status: 'observed', metrics: { referrals: 47, engagedVisits: 30, taskCompletions: 5 }, evidence: 'https://evidence.example/referrals-before.csv' }
  ],
  guardrails: { noRankingInference: true, noCausalityInference: true, aggregateDataOnly: true }
};

const after = structuredClone(before);
after.version = '0.2';
after.capturedAt = '2026-10-05T10:00:00Z';
after.period = { start: '2026-09-01', end: '2026-09-30' };
after.sources[0].metrics.aiImpressions = 5100;
after.sources[0].metrics.aiVisiblePages = 10;
after.sources[1].metrics.totalCitations = 31;
after.sources[1].metrics.citedPages = 11;
delete after.sources[1].metrics.groundingQueriesSampled;
after.sources[2].metrics.aiCrawlerSuccessfulRequests = 92;
after.sources[3].metrics.referrals = 35;
after.sources[3].metrics.engagedVisits = 24;
after.sources[3].metrics.taskCompletions = 4;

assert.equal(validateVisibilitySnapshot(before).valid, true, 'v0.1 snapshots remain valid under the v0.2 schema');
assert.equal(validateVisibilitySnapshot(after).valid, true);
const summary = summarizeVisibilitySnapshot(before);
assert.equal(summary.metrics['google-search-console-generative-ai'].aiVisiblePages, 8);
assert.equal(summary.providers[0].evidence, 'https://evidence.example/google-before.csv');

const funnel = buildVisibilityFunnel(before);
assert.equal(funnel.valid, true);
assert.deepEqual(funnel.observedStages, ['access', 'exposure', 'citation', 'visit', 'task']);
const stage = id => funnel.stages.find(item => item.id === id);
assert.equal(stage('access').derived.find(item => item.metric === 'crawlerSuccessRate').value, 0.86);
assert.equal(stage('exposure').derived.find(item => item.metric === 'impressionsPerVisiblePage').value, 400);
assert.equal(stage('citation').derived.find(item => item.metric === 'citationsPerCitedPage').value, 3);
assert.equal(funnel.guardrails.noCrossProviderConversionRate, true);
assert.equal(funnel.guardrails.noSingleVisibilityScore, true);
const funnelText = formatVisibilityFunnel(funnel);
assert.match(funnelText, /crawlerSuccessRate: 86\.0%/);
assert.match(funnelText, /impressionsPerVisiblePage: 400\.00/);
assert.match(funnelText, /cross-provider conversion rates/);

const singleSourceSnapshots = before.sources.map(source => ({ ...structuredClone(before), version: '0.2', sources: [structuredClone(source)] }));
const merged = mergeVisibilitySnapshots(singleSourceSnapshots);
assert.equal(merged.valid, true);
assert.equal(merged.snapshot.sources.length, 4);
assert.equal(merged.snapshot.version, '0.2');
assert.equal(buildVisibilityFunnel(merged.snapshot).observedStages.length, 5);
const duplicate = mergeVisibilitySnapshots([singleSourceSnapshots[0], singleSourceSnapshots[0]]);
assert.equal(duplicate.valid, false);
assert.match(String(duplicate.errors[0]), /duplicate provider/);
const wrongPeriod = structuredClone(singleSourceSnapshots[1]);
wrongPeriod.period = { start: '2026-08-02', end: '2026-08-31' };
assert.equal(mergeVisibilitySnapshots([singleSourceSnapshots[0], wrongPeriod]).valid, false);

const comparison = compareVisibilitySnapshots(before, after);
assert.equal(comparison.valid, true);
const change = (provider, metric) => comparison.changes.find(item => item.provider === provider && item.metric === metric);
assert.equal(change('google-search-console-generative-ai', 'aiImpressions').delta, 1900);
assert.equal(change('bing-webmaster-ai-performance', 'totalCitations').delta, 13);
assert.equal(change('referral-analytics', 'referrals').delta, -12, 'negative movement must be preserved');
assert.equal(change('bing-webmaster-ai-performance', 'groundingQueriesSampled').comparable, false, 'missing after metric remains missing, not zero');
assert.equal(comparison.periodCompatibility.sameLength, false);
assert.equal(comparison.guardrails.noCausalityInference, true);
assert.match(formatVisibilityComparison(comparison), /-12\s+referral-analytics referrals/);

const mismatch = structuredClone(after);
mismatch.site = 'https://other.example/';
assert.equal(compareVisibilitySnapshots(before, mismatch).valid, false);
const invalid = structuredClone(before);
invalid.guardrails.noCausalityInference = false;
assert.equal(validateVisibilitySnapshot(invalid).valid, false);
const overlapping = structuredClone(after);
overlapping.period = { start: '2026-08-15', end: '2026-09-14' };
assert.equal(compareVisibilitySnapshots(before, overlapping).valid, false);

console.log('PASS visibility evidence supports stage-separated funnels, provider-safe merge and longitudinal comparison without synthetic AI scores');
