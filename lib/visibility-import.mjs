import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateVisibilitySnapshot } from './visibility-evidence.mjs';

const PROVIDERS = new Set(['google', 'bing', 'referrals']);
const DEFAULT_AI_REFERRERS = [
  'chatgpt.com', 'chat.openai.com', 'openai.com', 'copilot.microsoft.com',
  'perplexity.ai', 'gemini.google.com'
];

function cleanKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value == null || value === '') return null;
  const normalized = String(value).trim().replace(/\s/g, '').replace(/,(?=\d{3}(?:\D|$))/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const input = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i += 1; continue; }
      if (ch === '"') { quoted = false; continue; }
      cell += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(cell); cell = ''; continue; }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    if (ch === '\r') continue;
    cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map(value => String(value).trim());
  return rows.filter(values => values.some(value => String(value).trim() !== '')).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function rowsFromJson(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload && typeof payload === 'object') return [payload];
  return [];
}

export function loadVisibilityExport(filePath) {
  const absolute = path.resolve(filePath);
  const text = fs.readFileSync(absolute, 'utf8');
  const ext = path.extname(absolute).toLowerCase();
  const rows = ext === '.json' ? rowsFromJson(JSON.parse(text)) : parseCsv(text);
  return { absolute, rows, format: ext === '.json' ? 'json' : 'csv' };
}

function normalizedRow(row) {
  return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [cleanKey(key), value]));
}

function firstNumber(row, aliases) {
  for (const alias of aliases) {
    const value = parseNumber(row[cleanKey(alias)]);
    if (value != null) return value;
  }
  return null;
}

function firstText(row, aliases) {
  for (const alias of aliases) {
    const value = row[cleanKey(alias)];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return null;
}

function aggregateGoogle(rows, reportScope) {
  const aiColumns = ['aiImpressions', 'generativeAiImpressions', 'generativeSearchImpressions'];
  let aiImpressions = 0;
  let observed = 0;
  for (const raw of rows) {
    const row = normalizedRow(raw);
    const hasAiColumn = aiColumns.some(column => Object.hasOwn(row, cleanKey(column)));
    const hasGenericColumn = Object.hasOwn(row, 'impressions');
    if (!hasAiColumn && hasGenericColumn && reportScope !== 'generative-ai') {
      throw new Error('Google Impressions is ambiguous: ordinary Web Search impressions are not AI impressions. Supply --report-scope=generative-ai only for an export from the dedicated generative AI report, or use explicitly named AI impression columns.');
    }
    // Never fill an unavailable explicit AI metric from a different generic metric.
    const value = firstNumber(row, hasAiColumn ? aiColumns : reportScope === 'generative-ai' ? ['impressions'] : []);
    if (value != null) { aiImpressions += value; observed += 1; }
  }
  return {
    provider: 'google-search-console-generative-ai',
    status: observed ? 'observed' : 'partial',
    metrics: observed ? { aiImpressions } : {},
    notes: (observed ? `Aggregated ${observed} row(s) containing generative-search impression evidence.` : 'No recognized generative-search impression column was found; preserve as partial evidence.')
      + (reportScope ? ' Generative AI report scope was supplied by the owner.' : ' Only explicitly named AI impression columns are accepted without owner-supplied report scope.')
  };
}

function aggregateBing(rows) {
  let totalCitations = 0;
  let citationRows = 0;
  let explicitCitedPages = null;
  let explicitGroundingQueries = null;
  let explicitAverage = null;
  const pages = new Set();
  const queries = new Set();
  for (const raw of rows) {
    const row = normalizedRow(raw);
    const citations = firstNumber(row, ['totalCitations', 'citations', 'citationCount']);
    if (citations != null) { totalCitations += citations; citationRows += 1; }
    const citedPages = firstNumber(row, ['citedPages', 'citedPageCount']);
    if (citedPages != null) explicitCitedPages = Math.max(explicitCitedPages ?? 0, citedPages);
    const grounding = firstNumber(row, ['groundingQueriesSampled', 'groundingQueryCount', 'queriesSampled']);
    if (grounding != null) explicitGroundingQueries = Math.max(explicitGroundingQueries ?? 0, grounding);
    const average = firstNumber(row, ['averageCitedPages', 'avgCitedPages']);
    if (average != null) explicitAverage = average;
    const page = firstText(row, ['citedUrl', 'url', 'page', 'citedPage']);
    if (page) pages.add(page);
    const query = firstText(row, ['groundingQuery', 'query', 'searchQuery']);
    if (query) queries.add(query);
  }
  const metrics = {};
  if (citationRows) metrics.totalCitations = totalCitations;
  if (explicitCitedPages != null || pages.size) metrics.citedPages = explicitCitedPages ?? pages.size;
  if (explicitGroundingQueries != null || queries.size) metrics.groundingQueriesSampled = explicitGroundingQueries ?? queries.size;
  if (explicitAverage != null) metrics.averageCitedPages = explicitAverage;
  return {
    provider: 'bing-webmaster-ai-performance',
    status: Object.keys(metrics).length ? 'observed' : 'partial',
    metrics,
    notes: Object.keys(metrics).length ? `Aggregated ${rows.length} Bing AI Performance row(s); unique URL/query counts are used only when explicit summary fields are absent.` : 'No recognized Bing AI Performance metrics were found; preserve as partial evidence.'
  };
}

function aggregateReferrals(rows, matchers) {
  let referrals = 0;
  let observed = 0;
  let rowsWithReferrer = 0;
  for (const raw of rows) {
    const row = normalizedRow(raw);
    const referrer = firstText(row, ['referrer', 'source', 'sessionSource', 'trafficSource', 'domain']);
    if (referrer) rowsWithReferrer += 1;
    const matched = !referrer || matchers.some(value => referrer.toLowerCase().includes(value.toLowerCase()));
    if (!matched) continue;
    const value = firstNumber(row, ['referrals', 'sessions', 'visits', 'entrances', 'users']);
    if (value != null) { referrals += value; observed += 1; }
    else if (referrer) { referrals += 1; observed += 1; }
  }
  return {
    provider: 'referral-analytics',
    status: observed ? 'observed' : 'partial',
    metrics: observed ? { referrals } : {},
    notes: observed
      ? `Aggregated ${observed} matching referral row(s). ${rowsWithReferrer ? `Filtered by: ${matchers.join(', ')}.` : 'No referrer dimension was present, so explicit referral/session counts were aggregated as supplied.'}`
      : `No matching referral evidence found for: ${matchers.join(', ')}.`
  };
}

function isoInstant(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid capturedAt: ${value}`);
  return date.toISOString();
}

function dateOnly(value, field) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) throw new Error(`${field} must use YYYY-MM-DD.`);
  return value;
}

export function importVisibilityExport(provider, filePath, options = {}) {
  if (!PROVIDERS.has(provider)) throw new Error(`Unsupported provider: ${provider}. Use google, bing or referrals.`);
  if (!/^https:\/\//i.test(String(options.site || ''))) throw new Error('--site must be a public HTTPS URL.');
  if (options.reportScope != null && (provider !== 'google' || options.reportScope !== 'generative-ai')) {
    throw new Error('--report-scope supports only generative-ai with --provider=google. Ordinary Web Search and other report scopes are not supported by this visibility adapter.');
  }
  const source = loadVisibilityExport(filePath);
  const matchers = String(options.match || DEFAULT_AI_REFERRERS.join(','))
    .split(',').map(value => value.trim()).filter(Boolean);
  const imported = provider === 'google'
    ? aggregateGoogle(source.rows, options.reportScope)
    : provider === 'bing'
      ? aggregateBing(source.rows)
      : aggregateReferrals(source.rows, matchers);
  imported.evidence = options.evidence || pathToFileURL(source.absolute).href;
  const snapshot = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/visibility-snapshot.schema.json',
    version: '0.1',
    site: options.site,
    capturedAt: isoInstant(options.capturedAt),
    period: { start: dateOnly(options.start, 'start'), end: dateOnly(options.end, 'end') },
    sources: [imported],
    notes: [
      `Imported from ${source.format.toUpperCase()} using ARWP ${provider} owner-data adapter.`,
      'Only aggregate metrics represented by the visibility contract are retained; unsupported dimensions remain in the original owner export.'
    ],
    guardrails: { noRankingInference: true, noCausalityInference: true, aggregateDataOnly: true }
  };
  const validation = validateVisibilitySnapshot(snapshot);
  if (!validation.valid) throw new Error(`Imported visibility snapshot is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ') || validation.warnings.join('; ')}`);
  return { snapshot, import: { provider, format: source.format, rows: source.rows.length, source: source.absolute, reportScope: options.reportScope ?? null, matchers: provider === 'referrals' ? matchers : null } };
}
