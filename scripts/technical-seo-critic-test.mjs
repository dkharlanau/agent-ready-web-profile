import assert from 'node:assert/strict';
import fs from 'node:fs';

const critic = JSON.parse(fs.readFileSync('registry/technical-seo-critic-practices.json', 'utf8'));
const portfolio = JSON.parse(fs.readFileSync('registry/portfolio-sites.json', 'utf8'));
const searchSurface = fs.readFileSync('lib/search-surface-core.mjs', 'utf8');
const skill = fs.readFileSync('skills/arwp-technical-seo-critic/SKILL.md', 'utf8');

assert.equal(critic.version, '0.1');
assert.match(critic.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(critic.methodology.doNotDuplicateExistingFindings, true);
assert.equal(critic.methodology.noRankingGuarantee, true);
assert.equal(critic.methodology.obsoleteSignalsRejected, true);

const required = [
  'TSC-01-head-metadata-parser-integrity',
  'TSC-02-search-field-performance',
  'TSC-03-pagination-canonical-independence',
  'TSC-04-crawl-state-space-control',
  'TSC-05-http-revalidation-efficiency',
  'TSC-06-link-follow-and-relationship-integrity',
  'TSC-07-obsolete-and-false-seo-signals',
  'TSC-08-canonical-channel-conflict'
];
const ids = critic.practices.map((practice) => practice.id);
for (const id of required) assert.ok(ids.includes(id), `missing critic practice ${id}`);
assert.equal(new Set(ids).size, ids.length, 'critic practice ids must be unique');

for (const [id, url] of Object.entries(critic.sources)) {
  assert.match(id, /^[a-z][A-Za-z0-9]+$/);
  assert.match(url, /^https:\/\//, `${id} must use HTTPS`);
}
for (const practice of critic.practices) {
  assert.match(practice.id, /^TSC-\d{2}-[a-z0-9-]+$/);
  assert.ok(['P0', 'P1', 'P2'].includes(practice.priority));
  assert.ok(practice.question.length > 20);
  assert.ok(practice.whyMissedByOrdinaryAudit.length > 20);
  assert.ok(practice.practice.length > 40);
  assert.ok(Array.isArray(practice.verify) && practice.verify.length >= 3);
  for (const source of practice.sources) assert.ok(critic.sources[source], `${practice.id} references unknown source ${source}`);
}

assert.doesNotMatch(searchSurface, /surface:lang:/, 'Search Surface must not generate an html[lang] SEO action');
assert.doesNotMatch(searchSurface, /Declare the page language/, 'Search Surface must not label html[lang] as a Google Search recommendation');
assert.match(skill, /html\[lang\].*accessibility/i);
assert.match(skill, /meta keywords/i);
assert.match(skill, /Core Web Vitals/i);
assert.match(skill, /HTTP Link/i);
assert.match(skill, /canonical/i);

const metalHatsCats = portfolio.sites.find((site) => site.id === 'metalhatscats-applied-systems');
assert.equal(metalHatsCats?.canonicalUrl, 'https://metalhatscats.com/');
assert.notEqual(metalHatsCats?.canonicalUrl, 'https://github.com/metalhatscats/metalhatscats');

console.log(`PASS ${critic.practices.length} Technical SEO Critic practices, obsolete-signal guardrails, canonical-channel challenge, and MetalHatsCats canonical fleet target.`);
