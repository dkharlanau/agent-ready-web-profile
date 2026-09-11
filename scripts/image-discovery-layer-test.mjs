import assert from 'node:assert/strict';
import fs from 'node:fs';

const registry = JSON.parse(fs.readFileSync('registry/image-discovery-practices.json', 'utf8'));
const skill = fs.readFileSync('skills/arwp-image-discovery/SKILL.md', 'utf8');
const docs = fs.readFileSync('docs/IMAGE-DISCOVERY-LAYER.md', 'utf8');

assert.equal(registry.version, '0.1');
assert.match(registry.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(registry.methodology.noRankingGuarantee, true);
assert.equal(registry.methodology.discoverRequirementsSeparatedFromGeneralImageSearch, true);
assert.equal(registry.methodology.decorativeAndInformativeImagesSeparated, true);
assert.equal(registry.methodology.deprecatedImageSitemapFieldsRejected, true);

const required = [
  'IDL-01-crawlable-image-and-landing-page',
  'IDL-02-preferred-image-signal-convergence',
  'IDL-03-image-sitemap-canonical-cohort',
  'IDL-04-context-and-alt-semantics',
  'IDL-05-image-preview-and-serving-controls',
  'IDL-06-representative-quality-and-discover-readiness',
  'IDL-07-responsive-delivery-with-crawlable-fallback',
  'IDL-08-license-and-creator-metadata-boundary'
];

const ids = registry.practices.map((practice) => practice.id);
assert.deepEqual(ids, required);
assert.equal(new Set(ids).size, ids.length, 'Image Discovery practice ids must be unique');

for (const [key, url] of Object.entries(registry.sources)) {
  assert.match(key, /^[a-z][A-Za-z0-9]+$/);
  assert.match(url, /^https:\/\/developers\.google\.com\//, `${key} must be a primary Google source`);
}
for (const practice of registry.practices) {
  assert.match(practice.id, /^IDL-\d{2}-[a-z0-9-]+$/);
  assert.ok(['P0', 'P1', 'P2'].includes(practice.priority));
  assert.ok(practice.question.length > 20);
  assert.ok(practice.practice.length > 50);
  assert.ok(Array.isArray(practice.verify) && practice.verify.length >= 4);
  for (const source of practice.sources) assert.ok(registry.sources[source], `${practice.id} references unknown source ${source}`);
}

for (const text of [skill, docs]) {
  assert.match(text, /primaryImageOfPage/);
  assert.match(text, /og:image/);
  assert.match(text, /image:image/);
  assert.match(text, /image:loc/);
  assert.match(text, /max-image-preview:large/);
  assert.match(text, /1200 px/i);
  assert.match(text, /300,000/i);
  assert.match(text, /ranking/i);
}

assert.match(skill, /decorative images may legitimately use empty alt/i);
assert.match(skill, /Do not mass-generate pseudo-descriptive alt text/i);
assert.match(docs, /1024 px representative image can still be a legitimate Search\/Images asset/i);
assert.match(docs, /Image sitemap `image:license` is deprecated/i);

const deprecatedAsNewMarkup = /<image:(caption|geo_location|title|license)>/;
assert.doesNotMatch(skill, deprecatedAsNewMarkup);
assert.doesNotMatch(docs, deprecatedAsNewMarkup);

console.log(`PASS ${registry.practices.length} Image Discovery practices with preferred-image, image-sitemap, alt/context, preview, Discover-boundary, responsive-delivery and licensing guardrails.`);
