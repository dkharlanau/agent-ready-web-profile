import assert from 'node:assert/strict';
import {
  buildPortfolioRollout,
  loadPortfolioRegistry,
  validatePortfolioRegistry
} from '../lib/portfolio-rollout.mjs';
import { buildPortfolioProposals } from '../lib/portfolio-proposals.mjs';
import { loadTrendRegistry } from '../lib/trend-radar.mjs';

const portfolio = loadPortfolioRegistry();
const trends = loadTrendRegistry();
const now = '2026-09-07T12:00:00Z';

const validation = validatePortfolioRegistry(portfolio);
assert.equal(validation.valid, true, JSON.stringify(validation));
assert.equal(portfolio.sites.length, 7);
assert.equal(portfolio.sites.filter(site => site.rollout.mode === 'managed-issue').length, 3);
const ptichi = portfolio.sites.find(site => site.id === 'ptichi-fresh-site');
assert.ok(ptichi);
assert.equal(ptichi.canonicalUrl, 'https://ptichi.com/');
assert.equal(ptichi.repository, 'dkharlanau/ptichi-site');
assert.equal(ptichi.rollout.mode, 'proposal-only');
const dkharlanau = portfolio.sites.find(site => site.id === 'dkharlanau-sap-knowledge');
const metkagram = portfolio.sites.find(site => site.id === 'metkagram-language-knowledge');
const cognitiveBiases = portfolio.sites.find(site => site.id === 'cognitive-biases-knowledge');
assert.equal(dkharlanau.githubPages.kind, 'user-site-root');
assert.equal(dkharlanau.githubPages.independentSearchIdentity, true);
assert.equal(metkagram.githubPages.kind, 'organization-site-root');
assert.equal(metkagram.githubPages.independentSearchIdentity, true);
assert.equal(cognitiveBiases.githubPages.kind, 'organization-site-root');
assert.equal(cognitiveBiases.githubPages.independentSearchIdentity, true);

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
assert.ok(rollout.candidates.some(item => item.siteId === 'cognitive-biases-knowledge' && item.rolloutMode === 'managed-issue'));
assert.ok(rollout.candidates.some(item => item.siteId === 'ptichi-fresh-site' && item.rolloutMode === 'proposal-only'));
assert.ok(!rollout.candidates.some(item => item.stage === 'watch' || item.stage === 'retired'));

const proposals = buildPortfolioProposals(portfolio, trends, { now });
assert.ok(proposals.proposals.length > 0);
assert.equal(proposals.guardrails.githubMutationAllowed, false);
assert.equal(proposals.guardrails.productionMutationAllowed, false);
assert.equal(proposals.guardrails.explicitTargetAuthorizationRequired, true);
assert.equal(proposals.guardrails.unknownTargetsAreReportedNotForced, true);
assert.ok(proposals.proposals.every(item => item.delivery.githubMutationAllowed === false));
assert.ok(proposals.proposals.every(item => item.delivery.productionMutationAllowed === false));
assert.ok(proposals.proposals.every(item => item.delivery.liveSiteAuditRequired === true));
assert.ok(proposals.proposals.every(item => item.suggestedIssue.body.includes('This is a review artifact only.')));
assert.ok(proposals.proposals.some(item => item.site.id === 'dkharlanau-sap-knowledge' && item.delivery.recommendedChannel === 'managed-issue-review'));
assert.ok(proposals.proposals.some(item => item.site.id === 'brali-practical-knowledge' && item.delivery.recommendedChannel === 'proposal-only-review'));
assert.ok(proposals.proposals.some(item => item.site.id === 'ptichi-fresh-site' && item.delivery.recommendedChannel === 'proposal-only-review'));

const proposalsAgain = buildPortfolioProposals(portfolio, trends, { now });
assert.deepEqual(
  proposalsAgain.proposals.map(item => item.proposalId),
  proposals.proposals.map(item => item.proposalId),
  'proposal IDs must be deterministic for the same portfolio/trend evidence'
);

const unknown = buildPortfolioProposals(portfolio, trends, {
  now,
  site: 'unknown-owner/unknown-site'
});
assert.deepEqual(unknown.unknownTargets, ['unknown-owner/unknown-site']);
assert.equal(unknown.proposals.length, 0);
assert.equal(unknown.summary.candidates, 0);

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
  ['dkharlanau-sap-knowledge', 'metalhatscats-applied-systems', 'metkagram-language-knowledge', 'ptichi-fresh-site'],
  'general is a real vertical, not a wildcard; WebMCP WATCH should map only to portfolio sites whose explicit verticals match its appliesTo set'
);
assert.ok(watch.candidates.every(item => item.recommendationStatus === 'watch-only'));

const watchProposals = buildPortfolioProposals(portfolio, trends, {
  now,
  includeWatch: true,
  trend: 'webmcp-origin-trial-evals'
});
assert.ok(watchProposals.proposals.length > 0);
assert.ok(watchProposals.proposals.flatMap(item => item.candidates).every(item => item.recommendationStatus === 'watch-only'));

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

console.log(`PASS owner portfolio maps ${rollout.candidates.length} ADOPT/MEASURED trend candidates across 7 sites including Ptichi and preserves GitHub Pages user-root versus organization-root hostname identity while building ${proposals.proposals.length} deterministic review-only target proposals without generic production mutation`);
