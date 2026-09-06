import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateSiteObservations, loadRecommendationsRegistry, robotsRootAccess } from '../lib/site-audit.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (...parts) => JSON.parse(fs.readFileSync(path.join(root, ...parts), 'utf8'));

const canonical = readJson('registry', 'search-agent-recommendations.json');
const published = readJson('docs', 'recommendations', 'registry.json');
const frozen = readJson('docs', 'recommendations', 'history', '2026-09-05.json');
const currentSnapshot = readJson('docs', 'recommendations', 'history', '2026-09-06.json');
const history = readJson('docs', 'recommendations', 'history', 'index.json');

assert.deepEqual(published, canonical, 'published recommendation registry must match the packaged canonical registry');
assert.deepEqual(currentSnapshot, canonical, 'current dated snapshot must match the current registry');
assert.notDeepEqual(frozen, canonical, 'historical snapshots must stay frozen when the live registry evolves');
assert.equal(frozen.ruleset, '2026.09');
assert.equal(frozen.rules.length, 15);
assert.equal(history.snapshots[0].date, '2026-09-05');
assert.equal(history.snapshots.at(-1).date, '2026-09-06');
assert.equal(history.snapshots.at(-1).version, '0.2');
assert.equal(history.snapshots.at(-1).rules, 34);
assert.match(history.historyPolicy, /not silently rewritten/i);

assert.deepEqual(loadRecommendationsRegistry(), canonical);
assert.equal(canonical.version, '0.2');
assert.equal(canonical.ruleset, '2026.09');
assert.equal(canonical.revision, '2026-09-06');
assert.equal(canonical.reviewedAt, '2026-09-06');
assert.equal(canonical.methodology.primarySourcesPreferred, true);
assert.equal(canonical.methodology.noRankingPromise, true);
assert.equal(canonical.methodology.noReadinessScore, true);
assert.match(canonical.methodology.implementationModel, /verification/);
assert.equal(canonical.rules.length, 34);
assert.equal(canonical.implementationPacks.length, 11);
assert.equal(new Set(canonical.rules.map(rule => rule.id)).size, canonical.rules.length, 'recommendation rule IDs must be unique');

const ids = new Set(canonical.rules.map(rule => rule.id));
for (const pack of canonical.implementationPacks) {
  assert.ok(pack.ruleIds.length > 0, `${pack.id} must reference at least one rule`);
  for (const id of pack.ruleIds) assert.ok(ids.has(id), `${pack.id} references unknown rule ${id}`);
}
for (const rule of canonical.rules) {
  assert.match(rule.source, /^https:\/\//, `${rule.id} must have an HTTPS primary/project source`);
  assert.equal(rule.sourceReviewedAt, '2026-09-06');
  assert.ok(canonical.layers.includes(rule.layer), `${rule.id} uses an unknown layer`);
}

const requiredNewRules = [
  'google-crawlable-internal-links',
  'google-canonical-consistency',
  'google-javascript-renderability',
  'google-important-content-textual',
  'google-structured-data-visible-parity',
  'google-localized-hreflang',
  'google-generative-content-structure',
  'google-scaled-query-variant-guardrail',
  'bing-ai-citation-clarity',
  'google-discover-large-images',
  'google-image-context-alt',
  'google-video-discovery',
  'google-article-author-resolution',
  'google-dataset-provenance',
  'google-software-app-structured-data',
  'google-local-commerce-freshness',
  'bing-local-business-freshness',
  'openai-chatgpt-referral-measurement',
  'openai-atlas-aria-agent-accessibility'
];
for (const id of requiredNewRules) assert.ok(ids.has(id), `missing 2026-09-06 recommendation ${id}`);

const aipref = canonical.rules.find(rule => rule.id === 'aipref-content-usage');
assert.equal(aipref.upstreamStatus, 'work-in-progress');
assert.match(aipref.notes, /Internet-Drafts can change/i);
const intro = canonical.rules.find(rule => rule.id === 'w3c-introduction-layer-watch');
assert.equal(intro.upstreamStatus, 'incubation');
assert.match(intro.claim, /not automatically a W3C Recommendation/i);
const preferred = canonical.rules.find(rule => rule.id === 'google-preferred-sources');
assert.equal(preferred.priority, 'opportunity');
assert.match(preferred.notes, /not a general ranking guarantee/i);
const gsc = canonical.rules.find(rule => rule.id === 'google-generative-ai-measurement');
assert.match(gsc.claim, /August 31, 2026/i);
const chatgpt = canonical.rules.find(rule => rule.id === 'openai-chatgpt-referral-measurement');
assert.match(chatgpt.claim, /utm_source=chatgpt\.com/i);
const atlas = canonical.rules.find(rule => rule.id === 'openai-atlas-aria-agent-accessibility');
assert.match(atlas.claim, /ARIA/i);

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
  sitemap: { ok: true, status: 200, url: 'https://example.com/sitemap.xml', text: '<urlset><url><loc>https://example.com/</loc><lastmod>2026-09-06</lastmod></url></urlset>' },
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
assert.equal(byId('google-crawlable-internal-links').status, 'not-assessed');
assert.equal(byId('openai-atlas-aria-agent-accessibility').status, 'not-assessed');
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

console.log('PASS Search + AI visibility recommendations stay source-backed, versioned, immutable by snapshot, actionable by pack, and separate observed evidence from unmeasured outcomes');
