/**
 * One-action Search failure triage over existing bounded Technical Integrity
 * evidence and optional, explicitly owner-supplied observations.
 *
 * This is not a ranking estimator, a Google API adapter or an experiment truth
 * store. Unknown, preliminary and synthetic observations never become zeros.
 */

export const SEARCH_FAILURE_DOCTOR_VERSION = '0.1';

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(label + ' must be an object.');
  }
  return value;
}

function siteKey(value) {
  if (typeof value !== 'string') throw new Error('An HTTPS site URL is required.');
  let url;
  try { url = new URL(value); } catch { throw new Error('An absolute HTTPS site URL is required.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Site identity must be an HTTPS URL without credentials, query or fragment.');
  }
  const pathname = url.pathname.replace(/\/+$/, '') + '/';
  return url.origin + pathname;
}

function validDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || Number.isNaN(Date.parse(value + 'T00:00:00Z'))
    || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) {
    throw new Error(label + ' must be a valid YYYY-MM-DD date.');
  }
  return value;
}

function count(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(label + ' must be a non-negative safe integer.');
  }
  return value;
}

function optionalText(value, label) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > 256) {
    throw new Error(label + ' must be a short non-empty string or null.');
  }
  return value.trim();
}

function validateOwner(raw, site) {
  if (!raw) return null;
  const owner = record(raw, 'Owner evidence');
  if (owner.version !== '0.1' || !['owner-supplied', 'synthetic'].includes(owner.dataStatus)) {
    throw new Error('Owner evidence requires version 0.1 and dataStatus owner-supplied or synthetic.');
  }
  if (siteKey(owner.site) !== site) throw new Error('Owner evidence site does not match the selected site.');
  if (owner.deployment !== undefined) {
    const d = record(owner.deployment, 'deployment');
    optionalText(d.expectedRef, 'deployment.expectedRef');
    optionalText(d.liveRef, 'deployment.liveRef');
    if (d.deployedOn != null) validDate(d.deployedOn, 'deployment.deployedOn');
  }
  if (owner.indexing !== undefined) {
    const i = record(owner.indexing, 'indexing');
    count(i.inspectedApprovedUrls, 'indexing.inspectedApprovedUrls');
    count(i.indexedApprovedUrls, 'indexing.indexedApprovedUrls');
    if (i.indexedApprovedUrls > i.inspectedApprovedUrls) {
      throw new Error('Indexed inspected URLs cannot exceed inspected URLs.');
    }
  }
  if (owner.search !== undefined) {
    const s = record(owner.search, 'search');
    if (s.provider !== 'google-search-console' || s.scope !== 'property' || s.searchType !== 'web'
      || !['final', 'preliminary'].includes(s.dataState)) {
      throw new Error('Search evidence must identify Google Web Search property totals and final/preliminary state.');
    }
    optionalText(s.property, 'search.property');
    if (!s.property) throw new Error('search.property is required.');
    validDate(s.startDate, 'search.startDate');
    validDate(s.endDate, 'search.endDate');
    if (s.endDate < s.startDate) throw new Error('Search endDate must not precede startDate.');
    count(s.impressions, 'search.impressions');
    count(s.clicks, 'search.clicks');
    if (s.clicks > s.impressions) throw new Error('Search clicks cannot exceed impressions.');
  }
  return owner;
}

function validateTechnical(raw, site) {
  if (!raw) return null;
  const report = record(raw, 'Technical report');
  if (siteKey(report.canonicalUrl) !== site) throw new Error('Technical report site does not match the selected site.');
  if (!Array.isArray(report.checks)) throw new Error('Technical report requires the checks array.');
  for (const check of report.checks) {
    record(check, 'Technical check');
    if (typeof check.id !== 'string' || !['P0', 'P1', 'P2'].includes(check.priority)
      || !['pass', 'fail', 'watch', 'not-applicable'].includes(check.status)) {
      throw new Error('Technical check requires an id, priority and known status.');
    }
  }
  return report;
}

function move(code, stage, why, action, verify, hold, evidenceClass) {
  return { code, stage, why, action, verify, hold, evidenceClass };
}

export function diagnoseSearchFailure({ site, technical = null, owner = null } = {}) {
  const selected = siteKey(site || technical?.canonicalUrl || owner?.site);
  const report = validateTechnical(technical, selected);
  const supplied = validateOwner(owner, selected);
  const observations = supplied?.dataStatus === 'owner-supplied' ? supplied : null;
  const deployment = observations?.deployment || null;
  const indexing = observations?.indexing || null;
  const search = observations?.search || null;

  const issues = (report?.checks || [])
    .filter(check => check.status === 'fail')
    .sort((a, b) => ['P0', 'P1', 'P2'].indexOf(a.priority) - ['P0', 'P1', 'P2'].indexOf(b.priority));
  const p0 = issues.find(check => check.priority === 'P0');
  const warnings = (report?.checks || []).filter(check => check.status === 'watch');

  const revisionMismatch = !!(deployment?.expectedRef && deployment?.liveRef
    && deployment.expectedRef !== deployment.liveRef);
  const deployedOn = deployment?.deployedOn || null;
  const reportPredatesDeployment = !!(search && deployedOn && search.endDate < deployedOn);
  const usableSearch = !!(search && search.dataState === 'final' && !reportPredatesDeployment);

  const stages = {
    publication: revisionMismatch ? 'owner-reported-mismatch'
      : deployment?.expectedRef && deployment.liveRef ? 'owner-reported-match' : 'unknown',
    publicEligibility: !report ? 'unknown' : p0 ? 'bounded-failure'
      : warnings.length ? 'bounded-review' : 'no-bounded-p0-failure',
    indexing: !indexing || indexing.inspectedApprovedUrls === 0 ? 'unknown'
      : indexing.indexedApprovedUrls === 0 ? 'none-in-inspected-sample'
      : indexing.indexedApprovedUrls < indexing.inspectedApprovedUrls ? 'partial-inspected-sample' : 'all-in-inspected-sample',
    exposure: !search ? 'unknown'
      : reportPredatesDeployment ? 'predeployment-evidence'
      : search.dataState !== 'final' ? 'preliminary-unknown'
      : search.impressions === 0 ? 'zero-reported-property-impressions' : 'reported-property-impressions',
    visitsFromSearch: !usableSearch ? 'unknown'
      : search.clicks === 0 ? 'zero-reported-property-clicks' : 'reported-property-clicks'
  };

  const unknowns = [];
  if (!report) unknowns.push('Public HTTP, robots and canonical eligibility have not been inspected.');
  if (!deployment?.expectedRef || !deployment?.liveRef) {
    unknowns.push('Exact expected versus live production revision is not established.');
  }
  if (!indexing || indexing.inspectedApprovedUrls === 0) {
    unknowns.push('Owner URL Inspection evidence for approved representative pages is missing.');
  }
  if (!search) unknowns.push('Final property-scoped Google Web Search impressions and clicks are unavailable.');
  if (search?.dataState === 'preliminary') unknowns.push('Search counts are preliminary and cannot support a final-period diagnosis.');
  if (reportPredatesDeployment) unknowns.push('The Search report ends before the declared deployment date; it cannot evaluate that deployment.');
  if (supplied?.dataStatus === 'synthetic') unknowns.push('Synthetic example data are excluded from every outcome decision.');
  if (report && warnings.length) unknowns.push('Bounded WATCH findings need context; WATCH does not mean an indexing failure.');

  let primary;
  if (revisionMismatch) {
    primary = move('verify-live-revision', 'publication',
      'The owner-provided expected and live revision identifiers disagree.',
      'Check the live deployment against the intended release. Resolve the mismatch before changing page content.',
      'Record the exact observed production revision and its deployed date, then repeat the affected check.',
      'A Git commit or merged pull request alone does not prove a site was deployed.', 'owner-supplied');
  } else if (p0) {
    primary = move('review-technical-blocker', 'publicEligibility',
      'A bounded public audit flagged ' + p0.id + ' (' + p0.priority + ').',
      'Inspect the final HTTP response and owning source for this exact finding; correct it only if the page is intended to be public and indexable.',
      'Re-run the same check on the actual deployed page and preserve its request/response evidence.',
      'A failed bounded check is not proof of Google deindexing or a ranking cause.', 'bounded-public-audit');
    primary.checkId = p0.id;
  } else if (indexing && indexing.inspectedApprovedUrls > 0
    && indexing.indexedApprovedUrls < indexing.inspectedApprovedUrls) {
    primary = move('review-indexing-sample', 'indexing',
      'Owner-provided URL Inspection shows ' + indexing.indexedApprovedUrls + ' indexed of '
        + indexing.inspectedApprovedUrls + ' inspected approved URLs.',
      'Open URL Inspection exclusion reasons for the affected approved pages, distinguish canonical/deduplication from unwanted noindex, and repair only confirmed defects.',
      'Inspect the same URLs again after a documented deployment; retain missing and unchanged results.',
      'A small inspected sample is not the sitewide indexed-page count.', 'owner-supplied');
  } else if (usableSearch && search.impressions === 0) {
    if (!indexing || indexing.inspectedApprovedUrls === 0) {
      primary = move('collect-indexing-evidence', 'indexing',
        'The final owner-provided property report contains zero impressions, but indexing evidence is missing.',
        'Inspect a small set of important approved pages in Search Console before rewriting content or adding URLs.',
        'Record each exact page, reported indexing state and reason; check property and date scope.',
        'Zero impressions do not prove that the site is blocked, penalized or has zero demand.', 'owner-supplied');
    } else {
      primary = move('review-query-fit', 'exposure',
        'The owner-provided final Google Web Search property report contains zero impressions in its stated period.',
        'Review one important indexed page, its user question and a distinct useful answer; check the correct Search property and query context.',
        'Compare the same property, search type and final periods after an exact deployed change.',
        'Do not manufacture keyword demand, mass-publish query variants or infer an AI citation outcome.', 'owner-supplied');
    }
  } else if (usableSearch && search.impressions > 0 && search.clicks === 0) {
    primary = move('review-selection-evidence', 'visitsFromSearch',
      'The final property report has impressions but no recorded clicks in the selected period.',
      'Inspect real joint query-and-page evidence and the actual result title/snippet for one existing page before changing it.',
      'Use the same property, segment and comparable final periods; note small denominators and alternate query intent.',
      'No clicks alone do not prove a broken title, a fixed CTR target or missing conversions.', 'owner-supplied');
  } else if (issues.length) {
    primary = move('review-technical-finding', 'publicEligibility',
      'A bounded public audit flagged ' + issues[0].id + ' (' + issues[0].priority + ').',
      'Confirm that the finding applies to an important published page before repairing its exact source.',
      'Re-run the bounded check on the final deployed page, without expanding the audit into a ranking claim.',
      'Optional technical findings may be less useful than an actual audience or content problem.', 'bounded-public-audit');
    primary.checkId = issues[0].id;
  } else if (usableSearch && search.clicks > 0) {
    primary = move('define-useful-outcome', 'usefulAction',
      'The owner-provided final Search report shows visits, but not whether visitors achieved the site goal.',
      'Choose one useful next action on an existing page and establish a real owner-side measure of its completion.',
      'Review actual use alongside Search visibility, without treating one as proof that it caused the other.',
      'Search clicks are not purchases, signups, task completions or conversion evidence.', 'owner-supplied');
  } else {
    primary = move('establish-evidence', 'publication',
      'The available evidence cannot establish the first broken stage.',
      report ? 'Check representative approved pages with owner URL Inspection and collect the same-property final Search report.'
        : 'Run a bounded public Technical Integrity audit, then obtain URL Inspection and final Search observations for the same site.',
      'Record the exact live revision, checked URLs, property, dates and missing evidence before choosing a site change.',
      'Do not treat an inconclusive crawl, synthetic fixture, missing export or preliminary report as zero visibility.', 'unknown');
  }

  return {
    version: SEARCH_FAILURE_DOCTOR_VERSION,
    site: selected,
    primary,
    stages,
    unknowns,
    sourceState: {
      technical: report ? 'bounded-public-audit' : 'not-provided',
      owner: observations ? 'owner-supplied-unverified' : supplied ? 'synthetic-excluded' : 'not-provided',
      googleSearchPeriod: usableSearch ? { startDate: search.startDate, endDate: search.endDate, searchType: 'web' } : null
    },
    guardrails: {
      noCompositeScore: true,
      noRankingOrCitationPromise: true,
      ownerClaimsAreNotIndependentlyVerified: true,
      boundedAuditIsNotIndexingProof: true,
      noAutomaticSiteMutation: true,
      missingDataRemainUnknown: true
    }
  };
}

export function formatSearchFailureDiagnosis(result) {
  const lines = [
    'Goose Search Failure Doctor — ' + result.site,
    '',
    'Start here: ' + result.primary.action,
    'Why: ' + result.primary.why,
    'Check it: ' + result.primary.verify,
    'When not to do it: ' + result.primary.hold,
    'Evidence: ' + result.primary.evidenceClass,
    '',
    'Observed stages:'
  ];
  for (const [key, state] of Object.entries(result.stages)) lines.push('  ' + key + ': ' + state);
  if (result.unknowns.length) {
    lines.push('', 'Still unknown:');
    for (const unknown of result.unknowns) lines.push('  - ' + unknown);
  }
  lines.push('', 'This is a scoped triage decision, not a ranking score or proof of Search improvement.');
  return lines.join('\n');
}
