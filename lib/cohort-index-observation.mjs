import { planCohortSearchObservation, validateCohortPageMap } from './cohort-search-observation.mjs';

// This is a read-only interpretation of a dated, owner-supplied URL Inspection
// snapshot. The frozen cohort and private page map remain authoritative.
// Google URL Inspection describes the indexed version, NOT a live HTTP test.
const FETCH_ERRORS = new Set([
  'SOFT_404', 'BLOCKED_ROBOTS_TXT', 'NOT_FOUND', 'ACCESS_DENIED',
  'SERVER_ERROR', 'REDIRECT_ERROR', 'ACCESS_FORBIDDEN', 'BLOCKED_4XX',
  'INTERNAL_CRAWL_ERROR', 'INVALID_URL'
]);
const NOINDEX = new Set(['BLOCKED_BY_META_TAG', 'BLOCKED_BY_HTTP_HEADER']);
const STATES = [
  'indexed', 'discovered-not-indexed', 'crawled-not-indexed',
  'unknown-to-google', 'blocked-robots', 'blocked-noindex', 'fetch-problem',
  'other-excluded', 'unresolved', 'not-inspected'
];

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validTimestamp(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)
    || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || !Number.isFinite(Date.parse(value))) {
    throw new Error(label + ' must be a valid timezone-aware RFC3339-like observation timestamp.');
  }
  const parsed = new Date(value).toISOString();
  if (Number.isNaN(Date.parse(value.slice(0, 10) + 'T00:00:00Z'))
    || new Date(value.slice(0, 10) + 'T00:00:00Z').toISOString().slice(0, 10) !== value.slice(0, 10)) {
    throw new Error(label + ' must include a real calendar date.');
  }
  return parsed;
}

function canonicalComparable(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.href;
  } catch {
    return null;
  }
}

function inspectionPageUrl(value) {
  const url = canonicalComparable(value);
  if (!url) throw new Error('Inspection rows require valid absolute HTTP(S) URLs.');
  // The report may contain pages from outside the cohort; they are counted as
  // unmatched but must never be used as proof for a frozen member.
  return url;
}

function classify(row) {
  const coverage = typeof row.coverageState === 'string' ? row.coverageState.trim() : '';
  const robots = row.robotsTxtState;
  const index = row.indexingState;
  const fetch = row.pageFetchState;
  const verdict = row.verdict;
  if (robots === 'DISALLOWED' || index === 'BLOCKED_BY_ROBOTS_TXT' || fetch === 'BLOCKED_ROBOTS_TXT') return 'blocked-robots';
  if (NOINDEX.has(index)) return 'blocked-noindex';
  if (FETCH_ERRORS.has(fetch)) return 'fetch-problem';
  // A PASS verdict is useful but is not an adequate proof by itself when the
  // coverage label disagrees, is missing, or describes an excluded URL.
  const labelIndexed = /^(submitted and indexed|indexed, not submitted in sitemap)$/i.test(coverage);
  if (labelIndexed && verdict === 'PASS') return 'indexed';
  if (labelIndexed && verdict !== 'PASS') return 'unresolved';
  if (coverage === 'Discovered - currently not indexed' && verdict !== 'PASS') return 'discovered-not-indexed';
  if (coverage === 'Crawled - currently not indexed' && verdict !== 'PASS') return 'crawled-not-indexed';
  if (coverage === 'URL is unknown to Google' && verdict !== 'PASS') return 'unknown-to-google';
  if (coverage && verdict === 'NEUTRAL') return 'other-excluded';
  return 'unresolved';
}

function emptyCounts() {
  return Object.fromEntries(STATES.map(state => [state, 0]));
}

function groupView(members, group) {
  const selected = members.filter(member => member.group === group);
  const counts = emptyCounts();
  for (const member of selected) counts[member.state] += 1;
  return {
    frozenMembers: selected.length,
    inspectedMembers: selected.length - counts['not-inspected'],
    stateCounts: counts,
    // Preserve the actual frozen IDs. No URL or query strings are emitted.
    memberIdsByState: Object.fromEntries(STATES.map(state => [
      state, selected.filter(member => member.state === state).map(member => member.id)
    ])),
    canonicalDifferenceMembers: selected.filter(member => member.canonicalDifferenceObserved).map(member => member.id),
    lastCrawlNotAfterDeploymentMembers: selected.filter(member => member.lastCrawlNotAfterDeployment).map(member => member.id)
  };
}

function getSnapshot(cohort, snapshot) {
  if (!record(snapshot)) throw new Error('An owner-supplied URL Inspection snapshot object is required.');
  // Support the exact envelope already written by the Ptichi search recovery
  // read-only collection. Do not guess property scope from arbitrary rows.
  if (!record(snapshot.properties) || !record(snapshot.properties[cohort.site])) {
    throw new Error('Snapshot must explicitly contain the frozen exact site property.');
  }
  const current = snapshot.current_url_inspection;
  if (!record(current) || !Array.isArray(current.rows)) {
    throw new Error('Snapshot must contain current_url_inspection.rows from a dated URL Inspection capture.');
  }
  if (!Number.isSafeInteger(current.total) || current.total !== current.rows.length) {
    throw new Error('The reported URL Inspection total must equal the complete rows array. A partial capture is not a complete snapshot.');
  }
  if (current.rows.length > 100_000) throw new Error('URL Inspection snapshot exceeds the local 100000-row review limit.');
  const observedAt = validTimestamp(current.observed_at ?? snapshot.observed_at, 'URL Inspection observed_at');
  if (record(current.counts)) {
    const actual = new Map();
    for (const row of current.rows) {
      if (!record(row)) throw new Error('URL Inspection rows must be objects.');
      const value = row.coverageState;
      if (typeof value !== 'string' || !value.trim()) throw new Error('Each URL Inspection row needs an explicit coverageState.');
      actual.set(value, (actual.get(value) || 0) + 1);
    }
    if (actual.size !== Object.keys(current.counts).length) {
      throw new Error('Snapshot coverageState counts disagree with the raw rows.');
    }
    for (const [coverage, value] of actual) {
      if (current.counts[coverage] !== value) throw new Error('Snapshot coverageState counts disagree with the raw rows.');
    }
  }
  return { current, observedAt };
}

export function reviewCohortIndexInspection(cohort, pageMap, source, options = {}) {
  const { current, observedAt } = getSnapshot(cohort, source);
  const observedDay = observedAt.slice(0, 10);
  const plan = planCohortSearchObservation(cohort, {
    productionRef: options.productionRef,
    deploymentDate: options.deploymentDate,
    asOf: observedDay
  });
  if (plan.productionGate !== 'ready') {
    throw new Error('Frozen production gate is on HOLD. Do not attribute an index snapshot to the treatment.');
  }
  const pageMapping = validateCohortPageMap(cohort, pageMap);
  const observations = new Map();
  for (const row of current.rows) {
    if (!record(row)) throw new Error('URL Inspection rows must be objects.');
    if (typeof row.coverageState !== 'string' || !row.coverageState.trim()) {
      throw new Error('Each URL Inspection row must have coverageState.');
    }
    const url = inspectionPageUrl(row.url);
    if (observations.has(url)) throw new Error('Duplicate inspected URL: snapshot cannot count a URL twice.');
    const state = classify(row);
    let lastCrawlDate = null;
    if (row.lastCrawlTime !== undefined && row.lastCrawlTime !== null) {
      lastCrawlDate = validTimestamp(row.lastCrawlTime, 'lastCrawlTime').slice(0, 10);
    }
    const google = canonicalComparable(row.googleCanonical);
    const declared = canonicalComparable(row.userCanonical);
    observations.set(url, {
      state,
      coverageState: row.coverageState,
      lastCrawlDate,
      lastCrawlNotAfterDeployment: lastCrawlDate !== null && lastCrawlDate <= options.deploymentDate,
      // Differences may be legitimate; they request inspection, not automatic repair.
      canonicalDifferenceObserved: google !== null && declared !== null && google !== declared
    });
  }

  const members = pageMapping.members.map(member => {
    const row = observations.get(member.url);
    return {
      id: member.id,
      entity: member.entity,
      group: member.group,
      state: row?.state ?? 'not-inspected',
      coverageState: row?.coverageState ?? null,
      lastCrawlDate: row?.lastCrawlDate ?? null,
      lastCrawlNotAfterDeployment: row?.lastCrawlNotAfterDeployment ?? false,
      canonicalDifferenceObserved: row?.canonicalDifferenceObserved ?? false
    };
  });
  const treatment = groupView(members, 'treatment');
  const control = groupView(members, 'control');
  const remaining = current.rows.length - members.filter(member => member.state !== 'not-inspected').length;

  const nextChecks = [];
  if (treatment.stateCounts['not-inspected'] || control.stateCounts['not-inspected']) {
    nextChecks.push('Inspect the missing frozen members in the same indexed-version Search Console report; absent rows are not a confirmed Google unknown state.');
  }
  const unknown = treatment.stateCounts['unknown-to-google'] + control.stateCounts['unknown-to-google'];
  const discovered = treatment.stateCounts['discovered-not-indexed'] + control.stateCounts['discovered-not-indexed'];
  if (unknown) nextChecks.push('For pages Google reports as unknown, check current discovery paths, sitemap processing and any URL migration; do not manufacture new pages or assume a ranking penalty.');
  if (discovered) nextChecks.push('For discovered but not indexed pages, review dated crawl evidence, their standalone value and migration state. URL Inspection does not reveal a definitive cause.');
  if (treatment.stateCounts['crawled-not-indexed'] || control.stateCounts['crawled-not-indexed']) {
    nextChecks.push('For crawled but not indexed pages, inspect the specific Search Console exclusion and actual page content before changing templates or canonicals.');
  }
  const blocked = ['blocked-robots', 'blocked-noindex', 'fetch-problem'];
  if (blocked.some(state => treatment.stateCounts[state] || control.stateCounts[state])) {
    nextChecks.push('Review actual access, noindex and fetch errors against intentional publishing policy; the indexed-version API is not a live HTTP verification.');
  }
  if (treatment.canonicalDifferenceMembers.length || control.canonicalDifferenceMembers.length) {
    nextChecks.push('Reconcile any Google-selected vs publisher-declared canonical differences with current pages and redirects; a difference is not automatically a defect.');
  }
  if (treatment.lastCrawlNotAfterDeploymentMembers.length || control.lastCrawlNotAfterDeploymentMembers.length) {
    nextChecks.push('Do not attribute pages last crawled before or on the deployment date to post-release changes. Wait for a verified recrawl before outcome inference.');
  }
  if (treatment.stateCounts.indexed || control.stateCounts.indexed) {
    nextChecks.push('For reported indexed pages, inspect separate owner Web Search page/query observations and useful tasks. Indexing alone is not acquisition.');
  }
  if (!nextChecks.length) nextChecks.push('Refresh the bounded URL Inspection snapshot when needed and preserve the prior dated observation; this output is not a ranking or causal result.');

  return {
    version: '0.1',
    kind: 'cohort-url-index-observation',
    cohortId: cohort.id,
    site: cohort.site,
    sourceClass: 'owner-supplied-url-inspection-snapshot',
    indexedVersionNotLiveTest: true,
    ownerSourceAuthenticatedByThisTool: false,
    observedAt,
    observedProductionRefClaim: options.productionRef,
    deploymentDateClaim: options.deploymentDate,
    productionGate: plan.productionGate,
    frozen: {
      treatment: treatment.frozenMembers,
      control: control.frozenMembers,
      searchQueries: cohort.queryPanel.queries.length
    },
    snapshot: {
      inspectedRows: current.rows.length,
      matchedFrozenMembers: treatment.inspectedMembers + control.inspectedMembers,
      outsideFrozenMembers: remaining
    },
    treatment,
    control,
    members,
    nextChecks,
    noOutcomeDecision: true,
    limitations: [
      'The source is a dated owner-supplied observation, not independently authenticated by Goose.',
      'Google URL Inspection API describes the indexed version and cannot verify current live HTTP or the real-time page state.',
      'Observed indexed/discovered/unknown states are snapshot classifications, not causes of ranking or indexing decisions.',
      'No inspection row means not inspected in this snapshot, not zero impressions or unknown to Google.',
      'Coverage labels are provider text: unknown/mismatched labels stay unresolved instead of being converted into a pass.',
      'Last crawl on the deployment day is not evidence that the new version was crawled without an exact timestamp.',
      'This inspection does not replace the provider Web Search page/query export, baseline comparison or useful-action data.',
      'No causal claim or automatic keep/revise/retire decision is generated.'
    ]
  };
}
