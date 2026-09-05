export const ARD_BASE_CONTEXT = 'https://agenticresourcediscovery.org/context/v1';
export const ARD_WELL_KNOWN_PATH = '/.well-known/ard.json';
export const ARD_LEGACY_WELL_KNOWN_PATH = '/.well-known/ai-catalog.json';

const CORE_TERMS = new Set([
  '@context', '@id',
  'identifier', 'displayName', 'type', 'url', 'data',
  'representativeQueries', 'capabilities', 'description', 'tags',
  'version', 'updatedAt', 'metadata', 'trustManifest'
]);

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function resolveUrl(value, baseUrl) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return new URL(value, baseUrl || undefined).href;
  } catch {
    return null;
  }
}

function parseAttributes(tag) {
  const attrs = {};
  const body = String(tag || '')
    .replace(/^<\/?[A-Za-z0-9:-]+\s*/i, '')
    .replace(/\/?\s*>$/, '');
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(body))) attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return attrs;
}

function nodesFromJsonLd(value) {
  if (Array.isArray(value)) return value.flatMap(nodesFromJsonLd);
  if (!object(value)) return [];
  const nodes = [];
  if (Array.isArray(value.entries)) nodes.push(...value.entries.flatMap(nodesFromJsonLd));
  if (Array.isArray(value['@graph'])) nodes.push(...value['@graph'].flatMap(nodesFromJsonLd));
  if (looksLikeArdEntry(value)) nodes.push(value);
  return nodes;
}

export function looksLikeArdEntry(entry) {
  if (!object(entry)) return false;
  return typeof entry.identifier === 'string'
    && typeof entry.displayName === 'string'
    && typeof entry.type === 'string'
    && (Object.hasOwn(entry, 'url') || Object.hasOwn(entry, 'data'));
}

export function validateArdEntry(entry, { baseUrl = null } = {}) {
  const issues = [];
  const warnings = [];
  if (!object(entry)) return { valid: false, issues: ['ARD entry must be an object.'], warnings };

  for (const term of ['identifier', 'displayName', 'type']) {
    if (typeof entry[term] !== 'string' || !entry[term].trim()) issues.push(`${term} is required and must be a non-empty string.`);
  }

  const hasUrl = Object.hasOwn(entry, 'url');
  const hasData = Object.hasOwn(entry, 'data');
  if (hasUrl === hasData) issues.push('Exactly one of url or data is required.');
  if (hasUrl && !resolveUrl(entry.url, baseUrl)) issues.push('url must resolve to a valid URL.');
  if (hasData && entry.data == null) issues.push('data must not be null.');

  if (!Array.isArray(entry.representativeQueries) || entry.representativeQueries.length < 2 || entry.representativeQueries.length > 5) {
    warnings.push('representativeQueries SHOULD contain 2-5 examples for search-oriented ARD discovery.');
  }
  if (entry.capabilities != null && !Array.isArray(entry.capabilities)) warnings.push('capabilities is expected to be an array when present.');

  return { valid: issues.length === 0, issues, warnings };
}

export function normalizeArdEntry(entry, { sourceId = null, baseUrl = null, discoveredVia = null } = {}) {
  const validation = validateArdEntry(entry, { baseUrl });
  const extensionTerms = {};
  const unknownTerms = {};
  if (object(entry)) {
    for (const [key, value] of Object.entries(entry)) {
      if (CORE_TERMS.has(key)) continue;
      if (key.includes(':')) extensionTerms[key] = value;
      else unknownTerms[key] = value;
    }
  }

  return {
    valid: validation.valid,
    issues: validation.issues,
    warnings: validation.warnings,
    sourceId,
    discoveredVia,
    context: object(entry) ? (entry['@context'] ?? null) : null,
    jsonLdId: object(entry) ? (entry['@id'] ?? null) : null,
    baseContext: ARD_BASE_CONTEXT,
    identifier: object(entry) ? (entry.identifier ?? null) : null,
    displayName: object(entry) ? (entry.displayName ?? null) : null,
    type: object(entry) ? (entry.type ?? null) : null,
    url: object(entry) && Object.hasOwn(entry, 'url') ? resolveUrl(entry.url, baseUrl) : null,
    data: object(entry) && Object.hasOwn(entry, 'data') ? entry.data : null,
    representativeQueries: Array.isArray(entry?.representativeQueries) ? [...entry.representativeQueries] : [],
    capabilities: Array.isArray(entry?.capabilities) ? [...entry.capabilities] : [],
    description: object(entry) ? (entry.description ?? null) : null,
    tags: Array.isArray(entry?.tags) ? [...entry.tags] : [],
    version: object(entry) ? (entry.version ?? null) : null,
    updatedAt: object(entry) ? (entry.updatedAt ?? null) : null,
    metadata: object(entry) ? (entry.metadata ?? null) : null,
    trustManifest: object(entry) ? (entry.trustManifest ?? null) : null,
    extensionTerms,
    unknownTerms
  };
}

export function parseAgentmapDirectives(robotsText, baseUrl) {
  const results = [];
  for (const raw of String(robotsText || '').split(/\r?\n/)) {
    const match = raw.match(/^\s*Agentmap\s*:\s*(\S+)\s*$/i);
    if (!match) continue;
    const url = resolveUrl(match[1], baseUrl);
    if (url) results.push({ url, relation: 'agentmap', legacy: false });
  }
  return dedupeSources(results);
}

export function extractArdHtml(html, baseUrl) {
  const links = [];
  for (const tag of String(html || '').match(/<link\b[^>]*>/gi) || []) {
    const attrs = parseAttributes(tag);
    const rels = String(attrs.rel || '').toLowerCase().split(/\s+/).filter(Boolean);
    const relation = rels.includes('ard') ? 'ard' : rels.includes('ai-catalog') ? 'ai-catalog' : null;
    if (!relation) continue;
    const url = resolveUrl(attrs.href, baseUrl);
    if (!url) continue;
    links.push({
      url,
      relation,
      legacy: relation === 'ai-catalog',
      mediaType: attrs.type || null
    });
  }

  const entries = [];
  const parseIssues = [];
  const scripts = String(html || '').match(/<script\b[^>]*type\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const script of scripts) {
    const body = script.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>\s*$/i, '').trim();
    if (!body) continue;
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      parseIssues.push(`Invalid JSON-LD block ignored: ${error.message}`);
      continue;
    }
    for (const node of nodesFromJsonLd(payload)) {
      const normalized = normalizeArdEntry(node, { baseUrl, discoveredVia: 'html-jsonld' });
      if (normalized.valid) entries.push(normalized);
      else parseIssues.push(...normalized.issues.map(issue => `${node.identifier || node.displayName || 'ARD JSON-LD entry'}: ${issue}`));
    }
  }

  return { links: dedupeSources(links), entries, parseIssues };
}

function dedupeSources(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = `${item.relation || ''}|${item.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function collectArdDiscoverySources({ baseUrl, html = '', robotsText = '', includeLegacy = true } = {}) {
  if (!baseUrl) throw new Error('baseUrl is required.');
  const origin = new URL(baseUrl).origin;
  const htmlDiscovery = extractArdHtml(html, baseUrl);
  const sources = [
    { url: new URL(ARD_WELL_KNOWN_PATH, origin).href, relation: 'well-known', legacy: false },
    ...htmlDiscovery.links,
    ...parseAgentmapDirectives(robotsText, origin)
  ];
  if (includeLegacy) sources.push({ url: new URL(ARD_LEGACY_WELL_KNOWN_PATH, origin).href, relation: 'legacy-well-known', legacy: true });
  return {
    sources: dedupeSources(sources),
    inlineEntries: htmlDiscovery.entries,
    parseIssues: htmlDiscovery.parseIssues
  };
}
