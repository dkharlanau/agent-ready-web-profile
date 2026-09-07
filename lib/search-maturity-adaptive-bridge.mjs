const SEARCH_MATURITY_GROWTH_ROUTES = Object.freeze({
  evidenceDensity: Object.freeze({
    growthActionId: 'growth:non-commodity-review',
    priority: 'P1',
    lane: 'content-quality',
    title: 'Review original evidence and usefulness on priority pages'
  }),
  firstPartyEvidence: Object.freeze({
    growthActionId: 'growth:non-commodity-review',
    priority: 'P1',
    lane: 'content-quality',
    title: 'Review original evidence and usefulness on priority pages'
  })
});

const DEFAULT_SOURCE = 'https://github.com/dkharlanau/agent-ready-web-profile/blob/main/docs/SEARCH-MATURITY-BENCHMARK.md';

function clone(value) {
  return structuredClone(value);
}

function isHttpsUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function summaryFor(actions, previous = {}) {
  const byPriority = {};
  const byLane = {};
  for (const action of actions) {
    const priority = action.priority || 'unknown';
    const lane = action.lane || 'unknown';
    byPriority[priority] = (byPriority[priority] || 0) + 1;
    byLane[lane] = (byLane[lane] || 0) + 1;
  }
  return {
    ...previous,
    totalActions: actions.length,
    byPriority,
    byLane
  };
}

export function routeAcceptedSearchMaturityActions(plan, reviewActions, acceptedActionIds = [], options = {}) {
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.actions)) {
    throw new Error('A Growth Plan with actions[] is required.');
  }
  if (typeof plan.canonicalUrl !== 'string' || !isHttpsUrl(plan.canonicalUrl)) {
    throw new Error('Growth Plan canonicalUrl must be an HTTPS URL.');
  }
  if (!Array.isArray(reviewActions)) throw new Error('reviewActions must be an array.');
  if (!Array.isArray(acceptedActionIds)) throw new Error('acceptedActionIds must be an array.');

  const byId = new Map();
  for (const action of reviewActions) {
    if (!action || typeof action !== 'object' || typeof action.id !== 'string') throw new Error('Every review action must have an id.');
    if (byId.has(action.id)) throw new Error(`Duplicate Search Maturity review action: ${action.id}`);
    byId.set(action.id, action);
  }

  const accepted = [...new Set(acceptedActionIds.map(String))];
  for (const id of accepted) {
    if (!byId.has(id)) throw new Error(`Accepted Search Maturity action is not present in reviewActions: ${id}`);
    const action = byId.get(id);
    if (action.status !== 'manual-review' || action.proposal !== null || action.verificationRequired !== true || action.outcomeMeasurementRequired !== true) {
      throw new Error(`Search Maturity action ${id} is not in the required manual-review state.`);
    }
  }

  const source = options.sourceRef || DEFAULT_SOURCE;
  if (!isHttpsUrl(source)) throw new Error('sourceRef must be an HTTPS URL.');

  const routed = [];
  const unroutable = [];
  for (const id of accepted) {
    const action = byId.get(id);
    const route = SEARCH_MATURITY_GROWTH_ROUTES[action.dimension];
    if (!route) {
      unroutable.push({
        reviewActionId: id,
        dimension: action.dimension,
        reason: 'no-reviewed-growth-route'
      });
      continue;
    }
    routed.push({
      reviewActionId: id,
      dimension: action.dimension,
      growthActionId: route.growthActionId
    });
  }

  const actions = clone(plan.actions);
  const existingIds = new Set(actions.map(action => action.id));
  const grouped = new Map();
  for (const item of routed) {
    if (!grouped.has(item.growthActionId)) grouped.set(item.growthActionId, []);
    grouped.get(item.growthActionId).push(item);
  }

  for (const [growthActionId, mappings] of grouped.entries()) {
    if (existingIds.has(growthActionId)) continue;
    const route = SEARCH_MATURITY_GROWTH_ROUTES[mappings[0].dimension];
    actions.push({
      id: growthActionId,
      priority: route.priority,
      lane: route.lane,
      title: route.title,
      status: 'manual',
      source,
      evidence: [source],
      searchMaturityBridge: {
        acceptedReviewActionIds: mappings.map(item => item.reviewActionId),
        dimensions: mappings.map(item => item.dimension)
      }
    });
    existingIds.add(growthActionId);
  }

  const routedPlan = clone(plan);
  routedPlan.actions = actions;
  routedPlan.summary = summaryFor(actions, routedPlan.summary || {});

  return {
    version: '0.1',
    kind: 'search-maturity-upgrade-bridge',
    plan: routedPlan,
    acceptedReviewActionIds: accepted,
    routed,
    unroutable,
    guardrails: {
      explicitAcceptanceRequired: true,
      noAutomaticGapRouting: true,
      noRankingGuarantee: true,
      noCausalityInference: true,
      unmappedDimensionsFailClosed: true
    }
  };
}

export function searchMaturityGrowthRouteTable() {
  return clone(SEARCH_MATURITY_GROWTH_ROUTES);
}
