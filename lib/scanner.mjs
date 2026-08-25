import { lookup as dnsLookup } from 'node:dns/promises';
import net from 'node:net';
import { validateProfile } from './validator.mjs';

const RELEASE_SCHEMA_URL = 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/v0.1.0/schema/site-profile.schema.json';
const DEFAULT_MAX_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;

const FEED_MEDIA_TYPES = new Set([
  'application/rss+xml',
  'application/atom+xml',
  'application/feed+json'
]);

function mediaTypeOnly(value) {
  return String(value || '').split(';', 1)[0].trim().toLowerCase();
}

function isPublicIpv4(address) {
  const parts = String(address).split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;

  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function isPublicIpv6(address) {
  const normalized = String(address).toLowerCase();
  if (normalized === '::' || normalized === '::1') return false;
  if (normalized.startsWith('::ffff:')) return isPublicIpv4(normalized.slice('::ffff:'.length));
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return false;
  const first = Number.parseInt(normalized.split(':', 1)[0] || '0', 16);
  if (Number.isFinite(first) && (first & 0xffc0) === 0xfe80) return false;
  if (normalized.startsWith('2001:db8:') || normalized === '2001:db8::') return false;
  return true;
}

function isPublicAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

function normalizeInputUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('A website URL is required.');
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

async function assertPublicHttpsUrl(value, resolveImpl) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') throw new Error(`Only HTTPS websites can be scanned: ${parsed.href}`);
  if (parsed.username || parsed.password) throw new Error('Website URLs containing credentials are not allowed.');
  if (parsed.port && parsed.port !== '443') throw new Error(`Non-standard HTTPS ports are not scanned: ${parsed.port}`);

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error(`Local hostname is not allowed: ${parsed.hostname}`);
  }

  if (net.isIP(hostname)) {
    if (!isPublicAddress(hostname)) throw new Error(`Private or reserved address is not allowed: ${hostname}`);
    return parsed;
  }

  let resolved;
  try {
    resolved = await resolveImpl(hostname, { all: true, verbatim: true });
  } catch (error) {
    throw new Error(`Unable to resolve ${hostname}: ${error?.message ?? error}`);
  }

  const addresses = Array.isArray(resolved) ? resolved : [resolved];
  if (!addresses.length) throw new Error(`Unable to resolve ${hostname}.`);
  for (const item of addresses) {
    const address = typeof item === 'string' ? item : item?.address;
    if (!address || !isPublicAddress(address)) {
      throw new Error(`Target resolves to a private or reserved address: ${address || hostname}`);
    }
  }
  return parsed;
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal, redirect: 'manual' });
  } finally {
    clearTimeout(timer);
  }
}

async function requestWithRedirects(url, {
  fetchImpl,
  resolveImpl,
  timeoutMs,
  method = 'GET',
  headers = {}
}) {
  let current = await assertPublicHttpsUrl(url, resolveImpl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetchWithTimeout(fetchImpl, current.href, {
      method,
      headers: {
        'user-agent': 'arwp-scanner/0.1',
        ...headers
      }
    }, timeoutMs);

    if (response.status >= 300 && response.status < 400 && response.status !== 304) {
      const location = response.headers?.get?.('location');
      try { await response.body?.cancel?.(); } catch { /* no-op */ }
      if (!location) throw new Error(`Redirect without Location from ${current.href}`);
      if (redirectCount === MAX_REDIRECTS) throw new Error(`Too many redirects while fetching ${url}`);
      current = await assertPublicHttpsUrl(new URL(location, current).href, resolveImpl);
      continue;
    }

    return { response, url: current.href };
  }

  throw new Error(`Too many redirects while fetching ${url}`);
}

async function readTextBounded(response, maxBytes, { allowTruncate = false } = {}) {
  const declaredLength = Number(response.headers?.get?.('content-length') || 0);
  if (declaredLength && declaredLength > maxBytes && !allowTruncate) {
    throw new Error(`Response exceeds maxBytes (${maxBytes}).`);
  }

  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    let truncated = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = maxBytes - total;
      if (value.byteLength > remaining) {
        if (!allowTruncate) {
          try { await reader.cancel(); } catch { /* no-op */ }
          throw new Error(`Response exceeds maxBytes (${maxBytes}).`);
        }
        if (remaining > 0) chunks.push(value.subarray(0, remaining));
        total += Math.max(remaining, 0);
        truncated = true;
        try { await reader.cancel(); } catch { /* no-op */ }
        break;
      }
      chunks.push(value);
      total += value.byteLength;
      if (allowTruncate && declaredLength > maxBytes && total === maxBytes) {
        truncated = true;
        try { await reader.cancel(); } catch { /* no-op */ }
        break;
      }
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      text: new TextDecoder('utf-8', { fatal: false }).decode(merged),
      truncated,
      bytesRead: total
    };
  }

  const text = await response.text();
  const encoded = new TextEncoder().encode(text);
  if (encoded.byteLength > maxBytes) {
    if (!allowTruncate) throw new Error(`Response exceeds maxBytes (${maxBytes}).`);
    return {
      text: new TextDecoder('utf-8', { fatal: false }).decode(encoded.subarray(0, maxBytes)),
      truncated: true,
      bytesRead: maxBytes
    };
  }
  return { text, truncated: false, bytesRead: encoded.byteLength };
}

async function fetchTextResource(url, options) {
  const { response, url: finalUrl } = await requestWithRedirects(url, {
    ...options,
    method: 'GET',
    headers: {
      Accept: options.accept || 'text/html, text/plain, application/json, application/xml;q=0.9, */*;q=0.1'
    }
  });
  if (response.status < 200 || response.status >= 300) {
    try { await response.body?.cancel?.(); } catch { /* no-op */ }
    return {
      ok: false,
      status: response.status,
      url: finalUrl,
      contentType: response.headers?.get?.('content-type') ?? null,
      text: null,
      truncated: false,
      bytesRead: 0
    };
  }

  const body = await readTextBounded(response, options.maxBytes, { allowTruncate: Boolean(options.allowTruncate) });
  return {
    ok: true,
    status: response.status,
    url: finalUrl,
    contentType: response.headers?.get?.('content-type') ?? null,
    text: body.text,
    truncated: body.truncated,
    bytesRead: body.bytesRead
  };
}

async function probeResource(url, options) {
  let result = await requestWithRedirects(url, {
    ...options,
    method: 'HEAD',
    headers: { Accept: '*/*' }
  });

  if ([405, 501].includes(result.response.status)) {
    try { await result.response.body?.cancel?.(); } catch { /* no-op */ }
    result = await requestWithRedirects(url, {
      ...options,
      method: 'GET',
      headers: { Accept: '*/*', Range: 'bytes=0-4095' }
    });
  }

  const info = {
    ok: result.response.status >= 200 && result.response.status < 300,
    status: result.response.status,
    url: result.url,
    contentType: result.response.headers?.get?.('content-type') ?? null
  };
  try { await result.response.body?.cancel?.(); } catch { /* no-op */ }
  return info;
}

function parseAttributes(tag) {
  const attrs = {};
  const body = tag.replace(/^<\/?[A-Za-z0-9:-]+\s*/i, '').replace(/\/?\s*>$/, '');
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(body))) {
    const name = match[1].toLowerCase();
    attrs[name] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attrs;
}

function findTags(html, name) {
  return String(html || '').match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDocumentMetadata(html, baseUrl, warnings) {
  const links = findTags(html, 'link').map(parseAttributes);
  const metas = findTags(html, 'meta').map(parseAttributes);
  const htmlTag = findTags(html, 'html')[0];
  const htmlAttrs = htmlTag ? parseAttributes(htmlTag) : {};
  const titleMatch = String(html || '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);

  function metaContent(name, property = false) {
    const key = property ? 'property' : 'name';
    const item = metas.find(meta => String(meta[key] || '').toLowerCase() === name.toLowerCase());
    return decodeHtml(item?.content || '');
  }

  function resolveHref(href) {
    if (!href) return null;
    try {
      return new URL(href, baseUrl).href;
    } catch {
      warnings.push(`Ignored malformed link URL: ${href}`);
      return null;
    }
  }

  const canonicalLink = links.find(link => String(link.rel || '').toLowerCase().split(/\s+/).includes('canonical'));
  const feeds = [];
  const llmsLinks = [];
  const profileLinks = [];
  const openapiLinks = [];

  for (const link of links) {
    const rel = String(link.rel || '').toLowerCase().split(/\s+/).filter(Boolean);
    const type = mediaTypeOnly(link.type);
    const href = resolveHref(link.href);
    if (!href) continue;

    if (rel.includes('alternate') && FEED_MEDIA_TYPES.has(type)) {
      feeds.push({ url: href, mediaType: type, title: decodeHtml(link.title || '') || undefined });
    }
    if (new URL(href).pathname.toLowerCase().endsWith('/llms.txt')) llmsLinks.push(href);
    if (new URL(href).pathname.toLowerCase().endsWith('/ai/site-profile.json')) profileLinks.push(href);
    if (rel.includes('service-desc') && (['application/json', 'application/yaml', 'text/yaml', 'application/x-yaml'].includes(type) || /(?:openapi|swagger)/i.test(new URL(href).pathname))) {
      openapiLinks.push(href);
    }
  }

  const language = String(htmlAttrs.lang || '').replace(/_/g, '-').trim();
  const languages = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(language) ? [language] : [];

  return {
    title: metaContent('og:site_name', true) || decodeHtml(titleMatch?.[1] || ''),
    description: metaContent('description') || metaContent('og:description', true),
    canonical: resolveHref(canonicalLink?.href),
    languages,
    feeds,
    llmsLinks,
    profileLinks,
    openapiLinks
  };
}

function makeProfileId(canonicalUrl) {
  const parsed = new URL(canonicalUrl);
  const pathPart = parsed.pathname === '/' ? '' : `-${parsed.pathname}`;
  let value = `${parsed.hostname.replace(/^www\./i, '')}${pathPart}`
    .replace(/[^A-Za-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 128);
  if (value.length < 2) value = `site-${value || 'web'}`;
  if (!/^[A-Za-z0-9]/.test(value)) value = `site-${value}`;
  return value.slice(0, 128);
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter(item => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function truncate(value, max) {
  const text = String(value || '').trim();
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function draftProfileFromScan(scan) {
  const canonical = new URL(scan.canonicalUrl);
  const profile = {
    $schema: RELEASE_SCHEMA_URL,
    profileVersion: '0.1',
    id: makeProfileId(scan.canonicalUrl),
    name: truncate(scan.identity.name || canonical.hostname, 200),
    canonicalUrl: scan.canonicalUrl,
    description: truncate(scan.identity.description || `Public website at ${canonical.hostname}.`, 1000)
  };

  if (scan.identity.languages?.length) profile.languages = scan.identity.languages;

  const web = {};
  if (scan.discovered.sitemap) web.sitemap = scan.discovered.sitemap.url;
  if (scan.discovered.robots) web.robots = scan.discovered.robots.url;
  if (scan.discovered.llms) web.llms = scan.discovered.llms.url;
  if (scan.discovered.feeds?.length) {
    web.feeds = scan.discovered.feeds.map(feed => ({
      url: feed.url,
      mediaType: feed.mediaType,
      ...(feed.title ? { title: feed.title } : {})
    }));
  }
  if (Object.keys(web).length) profile.web = web;

  if (scan.discovered.openapi) {
    profile.data = { openapi: scan.discovered.openapi.url };
  }

  return profile;
}

export async function scanSite(input, {
  fetchImpl = fetch,
  resolveImpl = dnsLookup,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = DEFAULT_MAX_BYTES
} = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('timeoutMs must be a positive number.');
  if (!Number.isFinite(maxBytes) || maxBytes < 16 * 1024) throw new Error('maxBytes must be at least 16384.');

  const source = normalizeInputUrl(input);
  const warnings = [];
  const requestOptions = { fetchImpl, resolveImpl, timeoutMs, maxBytes };
  const homepage = await fetchTextResource(source, {
    ...requestOptions,
    accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1',
    allowTruncate: true
  });
  if (!homepage.ok) throw new Error(`Unable to fetch website: HTTP ${homepage.status}`);

  if (homepage.truncated) {
    warnings.push(`Homepage body exceeded maxBytes (${maxBytes}); only the bounded prefix was inspected for HTML discovery.`);
  }
  if (!['text/html', 'application/xhtml+xml'].includes(mediaTypeOnly(homepage.contentType))) {
    warnings.push(`Homepage returned ${homepage.contentType || 'no Content-Type'}; HTML discovery may be incomplete.`);
  }

  const metadata = extractDocumentMetadata(homepage.text, homepage.url, warnings);
  let canonicalUrl = homepage.url;
  if (metadata.canonical) {
    try {
      canonicalUrl = (await assertPublicHttpsUrl(metadata.canonical, resolveImpl)).href;
    } catch (error) {
      warnings.push(`Ignored unsafe canonical URL: ${error.message}`);
    }
  }

  const canonical = new URL(canonicalUrl);
  const origin = canonical.origin;
  const discovered = { feeds: [] };
  const evidence = [{ key: 'web.homepage', status: 'detected', url: homepage.url, source: 'http' }];

  const robotsUrl = new URL('/robots.txt', origin).href;
  let robotsText = null;
  try {
    const robots = await fetchTextResource(robotsUrl, { ...requestOptions, maxBytes: Math.min(maxBytes, 128 * 1024), accept: 'text/plain, */*;q=0.1' });
    if (robots.ok) {
      discovered.robots = { url: robots.url, contentType: robots.contentType };
      robotsText = robots.text;
      evidence.push({ key: 'web.robots', status: 'detected', url: robots.url, source: 'conventional-path' });
    } else if (robots.status >= 500) {
      warnings.push(`robots.txt returned HTTP ${robots.status}.`);
    }
  } catch (error) {
    warnings.push(`robots.txt probe failed: ${error.message}`);
  }

  const sitemapCandidates = [];
  if (robotsText) {
    for (const match of robotsText.matchAll(/^\s*Sitemap:\s*(\S+)\s*$/gim)) sitemapCandidates.push(match[1]);
  }
  sitemapCandidates.push(new URL('/sitemap.xml', origin).href);

  for (const candidate of uniqueBy(sitemapCandidates, item => item).slice(0, 4)) {
    try {
      const probe = await probeResource(candidate, requestOptions);
      if (probe.ok) {
        discovered.sitemap = probe;
        evidence.push({ key: 'web.sitemap', status: 'detected', url: probe.url, source: robotsText?.includes(candidate) ? 'robots.txt' : 'conventional-path' });
        break;
      }
    } catch (error) {
      warnings.push(`Sitemap candidate rejected or unreachable (${candidate}): ${error.message}`);
    }
  }

  const llmsCandidates = uniqueBy([
    ...metadata.llmsLinks,
    new URL('/llms.txt', origin).href
  ], item => item);
  for (const candidate of llmsCandidates.slice(0, 3)) {
    try {
      const probe = await probeResource(candidate, requestOptions);
      if (probe.ok) {
        discovered.llms = probe;
        evidence.push({ key: 'web.llms', status: 'detected', url: probe.url, source: metadata.llmsLinks.includes(candidate) ? 'html-link' : 'conventional-path' });
        break;
      }
    } catch (error) {
      warnings.push(`llms.txt candidate rejected or unreachable (${candidate}): ${error.message}`);
    }
  }

  for (const feed of uniqueBy(metadata.feeds, item => item.url).slice(0, 3)) {
    try {
      const probe = await probeResource(feed.url, requestOptions);
      if (!probe.ok) continue;
      const mediaType = mediaTypeOnly(probe.contentType) || feed.mediaType;
      discovered.feeds.push({ ...feed, url: probe.url, mediaType });
      evidence.push({ key: 'web.feed', status: 'detected', url: probe.url, source: 'html-link', mediaType });
    } catch (error) {
      warnings.push(`Feed candidate rejected or unreachable (${feed.url}): ${error.message}`);
    }
  }

  for (const candidate of uniqueBy(metadata.openapiLinks, item => item).slice(0, 2)) {
    try {
      const probe = await probeResource(candidate, requestOptions);
      if (probe.ok) {
        discovered.openapi = probe;
        evidence.push({ key: 'data.openapi', status: 'detected', url: probe.url, source: 'html-service-desc' });
        break;
      }
    } catch (error) {
      warnings.push(`OpenAPI candidate rejected or unreachable (${candidate}): ${error.message}`);
    }
  }

  const profileCandidates = uniqueBy([
    ...metadata.profileLinks,
    new URL('/ai/site-profile.json', origin).href
  ], item => item);
  let existingProfile = null;
  for (const candidate of profileCandidates.slice(0, 3)) {
    try {
      const existing = await fetchTextResource(candidate, {
        ...requestOptions,
        maxBytes: Math.min(maxBytes, 256 * 1024),
        accept: 'application/json, */*;q=0.1'
      });
      if (!existing.ok) continue;
      let parsed;
      try {
        parsed = JSON.parse(existing.text);
      } catch {
        warnings.push(`Existing ARWP candidate is not valid JSON: ${existing.url}`);
        continue;
      }
      const validation = validateProfile(parsed);
      existingProfile = {
        url: existing.url,
        valid: validation.valid,
        profileId: parsed?.id ?? null,
        warnings: validation.warnings,
        errors: validation.valid ? [] : validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`)
      };
      evidence.push({
        key: 'arwp.profile',
        status: validation.valid ? 'detected' : 'warning',
        url: existing.url,
        source: metadata.profileLinks.includes(candidate) ? 'html-link' : 'conventional-path'
      });
      break;
    } catch (error) {
      warnings.push(`ARWP profile candidate rejected or unreachable (${candidate}): ${error.message}`);
    }
  }

  const identity = {
    name: metadata.title || canonical.hostname,
    description: metadata.description || `Public website at ${canonical.hostname}.`,
    languages: metadata.languages
  };

  const scan = {
    source: input,
    finalUrl: homepage.url,
    canonicalUrl,
    identity,
    discovered,
    existingProfile,
    evidence,
    capabilities: {
      web: {
        status: 'assessed',
        detected: evidence.filter(item => item.key.startsWith('web.')).map(item => item.key)
      },
      data: {
        status: 'partially-assessed',
        detected: discovered.openapi ? ['data.openapi'] : [],
        note: 'Only explicit service-desc/OpenAPI evidence is detected in this bounded scan.'
      },
      agentSkills: { status: 'not-assessed', note: 'Portable SKILL.md discovery requires explicit protocol evidence; marketing text is never treated as proof.' },
      agentWeb: { status: 'not-assessed', note: 'WebMCP requires browser/runtime inspection and is not inferred from static HTML.' },
      mcp: { status: 'not-assessed', note: 'MCP requires an explicit server/runtime or Registry check and is not inferred from page text.' },
      a2a: { status: 'not-assessed', note: 'A2A requires Agent Card semantic validation and is not inferred from page text.' }
    },
    warnings
  };

  scan.draftProfile = draftProfileFromScan(scan);
  const validation = validateProfile(scan.draftProfile);
  if (!validation.valid) {
    const details = validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ');
    throw new Error(`Scanner generated an invalid ARWP profile: ${details}`);
  }
  scan.draftWarnings = validation.warnings;
  return scan;
}

export function formatScanSummary(scan) {
  const lines = [
    `Scanned: ${scan.finalUrl}`,
    `Canonical: ${scan.canonicalUrl}`,
    `Profile ID: ${scan.draftProfile.id}`,
    '',
    'Detected evidence:'
  ];

  for (const item of scan.evidence) {
    lines.push(`  ${item.status === 'warning' ? 'WARN' : 'PASS'} ${item.key} ${item.url}`);
  }
  if (scan.evidence.length === 1) lines.push('  No additional machine-readable surfaces detected.');

  lines.push('', 'Advanced agent capabilities:');
  for (const key of ['agentSkills', 'agentWeb', 'mcp', 'a2a']) {
    lines.push(`  ${key}: ${scan.capabilities[key].status} — ${scan.capabilities[key].note}`);
  }

  if (scan.existingProfile) {
    lines.push('', `Existing ARWP profile: ${scan.existingProfile.valid ? 'valid' : 'invalid'} ${scan.existingProfile.url}`);
  }
  if (scan.warnings.length) {
    lines.push('', 'Warnings:');
    for (const warning of scan.warnings) lines.push(`  WARN ${warning}`);
  }
  return lines.join('\n');
}
