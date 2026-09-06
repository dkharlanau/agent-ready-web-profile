/** Offline, review-only query-to-page planning. No network, writes or ranking score. */
const SOURCES = [
  'https://developers.google.com/webmaster-tools/v1/searchanalytics/query',
  'https://support.google.com/webmasters/answer/7576553?hl=en',
  'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide'
];
const normalize = value => value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
const words = value => normalize(value).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const fail = message => { throw new Error(message); };
function text(value, field) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000 || /[\u0000-\u001f\u007f]/u.test(value)) fail(`${field}: expected bounded, non-empty text without control characters`);
  return value;
}
function record(value, field, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${field}: expected an object`);
  if (Object.keys(value).some(key => !allowed.includes(key))) fail(`${field}: unsupported field; review the input contract`);
}
function url(value, field) {
  text(value, field);
  let parsed;
  try { parsed = new URL(value); } catch { fail(`${field}: expected an absolute HTTP(S) URL`); }
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash) fail(`${field}: URL must be HTTP(S), without credentials or fragment`);
  return parsed;
}
function siteUrl(value) {
  const site = url(value, 'site');
  if (site.search || !site.pathname.endsWith('/')) fail('site: use a query-free URL prefix ending in /');
  return site;
}
function scopedUrl(value, site, field) {
  const parsed = url(value, field);
  if (parsed.origin !== site.origin || !parsed.pathname.startsWith(site.pathname)) fail(`${field}: URL is outside the site prefix`);
  return parsed.href;
}
function list(value, field, max = 1000) {
  if (!Array.isArray(value) || value.length > max) fail(`${field}: expected a bounded array`);
  return value;
}
function integer(value, field, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(`${field}: integer outside the allowed range`);
}
function date(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail(`${field}: expected a real YYYY-MM-DD date`);
}

export function validateOpportunityMap(input) {
  record(input, 'map', ['schemaVersion', 'site', 'brandTerms', 'opportunities']);
  if (input.schemaVersion !== '1.0') fail('map: unsupported schemaVersion');
  const site = siteUrl(input.site);
  const brands = list(input.brandTerms, 'brandTerms', 100);
  for (const term of brands) { text(term, 'brandTerms'); if (!words(term)) fail('brandTerms: term must contain letters or numbers'); }
  const opportunities = list(input.opportunities, 'opportunities');
  if (!opportunities.length) fail('opportunities: at least one reviewed intent is required');
  const ids = new Set();
  const queryOwners = new Map();
  for (const [index, item] of opportunities.entries()) {
    const field = `opportunities[${index}]`;
    record(item, field, ['id', 'intent', 'queries', 'targetUrl', 'pageState', 'businessValue', 'effort', 'conversion', 'evidence', 'internalLinksFrom']);
    text(item.id, `${field}.id`);
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(item.id) || ids.has(item.id)) fail(`${field}.id: invalid or duplicate ID`);
    ids.add(item.id);
    text(item.intent, `${field}.intent`);
    text(item.conversion, `${field}.conversion`);
    scopedUrl(item.targetUrl, site, `${field}.targetUrl`);
    if (!['existing', 'planned'].includes(item.pageState)) fail(`${field}.pageState: use existing or planned`);
    integer(item.businessValue, `${field}.businessValue`, 1, 5);
    integer(item.effort, `${field}.effort`, 1, 5);
    const queries = list(item.queries, `${field}.queries`, 100);
    if (!queries.length) fail(`${field}.queries: at least one query is required`);
    for (const query of queries) {
      text(query, `${field}.queries`);
      const key = normalize(query);
      if (queryOwners.has(key)) fail(`${field}.queries: duplicate or ambiguous query mapping`);
      queryOwners.set(key, item.id);
    }
    for (const link of list(item.internalLinksFrom, `${field}.internalLinksFrom`, 100)) scopedUrl(link, site, `${field}.internalLinksFrom`);
    for (const evidence of list(item.evidence, `${field}.evidence`, 100)) {
      record(evidence, `${field}.evidence`, ['type', 'status', 'reference']);
      if (!['tool', 'dataset', 'case-study', 'benchmark', 'worked-example', 'primary-source'].includes(evidence.type)) fail(`${field}.evidence: unsupported type`);
      if (!['available', 'planned'].includes(evidence.status)) fail(`${field}.evidence: unsupported status`);
      text(evidence.reference, `${field}.evidence.reference`);
    }
  }
  return { valid: true, opportunities: opportunities.length };
}

/** A single final, by-page, query+page export. UI Queries/Pages tabs cannot be joined. */
export function validateSearchConsoleExport(input, expectedSite) {
  record(input, 'export', ['schemaVersion', 'site', 'period', 'searchType', 'dimensions', 'aggregationType', 'dataState', 'filters', 'rows']);
  if (input.schemaVersion !== '1.0') fail('export: unsupported schemaVersion');
  const site = siteUrl(input.site);
  if (site.href !== siteUrl(expectedSite).href) fail('export: site scope does not match the map');
  record(input.period, 'period', ['start', 'end']);
  date(input.period.start, 'period.start'); date(input.period.end, 'period.end');
  if (input.period.start > input.period.end) fail('period: start must not be after end');
  if (input.searchType !== 'web' || input.dataState !== 'final' || input.aggregationType !== 'byPage') fail('export: requires final web data aggregated byPage');
  if (JSON.stringify(input.dimensions) !== '["query","page"]') fail('export: dimensions must be [query, page] in that order');
  record(input.filters, 'filters', ['country', 'device']);
  for (const key of ['country', 'device']) if (input.filters[key] !== null) text(input.filters[key], `filters.${key}`);
  const keys = new Set();
  for (const [index, row] of list(input.rows, 'rows', 100000).entries()) {
    const field = `rows[${index}]`;
    record(row, field, ['keys', 'clicks', 'impressions', 'position', 'ctr']);
    if (!Array.isArray(row.keys) || row.keys.length !== 2) fail(`${field}: expected query and page keys`);
    text(row.keys[0], `${field}.query`);
    const page = scopedUrl(row.keys[1], site, `${field}.page`);
    const key = JSON.stringify([row.keys[0], page]);
    if (keys.has(key)) fail(`${field}: duplicate query-page row; do not combine overlapping exports`);
    keys.add(key);
    integer(row.clicks, `${field}.clicks`); integer(row.impressions, `${field}.impressions`);
    if (row.clicks > row.impressions) fail(`${field}: clicks exceed impressions`);
    if (row.impressions > 0 && (typeof row.position !== 'number' || !Number.isFinite(row.position) || row.position < 1)) fail(`${field}: positive impressions require a finite position >= 1`);
    if (row.impressions === 0 && row.position !== null) fail(`${field}: zero impressions require null position`);
    if (row.ctr !== undefined && (typeof row.ctr !== 'number' || !Number.isFinite(row.ctr) || row.ctr < 0 || row.ctr > 1)) fail(`${field}: invalid CTR`);
  }
  return { valid: true, rows: input.rows.length };
}

function aggregate(rows) {
  if (!rows.length) return null;
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  if (!Number.isSafeInteger(clicks) || !Number.isSafeInteger(impressions)) fail('aggregate: counts exceed safe integer precision');
  const weighted = rows.reduce((sum, row) => sum + (row.position ?? 0) * row.impressions, 0);
  if (!Number.isFinite(weighted)) fail('aggregate: weighted position exceeds numeric precision');
  return { clicks, pageImpressions: impressions, ctr: impressions ? clicks / impressions : null, averagePosition: impressions ? weighted / impressions : null };
}

export function planSearchOpportunities(map, ownerExport = null, options = {}) {
  validateOpportunityMap(map);
  if (ownerExport !== null) validateSearchConsoleExport(ownerExport, map.site);
  const minImpressions = options.minImpressions ?? 50;
  integer(minImpressions, 'minImpressions', 1, 1000000);
  const brands = map.brandTerms.map(words);
  const branded = query => brands.some(term => ` ${words(query)} `.includes(` ${term} `));
  const index = new Map();
  for (const row of ownerExport?.rows ?? []) {
    const key = normalize(row.keys[0]);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(row);
  }
  const opportunities = map.opportunities.map(item => {
    const rows = item.queries.flatMap(query => index.get(normalize(query)) ?? []);
    const nonBrandRows = rows.filter(row => !branded(row.keys[0]));
    const observed = aggregate(rows);
    const nonBrandObserved = aggregate(nonBrandRows);
    const hasOriginalAsset = item.evidence.some(e => e.status === 'available' && e.type !== 'primary-source');
    const overlapQueryCount = item.queries.filter(query => new Set((index.get(normalize(query)) ?? []).filter(r => r.impressions > 0).map(r => new URL(r.keys[1]).href)).size > 1).length;
    const target = new URL(item.targetUrl).href;
    const targetObserved = aggregate(rows.filter(row => new URL(row.keys[1]).href === target));
    const enough = (nonBrandObserved?.pageImpressions ?? 0) >= minImpressions;
    let queue = 'research-before-publish';
    let priority = 4;
    if (item.pageState === 'existing') { queue = 'measure-and-review'; priority = 3; }
    if (enough) { queue = item.pageState === 'existing' ? 'review-existing-answer' : 'review-existing-coverage-first'; priority = 2; }
    if (enough && item.pageState === 'existing' && nonBrandObserved.averagePosition > 3 && nonBrandObserved.averagePosition <= 20) { queue = 'review-near-visibility'; priority = 1; }
    if (enough && overlapQueryCount) { queue = 'review-query-page-overlap'; priority = 1; }
    const tasks = [];
    const add = (kind, verification) => tasks.push({ kind, authority: 'review-required', verification });
    if (!enough) add('establish-demand-baseline', 'Review a scoped final Search Console export or documented audience research; missing rows are not zero demand.');
    if (overlapQueryCount) add('review-query-page-overlap', 'Compare actual intent, country/device and canonical pages; do not automatically merge, redirect or noindex.');
    if (item.pageState === 'planned' && observed?.pageImpressions > 0) add('review-existing-coverage-before-new-page', 'Inspect pages already serving the query before approving another URL.');
    add(item.pageState === 'existing' ? 'verify-existing-answer' : 'review-new-page-need', 'Inspect the built page, eligibility, user intent and original contribution; a declaration is not a live check.');
    add(hasOriginalAsset ? 'verify-original-asset' : 'produce-original-asset', 'Run the example/tool or review first-hand evidence; a reference alone does not prove quality.');
    if (!item.internalLinksFrom.length) add('add-relevant-internal-link', 'Choose an existing related page and verify a crawlable contextual link; do not create portfolio link schemes.');
    else add('verify-declared-internal-links', 'Inspect source pages and confirm relevant crawlable links; declared links are not observed links.');
    add('verify-useful-next-action', 'Verify the declared conversion is possible, then measure it separately from clicks.');
    add('record-outcome-review', 'Record change commit, equal complete windows, matching filters, confounders and keep/revise/revert; never infer causality from a delta.');
    return {
      id: item.id, intent: item.intent, targetUrl: target, pageState: item.pageState,
      priority, queue, businessValue: item.businessValue, effort: item.effort,
      demandStatus: ownerExport === null ? 'no-owner-data' : observed === null ? 'no-matching-export-rows' : 'owner-sample-observed',
      observed, nonBrandObserved, targetObserved, overlapQueryCount,
      originalAssetDeclared: hasOriginalAsset, conversion: item.conversion, tasks
    };
  });
  opportunities.sort((a, b) => a.priority - b.priority || b.businessValue - a.businessValue || (b.nonBrandObserved?.pageImpressions ?? 0) - (a.nonBrandObserved?.pageImpressions ?? 0) || a.effort - b.effort || a.id.localeCompare(b.id, 'en'));
  return {
    schemaVersion: '1.0', site: new URL(map.site).href, model: 'review-queue-v1',
    evidenceClass: 'project-heuristic', privacy: 'local-owner-data; review before sharing',
    policy: { minImpressions, reviewPositionBand: { above: 3, atMost: 20 }, automaticPublication: false, rankingScore: false },
    period: ownerExport ? { ...ownerExport.period } : null,
    filters: ownerExport ? { ...ownerExport.filters } : null,
    ownerDataStatus: ownerExport ? 'supplied-not-independently-verified' : 'not-supplied',
    outcome: { rankingImpact: null, conversionImpact: null },
    opportunities,
    limitations: [
      'Queries are editor-selected hypotheses, not verified search volumes. No semantic clustering or SERP scraping is performed.',
      'Export rows can be incomplete. Missing rows are not zero demand; page impressions are not unique searches or property totals.',
      'Positions are impression-weighted averages over matched by-page rows, not stable live ranks. CTR is recomputed from counts.',
      'Brand matching uses normalized token phrases; review aliases and languages manually. Priority bands and the configurable impression threshold are workflow heuristics, not provider rules.',
      'Multiple pages for one query are a review signal, not proof of cannibalization. No pages, evidence, links or conversions are fetched or verified.',
      'Reports omit raw query rows but contain owner aggregates. Keep real exports/reports private unless explicitly reviewed for publication.'
    ], sources: [...SOURCES]
  };
}

export function formatOpportunityPlan(report) {
  return [
    `ARWP search opportunities — ${report.site}`,
    `Owner data: ${report.ownerDataStatus}. Review queue, not a ranking forecast.`,
    ...report.opportunities.map(item => `${item.priority}. ${item.id}: ${item.queue}\n   ${item.targetUrl}\n   ${item.demandStatus}; non-brand page impressions: ${item.nonBrandObserved?.pageImpressions ?? 'unknown'}\n   ${item.tasks.map(task => task.kind).join(' → ')}`),
    'No ranking or conversion impact has been established.'
  ].join('\n');
}
