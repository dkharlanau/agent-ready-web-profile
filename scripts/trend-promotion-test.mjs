import assert from 'node:assert/strict';
import { loadTrendRegistry } from '../lib/trend-radar.mjs';
import { loadTrendWatchConfig } from '../lib/trend-source-watch.mjs';
import {
  buildTrendPromotionProposals,
  reviewTrendPromotion,
  summarizeTrendPromotions,
  validateTrendPromotionBatch
} from '../lib/trend-promotion.mjs';

const watch = {
  version: '0.1',
  generatedAt: '2026-09-07T06:00:00Z',
  reviewedThrough: '2026-09-06',
  candidates: [
    {
      sourceId: 'chrome-webmcp', provider: 'chrome', type: 'page-updated',
      title: 'WebMCP page metadata changed after review cutoff', summary: null,
      url: 'https://developer.chrome.com/docs/ai/webmcp', publishedAt: '2026-09-07T01:00:00Z'
    },
    {
      sourceId: 'cloudflare-ai-bots-changelog', provider: 'cloudflare', type: 'page-updated',
      title: 'Cloudflare changelog changed', summary: null,
      url: 'https://developers.cloudflare.com/changelog/', publishedAt: '2026-09-07T02:00:00Z'
    },
    {
      sourceId: 'google-search-blog', provider: 'google', type: 'feed-item',
      title: 'New Google Search documentation item', summary: 'AI Search update',
      url: 'https://developers.google.com/search/blog/example', publishedAt: '2026-09-07T03:00:00Z'
    }
  ]
};

const batch = buildTrendPromotionProposals(watch, loadTrendRegistry(), loadTrendWatchConfig(), { generatedAt: '2026-09-07T06:05:00Z' });
assert.equal(validateTrendPromotionBatch(batch).valid, true);
assert.equal(batch.proposals.length, 2, 'only WATCH trends mapped to changed sources should receive proposals');
assert.ok(batch.proposals.some(item => item.trendId === 'webmcp-origin-trial-evals'));
assert.ok(batch.proposals.some(item => item.trendId === 'cloudflare-content-use-reference-enforcement'));
assert.equal(batch.proposals.some(item => item.provider === 'google'), false, 'already ADOPT/retired Google trends must not get WATCH promotion proposals');
assert.equal(batch.guardrails.approvalDoesNotMutateRegistry, true);
assert.equal(summarizeTrendPromotions(batch).reviewRequired, 2);

const webmcp = batch.proposals.find(item => item.trendId === 'webmcp-origin-trial-evals');
const reviewed = reviewTrendPromotion(batch, webmcp.id, 'approve', {
  reviewer: 'reviewer@example', reviewedAt: '2026-09-07T07:00:00Z', note: 'Primary source reviewed; create a separate registry change if adoption is justified.'
});
assert.equal(validateTrendPromotionBatch(reviewed).valid, true);
const approved = reviewed.proposals.find(item => item.id === webmcp.id);
assert.equal(approved.status, 'approved');
assert.equal(approved.review.decision, 'approve');
assert.equal(summarizeTrendPromotions(reviewed).approved, 1);
assert.equal(summarizeTrendPromotions(reviewed).reviewRequired, 1);
assert.equal(loadTrendRegistry().trends.find(item => item.id === 'webmcp-origin-trial-evals').stage, 'watch', 'review must never mutate the Trend registry');
assert.throws(() => reviewTrendPromotion(batch, webmcp.id, 'approve', {}), /reviewer is required/);

console.log('PASS Trend source changes create explicit WATCH-to-ADOPT review proposals without silently mutating maturity');
