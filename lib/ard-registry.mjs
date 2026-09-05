import { lookup as dnsLookup } from 'node:dns/promises';
import { assertPublicHttpsUrl } from './public-fetch.mjs';

export const ARD_REGISTRY_DEFAULT_PAGE_SIZE = 10;
export const ARD_REGISTRY_MAX_PAGE_SIZE = 100;
export const ARD_REGISTRY_DEFAULT_MAX_BYTES = 256 * 1024;
export const ARD_REGISTRY_DEFAULT_TIMEOUT_MS = 8000;

const FEDERATION_MODES = new Set(['auto', 'referrals', 'none']);
const SEARCH_RESULT_CORE = new Set([
  '@context', '@id', 'identifier', 'displayName', 'type', 'url', 'data',
  'representativeQueries', 'capabilities', 'description', 'tags', 'version',
  'updatedAt', 'metadata', 'trustManifest', 'TrustManifest', 'score', 'source'
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function boundedInteger(value, { name, min, max, fallback }) {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  return value;
}

function registrySearchUrl(value) {
  const url = new URL(value);
  if (url.pathname.endsWith('/search')) return url.href;
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return new URL('search', url).href;
}

function searchPayload({ text, filter = null, context = null, federation = 'none', pageSize = ARD_REGISTRY_DEFAULT_PAGE_SIZE, pageToken = null } = {}) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('ARD registry search text is required.');
  if (!FEDERATION_MODES.has(federation)) throw new Error('federation must be one of: auto, referrals, none.');
  const size = boundedInteger(pageSize, { name: 'pageSize', min: 1, max: ARD_REGISTRY_MAX_PAGE_SIZE, fallback: ARD_REGISTRY_DEFAULT_PAGE_SIZE });
  if (filter != null && !asObject(filter)) throw new Error('filter must be an object when provided.');
  const query = { text: text.trim() };
  if (context != null) query['@context'] = context;
  if (filter && Object.keys(filter).length) query.filter = filter;
  const payload = { query, federation, pageSize: size };
  if (pageToken != null) {
    if (typeof pageToken !== 'string' || !pageToken) throw new Error('pageToken must be a non-empty string when provided.');
    payload.pageToken = pageToken;
  }
  return payload;
}

async function readBoundedJson(response, maxBytes) {
  const declared = Number(response.headers?.get?.('content-length') || 0);
  if (declared && declared > maxBytes) throw new Error(`ARD registry response exceeds maxBytes (${maxBytes}).`);
  let text;
  let bytes;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch { /* no-op */ }
        throw new Error(`ARD registry response exceeds maxBytes (${maxBytes}).`);
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    text = new TextDecoder().decode(merged);
    bytes = total;
  } else {
    text = await response.text();
    bytes = new TextEncoder().encode(text).byteLength;
    if (bytes > maxBytes) throw new Error(`ARD registry response exceeds maxBytes (${maxBytes}).`);
  }
  try {
    return { json: JSON.parse(text), bytes };
  } catch (error) {
    throw new Error(`ARD registry returned invalid JSON: ${error.message}`);
  }
}

function normalizeReferral(referral) {
  const value = asObject(referral);
  if (!value) return { valid: false, issue: 'Referral must be an object.', raw: referral };
  const issues = [];
  for (const field of ['identifier', 'displayName', 'type', 'url']) if (typeof value[field] !== 'string' || !value[field]) issues.push(`${field} is required.`);
  let url = null;
  if (typeof value.url === 'string') {
    try { url = new URL(value.url).href; } catch { issues.push('url must be an absolute URI.'); }
  }
  return {
    valid: issues.length === 0,
    issues,
    identifier: value.identifier || null,
    displayName: value.displayName || null,
    type: value.type || null,
    url,
    raw: value
  };
}

export function normalizeArdSearchResult(result) {
  const value = asObject(result);
  if (!value) return { valid: false, issues: ['Search result must be an object.'], raw: result };
  const issues = [];
  if (typeof value.identifier !== 'string' || !value.identifier) issues.push('identifier is required.');
  if (!Number.isInteger(value.score) || value.score < 0 || value.score > 100) issues.push('score must be an integer between 0 and 100.');
  let source = null;
  if (typeof value.source !== 'string' || !value.source) issues.push('source is required.');
  else {
    try { source = new URL(value.source).href; } catch { issues.push('source must be an absolute URI.'); }
  }
  let url = null;
  if (value.url != null) {
    if (typeof value.url !== 'string') issues.push('url must be a URI when present.');
    else {
      try { url = new URL(value.url).href; } catch { issues.push('url must be an absolute URI when present.'); }
    }
  }
  const extensionTerms = {};
  const unknownTerms = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (SEARCH_RESULT_CORE.has(key)) continue;
    if (key.includes(':')) extensionTerms[key] = entryValue;
    else unknownTerms[key] = entryValue;
  }
  return {
    valid: issues.length === 0,
    issues,
    identifier: value.identifier || null,
    displayName: value.displayName || null,
    type: value.type || null,
    url,
    data: asObject(value.data),
    score: Number.isInteger(value.score) ? value.score : null,
    scoreMeaning: 'semantic-relevance-not-trust',
    source,
    context: value['@context'] ?? null,
    jsonLdId: value['@id'] ?? null,
    representativeQueries: Array.isArray(value.representativeQueries) ? [...value.representativeQueries] : [],
    capabilities: Array.isArray(value.capabilities) ? [...value.capabilities] : [],
    description: typeof value.description === 'string' ? value.description : null,
    tags: Array.isArray(value.tags) ? [...value.tags] : [],
    version: typeof value.version === 'string' ? value.version : null,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
    metadata: asObject(value.metadata),
    trustManifest: asObject(value.trustManifest) || asObject(value.TrustManifest),
    extensionTerms,
    unknownTerms,
    raw: value
  };
}

export function validateArdSearchResponse(payload) {
  const value = asObject(payload);
  if (!value) return { valid: false, issues: ['Search response must be an object.'], results: [], referrals: [], pageToken: null };
  if (!Array.isArray(value.results)) return { valid: false, issues: ['Search response results must be an array.'], results: [], referrals: [], pageToken: null };
  const results = value.results.map(normalizeArdSearchResult);
  const referrals = Array.isArray(value.referrals) ? value.referrals.map(normalizeReferral) : [];
  const issues = [];
  for (const [index, result] of results.entries()) if (!result.valid) issues.push(...result.issues.map(issue => `results[${index}]: ${issue}`));
  for (const [index, referral] of referrals.entries()) if (!referral.valid) issues.push(...referral.issues.map(issue => `referrals[${index}]: ${issue}`));
  if (value.pageToken != null && (typeof value.pageToken !== 'string' || !value.pageToken)) issues.push('pageToken must be a non-empty string when present.');
  return {
    valid: issues.length === 0,
    issues,
    results,
    referrals,
    pageToken: typeof value.pageToken === 'string' && value.pageToken ? value.pageToken : null
  };
}

export async function searchArdRegistry(registryBaseUrl, request, {
  fetchImpl = fetch,
  resolveImpl = dnsLookup,
  timeoutMs = ARD_REGISTRY_DEFAULT_TIMEOUT_MS,
  maxBytes = ARD_REGISTRY_DEFAULT_MAX_BYTES,
  userAgent = 'arwp-ard-registry/0.1',
  headers = {},
  metrics = null
} = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('timeoutMs must be positive.');
  if (!Number.isFinite(maxBytes) || maxBytes < 1024 || maxBytes > 4 * 1024 * 1024) throw new Error('maxBytes must be between 1024 and 4194304.');
  const searchUrl = registrySearchUrl((await assertPublicHttpsUrl(registryBaseUrl, resolveImpl)).href);
  await assertPublicHttpsUrl(searchUrl, resolveImpl);
  const payload = searchPayload(request);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (metrics) metrics.requests = (metrics.requests || 0) + 1;
  let response;
  try {
    response = await fetchImpl(searchUrl, {
      method: 'POST',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'user-agent': userAgent,
        ...headers
      },
      body: JSON.stringify(payload)
    });
  } finally {
    clearTimeout(timer);
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers?.get?.('location');
    try { await response.body?.cancel?.(); } catch { /* no-op */ }
    throw new Error(`ARD registry search redirect is not followed automatically${location ? `: ${location}` : ''}.`);
  }

  if (response.status < 200 || response.status >= 300) {
    let errorBody = null;
    try {
      const parsed = await readBoundedJson(response, Math.min(maxBytes, 64 * 1024));
      errorBody = parsed.json;
      if (metrics) metrics.bytes = (metrics.bytes || 0) + parsed.bytes;
    } catch { /* keep bounded status-only error */ }
    return {
      ok: false,
      status: response.status,
      url: searchUrl,
      request: payload,
      error: errorBody,
      results: [],
      referrals: [],
      pageToken: null,
      note: 'No referrals or pagination are followed automatically.'
    };
  }

  const parsed = await readBoundedJson(response, maxBytes);
  if (metrics) metrics.bytes = (metrics.bytes || 0) + parsed.bytes;
  const validation = validateArdSearchResponse(parsed.json);
  if (!validation.valid) throw new Error(`ARD registry search response failed validation: ${validation.issues.join(' ')}`);
  return {
    ok: true,
    status: response.status,
    url: searchUrl,
    request: payload,
    results: validation.results,
    referrals: validation.referrals,
    pageToken: validation.pageToken,
    bytes: parsed.bytes,
    note: 'Registry score is semantic relevance, not security/trust. Referrals and pageToken are returned as evidence and are never followed automatically.'
  };
}

export function buildArdSearchRequest(options) {
  return searchPayload(options);
}
