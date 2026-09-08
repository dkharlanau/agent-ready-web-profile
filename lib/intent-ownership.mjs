export const INTENT_OWNERSHIP_VERSION = '0.1';

export const INTENT_OWNERSHIP_STATES = Object.freeze([
  'owned',
  'unowned',
  'declined',
  'fragmented',
  'blocked-owner'
]);

const DISCLOSURE_CLASSES = new Set([
  'public-methodology',
  'public-fixture',
  'commercial-private',
  'confidential-rd'
]);
const INDEX_STATES = new Set(['indexable', 'noindex', 'redirect', 'unknown']);
const CONFIDENCE = new Set(['low', 'medium', 'high']);
const PHRASE_CLASSES = new Set(['search-query', 'grounding-query', 'referral-intent', 'manual-intent']);
const INTENT_DISPOSITIONS = new Set(['serve', 'decline']);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isIso(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function parseHttps(value) {
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.hash) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isEvidenceRef(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (/^urn:sha256:[a-f0-9]{64}$/u.test(value)) return true;
  try {
    const parsed = new URL(value);
    return ['https:', 'http:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function refsValid(values) {
  return Array.isArray(values) && values.every(isEvidenceRef);
}

function error(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function normalizeUrl(value) {
  const parsed = parseHttps(value);
  return parsed ? parsed.href : value;
}

function sameOrigin(value, siteOrigin) {
  const parsed = parseHttps(value);
  return Boolean(parsed) && parsed.origin === siteOrigin;
}

function uniqueStrings(values) {
  return [...new Set(values)];
}

function validateCanonicalPage(page, index, siteOrigin, seen, errors) {
  const path = `canonicalPages[${index}]`;
  if (!isObject(page)) return error(errors, path, 'must be an object');
  if (!sameOrigin(page.url, siteOrigin)) error(errors, `${path}.url`, 'must be an https URL on the site origin');
  const url = normalizeUrl(page.url);
  if (seen.has(url)) error(errors, `${path}.url`, 'must be unique');
  seen.add(url);
  if (!INDEX_STATES.has(page.indexState)) error(errors, `${path}.indexState`, 'is invalid');
  if (page.indexState === 'redirect') {
    if (!sameOrigin(page.canonicalUrl, siteOrigin)) error(errors, `${path}.canonicalUrl`, 'redirect pages require a same-origin canonicalUrl');
    if (normalizeUrl(page.canonicalUrl) === url) error(errors, `${path}.canonicalUrl`, 'must differ from the redirect URL');
  } else if (page.canonicalUrl != null && !sameOrigin(page.canonicalUrl, siteOrigin)) {
    error(errors, `${path}.canonicalUrl`, 'must be a same-origin https URL when provided');
  }
  if (!refsValid(page.evidenceRefs || [])) error(errors, `${path}.evidenceRefs`, 'must contain only http(s) or urn:sha256 references');
}

function validateObservation(observation, familyIndex, observationIndex, siteOrigin, errors) {
  const path = `families[${familyIndex}].observations[${observationIndex}]`;
  if (!isObject(observation)) return error(errors, path, 'must be an object');
  if (typeof observation.provider !== 'string' || !observation.provider.trim()) error(errors, `${path}.provider`, 'is required');
  if (typeof observation.surface !== 'string' || !observation.surface.trim()) error(errors, `${path}.surface`, 'is required');
  if (!PHRASE_CLASSES.has(observation.phraseClass)) error(errors, `${path}.phraseClass`, 'is invalid');
  if (typeof observation.phrase !== 'string' || !observation.phrase.trim()) error(errors, `${path}.phrase`, 'is required');
  if (!isIso(observation.observedAt)) error(errors, `${path}.observedAt`, 'must be an ISO date/time');
  if (!sameOrigin(observation.pageUrl, siteOrigin)) error(errors, `${path}.pageUrl`, 'must be an https URL on the site origin');
  if (!refsValid(observation.evidenceRefs)) error(errors, `${path}.evidenceRefs`, 'must contain only http(s) or urn:sha256 references');
  if (observation.evidenceRefs?.length === 0) error(errors, `${path}.evidenceRefs`, 'requires at least one evidence reference');
}

function validateFamily(family, index, siteOrigin, canonicalUrls, errors) {
  const path = `families[${index}]`;
  if (!isObject(family)) return error(errors, path, 'must be an object');
  if (typeof family.id !== 'string' || !/^[a-z0-9][a-z0-9._:-]{2,119}$/u.test(family.id)) error(errors, `${path}.id`, 'is invalid');
  if (typeof family.label !== 'string' || !family.label.trim()) error(errors, `${path}.label`, 'is required');
  if (typeof family.locale !== 'string' || !family.locale.trim()) error(errors, `${path}.locale`, 'is required');
  if (!CONFIDENCE.has(family.ownershipConfidence)) error(errors, `${path}.ownershipConfidence`, 'is invalid');

  const intentDisposition = family.intentDisposition ?? 'serve';
  if (!INTENT_DISPOSITIONS.has(intentDisposition)) error(errors, `${path}.intentDisposition`, 'is invalid');
  if (family.dispositionReason != null && (typeof family.dispositionReason !== 'string' || !family.dispositionReason.trim())) {
    error(errors, `${path}.dispositionReason`, 'must be a non-empty string when provided');
  }

  if (!Array.isArray(family.ownerUrls)) error(errors, `${path}.ownerUrls`, 'must be an array');
  else {
    const normalized = family.ownerUrls.map(normalizeUrl);
    if (new Set(normalized).size !== normalized.length) error(errors, `${path}.ownerUrls`, 'must not contain duplicates');
    for (const [ownerIndex, ownerUrl] of family.ownerUrls.entries()) {
      if (!sameOrigin(ownerUrl, siteOrigin)) error(errors, `${path}.ownerUrls[${ownerIndex}]`, 'must be a same-origin https URL');
      if (!canonicalUrls.has(normalizeUrl(ownerUrl))) error(errors, `${path}.ownerUrls[${ownerIndex}]`, 'must reference canonicalPages');
    }
  }

  if (intentDisposition === 'decline') {
    if (!Array.isArray(family.ownerUrls) || family.ownerUrls.length !== 0) {
      error(errors, `${path}.ownerUrls`, 'declined intents must not declare canonical owners');
    }
    if (typeof family.dispositionReason !== 'string' || !family.dispositionReason.trim()) {
      error(errors, `${path}.dispositionReason`, 'is required when intentDisposition is decline');
    }
  }

  for (const field of ['supportingPages', 'evidenceAssets']) {
    if (!Array.isArray(family[field])) error(errors, `${path}.${field}`, 'must be an array');
  }
  if (Array.isArray(family.supportingPages)) {
    const normalized = family.supportingPages.map(normalizeUrl);
    if (new Set(normalized).size !== normalized.length) error(errors, `${path}.supportingPages`, 'must not contain duplicates');
    for (const [supportIndex, url] of family.supportingPages.entries()) {
      if (!sameOrigin(url, siteOrigin)) error(errors, `${path}.supportingPages[${supportIndex}]`, 'must be a same-origin https URL');
      if (!canonicalUrls.has(normalizeUrl(url))) error(errors, `${path}.supportingPages[${supportIndex}]`, 'must reference canonicalPages');
    }
  }
  if (Array.isArray(family.evidenceAssets)) {
    const ids = new Set();
    for (const [assetIndex, asset] of family.evidenceAssets.entries()) {
      const assetPath = `${path}.evidenceAssets[${assetIndex}]`;
      if (!isObject(asset)) {
        error(errors, assetPath, 'must be an object');
        continue;
      }
      if (typeof asset.id !== 'string' || !asset.id.trim()) error(errors, `${assetPath}.id`, 'is required');
      else if (ids.has(asset.id)) error(errors, `${assetPath}.id`, 'must be unique within the family');
      else ids.add(asset.id);
      if (typeof asset.type !== 'string' || !asset.type.trim()) error(errors, `${assetPath}.type`, 'is required');
      if (asset.url != null && !parseHttps(asset.url)) error(errors, `${assetPath}.url`, 'must be an https URL when provided');
      if (!refsValid(asset.evidenceRefs || [])) error(errors, `${assetPath}.evidenceRefs`, 'must contain only http(s) or urn:sha256 references');
    }
  }

  if (!Array.isArray(family.observations)) error(errors, `${path}.observations`, 'must be an array');
  else family.observations.forEach((observation, observationIndex) => validateObservation(observation, index, observationIndex, siteOrigin, errors));
}

export function validateIntentOwnershipLedger(ledger) {
  const errors = [];
  const warnings = [];
  if (!isObject(ledger)) return { valid: false, errors: ['ledger must be an object'], warnings };
  if (ledger.version !== INTENT_OWNERSHIP_VERSION) error(errors, 'version', `must be ${INTENT_OWNERSHIP_VERSION}`);
  if (ledger.kind !== 'intent-ownership-ledger') error(errors, 'kind', 'must be intent-ownership-ledger');
  if (!isIso(ledger.reviewedAt)) error(errors, 'reviewedAt', 'must be an ISO date/time');

  const site = parseHttps(ledger.site?.url);
  if (!site) error(errors, 'site.url', 'must be an https URL without a fragment');
  if (ledger.site?.ownership !== 'owner-controlled') error(errors, 'site.ownership', 'must be owner-controlled');
  const siteOrigin = site?.origin || '__invalid__';

  if (!isObject(ledger.disclosure)) error(errors, 'disclosure', 'is required');
  else {
    if (!DISCLOSURE_CLASSES.has(ledger.disclosure.class)) error(errors, 'disclosure.class', 'is invalid');
    if (typeof ledger.disclosure.containsLiveQueries !== 'boolean') error(errors, 'disclosure.containsLiveQueries', 'must be boolean');
    if (['public-methodology', 'public-fixture'].includes(ledger.disclosure.class) && ledger.disclosure.containsLiveQueries) {
      error(errors, 'disclosure.containsLiveQueries', 'public records must not contain live query cohorts');
    }
  }

  const seenPages = new Set();
  if (!Array.isArray(ledger.canonicalPages) || ledger.canonicalPages.length === 0) error(errors, 'canonicalPages', 'must be a non-empty array');
  else ledger.canonicalPages.forEach((page, index) => validateCanonicalPage(page, index, siteOrigin, seenPages, errors));

  if (!Array.isArray(ledger.families) || ledger.families.length === 0) error(errors, 'families', 'must be a non-empty array');
  else {
    const familyIds = new Set();
    ledger.families.forEach((family, index) => {
      validateFamily(family, index, siteOrigin, seenPages, errors);
      if (typeof family?.id === 'string') {
        if (familyIds.has(family.id)) error(errors, `families[${index}].id`, 'must be unique');
        familyIds.add(family.id);
      }
    });
  }

  if (!isObject(ledger.guardrails)) error(errors, 'guardrails', 'is required');
  else {
    for (const key of [
      'noPagePerQueryVariant',
      'noCannibalizationInference',
      'noRankingClaim',
      'noCrossProviderMetricJoin',
      'humanReviewBeforeMutation'
    ]) {
      if (ledger.guardrails[key] !== true) error(errors, `guardrails.${key}`, 'must be true');
    }
  }

  if (ledger.disclosure?.containsLiveQueries && ledger.disclosure?.class === 'commercial-private') {
    warnings.push('ledger contains live owner query evidence; keep it outside public fixtures and generated public docs.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

function familyReport(family, pagesByUrl) {
  const ownerUrls = uniqueStrings((family.ownerUrls || []).map(normalizeUrl));
  const intentDisposition = family.intentDisposition ?? 'serve';
  let ownershipState;
  if (intentDisposition === 'decline') ownershipState = 'declined';
  else if (ownerUrls.length === 0) ownershipState = 'unowned';
  else if (ownerUrls.length > 1) ownershipState = 'fragmented';
  else ownershipState = pagesByUrl.get(ownerUrls[0])?.indexState === 'indexable' ? 'owned' : 'blocked-owner';

  const observedPages = uniqueStrings((family.observations || []).map(item => normalizeUrl(item.pageUrl))).sort();
  const observedProviders = uniqueStrings((family.observations || []).map(item => item.provider)).sort();
  const owner = ownerUrls.length === 1 ? ownerUrls[0] : null;
  const observedOffOwner = Boolean(owner) && observedPages.some(url => url !== owner);
  const ownerObserved = Boolean(owner) && observedPages.includes(owner);

  const attention = [];
  if (ownershipState === 'unowned') {
    attention.push({
      code: 'review-owner-gap',
      priority: 'P1',
      message: 'No canonical owner is declared. Review whether an existing page can own the intent before considering a new URL.'
    });
  }
  if (ownershipState === 'fragmented') {
    attention.push({
      code: 'review-fragmented-ownership',
      priority: 'P1',
      message: 'Multiple canonical owner candidates are declared. Choose one only when product/content semantics justify consolidation; do not redirect or canonicalize automatically.'
    });
  }
  if (ownershipState === 'blocked-owner') {
    attention.push({
      code: 'review-blocked-owner',
      priority: 'P0',
      message: 'The declared owner is not observed as indexable in this ledger. Repair or re-review the ownership contract before Search/AI optimization.'
    });
  }
  if (observedOffOwner) {
    attention.push({
      code: 'review-observed-off-owner',
      priority: 'P1',
      message: 'Owner-side observations land on other canonical pages. Inspect intent clarity, linking and canonical signals; this is not proof of keyword cannibalization.'
    });
  }
  if (ownershipState === 'owned' && family.evidenceAssets.length === 0) {
    attention.push({
      code: 'strengthen-evidence-path',
      priority: 'P2',
      message: 'The owner has no recorded evidence assets. Add only real first-party examples, data, tools or sources that improve the page itself.'
    });
  }
  if (ownershipState === 'owned' && family.observations.length === 0) {
    attention.push({
      code: 'measure-owner',
      priority: 'P2',
      message: 'Ownership is declared but no owner-side Search/AI observation is recorded. External visibility remains unknown.'
    });
  }

  return {
    id: family.id,
    label: family.label,
    locale: family.locale,
    intentDisposition,
    dispositionReason: family.dispositionReason ?? null,
    ownershipState,
    ownershipConfidence: family.ownershipConfidence,
    ownerUrls,
    supportingPages: [...family.supportingPages].map(normalizeUrl).sort(),
    evidenceAssetCount: family.evidenceAssets.length,
    observationCount: family.observations.length,
    observedPages,
    observedProviders,
    ownerObserved,
    observedOffOwner,
    attention
  };
}

export function buildIntentOwnershipReport(ledger) {
  const validation = validateIntentOwnershipLedger(ledger);
  if (!validation.valid) throw new Error(`Invalid Intent Ownership ledger:\n- ${validation.errors.join('\n- ')}`);

  const pagesByUrl = new Map(ledger.canonicalPages.map(page => [normalizeUrl(page.url), page]));
  const families = ledger.families.map(family => familyReport(family, pagesByUrl)).sort((a, b) => a.id.localeCompare(b.id));
  const byState = Object.fromEntries(INTENT_OWNERSHIP_STATES.map(state => [state, families.filter(item => item.ownershipState === state).length]));
  const byProvider = {};
  for (const family of ledger.families) {
    for (const observation of family.observations) {
      byProvider[observation.provider] ??= { observationCount: 0, familyIds: new Set() };
      byProvider[observation.provider].observationCount += 1;
      byProvider[observation.provider].familyIds.add(family.id);
    }
  }

  const providerSummary = Object.fromEntries(
    Object.entries(byProvider)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([provider, value]) => [provider, {
        observationCount: value.observationCount,
        familyCount: value.familyIds.size
      }])
  );

  return {
    version: INTENT_OWNERSHIP_VERSION,
    kind: 'intent-ownership-report',
    site: ledger.site,
    reviewedAt: ledger.reviewedAt,
    disclosureClass: ledger.disclosure.class,
    summary: {
      familyCount: families.length,
      byState,
      familiesNeedingAttention: families.filter(item => item.attention.length > 0).length,
      observationsByProvider: providerSummary
    },
    families,
    boundaries: {
      queryVariantCreatesPage: false,
      declinedIntentCreatesPage: false,
      offOwnerObservationProvesCannibalization: false,
      ownershipProvesRankingOrCitation: false,
      providerMetricsCombined: false,
      productionMutationAuthorized: false
    }
  };
}
