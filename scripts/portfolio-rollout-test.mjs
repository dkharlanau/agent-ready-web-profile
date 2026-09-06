import assert from 'node:assert/strict';
import {
  buildPortfolioRollout,
  loadPortfolioRegistry,
  validatePortfolioRegistry
} from '../lib/portfolio-rollout.mjs';
import { loadTrendRegistry } from '../lib/trend-radar.mjs';

const portfolio = loadPortfolioRegistry();
const trends = loadTrendRegistry();
const now = '2026-09-06T12:00:00Z';

const validation = validatePortfolioRegistry(portfolio);
assert.equal(validation.valid, true, JSON.stringify(validation));
assert.equal(portfolio.sites.length, 5);
assert.equal(portfolio.sites.filter(site => site.rollout.mode === 'managed-issue').length, 2);

const rollout = buildPortfolioRollout(portfolio, trends, { now });
assert.ok(rollout.candidates.length > 0);
assert.equal(rollout.guardrails.noProductionMutation, true);
assert.equal(rollout.guardrails.watchIsNotDefaultRollout, true);
assert.ok(rollout.candidates.every(item => ['adopt', 'measured'].includes(item.stage)));
assert.ok(rollout.candidates.every(item => item.productionMutationAllowed === false));
assert.ok(rollout.candidates.every(item => item.requiresSiteAudit === true));
assert.ok(rollout.candidates.every(item => item.evidenceClass === 'owner-controlled-portfolio'));
assert.ok(rollout.candidates.some(item => item.siteId === 'dkharlanau-sap-knowledge' && item.rolloutMode === 'managed-issue'));
assert.ok(rollout.candidates.some(item => item.siteId === 'metkagram-language-knowledge' && item.rolloutMode === 'managed-issue'));
assert.ok(!rollout.candidates.some(item => item.stage === 'watch' || item.stage === 'retired'));

const watchWithoutOptIn = buildPortfolioRollout(portfolio, trends, {
  now,
  stage: 'watch',
  trend: 'webmcp-origin-trial-evals'
});
assert.equal(watchWithoutOptIn.candidates.length, 0, 'WATCH must not enter rollout without explicit --include-watch');

const watch = buildPortfolioRollout(portfolio, trends, {
  now,
  includeWatch: true,
  trend: 'webmcp-origin-trial-evals'
});
assert.deepEqual(
  [...new Set(watch.candidates.map(item => item.siteId))].sort(),
  ['dkharlanau-sap-knowledge', 'metkagram-language-knowledge'],
  'general is a real vertical, not a wildcard; WebMCP WATCH should map only to portfolio sites whose explicit verticals match its appliesTo set'
);
assert.ok(watch.candidates.every(item => item.recommendationStatus === 'watch-only'));

const excludedPortfolio = structuredClone(portfolio);
const target = excludedPortfolio.sites.find(site => site.id === 'dkharlanau-sap-knowledge');
target.rollout.excludeTrendIds = ['google-generative-ai-optimization-guide'];
const excluded = buildPortfolioRollout(excludedPortfolio, trends, {
  now,
  site: target.id,
  trend: 'google-generative-ai-optimization-guide'
});
assert.equal(excluded.candidates.length, 0);
assert.ok(excluded.skipped.some(item => item.siteId === target.id && item.reason === 'explicitly-excluded'));

const invalid = structuredClone(portfolio);
invalid.sites[1].repository = invalid.sites[0].repository;
const invalidResult = validatePortfolioRegistry(invalid);
assert.equal(invalidResult.valid, false);
assert.ok(invalidResult.semanticErrors.some(error => /Duplicate portfolio repository/.test(error)));

console.log(`PASS owner portfolio maps ${rollout.candidates.length} ADOPT/MEASURED trend candidates across ${Object.keys(rollout.summary.bySite).length} sites without generic production mutation`);
