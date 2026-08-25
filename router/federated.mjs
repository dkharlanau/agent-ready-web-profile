import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareGatewayContext } from '../gateway/factory.mjs';
import { parseIndexText, searchRecords } from '../gateway/lib.mjs';

export const DEFAULT_DIRECTORY_SOURCE = process.env.ARWP_DIRECTORY || path.resolve(process.cwd(), 'registry', 'sites.json');

function isHttp(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

function validateDirectory(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.sites)) throw new Error('ARWP directory must contain a sites array.');
  const ids = new Set();
  for (const site of payload.sites) {
    if (!site?.id || !site?.name || !site?.profileUrl || !site?.canonicalUrl) throw new Error('Every directory site requires id, name, profileUrl and canonicalUrl.');
    if (ids.has(site.id)) throw new Error(`Duplicate ARWP directory site id: ${site.id}`);
    ids.add(site.id);
    for (const [field, value] of [['profileUrl', site.profileUrl], ['canonicalUrl', site.canonicalUrl]]) {
      const parsed = new URL(value);
      if (parsed.protocol !== 'https:') throw new Error(`${site.id}.${field} must use HTTPS.`);
    }
  }
  return payload;
}

export async function loadDirectory(source = DEFAULT_DIRECTORY_SOURCE, fetchImpl = fetch) {
  if (isHttp(source)) {
    const parsed = new URL(source);
    if (parsed.protocol !== 'https:') throw new Error('Remote ARWP directory must use HTTPS.');
    const response = await fetchImpl(parsed.href, { headers: { Accept: 'application/json' }, redirect: 'follow' });
    if (!response.ok) throw new Error(`Unable to fetch ARWP directory: HTTP ${response.status}`);
    if (new URL(response.url).protocol !== 'https:') throw new Error('ARWP directory redirected away from HTTPS.');
    return { directory: validateDirectory(await response.json()), sourceUrl: response.url };
  }
  const file = path.resolve(source);
  if (!fs.existsSync(file)) throw new Error(`ARWP directory not found: ${file}`);
  return { directory: validateDirectory(JSON.parse(fs.readFileSync(file, 'utf8'))), sourceUrl: pathToFileURL(file).href };
}

export function selectSites(directory, { siteIds = [], capability = null } = {}) {
  const wanted = new Set((siteIds || []).map(String));
  return directory.sites.filter(site => {
    if (wanted.size && !wanted.has(site.id)) return false;
    if (!capability) return true;
    if (capability === 'mcp') return Boolean(site.capabilities?.mcp);
    return Boolean(site.capabilities?.[capability]);
  });
}

export async function searchFederated(query, {
  directorySource = DEFAULT_DIRECTORY_SOURCE,
  siteIds = [],
  limit = 10,
  limitPerSite = 3,
  fetchImpl = fetch
} = {}) {
  if (!String(query || '').trim()) throw new Error('A search query is required.');
  const { directory, sourceUrl } = await loadDirectory(directorySource, fetchImpl);
  const candidates = selectSites(directory, { siteIds, capability: 'retrieval' });
  const results = [];
  const failures = [];

  await Promise.all(candidates.map(async site => {
    try {
      const context = await prepareGatewayContext({ profileSource: site.profileUrl, fetchImpl });
      if (!context.indexes.length) return;
      const selected = context.indexes[0];
      const records = parseIndexText(await context.fetchText(selected.url), selected.format);
      const hits = searchRecords(records, query, limitPerSite).map(hit => ({
        ...hit,
        site: { id: site.id, name: site.name, canonicalUrl: site.canonicalUrl, profileUrl: site.profileUrl },
        index: { name: selected.name, url: selected.url }
      }));
      results.push(...hits);
    } catch (error) {
      failures.push({ siteId: site.id, siteName: site.name, error: String(error?.message || error) });
    }
  }));

  results.sort((a, b) => b.score - a.score || a.site.name.localeCompare(b.site.name) || String(a.id || '').localeCompare(String(b.id || '')));
  return {
    query: String(query),
    directory: sourceUrl,
    searchedSites: candidates.map(site => ({ id: site.id, name: site.name, profileUrl: site.profileUrl })),
    results: results.slice(0, Math.max(1, Math.min(Number(limit) || 10, 50))),
    failures
  };
}
