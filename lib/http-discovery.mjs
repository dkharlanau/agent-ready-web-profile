import { lookup as dnsLookup } from 'node:dns/promises';
import { assertPublicHttpsUrl } from './public-fetch.mjs';

const MAX_REDIRECTS = 5;

function splitLinkValues(value) {
  const parts = [];
  let start = 0;
  let quoted = false;
  let angleDepth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '"' && value[index - 1] !== '\\') quoted = !quoted;
    if (!quoted) {
      if (char === '<') angleDepth += 1;
      else if (char === '>') angleDepth = Math.max(0, angleDepth - 1);
      else if (char === ',' && angleDepth === 0) {
        parts.push(value.slice(start, index).trim());
        start = index + 1;
      }
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function unquote(value) {
  const text = String(value || '').trim();
  if (text.startsWith('"') && text.endsWith('"')) return text.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  return text;
}

export function parseLinkHeader(value, baseUrl) {
  const entries = [];
  for (const part of splitLinkValues(String(value || ''))) {
    const target = part.match(/^\s*<([^>]+)>/);
    if (!target) continue;
    let url;
    try { url = new URL(target[1], baseUrl).href; } catch { continue; }
    const params = {};
    const tail = part.slice(target[0].length);
    for (const segment of tail.split(';').map(item => item.trim()).filter(Boolean)) {
      const eq = segment.indexOf('=');
      if (eq < 0) params[segment.toLowerCase()] = '';
      else params[segment.slice(0, eq).trim().toLowerCase()] = unquote(segment.slice(eq + 1));
    }
    const rels = String(params.rel || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!rels.length) continue;
    entries.push({ url, rels, type: params.type || null, title: params.title || null });
  }
  return entries;
}

export async function fetchPublicHead(url, {
  fetchImpl = fetch,
  resolveImpl = dnsLookup,
  timeoutMs = 8000,
  maxRedirects = MAX_REDIRECTS,
  accept = 'text/markdown, text/html;q=0.9, application/json;q=0.7, */*;q=0.1',
  userAgent = 'arwp-resolver/0.1',
  metrics = null
} = {}) {
  let current = await assertPublicHttpsUrl(url, resolveImpl);
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (metrics) metrics.requests = (metrics.requests || 0) + 1;
    let response;
    try {
      response = await fetchImpl(current.href, {
        method: 'HEAD',
        headers: { Accept: accept, 'user-agent': userAgent },
        redirect: 'manual',
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400 && response.status !== 304) {
      const location = response.headers?.get?.('location');
      try { await response.body?.cancel?.(); } catch { /* no-op */ }
      if (!location) throw new Error(`Redirect without Location from ${current.href}`);
      if (redirectCount === maxRedirects) throw new Error(`Too many redirects while fetching HEAD ${url}`);
      current = await assertPublicHttpsUrl(new URL(location, current).href, resolveImpl);
      continue;
    }

    const contentType = response.headers?.get?.('content-type') || null;
    const linkHeader = response.headers?.get?.('link') || null;
    try { await response.body?.cancel?.(); } catch { /* no-op */ }
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      url: current.href,
      contentType,
      linkHeader,
      links: parseLinkHeader(linkHeader, current.href),
      markdownNegotiated: /^text\/markdown(?:;|$)/i.test(String(contentType || ''))
    };
  }
  throw new Error(`Too many redirects while fetching HEAD ${url}`);
}

export function adaptHttpDiscovery(head, sourceId = 'http-head:0') {
  const interfaces = {
    content: [], data: [], retrieval: [], apis: [], tools: [], skills: [], agents: [], browserTools: [], auth: [], trust: []
  };
  const contentType = String(head.contentType || '');
  if (/^text\/html(?:;|$)/i.test(contentType)) interfaces.content.push({
    sourceId,
    sourceAuthority: 'observed-web',
    kind: 'html',
    protocol: 'HTML',
    url: head.url,
    mediaType: head.contentType
  });
  if (head.markdownNegotiated) interfaces.content.push({
    sourceId,
    sourceAuthority: 'observed-web',
    kind: 'markdown-negotiated',
    protocol: 'HTTP',
    url: head.url,
    mediaType: head.contentType
  });

  const apiCatalogs = [];
  const arwpProfiles = [];
  const ardCatalogs = [];
  for (const link of head.links || []) {
    if (link.rels.includes('api-catalog')) apiCatalogs.push(link.url);
    // ARD v0.91 uses rel="ard". rel="ai-catalog" is preserved as a predecessor/compatibility relation.
    if (link.rels.includes('ard') || link.rels.includes('ai-catalog')) ardCatalogs.push(link.url);
    if (link.rels.includes('service-desc')) interfaces.apis.push({
      sourceId,
      sourceAuthority: 'ietf-standard',
      kind: 'api-description',
      protocol: /(?:openapi|swagger)/i.test(`${link.type || ''} ${link.url}`) ? 'OpenAPI' : 'HTTP service-desc',
      url: link.url,
      mediaType: link.type
    });
    if (link.rels.includes('service-doc')) interfaces.apis.push({
      sourceId,
      sourceAuthority: 'ietf-standard',
      kind: 'api-documentation',
      protocol: 'HTTP service-doc',
      url: link.url,
      mediaType: link.type
    });
    if (link.rels.includes('alternate') && /^text\/markdown(?:;|$)/i.test(String(link.type || ''))) interfaces.content.push({
      sourceId,
      sourceAuthority: 'observed-web',
      kind: 'markdown-alternate',
      protocol: 'HTTP Link',
      url: link.url,
      mediaType: link.type
    });
    if (link.rels.includes('describedby') && /\/ai\/site-profile\.json(?:$|[?#])|\/site-profile\.json(?:$|[?#])/i.test(link.url)) arwpProfiles.push(link.url);
  }
  return {
    interfaces,
    apiCatalogs: [...new Set(apiCatalogs)],
    arwpProfiles: [...new Set(arwpProfiles)],
    ardCatalogs: [...new Set(ardCatalogs)]
  };
}
