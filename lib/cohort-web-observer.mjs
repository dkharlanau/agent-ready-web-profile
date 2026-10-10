import {
  planCohortSearchObservation,
  validateCohortPageMap
} from './cohort-search-observation.mjs';

// This adapter reads existing, privately held Search Console Web Search evidence.
// It does not call Google, infer missing rows as zero, or create an experiment
// status separate from the supplied frozen Controlled Cohort.
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86400000;

function day(value, field) {
  if (typeof value !== 'string' || !datePattern.test(value)) {
    throw new Error(field + ' must be a YYYY-MM-DD calendar date.');
  }
  const ms = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) {
    throw new Error(field + ' is not a real calendar date.');
  }
  return ms;
}

function count(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(label + ' must be a non-negative safe integer count.');
  }
  return value;
}

function add(current, n) {
  const sum = (current ?? 0) + n;
  if (!Number.isSafeInteger(sum)) throw new Error('Owner Web Search metrics exceed safe integer precision.');
  return sum;
}

function searchKey(value) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function extractPropertyTotal(property, reportStart, reportEnd) {
  const response = property.windows?.current28?.totals;
  if (!isObject(response) || response.available !== true) {
    throw new Error('Read-only observer current28 property totals are unavailable or incomplete.');
  }
  const obj = response.response;
  if (!isObject(obj)) throw new Error('Observer current28 property totals need a provider response.');
  const rows = obj.rows ?? [];
  if (!Array.isArray(rows) || rows.length > 1) {
    throw new Error('Property totals must be a single aggregate row or no returned rows.');
  }
  if (!rows.length) return {
    population: 'property-aggregate', observed: false,
    clicks: null, impressions: null, period: { start: reportStart, end: reportEnd }
  };
  if (obj.responseAggregationType !== 'byProperty') {
    throw new Error('Provider property totals are not grouped by property.');
  }
  const value = rows[0];
  if (!isObject(value)) throw new Error('Property total must be a row object.');
  return {
    population: 'property-aggregate', observed: true,
    clicks: count(value.clicks, 'Property clicks'),
    impressions: count(value.impressions, 'Property impressions'),
    period: { start: reportStart, end: reportEnd }
  };
}

export function reviewCohortObserverWeb(cohort, pageMap, source, options = {}) {
  if (!isObject(source) || source.schema_version !== 1
    || source.search_type !== 'web' || source.data_state !== 'final'
    || source.timezone !== 'America/Los_Angeles') {
    throw new Error('Expected the dated Ptichi read-only observer v1 final Web report in Search Console Pacific Time.');
  }
  if (source.partial !== false) {
    throw new Error('Read-only owner observer report is partial or incompletely verified; do not infer coverage from it.');
  }
  if (typeof source.retrieved_at !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/.test(source.retrieved_at)
      || !Number.isFinite(Date.parse(source.retrieved_at))) {
    throw new Error('Observer report needs a timezone-aware retrieved_at timestamp.');
  }
  if (!isObject(source.properties) || !isObject(source.properties[cohort.site])) {
    throw new Error('Observer report must contain the exact frozen Search Console URL-prefix property.');
  }
  const property = source.properties[cohort.site];
  if (!isObject(property.windows) || !isObject(property.windows.current28)) {
    throw new Error('Observer report must contain the exact current28 window.');
  }
  const window = property.windows.current28;
  const start = day(window.start, 'current28.start');
  const end = day(window.end, 'current28.end');
  if (end - start !== 27 * DAY) throw new Error('current28 must be exactly 28 calendar days, inclusive.');
  if (source.cutoff !== window.end) {
    throw new Error('current28.end must equal the owner reported final data cutoff.');
  }
  if (end > Date.parse(source.retrieved_at)) {
    throw new Error('Final owner data cutoff must not be later than report retrieval.');
  }
  const plan = planCohortSearchObservation(cohort, {
    productionRef: options.productionRef,
    deploymentDate: options.deploymentDate,
    asOf: source.retrieved_at.slice(0, 10),
    finalDataThrough: source.cutoff
  });
  if (plan.productionGate !== 'ready') {
    throw new Error('Frozen production gate remains on HOLD. Do not attribute owner data to this treatment.');
  }
  const map = validateCohortPageMap(cohort, pageMap);
  const aggregate = extractPropertyTotal(property, window.start, window.end);

  // scripts/search-observe.py collects one joint 28-day page/query dimension.
  // Separate page and query tables must never be cross-joined into fake rows.
  const joint = property.dimensions?.page_query;
  if (!isObject(joint) || joint.available !== true || !isObject(joint.response)) {
    throw new Error('Owner page_query data is unavailable; never reconstruct it from separate Pages/Queries totals.');
  }
  if (typeof joint.row_limit_reached !== 'boolean') {
    throw new Error('Observer page_query dimension must declare row_limit_reached.');
  }
  const rows = joint.response.rows ?? [];
  if (!Array.isArray(rows) || rows.length > 25_000) {
    throw new Error('Owner page_query export exceeds the 25,000-row per-request limit.');
  }
  if (rows.length && joint.response.responseAggregationType !== 'byPage') {
    throw new Error('Joint page/query rows must be the provider byPage population, not property totals.');
  }
  const normalizedPanel = new Map();
  for (const query of cohort.queryPanel.queries) {
    const key = searchKey(query.text);
    normalizedPanel.set(key, [...(normalizedPanel.get(key) ?? []), query.id]);
  }
  const memberResults = new Map(map.members.map(member => [member.id, {
    id: member.id, entity: member.entity, group: member.group,
    state: 'not-returned-in-owner-export',
    returnedRows: 0, clicks: null, impressions: null,
    frozenPanelRows: 0, frozenPanelClicks: null, frozenPanelImpressions: null
  }]));
  const seen = new Set(), panelIds = new Set();
  let matched = 0, outsideCohort = 0, nonPanel = 0;
  for (const raw of rows) {
    if (!isObject(raw) || !Array.isArray(raw.keys) || raw.keys.length !== 2
        || raw.keys.some(key => typeof key !== 'string' || !key.trim())) {
      throw new Error('Every owner page_query row must have one page URL and one nonempty raw search query.');
    }
    const [page, query] = raw.keys;
    const clicks = count(raw.clicks, 'Page/query clicks');
    const impressions = count(raw.impressions, 'Page/query impressions');
    let url;
    try { url = new URL(page).href; } catch { throw new Error('Invalid owner page_query URL.'); }
    const key = JSON.stringify([url, query]);
    if (seen.has(key)) throw new Error('Duplicate page/query row; concatenated or overlapping exports cannot be silently summed.');
    seen.add(key);
    const member = map.byUrl.get(url);
    if (!member) { outsideCohort++; continue; }
    matched++;
    const result = memberResults.get(member.id);
    result.state = 'returned-in-owner-export';
    result.returnedRows += 1;
    result.clicks = add(result.clicks, clicks);
    result.impressions = add(result.impressions, impressions);
    const ids = normalizedPanel.get(searchKey(query));
    if (ids) {
      result.frozenPanelRows += 1;
      result.frozenPanelClicks = add(result.frozenPanelClicks, clicks);
      result.frozenPanelImpressions = add(result.frozenPanelImpressions, impressions);
      for (const id of ids) panelIds.add(id);
    } else nonPanel++;
  }

  const members = [...memberResults.values()];
  const groupSummary = group => {
    const groupMembers = members.filter(member => member.group === group);
    const returned = groupMembers.filter(member => member.state === 'returned-in-owner-export');
    const sum = field => returned.length
      ? returned.reduce((current, member) => add(current, member[field] ?? 0), 0)
      : null;
    return {
      frozenMembers: groupMembers.length,
      returnedMembers: returned.length,
      noReturnedRowsMemberIds: groupMembers
        .filter(member => member.state === 'not-returned-in-owner-export').map(member => member.id),
      returnedRows: returned.reduce((n, member) => n + member.returnedRows, 0),
      visiblePageQueryClicks: sum('clicks'),
      visiblePageQueryImpressions: sum('impressions'),
      visibleFrozenPanelClicks: sum('frozenPanelClicks'),
      visibleFrozenPanelImpressions: sum('frozenPanelImpressions')
    };
  };
  const frozenWindow = plan.windows.find(w => w.startDate === window.start && w.endDate === window.end);
  return {
    version: '0.1',
    kind: 'cohort-observer-web-evidence',
    cohortId: cohort.id,
    site: cohort.site,
    productionGate: plan.productionGate,
    frozenImplementationRef: plan.implementationRef,
    reportScope: 'google-search-console-web-page-query',
    sourceFormat: 'search-observe-v1',
    sourceOwnerAuthenticatedByGoose: false,
    reportRetrievedAt: source.retrieved_at,
    reportingTimezone: source.timezone,
    dataStateOwnerDeclared: source.data_state,
    window: {
      name: 'current28', startDate: window.start, endDate: window.end,
      days: 28, frozenObservationWindowDays: frozenWindow?.days ?? null,
      // A rolling 28-day report is NOT a T28 frozen treatment window by default.
      coincidesWithFrozenWindow: Boolean(frozenWindow),
      frozenWindowReviewState: frozenWindow?.state ?? null
    },
    rowLimitReached: joint.row_limit_reached,
    status: joint.row_limit_reached
      ? 'provider-top-rows-truncated'
      : !rows.length ? 'no-page-query-rows-returned'
      : !matched ? 'no-frozen-cohort-page-query-rows'
      : 'descriptive-rolling-web-observation',
    propertyTopline: aggregate,
    observed: {
      pageQueryRowsReturned: rows.length,
      pageQueryRowsMatchedToFrozenCohort: matched,
      pageQueryRowsOutsideCohort: outsideCohort,
      matchedRowsOutsideFrozenPanel: nonPanel,
      frozenPanelQueryIdsReturned: [...panelIds].sort(),
      frozenPanelQueryIdsNotReturned: cohort.queryPanel.queries
        .map(query => query.id).filter(id => !panelIds.has(id)),
      treatment: groupSummary('treatment'),
      control: groupSummary('control')
    },
    members,
    noOutcomeDecision: true,
    causalImpactEstablished: false,
    limitations: [
      'This is private owner-supplied Google Web Search reporting data, not a new authenticated Google request by Goose.',
      'The rolling current28 observation is not the frozen T28 treatment window unless its exact start and end match.',
      'Date, page and query were NOT jointly returned. The report is a 28-day page+query aggregate without a day dimension.',
      'Property totals and byPage query rows are different provider populations and must never be added or called conversion rates.',
      'Google omits anonymized queries and may return only top page/query rows; no returned row is unknown, not zero.',
      'A reached 25,000-row limit means truncated provider evidence, never complete query coverage.',
      'Clicks are not verified readers or completed practice; indexed coverage and owner Search outcomes remain separate.',
      'This read-only review makes no causal attribution, winner declaration or implicit experiment-state mutation.'
    ]
  };
}
