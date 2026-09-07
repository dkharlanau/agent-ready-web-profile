export const SEARCH_MATURITY_VERSION = '0.1';

export const SEARCH_MATURITY_DIMENSIONS = Object.freeze([
  'retrievalClarity',
  'topicalFocus',
  'answerFirst',
  'evidenceDensity',
  'firstPartyEvidence',
  'authorEntityIdentity',
  'siteTransparency',
  'semanticStructure',
  'structuredDataIntegrity',
  'internalTopicalGraph',
  'freshnessIntegrity',
  'urlStability',
  'multimodalEvidence',
  'externalCorroboration',
  'utilitySurface',
  'agentAccessibility'
]);

export const SEARCH_MATURITY_STATES = Object.freeze([
  'absent',
  'weak',
  'present',
  'strong',
  'differentiated',
  'unknown'
]);

const STATE_ORDER = Object.freeze({ absent: 0, weak: 1, present: 2, strong: 3, differentiated: 4 });
const EVIDENCE_CLASSES = new Set(['documented-platform', 'observed-correlation', 'experiment', 'unknown']);
const CONFIDENCE = new Set(['low', 'medium', 'high']);

function isHttpUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function observationError(id, message) {
  return `${id || '<missing-id>'}: ${message}`;
}

export function validateSearchMaturityCorpus(corpus) {
  const errors = [];
  if (!corpus || typeof corpus !== 'object' || Array.isArray(corpus)) return { valid: false, errors: ['corpus must be an object'] };
  if (corpus.version !== SEARCH_MATURITY_VERSION) errors.push(`version must be ${SEARCH_MATURITY_VERSION}`);
  if (!Array.isArray(corpus.observations) || corpus.observations.length === 0) errors.push('observations must be a non-empty array');

  const ids = new Set();
  for (const observation of corpus.observations || []) {
    const id = observation?.id;
    if (typeof id !== 'string' || !id.trim()) errors.push(observationError(id, 'id is required'));
    else if (ids.has(id)) errors.push(observationError(id, 'duplicate id'));
    else ids.add(id);

    if (typeof observation?.query !== 'string' || !observation.query.trim()) errors.push(observationError(id, 'query is required'));
    if (typeof observation?.intentFamily !== 'string' || !observation.intentFamily.trim()) errors.push(observationError(id, 'intentFamily is required'));
    if (!observation?.observedAt || Number.isNaN(Date.parse(observation.observedAt))) errors.push(observationError(id, 'observedAt must be an ISO date/time'));

    const surface = observation?.observationSurface;
    if (!surface || typeof surface !== 'object') errors.push(observationError(id, 'observationSurface is required'));
    else {
      if (typeof surface.provider !== 'string' || !surface.provider.trim()) errors.push(observationError(id, 'observationSurface.provider is required'));
      if (typeof surface.surface !== 'string' || !surface.surface.trim()) errors.push(observationError(id, 'observationSurface.surface is required'));
      if (surface.rank != null) {
        if (!Number.isInteger(surface.rank) || surface.rank < 1) errors.push(observationError(id, 'observationSurface.rank must be an integer >= 1'));
        if (!surface.rankEvidence || !isHttpUrl(surface.rankEvidence)) errors.push(observationError(id, 'rank requires rankEvidence URL'));
      }
    }

    const page = observation?.referencePage;
    if (!page || typeof page !== 'object') errors.push(observationError(id, 'referencePage is required'));
    else {
      if (!isHttpUrl(page.url)) errors.push(observationError(id, 'referencePage.url must be http(s)'));
      if (!['independent', 'project-reference'].includes(page.ownership)) errors.push(observationError(id, 'referencePage.ownership must be independent or project-reference'));
    }

    const features = observation?.features;
    if (!features || typeof features !== 'object') {
      errors.push(observationError(id, 'features is required'));
      continue;
    }

    for (const dimension of SEARCH_MATURITY_DIMENSIONS) {
      const feature = features[dimension];
      if (!feature || typeof feature !== 'object') {
        errors.push(observationError(id, `features.${dimension} is required`));
        continue;
      }
      if (!SEARCH_MATURITY_STATES.includes(feature.state)) errors.push(observationError(id, `features.${dimension}.state is invalid`));
      if (!CONFIDENCE.has(feature.confidence)) errors.push(observationError(id, `features.${dimension}.confidence is invalid`));
      if (!EVIDENCE_CLASSES.has(feature.evidenceClass)) errors.push(observationError(id, `features.${dimension}.evidenceClass is invalid`));
      if (!Array.isArray(feature.sources)) errors.push(observationError(id, `features.${dimension}.sources must be an array`));
      else for (const source of feature.sources) if (!isHttpUrl(source)) errors.push(observationError(id, `features.${dimension}.sources contains a non-URL`));
      if (!Array.isArray(feature.observations)) errors.push(observationError(id, `features.${dimension}.observations must be an array`));
      if (feature.state !== 'unknown' && (!feature.observations?.length && !feature.sources?.length)) {
        errors.push(observationError(id, `features.${dimension} needs observable evidence when state is not unknown`));
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function percentileFloor(states, share = 0.6) {
  if (!states.length) return 'unknown';
  for (let index = 4; index >= 0; index -= 1) {
    const atOrAbove = states.filter((state) => STATE_ORDER[state] >= index).length / states.length;
    if (atOrAbove >= share) return Object.keys(STATE_ORDER).find((state) => STATE_ORDER[state] === index);
  }
  return 'absent';
}

function summarizeEvidenceClass(features) {
  const counts = { 'documented-platform': 0, 'observed-correlation': 0, experiment: 0, unknown: 0 };
  for (const feature of features) counts[feature.evidenceClass] = (counts[feature.evidenceClass] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return { counts, dominant: sorted[0]?.[1] ? sorted[0][0] : 'unknown' };
}

export function buildSearchMaturityCohort(corpus, { intentFamily, ownership = 'independent', floorShare = 0.6 } = {}) {
  const validation = validateSearchMaturityCorpus(corpus);
  if (!validation.valid) throw new Error(`Invalid Search Maturity corpus:\n- ${validation.errors.join('\n- ')}`);
  if (!(floorShare > 0 && floorShare <= 1)) throw new Error('floorShare must be > 0 and <= 1');

  const selected = corpus.observations.filter((observation) => {
    if (ownership && observation.referencePage.ownership !== ownership) return false;
    if (intentFamily && observation.intentFamily !== intentFamily) return false;
    return true;
  });
  if (!selected.length) throw new Error('No observations match the requested cohort.');

  const dimensions = {};
  for (const dimension of SEARCH_MATURITY_DIMENSIONS) {
    const features = selected.map((observation) => observation.features[dimension]);
    const known = features.filter((feature) => feature.state !== 'unknown');
    const states = known.map((feature) => feature.state);
    const presentOrBetter = states.filter((state) => STATE_ORDER[state] >= STATE_ORDER.present).length;
    const strongOrBetter = states.filter((state) => STATE_ORDER[state] >= STATE_ORDER.strong).length;
    const benchmarkState = percentileFloor(states, floorShare);
    const presentShare = known.length ? presentOrBetter / known.length : null;
    const strongShare = known.length ? strongOrBetter / known.length : null;
    let pattern = 'insufficient';
    if (known.length >= 3 && strongShare >= 0.5) pattern = 'differentiator';
    else if (known.length >= 3 && presentShare >= 0.75) pattern = 'consistent';
    else if (known.length >= 2) pattern = 'mixed';

    dimensions[dimension] = {
      known: known.length,
      unknown: selected.length - known.length,
      benchmarkState,
      presentShare,
      strongShare,
      pattern,
      evidence: summarizeEvidenceClass(known),
      stateCounts: SEARCH_MATURITY_STATES.reduce((acc, state) => {
        acc[state] = features.filter((feature) => feature.state === state).length;
        return acc;
      }, {})
    };
  }

  const pageAges = selected
    .filter((observation) => observation.referencePage.publishedAt)
    .map((observation) => {
      const published = Date.parse(`${observation.referencePage.publishedAt}T00:00:00Z`);
      const observed = Date.parse(observation.observedAt);
      return Number.isNaN(published) || Number.isNaN(observed) ? null : Math.max(0, (observed - published) / 86400000);
    })
    .filter((value) => value != null)
    .sort((a, b) => a - b);
  const medianAge = pageAges.length
    ? pageAges.length % 2
      ? pageAges[(pageAges.length - 1) / 2]
      : (pageAges[pageAges.length / 2 - 1] + pageAges[pageAges.length / 2]) / 2
    : null;

  return {
    version: SEARCH_MATURITY_VERSION,
    kind: 'search-maturity-cohort',
    intentFamily: intentFamily || null,
    ownership,
    sampleSize: selected.length,
    observationIds: selected.map((observation) => observation.id),
    floorShare,
    retrievalAgeAtObservation: {
      known: pageAges.length,
      minDays: pageAges.length ? pageAges[0] : null,
      medianDays: medianAge,
      maxDays: pageAges.length ? pageAges[pageAges.length - 1] : null,
      caveat: 'Age at retrieval observation is not time-to-index or time-to-rank unless the observation source proves those events.'
    },
    dimensions,
    guardrails: {
      noRankingFactorClaim: true,
      noCausalClaimFromCorrelation: true,
      noSingleMaturityScore: true,
      unknownIsNotFailure: true,
      volatileVisibilityRequiresTimestampedObservations: true
    }
  };
}

export function compareTargetToSearchMaturityCohort(targetProfile, cohort) {
  if (!targetProfile || typeof targetProfile !== 'object') throw new Error('targetProfile must be an object');
  if (!targetProfile.features || typeof targetProfile.features !== 'object') throw new Error('targetProfile.features is required');
  if (!cohort || cohort.kind !== 'search-maturity-cohort') throw new Error('cohort must come from buildSearchMaturityCohort');

  const gaps = [];
  const aligned = [];
  const unknown = [];

  for (const dimension of SEARCH_MATURITY_DIMENSIONS) {
    const target = targetProfile.features[dimension];
    if (!target || !SEARCH_MATURITY_STATES.includes(target.state)) throw new Error(`targetProfile.features.${dimension}.state is required and must be valid`);
    const reference = cohort.dimensions[dimension];

    if (target.state === 'unknown' || reference.benchmarkState === 'unknown') {
      unknown.push({ dimension, targetState: target.state, benchmarkState: reference.benchmarkState, pattern: reference.pattern });
      continue;
    }

    const delta = STATE_ORDER[reference.benchmarkState] - STATE_ORDER[target.state];
    const row = {
      dimension,
      targetState: target.state,
      benchmarkState: reference.benchmarkState,
      delta,
      pattern: reference.pattern,
      sampleKnown: reference.known,
      presentShare: reference.presentShare,
      strongShare: reference.strongShare,
      evidenceClass: reference.evidence.dominant
    };

    if (delta > 0 && ['consistent', 'differentiator'].includes(reference.pattern)) gaps.push(row);
    else aligned.push(row);
  }

  gaps.sort((a, b) => b.delta - a.delta || (b.strongShare ?? 0) - (a.strongShare ?? 0) || a.dimension.localeCompare(b.dimension));

  return {
    version: SEARCH_MATURITY_VERSION,
    kind: 'search-maturity-diff',
    target: targetProfile.site || targetProfile.url || null,
    referenceIntentFamily: cohort.intentFamily,
    referenceSampleSize: cohort.sampleSize,
    gaps,
    aligned,
    unknown,
    guardrails: {
      differencesAreNotRankingFactors: true,
      cohortPatternsAreObservational: true,
      copyCompetitorContentOrDesign: false,
      routeChangesThroughExistingEvidenceAndVerificationGates: true
    }
  };
}

const PRIORITY = Object.freeze({
  retrievalClarity: 'P1',
  topicalFocus: 'P1',
  answerFirst: 'P1',
  evidenceDensity: 'P1',
  firstPartyEvidence: 'P1',
  authorEntityIdentity: 'P2',
  siteTransparency: 'P1',
  semanticStructure: 'P2',
  structuredDataIntegrity: 'P2',
  internalTopicalGraph: 'P1',
  freshnessIntegrity: 'P1',
  urlStability: 'P1',
  multimodalEvidence: 'P2',
  externalCorroboration: 'P2',
  utilitySurface: 'P1',
  agentAccessibility: 'P2'
});

export function searchMaturityDiffToReviewActions(diff) {
  if (!diff || diff.kind !== 'search-maturity-diff') throw new Error('diff must come from compareTargetToSearchMaturityCohort');
  return diff.gaps.map((gap) => ({
    id: `search-maturity:${gap.dimension}`,
    priority: PRIORITY[gap.dimension] || 'P2',
    lane: 'reference-cohort-gap',
    status: 'manual-review',
    dimension: gap.dimension,
    observedTargetState: gap.targetState,
    referenceBenchmarkState: gap.benchmarkState,
    referencePattern: gap.pattern,
    evidenceClass: gap.evidenceClass,
    rationale: `Reference cohort shows a ${gap.pattern} pattern at ${gap.benchmarkState}; target is ${gap.targetState}. Review whether strengthening this dimension creates real user/evidence value before changing the site.`,
    proposal: null,
    verificationRequired: true,
    outcomeMeasurementRequired: true
  }));
}
