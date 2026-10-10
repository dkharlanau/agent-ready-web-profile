import { evaluateMeasurementGate, summarizeControlledCohort } from './controlled-cohort.mjs';

// These are observation preparation and local evidence review helpers, not a new
// experiment state authority. The supplied frozen cohort is always canonical.
const DAY_MS = 86_400_000;
const SHA = /^[a-f0-9]{40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const REQUIRED_CSV_COLUMNS = ['date', 'page', 'query', 'clicks', 'impressions'];

function strictDay(value, label) {
  if (typeof value !== 'string' || !DATE.test(value)) throw new Error(label + ' must be YYYY-MM-DD.');
  const milliseconds = Date.parse(value + 'T00:00:00.000Z');
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 10) !== value) {
    throw new Error(label + ' must be a real calendar date.');
  }
  return milliseconds;
}

function dayAt(utcMillis) {
  return new Date(utcMillis).toISOString().slice(0, 10);
}

function ensureRef(ref, label) {
  if (typeof ref !== 'string' || !SHA.test(ref)) throw new Error(label + ' must be a full, lowercase, 40-character SHA.');
}

function assertFrozenCohort(cohort) {
  const summary = summarizeControlledCohort(cohort); // includes the existing schema + semantic checks
  if (cohort.queryPanel.frozenBeforeOutcomeReview !== true) throw new Error('The query panel must be frozen before outcome review.');
  return summary;
}

function recognizedSearchPanel(cohort) {
  return cohort.queryPanel.surface === 'google-search';
}

export function planCohortSearchObservation(cohort, options = {}) {
  const summary = assertFrozenCohort(cohort);
  const { productionRef, deploymentDate, asOf, finalDataThrough = null } = options;
  ensureRef(productionRef, 'productionRef');
  const deployment = strictDay(deploymentDate, 'deploymentDate');
  const observedAt = strictDay(asOf, 'asOf');
  if (observedAt < deployment) throw new Error('asOf must not precede the independently verified deployment date.');
  const finalAt = finalDataThrough == null ? null : strictDay(finalDataThrough, 'finalDataThrough');
  if (finalAt != null && finalAt > observedAt) throw new Error('finalDataThrough cannot be later than asOf.');

  const verified = evaluateMeasurementGate(cohort, productionRef);
  // A new matching SHA must not silently promote an older, explicitly held freeze.
  const gateReady = verified.ready && cohort.measurementGate.state === 'ready'
    && cohort.measurementGate.productionRef === productionRef
    && ['ready-to-observe', 'observing', 'reviewed'].includes(cohort.status);
  const windows = cohort.observationWindowsDays.map(days => {
    const startDate = dayAt(deployment + DAY_MS); // Exclude the partial deployment day.
    const endDate = dayAt(deployment + days * DAY_MS);
    const elapsed = observedAt > deployment + days * DAY_MS;
    const finalized = finalAt != null && finalAt >= deployment + days * DAY_MS;
    const state = !gateReady ? 'production-hold'
      : !elapsed ? 'window-open'
      : !finalized ? 'provider-finality-unconfirmed'
      : 'eligible-for-evidence-review';
    return {
      days, startDate, endDate, state,
      completeCalendarDays: elapsed,
      providerDataFinalThroughEnd: finalized,
      // Even "eligible" means the calendar and provider-finality gates passed,
      // never that a usable owner export or a positive result exists.
      ownerExportReviewed: false
    };
  });

  return {
    version: '0.1',
    kind: 'cohort-search-observation-plan',
    cohortId: cohort.id,
    site: cohort.site,
    querySurface: cohort.queryPanel.surface,
    provider: recognizedSearchPanel(cohort) ? 'google-search-console-web' : 'not-applicable-to-web-export',
    treatmentCount: summary.treatmentCount,
    controlCount: summary.controlCount,
    frozenQueryCount: summary.queryCount,
    implementationRef: cohort.measurementGate.implementationRef,
    frozenProductionRef: cohort.measurementGate.productionRef || null,
    independentlyObservedProductionRef: productionRef,
    productionGate: gateReady ? 'ready' : 'hold',
    deploymentDateClaim: deploymentDate,
    deploymentDateVerifiedByThisTool: false,
    observationAsOf: asOf,
    providerFinalDataThroughClaim: finalDataThrough,
    windows,
    nextActions: gateReady
      ? ['Preserve the signed/independently reviewed production receipt and frozen members.',
        'Collect a date + canonical page + query Search Console Web export for a fully elapsed window.',
        'Confirm provider data finality and map exact canonical page URLs to frozen member IDs before aggregating.',
        'Keep private owner query/page exports out of public GitHub; review confounders and useful tasks before a decision.']
      : ['Resolve the existing frozen production gate and independently observed SHA; do not run outcome interpretation.'],
    limitations: [
      'Dates and provider finality are owner-supplied declarations, not independently verified by this tool.',
      'A completed window is not an indexing, citation, ranking, traffic, adoption, or causal claim.',
      'Google Web Search observations must not be relabeled as generative AI visibility.',
      'Search Console can withhold anonymized queries and return only a subset of query/page rows.',
      'Missing rows, pages or reports mean unobserved in this export, not a confirmed zero.'
    ]
  };
}

export function createCohortPageMapTemplate(cohort) {
  assertFrozenCohort(cohort);
  return {
    version: '0.1',
    cohortId: cohort.id,
    site: cohort.site,
    // The owner must supply each exact public canonical URL. A content file path
    // is not a reliable way to reconstruct a canonical public route.
    members: [
      ...cohort.treatment.map(member => ({ id: member.id, entity: member.entity, group: 'treatment', url: null })),
      ...cohort.control.map(member => ({ id: member.id, entity: member.entity, group: 'control', url: null }))
    ]
  };
}

function canonicalUrl(value, origin) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Each cohort member needs an explicit canonical HTTPS URL.');
  let candidate;
  try { candidate = new URL(value); } catch { throw new Error('Malformed mapped canonical URL.'); }
  if (candidate.protocol !== 'https:' || candidate.username || candidate.password || candidate.search || candidate.hash) {
    throw new Error('Mapped URL must be HTTPS without userinfo, query or fragment.');
  }
  if (candidate.origin !== origin.origin || !candidate.pathname.startsWith(origin.pathname)) {
    throw new Error('Mapped URL must be on the frozen cohort site and within its base path.');
  }
  return candidate.href;
}

export function validateCohortPageMap(cohort, pageMap) {
  assertFrozenCohort(cohort);
  if (!pageMap || pageMap.version !== '0.1' || pageMap.cohortId !== cohort.id || pageMap.site !== cohort.site) {
    throw new Error('Page map version/cohortId/site must match the frozen cohort.');
  }
  if (!Array.isArray(pageMap.members)) throw new Error('Page map members must be an array.');
  const origin = new URL(cohort.site);
  const expected = new Map(createCohortPageMapTemplate(cohort).members.map(member => [member.id, member]));
  if (pageMap.members.length !== expected.size) throw new Error('Page map must include every frozen member exactly once.');
  const mapped = new Map();
  const urls = new Set();
  for (const member of pageMap.members) {
    if (!member || !expected.has(member.id) || mapped.has(member.id)) {
      throw new Error('Page map contains an unknown or duplicate member ID.');
    }
    const frozen = expected.get(member.id);
    if (member.group !== frozen.group || member.entity !== frozen.entity) {
      throw new Error('Page map changed a frozen member group or entity.');
    }
    const url = canonicalUrl(member.url, origin);
    if (urls.has(url)) throw new Error('Two cohort members cannot own the same canonical page URL.');
    urls.add(url);
    mapped.set(member.id, { ...frozen, url });
  }
  return {
    members: [...expected.keys()].map(id => mapped.get(id)),
    byUrl: new Map([...mapped.values()].map(member => [member.url, member]))
  };
}

export function parseGscWebCsv(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('An actual Search Console CSV export is required.');
  if (Buffer.byteLength(text, 'utf8') > 10 * 1024 * 1024) throw new Error('CSV exceeds the 10 MiB bounded local review limit.');
  const input = text.replace(/^\uFEFF/, '');
  const records = [];
  let row = [], field = '', quoted = false, afterQuote = false;
  const finishField = () => { row.push(field); field = ''; afterQuote = false; };
  const finishRow = () => {
    finishField();
    if (row.some(value => value.trim() !== '')) records.push(row);
    row = [];
    if (records.length > 50_001) throw new Error('CSV exceeds the 50,000-row local review limit.');
  };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; afterQuote = true; }
      else field += c;
    } else if (c === '"') {
      if (field !== '' || afterQuote) throw new Error('Malformed CSV quoting.');
      quoted = true;
    } else if (c === ',') finishField();
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && input[i + 1] === '\n') i++;
      finishRow();
    } else {
      if (afterQuote && c !== ' ' && c !== '\t') throw new Error('Malformed CSV after closing quote.');
      if (!afterQuote) field += c;
    }
  }
  if (quoted) throw new Error('Unterminated CSV quoted field.');
  if (row.length || field.length || afterQuote) finishRow();
  if (records.length < 1) throw new Error('No CSV header was found.');
  const headers = records.shift().map(value => value.toLowerCase().replace(/\s+/g, '').trim());
  const unique = new Set(headers);
  if (unique.size !== headers.length) throw new Error('Duplicate CSV columns are not allowed.');
  for (const required of REQUIRED_CSV_COLUMNS) if (!unique.has(required)) {
    throw new Error('CSV must contain Date, Page, Query, Clicks and Impressions columns from one joint Web Search export.');
  }
  const fieldIndex = Object.fromEntries(REQUIRED_CSV_COLUMNS.map(key => [key, headers.indexOf(key)]));
  return records.map((cells, index) => {
    if (cells.length !== headers.length) throw new Error('Wrong CSV column count at data row ' + (index + 2) + '.');
    const get = key => cells[fieldIndex[key]].trim();
    strictDay(get('date'), 'CSV date (row ' + (index + 2) + ')');
    const clicks = Number(get('clicks')), impressions = Number(get('impressions'));
    if (!/^\d+$/.test(get('clicks')) || !/^\d+$/.test(get('impressions'))
      || !Number.isSafeInteger(clicks) || !Number.isSafeInteger(impressions)) {
      throw new Error('Clicks and Impressions must be non-negative integer counts at row ' + (index + 2) + '.');
    }
    return { date: get('date'), page: get('page'), query: get('query'), clicks, impressions };
  });
}

const searchKey = value => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

export function reviewCohortGscWebExport(cohort, pageMap, csvText, options = {}) {
  if (!recognizedSearchPanel(cohort)) throw new Error('The GSC Web export review only supports a frozen google-search panel.');
  if (options.reportScope !== 'web') throw new Error('Explicit --report-scope=web is required; Google AI reports are a different population.');
  const plan = planCohortSearchObservation(cohort, options);
  if (plan.productionGate !== 'ready') throw new Error('Cannot interpret an export while the frozen cohort is on production HOLD.');
  const days = Number(options.windowDays);
  const window = plan.windows.find(item => item.days === days);
  if (!window) throw new Error('windowDays must be one of the frozen observationWindowsDays.');
  if (options.exportStart !== window.startDate || options.exportEnd !== window.endDate) {
    throw new Error('Owner-declared exportStart/exportEnd must equal the entire frozen observation window.');
  }
  const mapping = validateCohortPageMap(cohort, pageMap);
  const rows = parseGscWebCsv(csvText);
  const panelByText = new Map();
  for (const query of cohort.queryPanel.queries) {
    const normalized = searchKey(query.text);
    const ids = panelByText.get(normalized) || [];
    ids.push(query.id);
    panelByText.set(normalized, ids);
  }
  // Duplicates can result from concatenating pages or downloading overlapping
  // exports. Reject rather than quietly inflating metrics.
  const seen = new Set();
  const byMember = new Map(mapping.members.map(member => [member.id, {
    id: member.id, entity: member.entity, group: member.group, state: 'not-observed-in-export',
    observedRows: 0, clicks: null, impressions: null, panelRows: 0, panelClicks: null, panelImpressions: null
  }]));
  const seenQueries = new Set();
  let outOfCohortRows = 0, outOfPeriodRows = 0, matchedRows = 0, nonPanelRows = 0;
  for (const row of rows) {
    if (row.date < window.startDate || row.date > window.endDate) { outOfPeriodRows++; continue; }
    let page;
    try { page = new URL(row.page).href; } catch { throw new Error('CSV has a malformed page URL.'); }
    const member = mapping.byUrl.get(page);
    if (!member) { outOfCohortRows++; continue; }
    const key = JSON.stringify([row.date, page, row.query]);
    if (seen.has(key)) throw new Error('Duplicate date/page/query row: do not combine overlapping exports.');
    seen.add(key);
    matchedRows++;
    const result = byMember.get(member.id);
    result.state = 'observed-in-export';
    result.observedRows++;
    result.clicks = (result.clicks ?? 0) + row.clicks;
    result.impressions = (result.impressions ?? 0) + row.impressions;
    const panel = panelByText.get(searchKey(row.query));
    if (panel) {
      result.panelRows++;
      result.panelClicks = (result.panelClicks ?? 0) + row.clicks;
      result.panelImpressions = (result.panelImpressions ?? 0) + row.impressions;
      for (const queryId of panel) seenQueries.add(queryId);
    } else nonPanelRows++;
  }
  if (outOfPeriodRows) throw new Error('CSV contains rows outside the explicitly requested window: check export date filters.');
  const members = [...byMember.values()];
  const groupSummary = group => {
    const selected = members.filter(member => member.group === group);
    const observed = selected.filter(member => member.state === 'observed-in-export');
    const sum = key => observed.length ? observed.reduce((total, member) => total + (member[key] ?? 0), 0) : null;
    return {
      frozenMembers: selected.length,
      observedMembers: observed.length,
      notObservedMemberIds: selected.filter(member => member.state !== 'observed-in-export').map(member => member.id),
      observedRows: observed.reduce((total, member) => total + member.observedRows, 0),
      observedClicks: sum('clicks'),
      observedImpressions: sum('impressions'),
      observedFrozenPanelClicks: sum('panelClicks'),
      observedFrozenPanelImpressions: sum('panelImpressions')
    };
  };
  const elapsedFinality = window.state === 'eligible-for-evidence-review';
  const status = !rows.length ? 'no-rows-in-export'
    : !matchedRows ? 'no-matching-cohort-rows'
    : !elapsedFinality ? window.state
    : 'descriptive-export-review-only';
  return {
    version: '0.1',
    kind: 'cohort-gsc-web-observation',
    cohortId: cohort.id,
    site: cohort.site,
    frozenImplementationRef: plan.implementationRef,
    productionGate: plan.productionGate,
    reportScope: 'google-search-console-web',
    reportScopeVerifiedFromCsv: false,
    exportPeriodOwnerDeclared: { start: options.exportStart, end: options.exportEnd },
    finalDataThroughOwnerDeclared: options.finalDataThrough ?? null,
    window: { days, startDate: window.startDate, endDate: window.endDate, state: window.state },
    status,
    observed: {
      csvRows: rows.length,
      matchedCohortRows: matchedRows,
      outsideCohortRows: outOfCohortRows,
      outOfPeriodRows,
      nonFrozenPanelRows: nonPanelRows,
      frozenPanelQueriesSeenIds: [...seenQueries].sort(),
      frozenPanelQueryIdsNotSeen: cohort.queryPanel.queries.map(query => query.id).filter(id => !seenQueries.has(id)),
      treatment: groupSummary('treatment'),
      control: groupSummary('control')
    },
    members,
    noOutcomeDecision: true,
    limitations: [
      'This is a local, owner-supplied Google Web Search CSV review, not independently verified Search Console data.',
      'Google query/page tables may omit anonymized and lower-volume rows. A missing page or query is not a confirmed zero.',
      'Numbers describe returned Web Search rows only, not site-wide counts, AI impressions or ranking effects.',
      'Even a mature complete-window export cannot establish causality or a keep/revise decision without baselines, controls, contamination review and context.',
      'Raw page URLs and search queries should remain in private owner files; only this bounded derived summary is printed.'
    ]
  };
}
