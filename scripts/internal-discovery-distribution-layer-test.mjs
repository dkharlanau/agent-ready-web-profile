import assert from 'node:assert/strict';
import fs from 'node:fs';

const registry = JSON.parse(fs.readFileSync('registry/internal-discovery-distribution-practices.json', 'utf8'));
const skill = fs.readFileSync('skills/arwp-internal-discovery/SKILL.md', 'utf8');
const docs = fs.readFileSync('docs/INTERNAL-DISCOVERY-DISTRIBUTION-LAYER.md', 'utf8');
const evidence = fs.readFileSync('docs/INTERNAL-DISCOVERY-EVIDENCE.md', 'utf8');

assert.equal(registry.version, '0.1');
assert.match(registry.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(registry.methodology.renderedGraphPreferred, true);
assert.equal(registry.methodology.canonicalTargetsPreferred, true);
assert.equal(registry.methodology.contextualLinksSeparatedFromGlobalNavigation, true);
assert.equal(registry.methodology.breadcrumbsRepresentTypicalUserPath, true);
assert.equal(registry.methodology.utilityControlsSeparatedFromRankingSignals, true);
assert.equal(registry.methodology.partialCohortNeverTreatedAsCompleteGraph, true);
assert.equal(registry.methodology.noMagicLinkCount, true);
assert.equal(registry.methodology.noRankingGuarantee, true);

const required = [
  'IDD-01-crawlable-canonical-internal-links',
  'IDD-02-descriptive-anchor-text',
  'IDD-03-reachability-depth-and-global-only-gaps',
  'IDD-04-semantic-related-and-reverse-links',
  'IDD-05-visible-breadcrumbs-and-breadcrumblist',
  'IDD-06-intentional-continuation-blocks',
  'IDD-07-page-utility-share-copy-save-cite',
  'IDD-08-citation-and-canonical-share-contract',
  'IDD-09-preferred-source-affordance',
  'IDD-10-regression-safe-link-graph-gate'
];

const ids = registry.practices.map((practice) => practice.id);
assert.deepEqual(ids, required);
assert.equal(new Set(ids).size, ids.length, 'Internal Discovery practice ids must be unique');

for (const [key, url] of Object.entries(registry.sources)) {
  assert.match(key, /^[a-z][A-Za-z0-9]+$/);
  assert.match(url, /^https:\/\//, `${key} must be an HTTPS source`);
}
for (const practice of registry.practices) {
  assert.match(practice.id, /^IDD-\d{2}-[a-z0-9-]+$/);
  assert.ok(['P0', 'P1', 'P2'].includes(practice.priority));
  assert.ok(practice.question.length > 20);
  assert.ok(practice.practice.length > 50);
  assert.ok(Array.isArray(practice.verify) && practice.verify.length >= 4);
  for (const source of practice.sources) assert.ok(registry.sources[source], `${practice.id} references unknown source ${source}`);
}

for (const text of [skill, docs]) {
  assert.match(text, /anchor text/i);
  assert.match(text, /BreadcrumbList/);
  assert.match(text, /Continue from here/i);
  assert.match(text, /Share/);
  assert.match(text, /Copy link/i);
  assert.match(text, /Save/);
  assert.match(text, /Cite/);
  assert.match(text, /Preferred Sources/i);
  assert.match(text, /canonical/i);
  assert.match(text, /ranking/i);
  assert.match(text, /partial/i);
}

assert.match(skill, /Do not infer ranking improvement from link count/i);
assert.match(skill, /Do not inject the same sitewide block into every page/i);
assert.match(docs, /typical user path/i);
assert.match(docs, /not treated as ranking factors/i);
assert.match(evidence, /no magical ideal number of links/i);

console.log(`PASS ${registry.practices.length} Internal Discovery & Distribution practices covering canonical crawl paths, descriptive anchors, semantic relations, breadcrumbs, continuation, utility actions and regression-safe graph gates.`);
