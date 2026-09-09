import assert from 'node:assert/strict';
import { buildSiteGateReport, formatSiteGateReport } from '../lib/site-gate.mjs';

function page(url, extra = {}) {
  return {
    requestedUrl: url,
    url,
    ok: true,
    status: 200,
    canonical: url,
    robotDirectives: [],
    noindex: false,
    headings: 4,
    headingIds: 3,
    semanticLandmark: true,
    navPresent: true,
    interactiveTotal: 5,
    unlabeledInteractive: 0,
    internalLinks: 4,
    structuredTypes: [],
    sitemapMember: true,
    selection: { score: 100, segment: 'guide', sources: ['sitemap'] },
    ...extra
  };
}

const canonicalUrl = 'https://example.com/';
const pages = [
  page(canonicalUrl, { selection: { score: 10000, segment: 'home', sources: ['start'] } }),
  page('https://example.com/guide/a/'),
  page('https://example.com/guide/b/')
];
const discovery = {
  mode: 'test',
  scope: { origin: 'https://example.com', pathPrefix: '/' },
  maxPages: 30,
  concurrency: 4,
  maxBytesPerPage: 524288,
  timeoutMs: 8000,
  candidatesDiscovered: 80,
  sitemapCandidates: 80,
  homepageLinkCandidates: 2,
  sitemapRoot: 'https://example.com/sitemap.xml',
  sitemapSourcesFetched: 1,
  selectionPreview: pages.map(item => ({ url: item.url }))
};
const robots = { url: 'https://example.com/robots.txt', text: 'User-agent: *\nAllow: /\n' };
const sitemap = {
  rootUrl: 'https://example.com/sitemap.xml',
  sources: [{ url: 'https://example.com/sitemap.xml', ok: true, status: 200, error: null }],
  entries: pages.map(item => ({ url: item.url, lastmod: '2026-09-09' }))
};
const focus = {
  observedSiteThesis: { title: 'Evidence guide', h1: 'Evidence guide', description: 'Practical evidence guide' },
  metrics: { orphanCandidates: 0, pagesWithoutProof: 0, pagesWithoutClearJob: 0 },
  siteFindings: []
};

const report = buildSiteGateReport({
  inputUrl: canonicalUrl,
  canonicalUrl,
  discovery,
  pages,
  robots,
  sitemap,
  focus,
  requestedSiteType: 'auto',
  generatedAt: '2026-09-09T08:00:00.000Z'
});

assert.equal(report.version, '0.1');
assert.equal(report.siteType, 'large-knowledge-site');
assert.equal(report.cohort.selectedPages, 3);
assert.equal(report.cohort.urls.length, 3);
assert.equal(report.guardrails.noCompositeReadinessScore, true);
assert.equal('score' in report, false);
assert.equal(report.summary.p0Failures, 0);
assert.equal(report.summary.outcomeInterpretationState, 'blocked');
assert.equal(report.experimentSeed.measurementStages.map(item => item.stage).join('>'), 'access>exposure>citation>visit>task');
assert.equal(report.gates.find(gate => gate.id === 'eligibility-canonical').checks.find(check => check.id === 'priority-http-success').status, 'pass');
assert.equal(report.gates.find(gate => gate.id === 'measurement-baseline').checks.find(check => check.id === 'google-generative-native').status, 'owner-data');
assert.equal(report.gates.find(gate => gate.id === 'data-site-specialization').applicable, true);
assert.match(formatSiteGateReport(report), /No composite readiness\/AI score/);

const blocked = buildSiteGateReport({
  inputUrl: canonicalUrl,
  canonicalUrl,
  discovery: { ...discovery, candidatesDiscovered: 3, sitemapCandidates: 3 },
  pages: [page(canonicalUrl, { ok: false, status: 500, noindex: true })],
  robots,
  sitemap: { ...sitemap, entries: [{ url: canonicalUrl, lastmod: null }] },
  focus,
  requestedSiteType: 'general',
  generatedAt: '2026-09-09T08:00:00.000Z'
});
assert.ok(blocked.summary.p0Failures >= 1);
assert.equal(blocked.summary.publicImplementationState, 'blocked');

const googleBlocked = buildSiteGateReport({
  inputUrl: canonicalUrl,
  canonicalUrl,
  discovery: { ...discovery, candidatesDiscovered: 3, sitemapCandidates: 3 },
  pages: [page(canonicalUrl)],
  robots: { url: 'https://example.com/robots.txt', text: 'User-agent: Googlebot\nDisallow: /\n' },
  sitemap: { ...sitemap, entries: [{ url: canonicalUrl, lastmod: '2026-09-09' }] },
  focus,
  requestedSiteType: 'general',
  generatedAt: '2026-09-09T08:00:00.000Z'
});
assert.equal(
  googleBlocked.gates.find(gate => gate.id === 'eligibility-canonical').checks.find(check => check.id === 'crawler-access-intentional').status,
  'fail'
);

console.log('site-gate tests passed');
