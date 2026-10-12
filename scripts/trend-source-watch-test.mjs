import assert from 'node:assert/strict';
import { discoverFeedUrl, extractPageUpdatedAt, matchesKeywords, parseFeedEntries, runTrendSourceWatch, sourceRedirectNeedsReview, loadTrendWatchConfig } from '../lib/trend-source-watch.mjs';

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
const googleUpdates=loadTrendWatchConfig().sources.find(s=>s.id==='google-search-doc-updates');
// Synthetic provider-style item: neither Search nor AI keywords occur here.
assert.equal(matchesKeywords({title:'Added local business query support to aggregator and supplier units',summary:'The units now support local business queries.'},googleUpdates.keywords),true);
assert.equal(matchesKeywords({title:'Updated typography examples',summary:'Editorial copy styling examples.'},googleUpdates.keywords),false);

const atom = `<?xml version="1.0"?><feed><entry><title>WebMCP tools</title><link href="https://example.test/webmcp"/><updated>2026-09-07T10:00:00Z</updated><summary>Agent tools</summary></entry></feed>`;
const atomEntries = parseFeedEntries(atom);
assert.equal(atomEntries[0].url, 'https://example.test/webmcp');
assert.equal(atomEntries[0].publishedAt, '2026-09-07T10:00:00.000Z');

const html = `<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"><script type="application/ld+json">{"dateModified":"2026-09-07"}</script></head></html>`;
assert.equal(discoverFeedUrl(html, 'https://example.test/blog'), 'https://example.test/feed.xml');
assert.equal(extractPageUpdatedAt(html), '2026-09-07T00:00:00.000Z');
assert.equal(discoverFeedUrl('<a href="https://feeds.example.test/blog">Subscribe to our RSS feed</a>', 'https://example.test/blog'), 'https://feeds.example.test/blog');
assert.equal(discoverFeedUrl('<a href="/news/feed/"><svg></svg>Subscribe</a>', 'https://example.test/blog'), 'https://example.test/news/feed/');
assert.equal(discoverFeedUrl('<a href="/updates" aria-label="RSS feed for the blog">Blog</a>', 'https://example.test/blog'), 'https://example.test/updates');
assert.equal(discoverFeedUrl('<a href="/feed.xml?a=1&amp;b=2" type="application/rss+xml">Updates</a>', 'https://example.test/blog'), 'https://example.test/feed.xml?a=1&b=2');
assert.equal(discoverFeedUrl('<a href="/article">Best practices for RSS and Atom feeds</a><a href="/newsletter">Subscribe</a>', 'https://example.test/blog'), null);
assert.equal(discoverFeedUrl('<a href="javascript:bad()">Subscribe to RSS</a><a href="https://user:secret@example.test/feed">RSS</a>', 'https://example.test/blog'), null);
assert.equal(discoverFeedUrl('<a data-href="https://example.test/feed">RSS</a>', 'https://example.test/blog'), null);

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

const feedCases = new Map([
  ['https://example.test/subscription', {body: '<a href="/news/feed/">Subscribe</a>', type: 'text/html'}],
  ['https://example.test/news/feed/', {body: rss, type: 'application/rss+xml'}],
  ['https://example.test/no-feed', {body: '<a href="/newsletter">Subscribe</a>', type: 'text/html'}],
  ['https://example.test/bad-discovery', {body: '<a href="/failed/feed/">Subscribe</a>', type: 'text/html'}],
  ['https://example.test/failed/feed/', {body: 'Denied', status: 403, type: 'text/html'}],
  ['https://example.test/challenge-feed', {body: '<html>Challenge<script><rss><channel></channel></rss></script></html>', type: 'text/html'}],
  ['https://example.test/empty-feed', {body: '<rss><channel></channel></rss>', type: 'application/rss+xml'}]
]);
const coverage = await runTrendSourceWatch({version: 'test', sources: [...feedCases.keys()].filter(u => !u.endsWith('/feed/')).map((u, i) => ({
  id: `synthetic-${i}`, provider: 'synthetic', kind: /\/(?:challenge|empty)-feed$/.test(u) ? 'feed' : 'discover-feed', url: u, reviewedThrough: '2026-09-06'
}))}, {fetchImpl: async u => {
  const r = feedCases.get(String(u)); assert.ok(r, `Unexpected URL ${u}`);
  return {ok: (r.status || 200) === 200, status: r.status || 200, url: u, headers: {get: () => r.type}, text: async () => r.body};
}});
assert.equal(coverage.results[0].feedStatus, 'collected');
assert.equal(coverage.results[0].feedEntryCount, 2);
assert.equal(coverage.results[1].feedStatus, 'not_discovered');
assert.equal(coverage.results[2].feedStatus, 'fetch_failed');
assert.equal(coverage.results[2].feedResponse.status, 403);
assert.equal(coverage.results[3].feedStatus, 'unrecognized');
assert.equal(coverage.results[3].feedEntryCount, null);
assert.equal(coverage.results[4].feedStatus, 'collected');
assert.equal(coverage.results[4].feedEntryCount, 0);
assert.equal(coverage.summary.reachable, 5);
assert.equal(coverage.summary.failed, 0);
assert.equal(coverage.summary.feedIncomplete, 3);
assert.equal(coverage.candidates.filter(c => c.type === 'feed-item').length, 1);
const truncated = await runTrendSourceWatch({version: 'test', sources: [{id: 'synthetic-truncated', kind: 'feed', url: 'https://example.test/feed', reviewedThrough: '2026-09-06'}]}, {maxBytes: 10, fetchImpl: async () => ({ok: true, status: 200, headers: {get: () => 'application/rss+xml'}, text: async () => rss})});
assert.equal(truncated.results[0].feedStatus, 'truncated');
assert.equal(truncated.results[0].feedEntryCount, null);
assert.equal(truncated.candidates.length, 0);

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
