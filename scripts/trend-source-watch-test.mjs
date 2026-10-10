import assert from 'node:assert/strict';
import { discoverFeedUrl, extractPageUpdatedAt, matchesKeywords, parseFeedEntries, runTrendSourceWatch, sourceRedirectNeedsReview } from '../lib/trend-source-watch.mjs';

const rss = `<?xml version="1.0"?><rss><channel>
  <item><title>New generative AI Search control</title><link>https://example.test/new</link><pubDate>Mon, 07 Sep 2026 08:00:00 GMT</pubDate><description>AI Mode and Search Console</description></item>
  <item><title>Old unrelated post</title><link>https://example.test/old</link><pubDate>Sat, 05 Sep 2026 08:00:00 GMT</pubDate></item>
</channel></rss>`;

const entries = parseFeedEntries(rss);
assert.equal(entries.length, 2);
assert.equal(entries[0].title, 'New generative AI Search control');
assert.equal(entries[0].url, 'https://example.test/new');
assert.equal(matchesKeywords(entries[0], ['generative']), true);
assert.equal(matchesKeywords(entries[1], ['generative']), false);

const atom = `<?xml version="1.0"?><feed><entry><title>WebMCP tools</title><link href="https://example.test/webmcp"/><updated>2026-09-07T10:00:00Z</updated><summary>Agent tools</summary></entry></feed>`;
const atomEntries = parseFeedEntries(atom);
assert.equal(atomEntries[0].url, 'https://example.test/webmcp');
assert.equal(atomEntries[0].publishedAt, '2026-09-07T10:00:00.000Z');

const html = `<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"><script type="application/ld+json">{"dateModified":"2026-09-07"}</script></head></html>`;
assert.equal(discoverFeedUrl(html, 'https://example.test/blog'), 'https://example.test/feed.xml');
assert.equal(extractPageUpdatedAt(html), '2026-09-07T00:00:00.000Z');

const responses = new Map([
  ['https://example.test/feed.xml', { status: 200, url: 'https://example.test/feed.xml', body: rss, type: 'application/rss+xml' }],
  ['https://example.test/page', { status: 200, url: 'https://example.test/page', body: html, type: 'text/html' }],
  ['https://example.test/retired-faq', { status: 200, url: 'https://example.test/articles/unrelated-retirement', body: '<html><title>Retired product</title></html>', type: 'text/html' }]
]);
const fetchImpl = async url => {
  const item = responses.get(String(url));
  if (!item) throw new Error(`Unexpected URL ${url}`);
  return {
    ok: item.status >= 200 && item.status < 300,
    status: item.status,
    url: item.url,
    headers: { get: name => name.toLowerCase() === 'content-type' ? item.type : null },
    text: async () => item.body
  };
};

const report = await runTrendSourceWatch({
  version: 'test', reviewedThrough: '2026-09-06', guardrails: {}, sources: [
    { id: 'feed', provider: 'google', kind: 'feed', url: 'https://example.test/feed.xml', reviewedThrough: '2026-09-06', keywords: ['generative'] },
    { id: 'page', provider: 'chrome', kind: 'page-update', url: 'https://example.test/page', reviewedThrough: '2026-09-06', keywords: ['agent'] },
    { id: 'moved', provider: 'openai', kind: 'page-update', url: 'https://example.test/retired-faq', reviewedThrough: '2026-09-06', keywords: ['bots'] },
    { id: 'manual', provider: 'openai', kind: 'manual-page', url: 'https://example.test/manual', reviewedThrough: '2026-09-06', reason: 'Automation blocked; review manually.' }
  ]
}, { fetchImpl, timeoutMs: 1000 });

assert.equal(report.summary.sources, 4);
assert.equal(report.summary.reachable, 3);
assert.equal(report.summary.manual, 1);
assert.equal(report.summary.failed, 0);
assert.equal(report.summary.candidates, 3);
assert(report.candidates.some(item => item.type === 'feed-item'));
assert(report.candidates.some(item => item.type === 'page-updated'));
const manual = report.results.find(item => item.sourceId === 'manual');
assert.equal(manual.manual, true);
assert.equal(manual.ok, null);
assert.match(manual.note, /review manually/i);

assert.equal(sourceRedirectNeedsReview('https://example.test/docs', 'https://example.test/docs/'), false);
assert.equal(sourceRedirectNeedsReview('https://example.test/docs?lang=en', 'https://example.test/docs?lang=de'), false);
assert.equal(sourceRedirectNeedsReview('https://example.test/docs', 'https://example.test/retirement'), true);
assert.equal(sourceRedirectNeedsReview('https://example.test/docs', 'https://another.test/docs'), true);
assert.equal(sourceRedirectNeedsReview('not-a-url', 'https://example.test/retirement'), false);

const redirected = report.results.find(item => item.sourceId === 'moved');
assert.equal(redirected.ok, true);
assert.equal(redirected.sourceRedirectRequiresReview, true);
assert.equal(redirected.finalUrl, 'https://example.test/articles/unrelated-retirement');
const redirectCandidate = report.candidates.find(item => item.type === 'source-redirect-review');
assert.equal(redirectCandidate.sourceId, 'moved');
assert.equal(redirectCandidate.publishedAt, null);
assert.equal(redirectCandidate.requestedUrl, 'https://example.test/retired-faq');
assert.match(redirectCandidate.title, /verify the actual supporting claim/);
assert.equal(report.results.find(item => item.sourceId === 'page').sourceRedirectRequiresReview, false);
assert.equal(report.summary.failed, 0, 'a redirected HTTP 200 is a human review issue, not an HTTP failure');

const topicReport = await runTrendSourceWatch({
  version: 'test', reviewedThrough: '2026-09-06', guardrails: {}, sources: [
    { id: 'same-url-topic-lost', provider: 'openai', kind: 'page-update',
      url: 'https://example.test/page', reviewedThrough: '2026-09-06',
      expectedTopicTerms: ['OAI-SearchBot', 'GPTBot'] },
    { id: 'same-url-topic-present', provider: 'openai', kind: 'page-update',
      url: 'https://example.test/retired-faq', reviewedThrough: '2026-09-06',
      expectedTopicTerms: ['Retired product'] }
  ]
}, { fetchImpl, timeoutMs: 1000 });
const staleTopic = topicReport.results.find(x => x.sourceId === 'same-url-topic-lost');
assert.equal(staleTopic.topicRequiresReview, true);
assert.equal(staleTopic.topicEvidence.checkable, true);
assert.equal(staleTopic.topicEvidence.matchedTermCount, 0);
const missingTopic = topicReport.candidates.find(x => x.type === 'source-topic-review');
assert.equal(missingTopic.sourceId, 'same-url-topic-lost');
assert.equal(missingTopic.publishedAt, null);
assert.match(missingTopic.summary, /extraction problem|material source change/);
const presentTopic = topicReport.results.find(x => x.sourceId === 'same-url-topic-present');
assert.equal(presentTopic.topicRequiresReview, false);
assert.equal(presentTopic.topicEvidence.matchedTermCount, 1);
assert.equal(topicReport.summary.failed, 0, 'missing topic is not a network failure');

console.log('PASS trend-source-watch-test');
