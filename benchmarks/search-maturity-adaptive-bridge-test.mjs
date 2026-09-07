import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildSearchMaturityCohort,
  compareTargetToSearchMaturityCohort,
  searchMaturityDiffToReviewActions
} from '../lib/search-maturity.mjs';
import { routeAcceptedSearchMaturityActions } from '../lib/search-maturity-adaptive-bridge.mjs';
import { compileAdaptiveUpgradeGraph } from '../lib/adaptive-upgrade.mjs';

const corpus = JSON.parse(fs.readFileSync(new URL('./search-maturity/pilot-2026-09-07.json', import.meta.url), 'utf8'));
const before = JSON.parse(fs.readFileSync(new URL('./search-maturity/targets/arwp-ai-search-visibility-before-2026-09-07.json', import.meta.url), 'utf8'));
const cohort = buildSearchMaturityCohort(corpus, { intentFamily: 'ai-search-optimization' });
const diff = compareTargetToSearchMaturityCohort(before, cohort);
const reviewActions = searchMaturityDiffToReviewActions(diff);
const gapIds = reviewActions.map(action => action.id).sort();
assert.deepEqual(gapIds, ['search-maturity:evidenceDensity', 'search-maturity:firstPartyEvidence']);
assert.ok(reviewActions.every(action => action.status === 'manual-review'));
assert.ok(reviewActions.every(action => action.proposal === null));

const basePlan = {
  profile: '2026-09-07',
  canonicalUrl: before.site,
  summary: { totalActions: 0, byPriority: {}, byLane: {} },
  actions: [],
  observations: {}
};

const untouched = routeAcceptedSearchMaturityActions(basePlan, reviewActions, []);
assert.equal(untouched.plan.actions.length, 0, 'Search Maturity gaps must not route automatically');
assert.equal(untouched.routed.length, 0);
assert.equal(untouched.guardrails.explicitAcceptanceRequired, true);
assert.equal(untouched.guardrails.noAutomaticGapRouting, true);

const bridged = routeAcceptedSearchMaturityActions(basePlan, reviewActions, gapIds, {
  sourceRef: 'https://github.com/dkharlanau/agent-ready-web-profile/blob/main/benchmarks/search-maturity/targets/arwp-ai-search-visibility-before-2026-09-07.json'
});
assert.equal(bridged.routed.length, 2);
assert.equal(bridged.unroutable.length, 0);
assert.equal(bridged.plan.actions.length, 1, 'Two related maturity gaps should reuse one existing Growth review action rather than create a parallel planner');
assert.equal(bridged.plan.actions[0].id, 'growth:non-commodity-review');
assert.deepEqual(bridged.plan.actions[0].searchMaturityBridge.dimensions.sort(), ['evidenceDensity', 'firstPartyEvidence']);
assert.deepEqual(bridged.plan.actions[0].searchMaturityBridge.acceptedReviewActionIds.sort(), gapIds);

const upgrade = compileAdaptiveUpgradeGraph(bridged.plan, {
  goals: ['search', 'generative-search', 'ai-citations'],
  now: new Date('2026-09-07T14:00:00Z')
});
const citation = upgrade.recommendations.find(item => item.id === 'citation-ready-content');
assert.ok(citation, 'Accepted Search Maturity evidence gaps must route into the existing citation-ready-content Adaptive Upgrade pack');
assert.equal(citation.state, 'recommended');
assert.ok(citation.addresses.actionIds.includes('growth:non-commodity-review'));
assert.equal(upgrade.guardrails.productionMutationAuthorized, false);
assert.equal(upgrade.guardrails.noRankingGuarantee, true);

assert.throws(
  () => routeAcceptedSearchMaturityActions(basePlan, reviewActions, ['search-maturity:not-a-gap']),
  /not present in reviewActions/
);

const unsupported = routeAcceptedSearchMaturityActions(basePlan, [{
  id: 'search-maturity:agentAccessibility',
  status: 'manual-review',
  proposal: null,
  dimension: 'agentAccessibility',
  verificationRequired: true,
  outcomeMeasurementRequired: true
}], ['search-maturity:agentAccessibility']);
assert.equal(unsupported.plan.actions.length, 0);
assert.equal(unsupported.unroutable[0].reason, 'no-reviewed-growth-route');
assert.equal(unsupported.guardrails.unmappedDimensionsFailClosed, true);

console.log('PASS Search Maturity gaps require explicit acceptance, reuse the existing Growth action vocabulary, enter Adaptive Upgrade through citation-ready-content, and leave unreviewed/unmapped dimensions fail-closed');
