import { fetchPublicText } from './public-fetch.mjs';
import { analyzeVerticalEvidence, loadGrowthVerticalRegistry, VERTICAL_EVIDENCE_VERSION } from './growth-vertical-evidence.mjs';

const STATUS_RANK = {
  observed: 0,
  partial: 1,
  'external-owner-data': 2,
  manual: 3,
  'not-applicable-or-not-observed': 4,
  'not-observed': 5,
  unavailable: 6
};

const PATTERNS = {
  'software-product': [/product/i, /docs?/i, /guide/i, /changelog/i, /release/i, /version/i, /support/i, /trust/i, /security/i, /api/i, /mcp/i, /a2a/i, /agent/i],
  'research-dataset': [/research/i, /dataset/i, /data/i, /method/i, /provenance/i, /citation/i, /license/i, /download/i, /release/i, /version/i, /api/i],
  documentation: [/docs?/i, /guide/i, /manual/i, /reference/i, /version/i, /release/i, /example/i, /tutorial/i, /quickstart/i],
  editorial: [/article/i, /news/i, /blog/i, /update/i, /author/i, /profile/i, /source/i, /method/i, /evidence/i],
  commerce: [/product/i, /shop/i, /shipping/i, /delivery/i, /return/i, /refund/i, /seller/i, /contact/i, /about/i],
  'local-business': [/service/i, /location/i, /contact/i, /about/i, /visit/i, /direction/i, /map/i, /hours/i],
  general: [/about/i, /profile/i, /product/i, /service/i, /docs?/i, /update/i, /research/i]
};

function normalizeUrl(value, base) {
  try {
    const url = new URL(value, base);
    if (url.protocol !== 'https:') return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function linkUrls(html, base) {
  const out = [];
  for (const match of String(html || '').matchAll(/<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi)) {
    const value = match[1] || match[2] || match[3];
    const url = normalizeUrl(value, base);
    if (url) out.push(url);
  }
  return [...new Set(out)];
}

function sitemapUrls(xml, base) {
  return [...String(xml || '').matchAll(/<loc\b[^>]*>([^<]+)<\/loc>/gi)]
    .map(match => normalizeUrl(match[1].trim(), base))
    .filter(Boolean);
}

function scopePrefix(canonicalUrl) {
  const url = new URL(canonicalUrl);
  const pathname = url.pathname.endsWith('/') ? url.pathname : (url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1) || '/');
  return { origin: url.origin, pathname };
}

function relevantUrl(url, vertical, scope) {
  const parsed = new URL(url);
  if (parsed.origin !== scope.origin || !parsed.pathname.startsWith(scope.pathname)) return false;
  const haystack = `${parsed.pathname}${parsed.search}`;
  return (PATTERNS[vertical] || PATTERNS.general).some(pattern => pattern.test(haystack));
}

function urlPriority(url, vertical, canonicalUrl) {
  if (url === canonicalUrl) return -100;
  const parsed = new URL(url);
  const haystack = `${parsed.pathname}${parsed.search}`;
  const patterns = PATTERNS[vertical] || PATTERNS.general;
  const first = patterns.findIndex(pattern => pattern.test(haystack));
  const depth = parsed.pathname.split('/').filter(Boolean).length;
  return (first < 0 ? 50 : first) * 10 + Math.min(depth, 9);
}

export function discoverVerticalUrls({ canonicalUrl, entryHtml = '', sitemapXml = '', vertical = 'general', maxPages = 6 }) {
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 12) throw new Error('maxPages must be an integer between 1 and 12.');
  const canonical = normalizeUrl(canonicalUrl, canonicalUrl);
  if (!canonical) throw new Error('canonicalUrl must be public HTTPS.');
  const scope = scopePrefix(canonical);
  const candidates = new Set([canonical]);
  for (const url of [...linkUrls(entryHtml, canonical), ...sitemapUrls(sitemapXml, canonical)]) if (relevantUrl(url, vertical, scope)) candidates.add(url);
  return [...candidates]
    .sort((a, b) => urlPriority(a, vertical, canonical) - urlPriority(b, vertical, canonical) || a.localeCompare(b))
    .slice(0, maxPages);
}

function mergeChecks(reports, vertical) {
  const registry = loadGrowthVerticalRegistry();
  const definitions = registry.verticals?.[vertical]?.checks || [];
  return definitions.map(definition => {
    const observations = reports.map(report => report.checks.find(item => item.id === definition.id)).filter(Boolean);
    if (!observations.length) return {
      id: definition.id,
      priority: definition.priority,
      title: definition.title,
      status: 'unavailable',
      reason: 'No successful HTML surface produced evidence for this check.',
      evidence: [],
      expectedEvidence: definition.evidence
    };
    const best = [...observations].sort((a, b) => (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99))[0];
    const evidence = [...new Set(observations.flatMap(item => item.evidence || []))].slice(0, 16);
    const pages = [...new Set(observations.flatMap(item => item.observedOn || []))];
    return {
      ...best,
      evidence,
      observedOn: pages,
      surfaceObservations: observations.length,
      reason: `${best.reason} Aggregated across ${observations.length} successfully inspected relevant surface(s).`
    };
  });
}

export function aggregateVerticalEvidenceReports(reports, { vertical, canonicalUrl, discoveredUrls = [], failedUrls = [] } = {}) {
  const checks = mergeChecks(reports, vertical);
  const summary = checks.reduce((acc, item) => (acc[item.status] = (acc[item.status] || 0) + 1, acc), {});
  return {
    version: VERTICAL_EVIDENCE_VERSION,
    registryVersion: loadGrowthVerticalRegistry().version,
    vertical,
    canonicalUrl,
    coverage: 'bounded-relevant-surface-public-evidence',
    summary,
    pagesObserved: reports.length,
    discoveredUrls,
    failedUrls,
    checks,
    limitations: [
      'The adapter inspects only a bounded set of same-origin URLs selected from the entry page and canonical-path sitemap.',
      'Not observed in the bounded relevant-surface sample is not proof of site-wide absence.',
      'Public metadata and links are evidence, not authorization, runtime conformance, owner-platform state or ranking impact.'
    ]
  };
}

async function optionalText(url, options, accept, userAgent) {
  try {
    return await fetchPublicText(url, { ...options, accept, userAgent });
  } catch (error) {
    return { ok: false, url, text: null, issue: String(error?.message || error) };
  }
}

export async function analyzeVerticalEvidenceSite(input, options = {}) {
  const vertical = options.vertical || 'general';
  const maxPages = options.maxPages || 6;
  const network = {
    fetchImpl: options.fetchImpl || fetch,
    ...(options.resolveImpl ? { resolveImpl: options.resolveImpl } : {}),
    timeoutMs: options.timeoutMs || 8000,
    maxBytes: options.maxBytes || 256 * 1024
  };
  const injectedEntry = options.entryPage || null;
  const entry = injectedEntry || await optionalText(input, network, 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1', 'arwp-growth-vertical/0.2');
  const canonicalUrl = normalizeUrl(entry?.url || input, input) || normalizeUrl(input, input);
  if (!entry?.ok || typeof entry.text !== 'string') {
    const registry = loadGrowthVerticalRegistry();
    const definition = registry.verticals?.[vertical];
    if (!definition) throw new Error(`Unknown Growth vertical: ${vertical}`);
    return {
      version: VERTICAL_EVIDENCE_VERSION,
      registryVersion: registry.version,
      vertical,
      canonicalUrl,
      coverage: 'unavailable',
      summary: { unavailable: definition.checks.length },
      pagesObserved: 0,
      discoveredUrls: canonicalUrl ? [canonicalUrl] : [],
      failedUrls: canonicalUrl ? [{ url: canonicalUrl, issue: entry?.issue || 'entry-page unavailable' }] : [],
      checks: definition.checks.map(check => ({ id: check.id, priority: check.priority, title: check.title, status: 'unavailable', reason: 'Entry-page public evidence was unavailable.', evidence: [], expectedEvidence: check.evidence })),
      limitations: ['Unavailable public evidence does not imply a failed vertical check.']
    };
  }

  const siteBase = canonicalUrl.endsWith('/') ? canonicalUrl : `${canonicalUrl}/`;
  const sitemapUrl = new URL('sitemap.xml', siteBase).href;
  const sitemap = options.sitemap || await optionalText(sitemapUrl, network, 'application/xml, text/xml, text/plain;q=0.8, */*;q=0.1', 'arwp-growth-vertical/0.2');
  const discoveredUrls = discoverVerticalUrls({ canonicalUrl, entryHtml: entry.text, sitemapXml: sitemap?.ok ? sitemap.text : '', vertical, maxPages });
  const pages = [{ ok: true, url: canonicalUrl, text: entry.text }];
  for (const url of discoveredUrls) {
    if (url === canonicalUrl) continue;
    const injected = options.pages?.find(page => normalizeUrl(page.url, canonicalUrl) === url);
    const response = injected || await optionalText(url, network, 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1', 'arwp-growth-vertical/0.2');
    if (response?.ok && typeof response.text === 'string') pages.push({ ok: true, url: response.url || url, text: response.text });
    else pages.push({ ok: false, url, issue: response?.issue || `HTTP ${response?.status ?? 'unknown'}` });
  }
  const successful = pages.filter(page => page.ok && typeof page.text === 'string');
  const reports = successful.map(page => {
    const report = analyzeVerticalEvidence({ vertical, canonicalUrl: page.url, html: page.text });
    report.checks = report.checks.map(check => ({ ...check, observedOn: [page.url] }));
    return report;
  });
  return aggregateVerticalEvidenceReports(reports, {
    vertical,
    canonicalUrl,
    discoveredUrls,
    failedUrls: pages.filter(page => !page.ok).map(page => ({ url: page.url, issue: page.issue }))
  });
}
