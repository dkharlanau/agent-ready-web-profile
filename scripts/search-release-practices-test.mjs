import assert from 'node:assert/strict';
import fs from 'node:fs';

const registry = JSON.parse(fs.readFileSync('registry/search-release-practices.json', 'utf8'));
const docs = fs.readFileSync('docs/SEARCH-RELEASE-GATE.md', 'utf8');
const skill = fs.readFileSync('skills/arwp-search-release/SKILL.md', 'utf8');

assert.equal(registry.version, '1.0');
assert.match(registry.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(registry.methodology.primarySourcesPreferred, true);
assert.equal(registry.methodology.noRankingPromise, true);
assert.equal(registry.methodology.noCompositeScore, true);
assert.equal(registry.methodology.finalArtifactFirst, true);
assert.equal(registry.methodology.productionVerificationSeparate, true);
assert.equal(registry.methodology.ownerSearchObservationSeparate, true);
assert.equal(registry.methodology.githubPagesIsHostingNotIdentity, true);

const sourceEntries = Object.entries(registry.sources || {});
assert.ok(sourceEntries.length >= 10, 'Search Release should retain a broad primary-source set');
for (const [key, url] of sourceEntries) {
  assert.match(key, /^[a-z][A-Za-z0-9]+$/);
  assert.match(url, /^https:\/\//, `source ${key} must be HTTPS`);
}

assert.ok(Array.isArray(registry.practices));
assert.ok(registry.practices.length >= 18, 'Search Release should retain the initial interview/practice coverage');
const ids = registry.practices.map((practice) => practice.id);
assert.equal(new Set(ids).size, ids.length, 'Search Release practice ids must be unique');

const required = [
  'SR-01-hostname-scope',
  'SR-02-home-identity-chain',
  'SR-03-title-source-convergence',
  'SR-04-snippet-source-hygiene',
  'SR-05-favicon-delivery',
  'SR-06-canonical-host-contract',
  'SR-07-duplicate-home-variants',
  'SR-08-github-pages-domain-security',
  'SR-09-sitemap-canonical-inventory',
  'SR-10-robots-discovery-contract',
  'SR-11-internal-discovery',
  'SR-12-localization-clusters',
  'SR-13-root-gateway-substance',
  'SR-14-final-artifact-gate',
  'SR-15-change-notification',
  'SR-16-migration-continuity',
  'SR-17-portfolio-identity-isolation',
  'SR-18-owner-serp-observation'
];
for (const id of required) assert.ok(ids.includes(id), `missing required Search Release practice ${id}`);

for (const practice of registry.practices) {
  assert.match(practice.id, /^SR-\d{2}-[a-z0-9-]+$/);
  assert.ok(['P0', 'P1', 'P2'].includes(practice.priority), `${practice.id} has unsupported priority`);
  assert.ok(Array.isArray(practice.appliesTo) && practice.appliesTo.length > 0, `${practice.id} needs scope`);
  assert.ok(typeof practice.question === 'string' && practice.question.length > 20, `${practice.id} needs an interview question`);
  assert.ok(typeof practice.practice === 'string' && practice.practice.length > 40, `${practice.id} needs an implementation practice`);
  assert.ok(Array.isArray(practice.verify) && practice.verify.length > 0, `${practice.id} needs verification evidence`);
  assert.ok(Array.isArray(practice.sources) && practice.sources.length > 0, `${practice.id} needs sources`);
  for (const source of practice.sources) assert.ok(registry.sources[source], `${practice.id} references unknown source ${source}`);
}

for (const phrase of [
  'user-facing result is itself a product surface',
  'GitHub Pages-specific checks',
  'Snippet hygiene rule',
  'Favicon rule',
  'Canonical-host invariant',
  'Production loop'
]) assert.match(docs, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));

for (const phrase of [
  'registry/search-release-practices.json',
  'final built hostname-root HTML',
  'data-nosnippet',
  'GitHub Pages custom domain',
  'actual Search/Bing selection'
]) assert.match(skill, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));

console.log(`PASS ${registry.practices.length} Search Release practices preserve hostname identity, title/snippet/favicon, canonical host, crawl discovery, GitHub Pages, final-artifact and owner-observation boundaries without a ranking score.`);
