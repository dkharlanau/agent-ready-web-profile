import { lookup as dnsLookup } from 'node:dns/promises';
import { fetchPublicJson, fetchPublicText } from './public-fetch.mjs';
import { fetchPublicHead } from './http-discovery.mjs';
import {
  ARD_WELL_KNOWN_PATH,
  ARD_LEGACY_WELL_KNOWN_PATH,
  collectArdDiscoverySources,
  normalizeArdEntry
} from './ard-v091.mjs';

const DEFAULT_MAX_BYTES = 256 * 1024;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_MANIFESTS = 6;
const DEFAULT_MAX_ENTRIES = 200;

function sourceKey(item) {
  return `${item.relation || ''}|${item.url}`;
}

function dedupeSources(items) {
  const seenUrls = new Set();
  return items.filter(item => {
    if (!item?.url || seenUrls.has(item.url)) return false;
    seenUrls.add(item.url);
    return true;
  });
}

function httpArdSources(head) {
  const sources = [];
  for (const link of head?.links || []) {
    const rels = Array.isArray(link.rels) ? link.rels : [];
    if (rels.includes('ard')) sources.push({ url: link.url, relation: 'http-link-ard', legacy: false, mediaType: link.type || null });
    else if (rels.includes('ai-catalog')) sources.push({ url: link.url, relation: 'http-link-ai-catalog', legacy: true, mediaType: link.type || null });
  }
  return sources;
}

function manifestEntries(payload, sourceId, sourceUrl) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, issue: 'ARD manifest must be an object.', entries: [] };
  }
  if (!Array.isArray(payload.entries)) {
    return { valid: false, issue: 'ARD manifest requires an entries array.', entries: [] };
  }
  return {
    valid: true,
    issue: null,
    entries: payload.entries.map(entry => normalizeArdEntry(entry, { sourceId, baseUrl: sourceUrl, discoveredVia: 'ard-manifest' }))
  };
}

export async function discoverArdSite(input, {
  fetchImpl = fetch,
  resolveImpl = dnsLookup,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = DEFAULT_MAX_BYTES,
  maxManifests = DEFAULT_MAX_MANIFESTS,
  maxEntries = DEFAULT_MAX_ENTRIES
} = {}) {
  if (!Number.isInteger(maxManifests) || maxManifests < 1 || maxManifests > 12) throw new Error('maxManifests must be an integer between 1 and 12.');
  if (!Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 1000) throw new Error('maxEntries must be an integer between 1 and 1000.');

  const metrics = { requests: 0, bytes: 0 };
  const network = { fetchImpl, resolveImpl, timeoutMs, maxBytes, metrics };
  const homepage = await fetchPublicText(input, {
    ...network,
    accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1'
  });
  if (!homepage.ok) throw new Error(`Unable to fetch website for ARD discovery: HTTP ${homepage.status}`);

  const canonicalUrl = homepage.url;
  const origin = new URL(canonicalUrl).origin;
  const robotsUrl = new URL('/robots.txt', origin).href;
  let robotsText = '';
  try {
    const robots = await fetchPublicText(robotsUrl, {
      ...network,
      maxBytes: Math.min(maxBytes, 128 * 1024),
      accept: 'text/plain, */*;q=0.1'
    });
    if (robots.ok) robotsText = robots.text || '';
  } catch { /* robots is optional discovery evidence */ }

  let head = null;
  try {
    head = await fetchPublicHead(canonicalUrl, { fetchImpl, resolveImpl, timeoutMs, metrics });
  } catch { /* HTTP Link discovery is optional */ }

  const staticDiscovery = collectArdDiscoverySources({ baseUrl: canonicalUrl, html: homepage.text || '', robotsText, includeLegacy: true });
  const candidates = dedupeSources([
    ...staticDiscovery.sources,
    ...httpArdSources(head)
  ]);

  const canonicalManifestUrl = new URL(ARD_WELL_KNOWN_PATH, origin).href;
  const legacyManifestUrl = new URL(ARD_LEGACY_WELL_KNOWN_PATH, origin).href;
  const sources = [];
  const entries = [...staticDiscovery.inlineEntries];
  let canonicalResolved = false;

  for (const [index, candidate] of candidates.entries()) {
    if (sources.length >= maxManifests) break;
    if (candidate.url === legacyManifestUrl && candidate.relation === 'legacy-well-known' && canonicalResolved) {
      sources.push({ ...candidate, status: 'skipped', issue: 'Canonical /.well-known/ard.json resolved; predecessor conventional path was not fetched.' });
      continue;
    }
    const sourceId = `ard-site:${index}`;
    try {
      const fetched = await fetchPublicJson(candidate.url, {
        ...network,
        accept: 'application/ld+json, application/json, application/ai-catalog+json;q=0.7, */*;q=0.1'
      });
      if (!fetched.ok) {
        sources.push({ ...candidate, sourceId, status: fetched.parseError ? 'invalid-json' : 'not-found', httpStatus: fetched.status, issue: fetched.parseError || null });
        continue;
      }
      const manifest = manifestEntries(fetched.json, sourceId, fetched.url);
      sources.push({
        ...candidate,
        sourceId,
        status: manifest.valid ? 'resolved' : 'invalid-manifest',
        url: fetched.url,
        httpStatus: fetched.status,
        contentType: fetched.contentType,
        entries: manifest.entries.length,
        issue: manifest.issue
      });
      if (candidate.url === canonicalManifestUrl && manifest.valid) canonicalResolved = true;
      for (const entry of manifest.entries) {
        if (entries.length >= maxEntries) break;
        entries.push(entry);
      }
    } catch (error) {
      sources.push({ ...candidate, sourceId, status: 'error', issue: String(error?.message || error) });
    }
  }

  const validEntries = entries.filter(item => item.valid);
  const invalidEntries = entries.filter(item => !item.valid);
  return {
    version: '0.1',
    target: input,
    canonicalUrl,
    sources,
    entries,
    summary: {
      sourcesObserved: candidates.length,
      sourcesProcessed: sources.length,
      sourcesResolved: sources.filter(item => item.status === 'resolved').length,
      inlineEntries: staticDiscovery.inlineEntries.length,
      validEntries: validEntries.length,
      invalidEntries: invalidEntries.length,
      parseIssues: staticDiscovery.parseIssues.length
    },
    parseIssues: staticDiscovery.parseIssues,
    metrics,
    boundaries: {
      recursiveCatalogFetch: false,
      registrySearch: false,
      referralsFollowed: false,
      resourcesExecuted: false,
      metadataGrantsAuthorization: false,
      predecessorPathIsCompatibilityOnly: true
    },
    note: 'ARD site discovery is bounded static evidence collection. Nested catalogs, registry search, referrals, artifact execution and authorization are deliberately not followed.'
  };
}

export { DEFAULT_MAX_MANIFESTS as ARD_SITE_DEFAULT_MAX_MANIFESTS, DEFAULT_MAX_ENTRIES as ARD_SITE_DEFAULT_MAX_ENTRIES };
