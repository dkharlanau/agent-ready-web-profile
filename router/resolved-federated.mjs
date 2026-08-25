import { resolveSite } from '../lib/resolver.mjs';
import { resolveMany } from '../lib/resolver-batch.mjs';
import { fetchPublicText } from '../lib/public-fetch.mjs';
import { parseIndexText, searchRecords } from '../gateway/lib.mjs';

function inferFormat(item) {
  const explicit = String(item?.format || '').toLowerCase();
  if (['json', 'jsonl', 'ndjson'].includes(explicit)) return explicit;
  const source = `${item?.url || ''} ${item?.mediaType || ''}`.toLowerCase();
  if (source.includes('ndjson') || source.endsWith('.ndjson')) return 'ndjson';
  if (source.includes('jsonl') || source.endsWith('.jsonl')) return 'jsonl';
  if (source.includes('application/feed+json') || source.includes('application/json') || /\.json(?:$|[?#])/.test(source)) return 'json';
  if (item?.kind === 'feed' && /\/(?:feed(?:\.json)?|feeds?\/json|jsonfeed(?:\.json)?)(?:$|[?#])/i.test(String(item.url || ''))) return 'json';
  return null;
}

function authorityRank(value) {
  return ({
    'ietf-standard': 6,
    'upstream-standard': 6,
    'project-profile': 5,
    'upstream-convention': 4,
    'community-convention': 3,
    'experimental-upstream': 2,
    'observed-web': 1
  })[value] || 0;
}

function staticSurfaceRank(item) {
  if (item.kind === 'index') return 2;
  if (item.kind === 'feed') return 1;
  return 0;
}

export function resolvedStaticIndexes(resolution) {
  const candidates = [
    ...(resolution?.interfaces?.retrieval || []),
    ...(resolution?.interfaces?.content || []).filter(item => item.kind === 'feed')
  ];
  return candidates
    .map(item => ({ ...item, format: inferFormat(item) }))
    .filter(item => item.url && item.format && (item.kind === 'index' || item.kind === 'feed' || ['json', 'jsonl', 'ndjson'].includes(item.format)))
    .sort((a, b) => authorityRank(b.sourceAuthority) - authorityRank(a.sourceAuthority)
      || staticSurfaceRank(b) - staticSurfaceRank(a)
      || String(a.url).localeCompare(String(b.url)));
}

async function mapLimit(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export async function searchResolvedFederated(query, {
  sites,
  resolveImpl = resolveSite,
  fetchTextImpl = fetchPublicText,
  concurrency = 4,
  limit = 10,
  limitPerSite = 3,
  maxIndexBytes = 2 * 1024 * 1024
} = {}) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) throw new Error('A federated search query is required.');
  if (!Array.isArray(sites) || !sites.length) throw new Error('Resolver-backed federation requires a non-empty reviewed sites array.');
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));
  const safePerSite = Math.max(1, Math.min(Number(limitPerSite) || 3, 10));
  const safeConcurrency = Math.max(1, Math.min(Math.trunc(Number(concurrency) || 4), 8));

  const batch = await resolveMany(sites, { resolveImpl, concurrency: safeConcurrency });
  const resolvedSites = batch.results.filter(item => item.status === 'resolved');
  const skipped = batch.results.filter(item => item.status === 'failed').map(item => ({
    id: item.id,
    inputUrl: item.inputUrl,
    reason: 'resolution-failed',
    error: item.error
  }));
  const failures = [];
  const executed = [];
  const hitsBySite = await mapLimit(resolvedSites, safeConcurrency, async item => {
    const indexes = resolvedStaticIndexes(item.resolution);
    if (!indexes.length) {
      skipped.push({ id: item.id, inputUrl: item.inputUrl, reason: 'no-supported-static-retrieval-index' });
      return [];
    }
    const selected = indexes[0];
    try {
      const fetched = await fetchTextImpl(selected.url, { maxBytes: maxIndexBytes });
      if (!fetched.ok) throw new Error(`HTTP ${fetched.status}`);
      const records = parseIndexText(fetched.text, selected.format);
      const matches = searchRecords(records, normalizedQuery, safePerSite);
      executed.push({
        siteId: item.id,
        siteName: item.name || item.resolution.identity?.name || item.id,
        interface: {
          kind: selected.kind || 'index',
          url: selected.url,
          mediaType: selected.mediaType || null,
          format: selected.format,
          sourceId: selected.sourceId || null,
          sourceAuthority: selected.sourceAuthority || null
        },
        records: records.length,
        matches: matches.length
      });
      return matches.map(hit => ({
        ...hit,
        site: {
          id: item.id,
          name: item.name || item.resolution.identity?.name || item.id,
          canonicalUrl: item.resolution.canonicalUrl,
          inputUrl: item.inputUrl
        },
        discovery: {
          sourceId: selected.sourceId || null,
          sourceAuthority: selected.sourceAuthority || null
        },
        interface: {
          kind: selected.kind || 'index',
          url: selected.url,
          mediaType: selected.mediaType || null,
          format: selected.format
        }
      }));
    } catch (error) {
      failures.push({
        siteId: item.id,
        siteName: item.name || item.resolution.identity?.name || item.id,
        interfaceUrl: selected.url,
        error: String(error?.message || error)
      });
      return [];
    }
  });

  const results = hitsBySite.flat();
  results.sort((a, b) => b.score - a.score || a.site.name.localeCompare(b.site.name) || String(a.id || '').localeCompare(String(b.id || '')));
  executed.sort((a, b) => String(a.siteId).localeCompare(String(b.siteId)) || String(a.interface.url).localeCompare(String(b.interface.url)));
  return {
    federationVersion: '0.2',
    query: normalizedQuery,
    policy: 'Only resolved static JSON/JSONL/NDJSON retrieval indexes and JSON Feed surfaces are executed. Generic federation does not invent OpenAPI, MCP or A2A operations.',
    searchedSites: executed.length,
    resolvedSites: resolvedSites.length,
    executed,
    results: results.slice(0, safeLimit),
    skipped,
    failures,
    resolutionSummary: batch.summary
  };
}
