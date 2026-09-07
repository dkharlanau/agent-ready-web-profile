import { SEARCH_MATURITY_DIMENSIONS } from './search-maturity.mjs';

export const SEARCH_INTERVENTION_VERSION = '0.1';
export const SEARCH_OUTCOME_CHANNELS = Object.freeze([
  'crawl-index',
  'classic-search-visibility',
  'ai-retrieval',
  'ai-citation',
  'answer-absorption',
  'referral',
  'useful-action',
  'product-continuation',
  'conversion'
]);

const OUTCOME_STATES = new Set(['positive', 'negative', 'neutral', 'inconclusive', 'not-observed']);
const DISCLOSURE_CLASSES = new Set([
  'public-methodology',
  'public-fixture',
  'commercial-private',
  'confidential-rd',
  'defensive-publication'
]);
const INTERVENTION_STATES = new Set(['planned', 'source-implemented', 'build-verified', 'deployed-verified']);
const VERIFICATION_STATES = new Set(['not-run', 'source-implemented', 'build-verified', 'deployed-verified']);
const PROVENANCE_CLASSES = new Set(['owner-evidence', 'research-observation', 'platform-documentation', 'synthetic-fixture']);
const DISPOSITIONS = new Set(['support', 'neutral', 'negative', 'inconclusive']);
const CONFIDENCE = new Set(['low', 'medium', 'high']);
const DIMENSIONS = new Set(SEARCH_MATURITY_DIMENSIONS);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isIso(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isHttpsUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isEvidenceRef(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (/^urn:sha256:[a-f0-9]{64}$/u.test(value)) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function nonEmptyStrings(values) {
  return Array.isArray(values) && values.every(value => typeof value === 'string' && value.trim());
}

function refsValid(values) {
  return Array.isArray(values) && values.every(isEvidenceRef);
}

function error(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function validateSurface(surface, index, errors) {
  const path = `baseline.surfaces[${index}]`;
  if (!isObject(surface)) return error(errors, path, 'must be an object');
  if (typeof surface.name !== 'string' || !surface.name.trim()) error(errors, `${path}.name`, 'is required');
  if (!PROVENANCE_CLASSES.has(surface.provenanceClass)) error(errors, `${path}.provenanceClass`, 'is invalid');
  if (!refsValid(surface.evidenceRefs)) error(errors, `${path}.evidenceRefs`, 'must contain only http(s) URLs or urn:sha256 references');
}

function validateObservation(observation, index, errors) {
  const path = `observations[${index}]`;
  if (!isObject(observation)) return error(errors, path, 'must be an object');
  if (!['baseline', 'follow-up'].includes(observation.phase)) error(errors, `${path}.phase`, 'must be baseline or follow-up');
  if (!SEARCH_OUTCOME_CHANNELS.includes(observation.channel)) error(errors, `${path}.channel`, 'is invalid');
  if (!isIso(observation.observedAt)) error(errors, `${path}.observedAt`, 'must be an ISO date/time');
  if (!OUTCOME_STATES.has(observation.state)) error(errors, `${path}.state`, 'is invalid');
  if (observation.windowDays != null && (!Number.isInteger(observation.windowDays) || observation.windowDays < 0)) {
    error(errors, `${path}.windowDays`, 'must be an integer >= 0 when provided');
  }
  if (!refsValid(observation.evidenceRefs)) error(errors, `${path}.evidenceRefs`, 'must contain only http(s) URLs or urn:sha256 references');
  if (observation.state !== 'not-observed' && observation.evidenceRefs?.length === 0) {
    error(errors, `${path}.evidenceRefs`, 'requires evidence when an outcome state is observed');
  }
}

export function validateSearchIntervention(record) {
  const errors = [];
  const warnings = [];
  if (!isObject(record)) return { valid: false, errors: ['record must be an object'], warnings };

  if (record.version !== SEARCH_INTERVENTION_VERSION) error(errors, 'version', `must be ${SEARCH_INTERVENTION_VERSION}`);
  if (record.kind !== 'search-intervention') error(errors, 'kind', 'must be search-intervention');
  if (typeof record.id !== 'string' || !/^[a-z0-9][a-z0-9._:-]{2,119}$/u.test(record.id)) error(errors, 'id', 'is invalid');

  if (!isObject(record.site)) error(errors, 'site', 'is required');
  else {
    if (!isHttpsUrl(record.site.url)) error(errors, 'site.url', 'must be an https URL');
    if (typeof record.site.siteClass !== 'string' || !record.site.siteClass.trim()) error(errors, 'site.siteClass', 'is required');
    if (record.site.ownership !== 'owner-controlled') error(errors, 'site.ownership', 'must be owner-controlled');
  }

  if (!isObject(record.intent)) error(errors, 'intent', 'is required');
  else {
    if (typeof record.intent.family !== 'string' || !record.intent.family.trim()) error(errors, 'intent.family', 'is required');
    if (typeof record.intent.locale !== 'string' || !record.intent.locale.trim()) error(errors, 'intent.locale', 'is required');
    if (record.intent.queryCohortRef != null && !isEvidenceRef(record.intent.queryCohortRef)) {
      error(errors, 'intent.queryCohortRef', 'must be an evidence reference when provided');
    }
  }

  if (typeof record.hypothesis !== 'string' || record.hypothesis.trim().length < 20) error(errors, 'hypothesis', 'must be a meaningful string');

  if (!isObject(record.disclosure)) error(errors, 'disclosure', 'is required');
  else {
    if (!DISCLOSURE_CLASSES.has(record.disclosure.class)) error(errors, 'disclosure.class', 'is invalid');
    for (const key of ['containsLiveCorpus', 'containsLearnedPriors', 'ipReviewRequired']) {
      if (typeof record.disclosure[key] !== 'boolean') error(errors, `disclosure.${key}`, 'must be boolean');
    }
    if (['public-methodology', 'public-fixture'].includes(record.disclosure.class)) {
      if (record.disclosure.containsLiveCorpus) error(errors, 'disclosure.containsLiveCorpus', 'public records must not contain a live corpus');
      if (record.disclosure.containsLearnedPriors) error(errors, 'disclosure.containsLearnedPriors', 'public records must not contain learned priors');
    }
    if (record.disclosure.class === 'confidential-rd' && !record.disclosure.ipReviewRequired) {
      error(errors, 'disclosure.ipReviewRequired', 'confidential R&D requires IP review');
    }
  }

  if (!isObject(record.baseline)) error(errors, 'baseline', 'is required');
  else {
    if (!isIso(record.baseline.capturedAt)) error(errors, 'baseline.capturedAt', 'must be an ISO date/time');
    if (!Array.isArray(record.baseline.surfaces) || record.baseline.surfaces.length === 0) error(errors, 'baseline.surfaces', 'must be a non-empty array');
    else record.baseline.surfaces.forEach((surface, index) => validateSurface(surface, index, errors));
  }

  if (!isObject(record.intervention)) error(errors, 'intervention', 'is required');
  else {
    if (!INTERVENTION_STATES.has(record.intervention.status)) error(errors, 'intervention.status', 'is invalid');
    if (!Array.isArray(record.intervention.changedDimensions) || record.intervention.changedDimensions.length === 0) {
      error(errors, 'intervention.changedDimensions', 'must be a non-empty array');
    } else {
      const dimensions = new Set();
      for (const dimension of record.intervention.changedDimensions) {
        if (!DIMENSIONS.has(dimension)) error(errors, 'intervention.changedDimensions', `contains unknown dimension ${dimension}`);
        if (dimensions.has(dimension)) error(errors, 'intervention.changedDimensions', `contains duplicate dimension ${dimension}`);
        dimensions.add(dimension);
      }
    }
    if (!Array.isArray(record.intervention.changedUrls) || !record.intervention.changedUrls.every(isHttpsUrl)) {
      error(errors, 'intervention.changedUrls', 'must be an array of https URLs');
    }
    if (record.intervention.status !== 'planned') {
      if (!record.intervention.changedUrls?.length) error(errors, 'intervention.changedUrls', 'implemented interventions require at least one URL');
      if (!isIso(record.intervention.implementedAt)) error(errors, 'intervention.implementedAt', 'implemented interventions require an ISO date/time');
      if (typeof record.intervention.commitSha !== 'string' || !/^[a-f0-9]{7,64}$/u.test(record.intervention.commitSha)) {
        error(errors, 'intervention.commitSha', 'implemented interventions require a git commit SHA');
      }
    }
    if (!isObject(record.intervention.verification)) error(errors, 'intervention.verification', 'is required');
    else {
      if (!VERIFICATION_STATES.has(record.intervention.verification.state)) error(errors, 'intervention.verification.state', 'is invalid');
      if (!refsValid(record.intervention.verification.evidenceRefs)) error(errors, 'intervention.verification.evidenceRefs', 'must contain valid evidence references');
    }
  }

  if (record.controls != null) {
    if (!isObject(record.controls)) error(errors, 'controls', 'must be an object');
    else if (!Array.isArray(record.controls.urls) || !record.controls.urls.every(isHttpsUrl)) error(errors, 'controls.urls', 'must be an array of https URLs');
  }

  if (!Array.isArray(record.outcomeWindows) || record.outcomeWindows.length === 0) error(errors, 'outcomeWindows', 'must be a non-empty array');
  else {
    const days = new Set();
    for (const [index, window] of record.outcomeWindows.entries()) {
      if (!isObject(window) || !Number.isInteger(window.days) || window.days < 0) error(errors, `outcomeWindows[${index}].days`, 'must be an integer >= 0');
      else if (days.has(window.days)) error(errors, 'outcomeWindows', `contains duplicate ${window.days}-day window`);
      else days.add(window.days);
      if (window?.dueAt != null && !isIso(window.dueAt)) error(errors, `outcomeWindows[${index}].dueAt`, 'must be an ISO date/time when provided');
    }
  }

  if (record.observations != null) {
    if (!Array.isArray(record.observations)) error(errors, 'observations', 'must be an array');
    else record.observations.forEach((observation, index) => validateObservation(observation, index, errors));
  }

  if (!nonEmptyStrings(record.confounders)) error(errors, 'confounders', 'must be an array of non-empty strings');
  if (!DISPOSITIONS.has(record.disposition)) error(errors, 'disposition', 'is invalid');
  if (!CONFIDENCE.has(record.confidence)) error(errors, 'confidence', 'is invalid');

  const followUp = (record.observations || []).filter(item => item?.phase === 'follow-up');
  if (record.disposition !== 'inconclusive' && followUp.length === 0) error(errors, 'disposition', 'non-inconclusive disposition requires at least one follow-up observation');
  if (record.disposition === 'support' && !followUp.some(item => item.state === 'positive')) error(errors, 'disposition', 'support requires a positive follow-up observation');
  if (record.disposition === 'negative' && !followUp.some(item => item.state === 'negative')) error(errors, 'disposition', 'negative requires a negative follow-up observation');
  if (record.disposition === 'neutral' && !followUp.some(item => item.state === 'neutral')) error(errors, 'disposition', 'neutral requires a neutral follow-up observation');
  if (record.confidence !== 'low' && followUp.length === 0) error(errors, 'confidence', 'medium/high confidence requires follow-up observations');

  if (!isObject(record.guardrails)) error(errors, 'guardrails', 'is required');
  else {
    const requiredTrue = [
      'noRankingGuarantee',
      'noCausalityInference',
      'preserveNegativeResults',
      'separateOutcomeChannels',
      'humanReviewBeforeLearning'
    ];
    for (const key of requiredTrue) if (record.guardrails[key] !== true) error(errors, `guardrails.${key}`, 'must be true');
  }

  if (record.intervention?.status === 'deployed-verified' && record.intervention?.verification?.state !== 'deployed-verified') {
    error(errors, 'intervention.verification.state', 'must be deployed-verified when intervention status is deployed-verified');
  }
  if (record.intervention?.status === 'build-verified' && !['build-verified', 'deployed-verified'].includes(record.intervention?.verification?.state)) {
    error(errors, 'intervention.verification.state', 'must be build-verified or deployed-verified when intervention status is build-verified');
  }
  if (record.intervention?.status === 'source-implemented' && record.intervention?.verification?.state === 'not-run') {
    warnings.push('source implementation exists but verification has not run yet.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function createSearchInterventionDraft({
  id,
  siteUrl,
  siteClass,
  intentFamily,
  locale = 'en',
  hypothesis,
  baseline,
  changedDimensions,
  changedUrls = [],
  outcomeWindowDays = [7, 14, 28],
  confounders = [],
  controls = null,
  disclosureClass = 'public-fixture',
  implementation = null,
  queryCohortRef = null
}) {
  const intervention = implementation
    ? {
        status: implementation.status || 'source-implemented',
        changedUrls,
        changedDimensions,
        implementedAt: implementation.implementedAt,
        commitSha: implementation.commitSha,
        ...(implementation.linkedGrowthExperimentId ? { linkedGrowthExperimentId: implementation.linkedGrowthExperimentId } : {}),
        verification: implementation.verification || { state: 'source-implemented', evidenceRefs: [] }
      }
    : {
        status: 'planned',
        changedUrls,
        changedDimensions,
        verification: { state: 'not-run', evidenceRefs: [] }
      };

  const record = {
    version: SEARCH_INTERVENTION_VERSION,
    kind: 'search-intervention',
    id,
    site: { url: siteUrl, siteClass, ownership: 'owner-controlled' },
    intent: { family: intentFamily, locale, ...(queryCohortRef ? { queryCohortRef } : {}) },
    hypothesis,
    disclosure: {
      class: disclosureClass,
      containsLiveCorpus: false,
      containsLearnedPriors: false,
      ipReviewRequired: disclosureClass === 'confidential-rd'
    },
    baseline,
    intervention,
    ...(controls ? { controls } : {}),
    outcomeWindows: outcomeWindowDays.map(days => ({ days })),
    observations: [],
    confounders,
    disposition: 'inconclusive',
    confidence: 'low',
    guardrails: {
      noRankingGuarantee: true,
      noCausalityInference: true,
      preserveNegativeResults: true,
      separateOutcomeChannels: true,
      humanReviewBeforeLearning: true
    }
  };

  const validation = validateSearchIntervention(record);
  if (!validation.valid) throw new Error(`Invalid Search Intervention draft:\n- ${validation.errors.join('\n- ')}`);
  return record;
}

export function searchMaturityDiffToInterventionCandidates(diff, { siteUrl, siteClass, locale = 'en' } = {}) {
  if (!diff || diff.kind !== 'search-maturity-diff' || !Array.isArray(diff.gaps)) {
    throw new Error('diff must come from compareTargetToSearchMaturityCohort.');
  }
  if (!isHttpsUrl(siteUrl)) throw new Error('siteUrl must be an https URL.');
  if (typeof siteClass !== 'string' || !siteClass.trim()) throw new Error('siteClass is required.');

  return diff.gaps.map(gap => ({
    id: `search-intervention:${gap.dimension}`,
    status: 'manual-review',
    site: { url: siteUrl, siteClass, ownership: 'owner-controlled' },
    intent: { family: diff.referenceIntentFamily || 'unknown', locale },
    changedDimensions: [gap.dimension],
    changedUrls: [],
    hypothesis: `Strengthening ${gap.dimension} from ${gap.targetState} toward the observed ${gap.benchmarkState} cohort pattern may improve the user/evidence artifact; Search/AI/business outcomes must be measured separately.`,
    evidenceClass: gap.evidenceClass,
    referencePattern: gap.pattern,
    baselineRequired: true,
    controlsRecommended: true,
    outcomeChannels: [...SEARCH_OUTCOME_CHANNELS],
    requiresApplicabilityReview: true,
    requiresDisclosureClassification: true
  }));
}

export function appendSearchOutcomeObservation(record, observation) {
  const validation = validateSearchIntervention(record);
  if (!validation.valid) throw new Error('Cannot append an observation to an invalid Search Intervention record.');
  const next = { ...record, observations: [...(record.observations || []), observation] };
  const nextValidation = validateSearchIntervention(next);
  if (!nextValidation.valid) throw new Error(`Invalid Search outcome observation:\n- ${nextValidation.errors.join('\n- ')}`);
  return next;
}
