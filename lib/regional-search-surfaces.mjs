import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REGIONAL_SEARCH_SURFACES_VERSION = '0.1';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const registryPath = path.join(root, 'registry', 'regional-search-surfaces.json');

const MARKET_ALIASES = new Map([
  ['eea', 'eea'],
  ['european-economic-area', 'eea'],
  ['european economic area', 'eea'],
  ['turkiye', 'turkiye'],
  ['türkiye', 'turkiye'],
  ['turkey', 'turkiye'],
  ['tr', 'turkiye'],
  ['south-africa', 'south-africa'],
  ['south africa', 'south-africa'],
  ['za', 'south-africa'],
  ['other', 'other']
]);

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
}

export function normalizeRegionalMarket(value) {
  const raw = String(value || '').trim().toLowerCase();
  return MARKET_ALIASES.get(raw) || MARKET_ALIASES.get(normalizeToken(raw)) || null;
}

export function normalizeQueryType(value) {
  const token = normalizeToken(value);
  const aliases = new Map([
    ['hotel', 'hotels'],
    ['flight', 'flights'],
    ['ground-transport', 'ground-transportation'],
    ['ground-transportation', 'ground-transportation'],
    ['local-business', 'local-businesses'],
    ['local-businesses', 'local-businesses'],
    ['thing-to-do', 'things-to-do'],
    ['things-to-do', 'things-to-do'],
    ['product', 'products'],
    ['vacation-rental', 'vacation-rentals'],
    ['vacation-rentals', 'vacation-rentals'],
    ['job', 'jobs'],
    ['car-rental', 'car-hire']
  ]);
  return aliases.get(token) || token || null;
}

export function loadRegionalSearchSurfaces() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

export function validateRegionalSearchSurfaces(registry = loadRegionalSearchSurfaces()) {
  const errors = [];
  if (registry?.version !== REGIONAL_SEARCH_SURFACES_VERSION) errors.push(`expected registry version ${REGIONAL_SEARCH_SURFACES_VERSION}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(registry?.reviewedAt || ''))) errors.push('reviewedAt must use YYYY-MM-DD');
  if (!/^https:\/\//.test(String(registry?.source || ''))) errors.push('registry source must be HTTPS');
  const marketIds = new Set((registry?.markets || []).map(item => item.id));
  if (!marketIds.size) errors.push('registry must define at least one market');
  const ids = new Set();
  for (const feature of registry?.features || []) {
    if (!feature?.id) errors.push('feature missing id');
    else if (ids.has(feature.id)) errors.push(`duplicate feature id: ${feature.id}`);
    else ids.add(feature.id);
    if (!marketIds.has(feature?.market)) errors.push(`${feature?.id || 'feature'} references unknown market ${feature?.market}`);
    if (!Array.isArray(feature?.queryTypes) || !feature.queryTypes.length) errors.push(`${feature?.id || 'feature'} must define queryTypes`);
    if (!Array.isArray(feature?.eligibleRoles) || !feature.eligibleRoles.length) errors.push(`${feature?.id || 'feature'} must define eligibleRoles`);
    if (typeof feature?.requiresStructuredData !== 'boolean') errors.push(`${feature?.id || 'feature'} must define requiresStructuredData`);
    if (!/^https:\/\//.test(String(feature?.source || ''))) errors.push(`${feature?.id || 'feature'} source must be HTTPS`);
    if (!feature?.doesNotProve) errors.push(`${feature?.id || 'feature'} must state doesNotProve`);
  }
  return { valid: errors.length === 0, errors };
}

function splitValues(value, normalizer = normalizeToken) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(values.map(normalizer).filter(Boolean))];
}

export function evaluateRegionalSearchSurfaces({ market, queryTypes = [], roles = [] } = {}, registry = loadRegionalSearchSurfaces()) {
  const validation = validateRegionalSearchSurfaces(registry);
  if (!validation.valid) return { valid: false, errors: validation.errors, matches: [] };

  const normalizedMarket = normalizeRegionalMarket(market);
  if (!normalizedMarket) {
    return {
      valid: false,
      errors: [`Unknown market: ${market}. Use eea, turkiye, south-africa, or other.`],
      matches: []
    };
  }

  const normalizedQueries = splitValues(queryTypes, normalizeQueryType);
  const normalizedRoles = splitValues(roles, normalizeToken);
  if (!normalizedQueries.length) {
    return { valid: false, errors: ['At least one query type is required.'], matches: [] };
  }

  if (normalizedMarket === 'other') {
    return {
      valid: true,
      provider: registry.provider,
      market: normalizedMarket,
      queryTypes: normalizedQueries,
      roles: normalizedRoles,
      matches: [],
      status: 'not-applicable',
      message: 'This registry contains no additional regional Search surface for the selected market. This does not mean ordinary Google Search or other global Search features are unavailable.',
      source: registry.source,
      guardrails: registry.guardrails
    };
  }

  const matches = registry.features
    .filter(feature => feature.market === normalizedMarket)
    .filter(feature => feature.queryTypes.some(query => normalizedQueries.includes(query)))
    .filter(feature => !normalizedRoles.length || feature.eligibleRoles.some(role => normalizedRoles.includes(role)))
    .map(feature => ({
      id: feature.id,
      feature: feature.feature,
      matchedQueryTypes: feature.queryTypes.filter(query => normalizedQueries.includes(query)),
      eligibleRoles: feature.eligibleRoles,
      requiresStructuredData: feature.requiresStructuredData,
      action: feature.action,
      verification: feature.verification,
      source: feature.source,
      doesNotProve: feature.doesNotProve
    }));

  return {
    valid: true,
    provider: registry.provider,
    market: normalizedMarket,
    queryTypes: normalizedQueries,
    roles: normalizedRoles,
    matches,
    status: matches.length ? 'review' : 'not-applicable',
    message: matches.length
      ? `${matches.length} provider-documented regional Search surface(s) match the selected market/query scope. Each remains an eligibility/participation review, not a ranking recommendation.`
      : 'No provider-documented regional Search surface in this registry matches the selected market/query/role scope.',
    source: registry.source,
    guardrails: registry.guardrails
  };
}

export function listRegionalQueryTypes(registry = loadRegionalSearchSurfaces()) {
  return [...new Set((registry.features || []).flatMap(feature => feature.queryTypes))].sort();
}

export function formatRegionalSearchSurfaceReport(result) {
  if (!result.valid) return `Regional Search surface review failed: ${result.errors.join('; ')}`;
  const lines = [
    'Regional Search surface review',
    `Provider: ${result.provider}`,
    `Market: ${result.market}`,
    `Query types: ${result.queryTypes.join(', ')}`,
    `Status: ${result.status}`,
    result.message
  ];
  for (const match of result.matches) {
    lines.push('', `${match.feature} [${match.id}]`);
    lines.push(`  matched queries: ${match.matchedQueryTypes.join(', ')}`);
    lines.push(`  structured data required by this feature: ${match.requiresStructuredData ? 'yes' : 'no'}`);
    lines.push(`  action: ${match.action}`);
    lines.push(`  verify: ${match.verification}`);
    lines.push(`  boundary: ${match.doesNotProve}`);
    lines.push(`  source: ${match.source}`);
  }
  lines.push('', 'No regional score is produced. General Search eligibility and page usefulness remain separate prerequisites.');
  return lines.join('\n');
}
