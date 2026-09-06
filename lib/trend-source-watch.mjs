import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const defaultConfigPath = path.join(root, 'registry', 'trend-watch-sources.json');

export function loadTrendWatchConfig(file = defaultConfigPath) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function decodeXml(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
}

function stripTags(value = '') {
  return decodeXml(String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function firstTag(block, names) {
  for (const name of names) {
    const match = String(block).match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (match) return decodeXml(match[1].trim());
  }
  return null;
}

function extractLink(block) {
  const rss = firstTag(block, ['link']);
  if (rss && /^https?:\/\//i.test(stripTags(rss))) return stripTags(rss);
  const atom = String(block).match(/<link\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/i);
  return atom ? decodeXml(atom[1]) : null;
}

function parseDate(value) {
  const time = Date.parse(value || '');
  return Number.isNaN(time) ? null : new Date(time);
}

export function parseFeedEntries(xml) {
  const blocks = [
    ...String(xml || '').matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi),
    ...String(xml || '').matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)
  ].map(match => match[1]);
  return blocks.map(block => {
    const title = stripTags(firstTag(block, ['title']) || '');
    const summary = stripTags(firstTag(block, ['description', 'summary', 'content']) || '');
    const rawDate = stripTags(firstTag(block, ['pubDate', 'published', 'updated', 'dc:date']) || '');
    return {
      title,
      summary,
      url: extractLink(block),
      publishedAt: parseDate(rawDate)?.toISOString() || null,
      rawDate: rawDate || null
    };
  }).filter(item => item.title || item.url);
}

export function discoverFeedUrl(html, baseUrl) {
  const links = [...String(html || '').matchAll(/<link\b[^>]*>/gi)].map(match => match[0]);
  for (const tag of links) {
    const type = tag.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() || '';
    const rel = tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() || '';
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href || !rel.includes('alternate') || !/(rss|atom|xml)/.test(type)) continue;
    try { return new URL(href, baseUrl).href; } catch { /* ignore */ }
  }
  return null;
}

export function extractPageUpdatedAt(html) {
  const jsonLd = [...String(html || '').matchAll(/"dateModified"\s*:\s*"([^"]+)"/gi)]
    .map(match => parseDate(match[1])).filter(Boolean);
  const meta = [...String(html || '').matchAll(/<(?:meta|time)\b[^>]*(?:property|name|itemprop)\s*=\s*["'](?:article:modified_time|dateModified|last-modified)["'][^>]*(?:content|datetime)\s*=\s*["']([^"']+)["'][^>]*>/gi)]
    .map(match => parseDate(match[1])).filter(Boolean);
  const visible = [...String(html || '').matchAll(/(?:last updated|updated|modified)\s*(?::|—|-)?\s*(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|[A-Z][a-z]+\s+\d{1,2},\s+20\d{2})/gi)]
    .map(match => parseDate(match[1])).filter(Boolean);
  const dates = [...jsonLd, ...meta, ...visible];
  return dates.length ? new Date(Math.max(...dates.map(date => date.getTime()))).toISOString() : null;
}

export function matchesKeywords(item, keywords = []) {
  if (!keywords.length) return true;
  const haystack = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
  return keywords.some(keyword => haystack.includes(String(keyword).toLowerCase()));
}

async function fetchText(url, { fetchImpl = fetch, timeoutMs = 15000, maxBytes = 1024 * 1024 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'ARWP-Trend-Radar/0.1', accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.1' }
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url || url,
      text: text.length > maxBytes ? text.slice(0, maxBytes) : text,
      truncated: text.length > maxBytes,
      contentType: response.headers?.get?.('content-type') || null
    };
  } finally {
    clearTimeout(timer);
  }
}

function newerThan(iso, reviewedThrough) {
  const item = parseDate(iso);
  const reviewed = parseDate(`${reviewedThrough}T23:59:59Z`) || parseDate(reviewedThrough);
  return Boolean(item && reviewed && item.getTime() > reviewed.getTime());
}

async function checkSource(source, options) {
  const base = await fetchText(source.url, options);
  if (!base.ok) return { sourceId: source.id, provider: source.provider, kind: source.kind, url: source.url, ok: false, status: base.status, candidates: [], error: `HTTP ${base.status}` };

  let feedUrl = null;
  let entries = [];
  let pageUpdatedAt = null;

  if (source.kind === 'feed') {
    feedUrl = base.finalUrl;
    entries = parseFeedEntries(base.text);
  } else if (source.kind === 'discover-feed') {
    feedUrl = discoverFeedUrl(base.text, base.finalUrl);
    if (feedUrl) {
      const feed = await fetchText(feedUrl, options);
      if (feed.ok) entries = parseFeedEntries(feed.text);
    }
    pageUpdatedAt = extractPageUpdatedAt(base.text);
  } else if (source.kind === 'page-update') {
    pageUpdatedAt = extractPageUpdatedAt(base.text);
  }

  const feedCandidates = entries
    .filter(item => item.publishedAt && newerThan(item.publishedAt, source.reviewedThrough))
    .filter(item => matchesKeywords(item, source.keywords))
    .map(item => ({ type: 'feed-item', ...item }));

  const pageCandidate = pageUpdatedAt && newerThan(pageUpdatedAt, source.reviewedThrough)
    ? [{ type: 'page-updated', title: `${source.id} page metadata changed after review cutoff`, summary: null, url: base.finalUrl, publishedAt: pageUpdatedAt }]
    : [];

  return {
    sourceId: source.id,
    provider: source.provider,
    kind: source.kind,
    url: source.url,
    finalUrl: base.finalUrl,
    ok: true,
    status: base.status,
    feedUrl,
    pageUpdatedAt,
    reviewedThrough: source.reviewedThrough,
    candidates: [...feedCandidates, ...pageCandidate]
  };
}

export async function runTrendSourceWatch(config = loadTrendWatchConfig(), options = {}) {
  const results = [];
  for (const source of config.sources || []) {
    try {
      results.push(await checkSource(source, options));
    } catch (error) {
      results.push({ sourceId: source.id, provider: source.provider, kind: source.kind, url: source.url, ok: false, status: null, candidates: [], error: String(error?.message || error) });
    }
  }
  const candidates = results.flatMap(result => result.candidates.map(candidate => ({ sourceId: result.sourceId, provider: result.provider, ...candidate })));
  return {
    version: config.version,
    generatedAt: new Date().toISOString(),
    reviewedThrough: config.reviewedThrough,
    summary: {
      sources: results.length,
      reachable: results.filter(item => item.ok).length,
      failed: results.filter(item => !item.ok).length,
      candidates: candidates.length
    },
    candidates,
    results,
    guardrails: config.guardrails,
    note: 'A candidate is only a prompt for source review. It must not automatically create or promote an ARWP recommendation.'
  };
}
