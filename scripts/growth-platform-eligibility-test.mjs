import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applySearchPlatformEligibilityToGrowthPlan } from '../lib/growth-platform-eligibility.mjs';
import { evaluateSearchPlatformEligibility } from '../lib/search-platform-eligibility.mjs';

function plan(canonicalUrl) {
  return {
    canonicalUrl,
    observations: {},
    refinements: {},
    actions: [
      {
        id: 'growth:preferred-source-acquisition',
        priority: 'P2',
        lane: 'citation',
        title: 'Add a Preferred Sources CTA when the site has repeat readers',
        status: 'opportunity',
        reason: 'Provider opportunity.',
        implementation: { url: 'https://www.google.com/preferences/source?q=example.com' }
      },
      {
        id: 'growth:content-review',
        priority: 'P1',
        lane: 'content-quality',
        title: 'Review content',
        status: 'manual',
        reason: 'Fixture action.'
      }
    ]
  };
}

const root = applySearchPlatformEligibilityToGrowthPlan(plan('https://example.com/'), { siteScope: 'hostname-root' });
const rootPreferred = root.actions.find(item => item.id === 'growth:preferred-source-acquisition');
assert.ok(rootPreferred);
assert.equal(rootPreferred.status, 'opportunity');
assert.equal(root.refinements.preferredSourcesDisposition, 'eligible');
assert.equal(root.refinements.preferredSourcesScopeExplicit, true);
assert.equal(root.observations.searchPlatformEligibility.preferredSources.state, 'pass');

const unknown = applySearchPlatformEligibilityToGrowthPlan(plan('https://example.com/'));
const unknownPreferred = unknown.actions.find(item => item.id === 'growth:preferred-source-acquisition');
assert.ok(unknownPreferred);
assert.equal(unknownPreferred.status, 'watch');
assert.match(unknownPreferred.title, /Classify hostname scope/i);
assert.equal(unknownPreferred.implementation.url, undefined, 'unknown scope must not ship the acquisition CTA as an implementation URL');
assert.equal(unknown.refinements.preferredSourcesDisposition, 'scope-review-required');
assert.equal(unknown.refinements.preferredSourcesScopeExplicit, false);
assert.equal(unknown.observations.searchPlatformEligibility.preferredSources.state, 'watch');

const project = applySearchPlatformEligibilityToGrowthPlan(plan('https://owner.github.io/project/'), { siteScope: 'subdirectory' });
assert.equal(project.actions.some(item => item.id === 'growth:preferred-source-acquisition'), false, 'subdirectory scope must suppress an inapplicable Preferred Sources CTA');
assert.equal(project.refinements.preferredSourcesDisposition, 'not-applicable');
assert.equal(project.observations.searchPlatformEligibility.preferredSources.state, 'not-applicable');
assert.equal(project.summary.totalActions, 1);

const contradictory = applySearchPlatformEligibilityToGrowthPlan(plan('https://owner.github.io/project/'), { siteScope: 'hostname-root' });
assert.equal(contradictory.actions.some(item => item.id === 'growth:preferred-source-acquisition'), false, 'contradictory hostname-root declaration must fail closed');
assert.equal(contradictory.refinements.preferredSourcesDisposition, 'blocked-scope-conflict');
assert.equal(contradictory.observations.searchPlatformEligibility.preferredSources.state, 'fail');

const contradictoryRoot = evaluateSearchPlatformEligibility({
  site: 'https://owner.github.io/',
  siteScope: 'subdirectory'
});
assert.equal(contradictoryRoot.findings.find(item => item.id === 'SPE-01-preferred-sources-scope').state, 'fail');

const growthSource = fs.readFileSync('lib/growth-plan-vertical.mjs', 'utf8');
assert.match(growthSource, /applySearchPlatformEligibilityToGrowthPlan/);
assert.match(growthSource, /siteScope:\s*options\.siteScope/);
const growthCli = fs.readFileSync('bin/arwp-growth.mjs', 'utf8');
assert.match(growthCli, /--site-scope=hostname-root\|subdirectory\|unknown/);
assert.match(growthCli, /siteScope/);

console.log('PASS Growth planning gates Preferred Sources acquisition by explicit hostname scope and fails closed on subdirectory/hostname-root contradictions.');
