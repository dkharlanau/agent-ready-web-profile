import assert from 'node:assert/strict';
import fs from 'node:fs';

const discovery = JSON.parse(fs.readFileSync('registry/image-discovery-practices.json', 'utf8'));
const quality = JSON.parse(fs.readFileSync('registry/image-quality-practices.json', 'utf8'));
const skill = fs.readFileSync('skills/arwp-image-discovery/SKILL.md', 'utf8');
const discoveryDocs = fs.readFileSync('docs/IMAGE-DISCOVERY-LAYER.md', 'utf8');
const qualityDocs = fs.readFileSync('docs/IMAGE-QUALITY-LAYER.md', 'utf8');

assert.equal(discovery.version, '0.1');
assert.match(discovery.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(discovery.methodology.noRankingGuarantee, true);
assert.equal(discovery.methodology.discoverRequirementsSeparatedFromGeneralImageSearch, true);
assert.equal(discovery.methodology.decorativeAndInformativeImagesSeparated, true);
assert.equal(discovery.methodology.deprecatedImageSitemapFieldsRejected, true);

const requiredDiscovery = [
  'IDL-01-crawlable-image-and-landing-page',
  'IDL-02-preferred-image-signal-convergence',
  'IDL-03-image-sitemap-canonical-cohort',
  'IDL-04-context-and-alt-semantics',
  'IDL-05-image-preview-and-serving-controls',
  'IDL-06-representative-quality-and-discover-readiness',
  'IDL-07-responsive-delivery-with-crawlable-fallback',
  'IDL-08-license-and-creator-metadata-boundary'
];

const discoveryIds = discovery.practices.map((practice) => practice.id);
assert.deepEqual(discoveryIds, requiredDiscovery);
assert.equal(new Set(discoveryIds).size, discoveryIds.length, 'Image Discovery practice ids must be unique');

for (const [key, url] of Object.entries(discovery.sources)) {
  assert.match(key, /^[a-z][A-Za-z0-9]+$/);
  assert.match(url, /^https:\/\/developers\.google\.com\//, `${key} must be a primary Google source`);
}
for (const practice of discovery.practices) {
  assert.match(practice.id, /^IDL-\d{2}-[a-z0-9-]+$/);
  assert.ok(['P0', 'P1', 'P2'].includes(practice.priority));
  assert.ok(practice.question.length > 20);
  assert.ok(practice.practice.length > 50);
  assert.ok(Array.isArray(practice.verify) && practice.verify.length >= 4);
  for (const source of practice.sources) assert.ok(discovery.sources[source], `${practice.id} references unknown source ${source}`);
}

assert.equal(quality.version, '0.1');
assert.match(quality.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(quality.methodology.measureRealBytes, true);
assert.equal(quality.methodology.measureIntrinsicDimensions, true);
assert.equal(quality.methodology.compareRenderedDimensions, true);
assert.equal(quality.methodology.qualityPreservationRequired, true);
assert.equal(quality.methodology.lossyTranscodesRequireVisualAcceptance, true);
assert.equal(quality.methodology.offscreenLazyLoadingPreferred, true);
assert.equal(quality.methodology.criticalImagesMustNotBeBlindlyLazyLoaded, true);
assert.equal(quality.methodology.actualCreatorPrecedesPortfolioDefaults, true);
assert.equal(quality.methodology.noUniversalByteLimitClaim, true);

const requiredQuality = [
  'IQL-01-byte-dimension-inventory',
  'IQL-02-quality-preserving-optimization',
  'IQL-03-format-selection',
  'IQL-04-responsive-sizing-and-overdelivery',
  'IQL-05-loading-priority-and-layout-stability',
  'IQL-06-semantic-stable-filenames',
  'IQL-07-provenance-and-visible-attribution',
  'IQL-08-portfolio-github-pages-attribution',
  'IQL-09-duplicate-unused-and-variant-control'
];

const qualityIds = quality.practices.map((practice) => practice.id);
assert.deepEqual(qualityIds, requiredQuality);
assert.equal(new Set(qualityIds).size, qualityIds.length, 'Image Quality practice ids must be unique');

const allowedSourceHosts = new Set(['developer.mozilla.org', 'developers.google.com', 'schema.org']);
for (const [key, url] of Object.entries(quality.sources)) {
  assert.match(key, /^[a-z][A-Za-z0-9]+$/);
  const parsed = new URL(url);
  assert.equal(parsed.protocol, 'https:');
  assert.ok(allowedSourceHosts.has(parsed.hostname), `${key} uses unapproved source host ${parsed.hostname}`);
}
for (const practice of quality.practices) {
  assert.match(practice.id, /^IQL-\d{2}-[a-z0-9-]+$/);
  assert.ok(['P0', 'P1', 'P2'].includes(practice.priority));
  assert.ok(practice.question.length > 20);
  assert.ok(practice.practice.length > 50);
  assert.ok(Array.isArray(practice.verify) && practice.verify.length >= 4);
  for (const source of practice.sources) assert.ok(quality.sources[source], `${practice.id} references unknown source ${source}`);
}

const requiredInventoryFields = [
  'bytes',
  'intrinsicWidth',
  'intrinsicHeight',
  'largestRenderedWidth',
  'largestRenderedHeight',
  'format',
  'loadingPolicy',
  'creator',
  'creditText',
  'license',
  'optimizationState'
];
for (const field of requiredInventoryFields) assert.ok(quality.inventoryFields.includes(field), `image inventory must include ${field}`);

assert.equal(quality.portfolioAttributionPolicy.githubPagesDefault.creatorType, 'Organization');
assert.equal(quality.portfolioAttributionPolicy.githubPagesDefault.creatorName, 'Metal Heads Cats');
assert.equal(quality.portfolioAttributionPolicy.githubPagesDefault.creditText, 'Metal Heads Cats');
assert.equal(quality.portfolioAttributionPolicy.githubPagesDefault.visibleAttributionRequired, true);
assert.ok(
  quality.portfolioAttributionPolicy.exceptions.some((entry) => entry.repository === 'dkharlanau/dkharlanau.github.io'),
  'personal GitHub Pages site must stay outside the Metal Heads Cats default'
);
assert.match(quality.portfolioAttributionPolicy.scope, /first-party images/i);
assert.ok(quality.portfolioAttributionPolicy.guardrails.some((rule) => /third-party creator/i.test(rule)));

for (const text of [skill, discoveryDocs]) {
  assert.match(text, /primaryImageOfPage/);
  assert.match(text, /og:image/);
  assert.match(text, /image:image/);
  assert.match(text, /image:loc/);
  assert.match(text, /max-image-preview:large/);
  assert.match(text, /1200 px/i);
  assert.match(text, /300,000/i);
  assert.match(text, /ranking/i);
}

for (const text of [skill, qualityDocs]) {
  assert.match(text, /actual bytes|exact encoded byte size|byte size/i);
  assert.match(text, /intrinsic/i);
  assert.match(text, /loading="lazy"|loading=lazy/i);
  assert.match(text, /fetchpriority/i);
  assert.match(text, /width.*height|width\/height/i);
  assert.match(text, /AVIF\/WebP|AVIF.*WebP/i);
  assert.match(text, /lowercase kebab-case/i);
  assert.match(text, /Metal Heads Cats/);
  assert.match(text, /dkharlanau\/dkharlanau\.github\.io/);
  assert.match(text, /creator/);
  assert.match(text, /creditText/);
  assert.match(text, /copyrightNotice/);
  assert.match(text, /license/);
  assert.match(text, /Do not.*lossy.*mathematically lossless|not mathematically lossless/i);
  assert.match(text, /third-party/i);
}

assert.match(skill, /decorative images may legitimately use empty alt/i);
assert.match(skill, /Do not mass-generate pseudo-descriptive alt text/i);
assert.match(discoveryDocs, /1024 px representative image can still be a legitimate Search\/Images asset/i);
assert.match(discoveryDocs, /Image sitemap `image:license` is deprecated/i);
assert.match(qualityDocs, /GitHub Pages has no runtime image optimization service/i);
assert.match(qualityDocs, /A lossy codec can be visually equivalent/i);

const deprecatedAsNewMarkup = /<image:(caption|geo_location|title|license)>/;
assert.doesNotMatch(skill, deprecatedAsNewMarkup);
assert.doesNotMatch(discoveryDocs, deprecatedAsNewMarkup);

console.log(`PASS ${discovery.practices.length} Image Discovery practices plus ${quality.practices.length} Image Quality & Attribution practices with byte/dimension inventory, quality-preserving optimization, loading priority, semantic naming and truthful portfolio attribution guardrails.`);
