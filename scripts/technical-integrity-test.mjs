import assert from 'node:assert/strict';
import { analyzeTechnicalIntegrityFromPages, formatTechnicalIntegrityReport, robotsPathAccess } from '../lib/technical-integrity.mjs';

function html({
  title = 'Useful guide',
  canonical = 'https://example.com/',
  robots = '',
  googlebot = '',
  bingbot = '',
  hreflang = [],
  body = null,
  extraHead = ''
} = {}) {
  const repeated = body || `<main><h1>${title}</h1><p>${'Useful evidence-backed explanation for a concrete user task. '.repeat(40)}</p><a href="/guide/">Guide</a><a href="/about/">About</a></main>`;
  return `<!doctype html><html lang="en"><head><title>${title}</title><link rel="canonical" href="${canonical}">${robots ? `<meta name="robots" content="${robots}">` : ''}${googlebot ? `<meta name="googlebot" content="${googlebot}">` : ''}${bingbot ? `<meta name="bingbot" content="${bingbot}">` : ''}${hreflang.map(item => `<link rel="alternate" hreflang="${item.lang}" href="${item.url}">`).join('')}${extraHead}</head><body>${repeated}</body></html>`;
}

function page(url, markup, extra = {}) {
  return {
    requestedUrl: url,
    url,
    ok: true,
    status: 200,
    contentType: 'text/html; charset=utf-8',
    headers: {},
    bytes: 4096,
    fetchBudgetBytes: 524288,
    html: markup,
    ...extra
  };
}

function check(report, id) {
  return report.checks.find(item => item.id === id);
}

const home = 'https://example.com/';
const guide = 'https://example.com/guide/';
const cleanPages = [
  page(home, html({ title: 'Home', canonical: home })),
  page(guide, html({ title: 'Guide', canonical: guide }))
];

const clean = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: cleanPages,
  robots: { url: 'https://example.com/robots.txt', ok: true, status: 200, text: 'User-agent: *\nAllow: /\n' },
  generatedAt: '2026-09-11T12:00:00.000Z'
});
assert.equal(clean.version, '0.2');
assert.equal(clean.rulesVersion, '0.4');
assert.equal(clean.guardrails.noCompositeScore, true);
assert.equal(clean.guardrails.boundedFetchFailureIsNotIndexabilityFailure, true);
assert.equal(clean.guardrails.nonHtmlDoesNotRequireHtmlCanonical, true);
assert.equal('score' in clean, false);
assert.equal(clean.summary.p0Failures, 0);
assert.equal(check(clean, 'google-ai-snippet-eligibility').status, 'pass');
assert.equal(check(clean, 'google-priority-url-robots-access').status, 'pass');
assert.equal(check(clean, 'bounded-internal-link-target-health').status, 'watch');
assert.match(check(clean, 'bounded-internal-link-target-health').message, /No executable detector/);
assert.equal(check(clean, 'hreflang-cluster-integrity').status, 'not-applicable');
assert.match(formatTechnicalIntegrityReport(clean), /No composite Search\/AI score/);

const robots404 = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: cleanPages,
  robots: { url: 'https://example.com/robots.txt', ok: false, status: 404, text: '' },
  generatedAt: '2026-09-11T12:00:00.000Z'
});
assert.equal(check(robots404, 'google-robots-fetch-state').status, 'pass');
assert.match(check(robots404, 'google-robots-fetch-state').message, /no crawl restrictions/i);
assert.equal(check(robots404, 'google-priority-url-robots-access').status, 'watch');

const robots503 = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: cleanPages,
  robots: { url: 'https://example.com/robots.txt', ok: false, status: 503, text: '' },
  generatedAt: '2026-09-11T12:00:00.000Z'
});
assert.equal(check(robots503, 'google-robots-fetch-state').status, 'fail');
assert.ok(robots503.summary.p0Failures >= 1);

const pathRobots = 'User-agent: Googlebot\nDisallow: /private/\nAllow: /private/public/\nUser-agent: *\nAllow: /\n';
assert.equal(robotsPathAccess(pathRobots, 'Googlebot', 'https://example.com/private/a').status, 'blocked');
assert.equal(robotsPathAccess(pathRobots, 'Googlebot', 'https://example.com/private/public/a').status, 'allowed');
const pathBlocked = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: [page(home, html({ title: 'Home', canonical: home })), page('https://example.com/private/a', html({ title: 'Private accidental', canonical: 'https://example.com/private/a' }))],
  robots: { url: 'https://example.com/robots.txt', ok: true, status: 200, text: pathRobots },
  generatedAt: '2026-09-11T12:00:00.000Z'
});
assert.equal(check(pathBlocked, 'google-robots-fetch-state').status, 'pass');
assert.equal(check(pathBlocked, 'google-priority-url-robots-access').status, 'fail');

const blockedMarkup = `<!doctype html><html><head><title>Broken</title><link rel="canonical" href="${home}"><link rel="canonical" href="${guide}"><meta name="robots" content="noindex,nosnippet"></head><body><div id="app"></div><script src="a.js"></script><script src="b.js"></script><script src="c.js"></script></body></html>`;
const blocked = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: [page(home, blockedMarkup)],
  robots: { url: 'https://example.com/robots.txt', ok: true, status: 200, text: 'User-agent: *\nAllow: /\n' },
  generatedAt: '2026-09-11T12:00:00.000Z'
});
assert.equal(check(blocked, 'search-indexability').status, 'fail');
assert.equal(check(blocked, 'google-ai-snippet-eligibility').status, 'fail');
assert.equal(check(blocked, 'canonical-final-consistency').status, 'fail');
assert.equal(check(blocked, 'critical-content-textual').status, 'watch');
assert.ok(blocked.summary.p0Failures >= 3);

const fetchLimited = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: [
    page(home, html({ title: 'Home', canonical: home })),
    {
      requestedUrl: 'https://example.com/library/',
      url: 'https://example.com/library/',
      ok: false,
      status: null,
      contentType: null,
      headers: {},
      html: null,
      fetchBudgetBytes: 524288,
      error: 'Response exceeds maxBytes (524288).'
    }
  ],
  robots: { url: 'https://example.com/robots.txt', ok: true, status: 200, text: 'User-agent: *\nAllow: /\n' },
  generatedAt: '2026-09-11T12:00:00.000Z'
});
assert.equal(check(fetchLimited, 'search-indexability').status, 'watch');
assert.equal(check(fetchLimited, 'bounded-retrieval-footprint').status, 'watch');
assert.equal(fetchLimited.summary.p0Failures, 0);
assert.match(check(fetchLimited, 'bounded-retrieval-footprint').message, /not an indexability failure/i);

const markdown = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: [
    page(home, html({ title: 'Home', canonical: home })),
    page('https://example.com/README.md', '# README\n\nUseful Markdown documentation with enough direct content for a user.', {
      contentType: 'text/markdown; charset=utf-8',
      headers: {},
      bytes: 1200
    })
  ],
  robots: { url: 'https://example.com/robots.txt', ok: true, status: 200, text: 'User-agent: *\nAllow: /\n' },
  generatedAt: '2026-09-11T12:00:00.000Z'
});
assert.equal(check(markdown, 'canonical-final-consistency').status, 'pass');
assert.doesNotMatch(check(markdown, 'canonical-final-consistency').message, /README\.md/);

const en = 'https://example.com/en/';
const de = 'https://example.com/de/';
const localized = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: en,
  pages: [
    page(en, html({ title: 'English', canonical: en, hreflang: [{ lang: 'en', url: en }, { lang: 'de', url: de }] })),
    page(de, html({ title: 'Deutsch', canonical: de, hreflang: [{ lang: 'de', url: de }, { lang: 'en', url: en }] }))
  ],
  robots: { url: 'https://example.com/robots.txt', ok: true, status: 200, text: 'User-agent: *\nAllow: /\n' },
  generatedAt: '2026-09-11T12:00:00.000Z'
});
assert.equal(check(localized, 'hreflang-cluster-integrity').status, 'pass');

const brokenLocalized = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: en,
  pages: [
    page(en, html({ title: 'English', canonical: en, hreflang: [{ lang: 'en', url: en }, { lang: 'de', url: de }] })),
    page(de, html({ title: 'Deutsch', canonical: de, hreflang: [{ lang: 'de', url: de }] }))
  ],
  robots: { url: 'https://example.com/robots.txt', ok: true, status: 200, text: 'User-agent: *\nAllow: /\n' },
  generatedAt: '2026-09-11T12:00:00.000Z'
});
assert.equal(check(brokenLocalized, 'hreflang-cluster-integrity').status, 'watch');
assert.match(check(brokenLocalized, 'hreflang-cluster-integrity').message, /does not link back/i);

const duplicateBody = `<main><h1>Template</h1><p>${'The same useful but suspiciously repeated long template body with evidence and examples. '.repeat(55)}</p><a href="/">Home</a></main>`;
const duplicate = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: [
    page('https://example.com/a/', html({ title: 'Repeated title', canonical: 'https://example.com/a/', body: duplicateBody })),
    page('https://example.com/b/', html({ title: 'Repeated title', canonical: 'https://example.com/b/', body: duplicateBody }))
  ],
  robots: { url: 'https://example.com/robots.txt', ok: true, status: 200, text: 'User-agent: *\nAllow: /\n' },
  generatedAt: '2026-09-11T12:00:00.000Z'
});
assert.equal(check(duplicate, 'near-duplicate-priority-pages').status, 'watch');
assert.ok(check(duplicate, 'near-duplicate-priority-pages').nearDuplicatePairs.length >= 1);

const soft404 = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: [page('https://example.com/missing/', html({
    title: 'Page not found',
    canonical: 'https://example.com/missing/',
    body: '<main><h1>404 — Page not found</h1><p>The page does not exist.</p><a href="/">Home</a></main>'
  }))],
  robots: { url: 'https://example.com/robots.txt', ok: true, status: 200, text: 'User-agent: *\nAllow: /\n' },
  generatedAt: '2026-09-11T12:00:00.000Z'
});
assert.equal(check(soft404, 'soft-404-suspect').status, 'watch');

const bingRestricted = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: [page(home, html({ title: 'Bing controls', canonical: home, bingbot: 'noarchive,nocache' }))],
  robots: { url: 'https://example.com/robots.txt', ok: true, status: 200, text: 'User-agent: *\nAllow: /\n' },
  generatedAt: '2026-09-11T12:00:00.000Z'
});
assert.equal(check(bingRestricted, 'bing-grounding-preview-controls').status, 'watch');

// OpenAI: Search discovery and training controls are independent.
const openaiSearchVisibleTrainingBlocked = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: [page(home, html({ title: 'Public ChatGPT page', canonical: home }))],
  robots: {
    url: 'https://example.com/robots.txt',
    ok: true,
    status: 200,
    text: 'User-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n'
  },
  generatedAt: '2026-09-11T12:00:00.000Z'
});
assert.equal(check(openaiSearchVisibleTrainingBlocked, 'openai-search-crawl-policy').status, 'pass');
assert.equal(check(openaiSearchVisibleTrainingBlocked, 'openai-search-crawl-policy').gptBotStatus, 'blocked');
assert.match(check(openaiSearchVisibleTrainingBlocked, 'openai-search-crawl-policy').message, /Search discovery and training policy remain separate/i);

// OpenAI: generic noindex is readable when OAI-SearchBot can fetch the page.
const openaiReadableNoindex = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: [page(home, html({ title: 'Suppressed URL', canonical: home, robots: 'noindex' }))],
  robots: {
    url: 'https://example.com/robots.txt',
    ok: true,
    status: 200,
    text: 'User-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n'
  },
  generatedAt: '2026-09-11T12:00:00.000Z'
});
assert.equal(check(openaiReadableNoindex, 'openai-search-crawl-policy').status, 'pass');
assert.equal(check(openaiReadableNoindex, 'openai-search-crawl-policy').readableNoindexCount, 1);
assert.match(check(openaiReadableNoindex, 'openai-search-crawl-policy').message, /suppression directive is readable/i);
assert.match(check(openaiReadableNoindex, 'openai-search-crawl-policy').message, /does not prove universal suppression/i);

// OpenAI: blocking OAI-SearchBot from a page carrying generic noindex makes the directive unreadable to that crawler.
const hidden = 'https://example.com/hidden/';
const openaiUnreadableNoindex = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: [page(hidden, html({ title: 'Hidden URL', canonical: hidden, robots: 'noindex' }))],
  robots: {
    url: 'https://example.com/robots.txt',
    ok: true,
    status: 200,
    text: 'User-agent: OAI-SearchBot\nDisallow: /hidden/\n\nUser-agent: GPTBot\nDisallow: /\n'
  },
  generatedAt: '2026-09-11T12:00:00.000Z'
});
assert.equal(check(openaiUnreadableNoindex, 'openai-search-crawl-policy').status, 'watch');
assert.equal(check(openaiUnreadableNoindex, 'openai-search-crawl-policy').unreadableNoindexCount, 1);
assert.match(check(openaiUnreadableNoindex, 'openai-search-crawl-policy').message, /must be allowed to crawl a page to read noindex/i);
assert.match(check(openaiUnreadableNoindex, 'openai-search-crawl-policy').message, /robots blocking alone is not proof/i);

// OpenAI: robots blocking without noindex is not evidence that a learned URL/title cannot surface.
const openaiBlockedWithoutNoindex = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: [page(hidden, html({ title: 'Blocked only', canonical: hidden }))],
  robots: {
    url: 'https://example.com/robots.txt',
    ok: true,
    status: 200,
    text: 'User-agent: OAI-SearchBot\nDisallow: /hidden/\n\nUser-agent: GPTBot\nAllow: /\n'
  },
  generatedAt: '2026-09-11T12:00:00.000Z'
});
assert.equal(check(openaiBlockedWithoutNoindex, 'openai-search-crawl-policy').status, 'watch');
assert.match(check(openaiBlockedWithoutNoindex, 'openai-search-crawl-policy').message, /robots blocking alone does not prove URL\/title suppression/i);

// A Googlebot-scoped noindex must not be reinterpreted as a generic OpenAI suppression directive.
const openaiGoogleScopedNoindex = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: [page(hidden, html({ title: 'Google-only noindex', canonical: hidden, googlebot: 'noindex' }))],
  robots: {
    url: 'https://example.com/robots.txt',
    ok: true,
    status: 200,
    text: 'User-agent: OAI-SearchBot\nDisallow: /hidden/\n'
  },
  generatedAt: '2026-09-11T12:00:00.000Z'
});
assert.equal(check(openaiGoogleScopedNoindex, 'openai-search-crawl-policy').status, 'watch');
assert.equal(check(openaiGoogleScopedNoindex, 'openai-search-crawl-policy').unreadableNoindexCount, undefined);
assert.match(check(openaiGoogleScopedNoindex, 'openai-search-crawl-policy').message, /robots blocking alone does not prove URL\/title suppression/i);

console.log('technical-integrity tests passed');
