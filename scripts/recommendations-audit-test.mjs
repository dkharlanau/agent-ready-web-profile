import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateSiteObservations, loadRecommendationsRegistry, robotsRootAccess } from '../lib/site-audit.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonical = JSON.parse(fs.readFileSync(path.join(root, 'registry', 'search-agent-recommendations.json'), 'utf8'));
const published = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'recommendations', 'registry.json'), 'utf8'));

assert.deepEqual(published, canonical, 'published recommendation registry must match the packaged canonical registry');
assert.deepEqual(loadRecommendationsRegistry(), canonical);
assert.equal(canonical.ruleset, '2026.09');
assert.equal(canonical.reviewedAt, '2026-09-05');
assert.equal(canonical.methodology.primarySourcesPreferred, true);
assert.equal(canonical.methodology.noRankingPromise, true);
assert.equal(canonical.methodology.noReadinessScore, true);
assert.equal(canonical.rules.length, 15);
assert.equal(new Set(canonical.rules.map(rule => rule.id)).size, canonical.rules.length, 'recommendation rule IDs must be unique');
for (const rule of canonical.rules) {
  assert.match(rule.source, /^https:\/\//, `${rule.id} must have an HTTPS primary/project source`);
  assert.equal(rule.sourceReviewedAt, '2026-09-05');
  assert.ok(canonical.layers.includes(rule.layer), `${rule.id} uses an unknown layer`);
}

const aipref = canonical.rules.find(rule => rule.id === 'aipref-content-usage');
assert.equal(aipref.upstreamStatus, 'work-in-progress');
assert.match(aipref.notes, /Internet-Drafts can change/i);
const intro = canonical.rules.find(rule => rule.id === 'w3c-introduction-layer-watch');
assert.equal(intro.upstreamStatus, 'incubation');
assert.match(intro.claim, /not automatically a W3C Recommendation/i);
const preferred = canonical.rules.find(rule => rule.id === 'google-preferred-sources');
assert.equal(preferred.priority, 'opportunity');
assert.match(preferred.notes, /not a general ranking guarantee/i);

const robots = `User-agent: Googlebot\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n\nContent-Usage: train-ai=n\n`;
assert.equal(robotsRootAccess(robots, 'Googlebot').status, 'allowed');
assert.equal(robotsRootAccess(robots, 'OAI-SearchBot').status, 'allowed');
assert.equal(robotsRootAccess(robots, 'GPTBot').status, 'blocked');

const observation = {
  canonicalUrl: 'https://example.com/',
  homepage: {
    ok: true,
    status: 200,
    url: 'https://example.com/',
    headers: { contentUsage: 'train-ai=n', xRobotsTag: null },
    text: `<!doctype html><html><head><meta name="robots" content="index,follow"><script async src="https://news.google.com/swg/js/v1/publisher.js"></script></head><body><h1 id="overview">Overview</h1><div google-add-preferred-source-btn></div><h2 id="details">Details</h2></body></html>`
  },
  robots: { ok: true, status: 200, url: 'https://example.com/robots.txt', text: robots },
  sitemap: { ok: true, status: 200, url: 'https://example.com/sitemap.xml', text: '<urlset><url><loc>https://example.com/</loc><lastmod>2026-09-05</lastmod></url></urlset>' },
  scan: { canonicalUrl: 'https://example.com/', existingProfile: { valid: true, url: 'https://example.com/ai/site-profile.json', errors: [] } }
};

const result = evaluateSiteObservations(observation, canonical);
assert.equal(result.ruleset, '2026.09');
assert.equal(result.checks.length, canonical.rules.length);
const byId = id => result.checks.find(check => check.id === id);
assert.equal(byId('google-search-technical-eligibility').status, 'pass');
assert.equal(byId('google-ai-search-eligibility').status, 'pass');
assert.equal(byId('google-preferred-sources').status, 'pass');
assert.equal(byId('google-read-more-deep-links').status, 'pass');
assert.equal(byId('google-sitemap-lastmod').status, 'pass');
assert.equal(byId('openai-oai-searchbot-access').status, 'pass');
assert.equal(byId('aipref-content-usage').status, 'observed');
assert.equal(byId('webmcp-runtime-tools').status, 'not-assessed');
assert.equal(byId('google-generative-ai-measurement').status, 'not-assessed');
assert.equal(byId('w3c-introduction-layer-watch').status, 'watch');
assert.equal(byId('arwp-profile-validity').status, 'pass');
assert.match(result.guardrail, /never guarantees crawling, indexing, ranking, citation or agent success/i);

const blocked = structuredClone(observation);
blocked.homepage.text = '<html><head><meta name="robots" content="noindex,nosnippet"></head><body><h1>Hidden</h1></body></html>';
blocked.robots.text = 'User-agent: Googlebot\nDisallow: /\n\nUser-agent: OAI-SearchBot\nDisallow: /\n';
blocked.homepage.headers.contentUsage = null;
blocked.scan.existingProfile = null;
const blockedResult = evaluateSiteObservations(blocked, canonical);
const blockedById = id => blockedResult.checks.find(check => check.id === id);
assert.equal(blockedById('google-search-technical-eligibility').status, 'fail');
assert.equal(blockedById('google-ai-search-eligibility').status, 'fail');
assert.equal(blockedById('openai-oai-searchbot-access').status, 'fail');
assert.equal(blockedById('google-preferred-sources').status, 'warn');
assert.equal(blockedById('google-read-more-deep-links').status, 'warn');
assert.equal(blockedById('aipref-content-usage').status, 'not-assessed');
assert.equal(blockedById('arwp-profile-validity').status, 'not-applicable');

console.log('PASS Search + Agent recommendations stay source-backed and the audit separates automated evidence, opportunities, runtime-only checks and external measurement');
