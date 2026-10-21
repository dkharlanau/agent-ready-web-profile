const ID = /^[a-z][a-z0-9._:-]{2,79}$/;
const timestamp = value => typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
function siteUrl(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) throw Error('Bing site must be an exact HTTPS property.');
  return u.href;
}
function count(value) {
  if (value !== null && (!Number.isSafeInteger(value) || value < 0)) throw Error('Approximate provider counts must be nonnegative safe integers or null.');
  return value;
}
export function createBingTopicsTemplate(site) {
  return { version: '0.1', provider: 'bing-webmaster-ai-performance', view: 'topics-portfolio', site: siteUrl(site),
    availability: 'not-exported', capturedAt: null, period: null, sourceEvidence: null,
    topics: [], opportunities: [], pages: [],
    guardrails: { approximateNotExact: true, sampledNotComplete: true, sourceAuthenticatedByGoose: false, notSearchVolume: true } };
}
export function reviewBingTopicsPortfolio(input) {
  siteUrl(input.site);
  if (input.version !== '0.1' || input.provider !== 'bing-webmaster-ai-performance' || input.view !== 'topics-portfolio'
    || !['available', 'insufficient-data', 'not-exported'].includes(input.availability)
    || input.guardrails?.approximateNotExact !== true || input.guardrails?.sampledNotComplete !== true
    || input.guardrails?.sourceAuthenticatedByGoose !== false || input.guardrails?.notSearchVolume !== true) throw Error('Invalid owner-normalized Topics Portfolio contract.');
  for (const key of ['topics', 'opportunities', 'pages']) if (!Array.isArray(input[key]) || input[key].length > 5000) throw Error('A bounded ' + key + ' array is required.');
  if (input.availability !== 'available' && (input.topics.length || input.opportunities.length || input.pages.length)) throw Error('Unavailable data cannot contain observed rows.');
  if (input.availability !== 'not-exported') {
    if (!timestamp(input.capturedAt) || !date(input.period?.start) || !date(input.period?.end)
      || input.period.start > input.period.end || Date.parse(input.capturedAt) < Date.parse(input.period.end + 'T00:00:00Z')
      || !['owner-final', 'partial', 'unknown'].includes(input.period.dataState)
      || input.sourceEvidence?.sourceClass !== 'owner-normalized'
      || !/^[a-f0-9]{64}$/.test(input.sourceEvidence?.sha256 || '')) throw Error('Observed Topics Portfolio needs exact dates and a hash of the private original export/capture.');
  } else if (input.capturedAt !== null || input.period !== null || input.sourceEvidence !== null) throw Error('An unexported scaffold cannot claim observation dates or evidence.');
  const ids = rows => {
    const seen = new Set();
    for (const row of rows) {
      if (!ID.test(row.id || '') || seen.has(row.id)) throw Error('Opaque IDs must be valid and unique.');
      seen.add(row.id);
    }
    return seen;
  };
  const topicIds = ids(input.topics), pageIds = ids(input.pages); ids(input.opportunities);
  const topics = input.topics.map(row => {
    if (Object.keys(row).some(k => !['id', 'topicSizeApprox', 'sitesCitedApprox', 'queriesApprox', 'ownCitations'].includes(k))) throw Error('Topic labels and raw query text belong only in private original exports.');
    return { id: row.id, topicSizeApprox: count(row.topicSizeApprox ?? null), sitesCitedApprox: count(row.sitesCitedApprox ?? null),
      queriesApprox: count(row.queriesApprox ?? null), ownCitations: count(row.ownCitations ?? null) };
  });
  for (const row of input.pages) {
    const page = new URL(siteUrl(row.canonicalUrl)), site = new URL(input.site);
    if (page.origin !== site.origin || !(page.pathname === site.pathname || page.pathname.startsWith(site.pathname.endsWith('/') ? site.pathname : site.pathname + '/'))) throw Error('Candidate pages must stay within the exact owner property.');
  }
  const opportunities = input.opportunities.map(row => {
    if (Object.keys(row).some(k => !['id', 'topicId', 'citationRange', 'relevance', 'pageId', 'intentMatch'].includes(k))) throw Error('Keep raw opportunity text outside portable reviews.');
    if (row.topicId !== null && !topicIds.has(row.topicId)) throw Error('Unknown opportunity topic.');
    if (!['unreviewed', 'relevant', 'brand-conflict', 'off-topic'].includes(row.relevance)) throw Error('Explicit owner relevance review is required.');
    if (row.pageId != null && !pageIds.has(row.pageId)) throw Error('Unknown existing canonical page ID.');
    if (!['confirmed', 'unreviewed', 'mismatch'].includes(row.intentMatch)) throw Error('An explicit intent-match review is required.');
    if (row.citationRange !== null) {
      if (!row.citationRange || !Number.isSafeInteger(row.citationRange.lowerBound) || row.citationRange.lowerBound < 0
        || (row.citationRange.upperBound !== null && (!Number.isSafeInteger(row.citationRange.upperBound) || row.citationRange.upperBound < row.citationRange.lowerBound))) throw Error('Citation ranges need valid ordered bounds; never invent a midpoint.');
    }
    return { id: row.id, topicId: row.topicId, citationRange: row.citationRange, relevance: row.relevance, pageId: row.pageId ?? null, intentMatch: row.intentMatch };
  });
  const candidates = opportunities.filter(row => row.relevance === 'relevant' && row.intentMatch === 'confirmed' && row.pageId);
  // Input order is the owner's chosen review order, never a synthetic opportunity score.
  return { version: '0.1', kind: 'bing-topics-portfolio-review', site: input.site,
    state: input.availability === 'not-exported' ? 'not-measured' : input.availability === 'insufficient-data' ? 'provider-insufficient-data' : 'owner-normalized',
    capturedAt: input.capturedAt, period: input.period ? { start: input.period.start, end: input.period.end, dataState: input.period.dataState } : null,
    sourceEvidence: input.sourceEvidence ? { sourceClass: input.sourceEvidence.sourceClass, sha256: input.sourceEvidence.sha256 } : null,
    topics, opportunities, nextReview: candidates.length ? { opportunityId: candidates[0].id, pageId: candidates[0].pageId, action: 'Review one bounded weakness on the existing canonical page.' } : null,
    limitations: ['Topics and ecosystem counts are approximate AI classifications, not exact search demand.',
      'Opportunity ranges stay ranges; omitted queries are not verified zeros.', 'Owner relevance and intent review are not authenticated by Goose.',
      'No automatic page creation, account change, outcome decision or causal claim.'], sourceAuthenticatedByGoose: false };
}
