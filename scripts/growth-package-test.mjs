import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const expectedBins = {
  'arwp-growth': 'bin/arwp-growth.mjs',
  'arwp-growth-policy': 'bin/arwp-growth-policy.mjs',
  'arwp-growth-history': 'bin/arwp-growth-history.mjs',
  'arwp-hypotheses': 'bin/arwp-hypotheses.mjs',
  'arwp-growth-experiment': 'bin/arwp-growth-experiment.mjs',
  'arwp-growth-remediation': 'bin/arwp-growth-remediation.mjs',
  'arwp-trends': 'bin/arwp-trends.mjs'
};

for (const [name, target] of Object.entries(expectedBins)) {
  assert.equal(pkg.bin?.[name], target, `${name} must be an npm bin entry`);
  assert.equal(fs.existsSync(target), true, `${target} must exist`);
}

const expectedScripts = {
  growth: 'node bin/arwp-growth.mjs',
  'growth-policy': 'node bin/arwp-growth-policy.mjs',
  'growth-history': 'node bin/arwp-growth-history.mjs',
  hypotheses: 'node bin/arwp-hypotheses.mjs',
  'growth-experiment': 'node bin/arwp-growth-experiment.mjs',
  'growth-remediation': 'node bin/arwp-growth-remediation.mjs',
  trends: 'node bin/arwp-trends.mjs'
};

for (const [name, command] of Object.entries(expectedScripts)) {
  assert.equal(pkg.scripts?.[name], command, `${name} package script must stay executable`);
}

assert.equal(typeof pkg.scripts?.['test:growth'], 'string');
assert.match(pkg.scripts['test:growth'], /growth-experiment-test\.mjs/);
assert.match(pkg.scripts['test:growth'], /growth-remediation-test\.mjs/);
assert.equal(typeof pkg.scripts?.['test:trends'], 'string');

for (const file of [
  'lib/growth-profile.mjs',
  'lib/growth-plan.mjs',
  'lib/growth-plan-vertical.mjs',
  'lib/growth-vertical-evidence.mjs',
  'lib/growth-vertical-site.mjs',
  'lib/growth-vertical-extended.mjs',
  'lib/growth-policy.mjs',
  'lib/growth-history.mjs',
  'lib/growth-hypotheses.mjs',
  'lib/growth-experiment.mjs',
  'lib/growth-remediation.mjs',
  'lib/growth-pr-delivery.mjs',
  'bin/arwp-growth-pr.mjs',
  'schema/growth-pr-delivery.schema.json',
  'schema/growth-owner-data.schema.json',
  'lib/trend-radar.mjs',
  'scripts/trend-source-watch.mjs',
  'scripts/growth-commerce-local-test.mjs',
  'registry/growth-opportunities.json',
  'registry/growth-verticals.json',
  'registry/growth-hypotheses.json',
  'registry/trends.json',
  'schema/growth-policy.schema.json',
  'schema/growth-experiment.schema.json',
  'schema/growth-remediation-manifest.schema.json',
  'templates/growth/organization.jsonld',
  'templates/growth/owner-data.json',
  'docs/GROWTH-PROFILE.md',
  'docs/GROWTH-POLICY.md',
  'docs/GROWTH-LOOP.md',
  'docs/GROWTH-EXPERIMENTS.md',
  'docs/GROWTH-REMEDIATION.md',
  'docs/GROWTH-PR-DELIVERY.md',
  'docs/TREND-RADAR.md'
]) {
  assert.equal(fs.existsSync(file), true, `${file} must exist`);
}

for (const publishedPath of [
  'bin/', 'lib/', 'schema/', 'registry/', 'templates/growth/',
  'scripts/trend-source-watch.mjs',
  'docs/GROWTH-PROFILE.md', 'docs/GROWTH-POLICY.md', 'docs/GROWTH-LOOP.md', 'docs/GROWTH-EXPERIMENTS.md', 'docs/GROWTH-REMEDIATION.md', 'docs/TREND-RADAR.md'
]) {
  assert(pkg.files.includes(publishedPath), `${publishedPath} must be present in package files`);
}

assert(pkg.files.includes('bin/'), 'review-only PR CLI must ship via bin/');
assert(pkg.files.includes('lib/'), 'vertical and PR delivery implementations must ship via lib/');
assert(pkg.files.includes('schema/'), 'owner-data and PR-delivery schemas must ship via schema/');
assert(pkg.files.includes('templates/growth/'), 'owner-data and remediation templates must ship via templates/growth/');

const verticals = JSON.parse(fs.readFileSync('registry/growth-verticals.json', 'utf8'));
const hypotheses = JSON.parse(fs.readFileSync('registry/growth-hypotheses.json', 'utf8'));
const trends = JSON.parse(fs.readFileSync('registry/trends.json', 'utf8'));
assert.equal(verticals.version, '0.3');
assert(verticals.verticals.commerce.checks.some(item => item.id === 'commerce-ucp-discovery'));
assert(verticals.verticals['local-business'].checks.some(item => item.id === 'local-business-owner-profile'));
assert.equal(hypotheses.version, '0.1');
assert(Array.isArray(hypotheses.hypotheses) && hypotheses.hypotheses.length > 0, 'hypothesis registry must be non-empty');
assert(Array.isArray(trends.trends) && trends.trends.length > 0, 'trend registry must be non-empty');

assert(pkg.keywords.includes('growth-loop'));
assert(pkg.keywords.includes('growth-hypotheses'));
assert(pkg.keywords.includes('growth-experiments'));
assert(pkg.keywords.includes('growth-remediation'));
assert(pkg.keywords.includes('trend-radar'));

console.log('PASS growth-package-test');
