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
  generatedAt: '2026-09-09T12:00:00.000Z'
});
assert.equal(clean.version, '0.2');
assert.equal(clean.rulesVersion, '0.3');
assert.equal(clean.guardrails.noCompositeScore, true);
assert.equal(clean.guardrails.boundedFetchFailureIsNotIndexabilityFailure, true);
assert.equal(clean.guardrails.nonHtmlDoesNotRequireHtmlCanonical, true);
assert.equal('score' in clean, false);
assert.equal(clean.summary.p0Failures, 0);
assert.equal(clean.checks.find(item => item.id === 'google-ai-snippet-eligibility').status, 'pass');
assert.equal(clean.checks.find(item => item.id === 'google-priority-url-robots-access').status, 'pass');
assert.equal(clean.checks.find(item => item.id === 'bounded-internal-link-target-health').status, 'watch');
assert.match(clean.checks.find(item => item.id === 'bounded-internal-link-target-health').message, /No executable detector/);
assert.equal(clean.checks.find(item => item.id === 'hreflang-cluster-integrity').status, 'not-applicable');
assert.match(formatTechnicalIntegrityReport(clean), /No composite Search\/AI score/);

const robots404 = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: cleanPages,
  robots: { url: 'https://example.com/robots.txt', ok: false, status: 404, text: '' },
  generatedAt: '2026-09-09T12:00:00.000Z'
});
assert.equal(robots404.checks.find(item => item.id === 'google-robots-fetch-state').status, 'pass');
assert.match(robots404.checks.find(item => item.id === 'google-robots-fetch-state').message, /no crawl restrictions/i);
assert.equal(robots404.checks.find(item => item.id === 'google-priority-url-robots-access').status, 'watch');

const robots503 = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: cleanPages,
  robots: { url: 'https://example.com/robots.txt', ok: false, status: 503, text: '' },
  generatedAt: '2026-09-09T12:00:00.000Z'
});
assert.equal(robots503.checks.find(item => item.id === 'google-robots-fetch-state').status, 'fail');
assert.ok(robots503.summary.p0Failures >= 1);

const pathRobots = 'User-agent: Googlebot\nDisallow: /private/\nAllow: /private/public/\nUser-agent: *\nAllow: /\n';
assert.equal(robotsPathAccess(pathRobots, 'Googlebot', 'https://example.com/private/a').status, 'blocked');
assert.equal(robotsPathAccess(pathRobots, 'Googlebot', 'https://example.com/private/public/a').status, 'allowed');
const pathBlocked = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: [page(home, html({ title: 'Home', canonical: home })), page('https://example.com/private/a', html({ title: 'Private accidental', canonical: 'https://example.com/private/a' }))],
  robots: { url: 'https://example.com/robots.txt', ok: true, status: 200, text: pathRobots },
  generatedAt: '2026-09-09T12:00:00.000Z'
});
assert.equal(pathBlocked.checks.find(item => item.id === 'google-robots-fetch-state').status, 'pass');
assert.equal(pathBlocked.checks.find(item => item.id === 'google-priority-url-robots-access').status, 'fail');

const blockedMarkup = `<!doctype html><html><head><title>Broken</title><link rel="canonical" href="${home}"><link rel="canonical" href="${guide}"><meta name="robots" content="noindex,nosnippet"></head><body><div id="app"></div><script src="a.js"></script><script src="b.js"></script><script src="c.js"></script></body></html>`;
const blocked = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: [page(home, blockedMarkup)],
  robots: { url: 'https://example.com/robots.txt', ok: true, status: 200, text: 'User-agent: *\nAllow: /\n' },
  generatedAt: '2026-09-09T12:00:00.000Z'
});
assert.equal(blocked.checks.find(item => item.id === 'search-indexability').status, 'fail');
assert.equal(blocked.checks.find(item => item.id === 'google-ai-snippet-eligibility').status, 'fail');
assert.equal(blocked.checks.find(item => item.id === 'canonical-final-consistency').status, 'fail');
assert.equal(blocked.checks.find(item => item.id === 'critical-content-textual').status, 'watch');
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
  generatedAt: '2026-09-09T12:00:00.000Z'
});
assert.equal(fetchLimited.checks.find(item => item.id === 'search-indexability').status, 'watch');
assert.equal(fetchLimited.checks.find(item => item.id === 'bounded-retrieval-footprint').status, 'watch');
assert.equal(fetchLimited.summary.p0Failures, 0);
assert.match(fetchLimited.checks.find(item => item.id === 'bounded-retrieval-footprint').message, /not an indexability failure/i);

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
  generatedAt: '2026-09-09T12:00:00.000Z'
});
assert.equal(markdown.checks.find(item => item.id === 'canonical-final-consistency').status, 'pass');
assert.doesNotMatch(markdown.checks.find(item => item.id === 'canonical-final-consistency').message, /README\.md/);

const en = 'https://example.com/en/';
const de = 'https://example.com/de/';
const localized = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: en,
  pages: [
    page(en, html({ title: 'English', canonical: en, hreflang: [{ lang: 'en', url: en }, { lang: 'de', url: de }] })),
    page(de, html({ title: 'Deutsch', canonical: de, hreflang: [{ lang: 'de', url: de }, { lang: 'en', url: en }] }))
  ],
  robots: { url: 'https://example.com/robots.txt', ok: true, status: 200, text: 'User-agent: *\nAllow: /\n' },
  generatedAt: '2026-09-09T12:00:00.000Z'
});
assert.equal(localized.checks.find(item => item.id === 'hreflang-cluster-integrity').status, 'pass');

const brokenLocalized = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: en,
  pages: [
    page(en, html({ title: 'English', canonical: en, hreflang: [{ lang: 'en', url: en }, { lang: 'de', url: de }] })),
    page(de, html({ title: 'Deutsch', canonical: de, hreflang: [{ lang: 'de', url: de }] }))
  ],
  robots: { url: 'https://example.com/robots.txt', ok: true, status: 200, text: 'User-agent: *\nAllow: /\n' },
  generatedAt: '2026-09-09T12:00:00.000Z'
});
assert.equal(brokenLocalized.checks.find(item => item.id === 'hreflang-cluster-integrity').status, 'watch');
assert.match(brokenLocalized.checks.find(item => item.id === 'hreflang-cluster-integrity').message, /does not link back/i);

const duplicateBody = `<main><h1>Template</h1><p>${'The same useful but suspiciously repeated long template body with evidence and examples. '.repeat(55)}</p><a href="/">Home</a></main>`;
const duplicate = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: [
    page('https://example.com/a/', html({ title: 'Repeated title', canonical: 'https://example.com/a/', body: duplicateBody })),
    page('https://example.com/b/', html({ title: 'Repeated title', canonical: 'https://example.com/b/', body: duplicateBody }))
  ],
  robots: { url: 'https://example.com/robots.txt', ok: true, status: 200, text: 'User-agent: *\nAllow: /\n' },
  generatedAt: '2026-09-09T12:00:00.000Z'
});
assert.equal(duplicate.checks.find(item => item.id === 'near-duplicate-priority-pages').status, 'watch');
assert.ok(duplicate.checks.find(item => item.id === 'near-duplicate-priority-pages').nearDuplicatePairs.length >= 1);

const soft404 = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: [page('https://example.com/missing/', html({
    title: 'Page not found',
    canonical: 'https://example.com/missing/',
    body: '<main><h1>404 — Page not found</h1><p>The page does not exist.</p><a href="/">Home</a></main>'
  }))],
  robots: { url: 'https://example.com/robots.txt', ok: true, status: 200, text: 'User-agent: *\nAllow: /\n' },
  generatedAt: '2026-09-09T12:00:00.000Z'
});
assert.equal(soft404.checks.find(item => item.id === 'soft-404-suspect').status, 'watch');

const bingRestricted = analyzeTechnicalIntegrityFromPages({
  canonicalUrl: home,
  pages: [page(home, html({ title: 'Bing controls', canonical: home, bingbot: 'noarchive,nocache' }))],
  robots: { url: 'https://example.com/robots.txt', ok: true, status: 200, text: 'User-agent: *\nAllow: /\n' },
  generatedAt: '2026-09-09T12:00:00.000Z'
});
assert.equal(bingRestricted.checks.find(item => item.id === 'bing-grounding-preview-controls').status, 'watch');

console.log('technical-integrity tests passed');
