import fs from 'node:fs';
import path from 'node:path';

export const CONTENT_PAGE_QUALITY_VERSION = '0.1';
export const CONTENT_PAGE_QUALITY_REVIEWED_AT = '2026-09-16';
export const MAX_CONTENT_HTML_BYTES = 2 * 1024 * 1024;

const REQUIRED_OG = ['og:title', 'og:description', 'og:url', 'og:type', 'og:image', 'og:image:alt'];
const KNOWN_CONTENT_TYPES = new Set(['Article', 'BlogPosting', 'TechArticle', 'NewsArticle', 'ScholarlyArticle']);

function decodeEntities(value) {
  return String(value || '').replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, token => {
    const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    const lower = token.toLowerCase();
    if (named[lower]) return named[lower];
    const code = lower.startsWith('&#x') ? Number.parseInt(lower.slice(3, -1), 16) : Number.parseInt(lower.slice(2, -1), 10);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd';
  });
}

function attrs(raw) {
  const out = Object.create(null);
  const body = String(raw || '').replace(/^<\/?[\w:-]+\s*/i, '').replace(/\/?\s*>$/, '');
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = re.exec(body))) {
    const key = String(match[1]).toLowerCase();
    if (!(key in out)) out[key] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return out;
}

function textContent(value) {
  return decodeEntities(String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteHttps(value, base) {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function normalizedUrl(value, base) {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function equalUrl(a, b) {
  const left = normalizedUrl(a);
  const right = normalizedUrl(b);
  if (!left || !right) return false;
  const x = new URL(left);
  const y = new URL(right);
  const cleanPath = value => value.pathname === '/' ? '/' : value.pathname.replace(/\/+$/, '');
  return x.origin === y.origin && cleanPath(x) === cleanPath(y) && x.search === y.search;
}

function metaMap(html) {
  const map = new Map();
  for (const tag of String(html).match(/<meta\b[^>]*>/gi) || []) {
    const a = attrs(tag);
    const key = String(a.property || a.name || '').trim().toLowerCase();
    if (!key || !String(a.content || '').trim()) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(String(a.content).trim());
  }
  return map;
}

function canonicalLinks(html, base) {
  const out = [];
  for (const tag of String(html).match(/<link\b[^>]*>/gi) || []) {
    const a = attrs(tag);
    const rel = String(a.rel || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (rel.includes('canonical') && a.href) out.push(normalizedUrl(a.href, base) || String(a.href));
  }
  return out;
}

function titleValues(html) {
  return [...String(html).matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)]
    .map(match => textContent(match[1]))
    .filter(Boolean);
}

function htmlLang(html) {
  const tag = String(html).match(/<html\b[^>]*>/i)?.[0];
  return tag ? String(attrs(tag).lang || '').trim() : '';
}

function jsonLd(html) {
  const parsed = [];
  let invalid = 0;
  for (const match of String(html).matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      parsed.push(JSON.parse(match[1]));
    } catch {
      invalid += 1;
    }
  }
  return { parsed, invalid };
}

function structuredTypes(payloads) {
  const out = new Set();
  const queue = [...payloads];
  let visited = 0;
  while (queue.length && visited < 4096) {
    const value = queue.shift();
    visited += 1;
    if (Array.isArray(value)) {
      queue.push(...value);
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    const type = value['@type'];
    if (Array.isArray(type)) type.forEach(item => out.add(String(item)));
    else if (type) out.add(String(type));
    for (const child of Object.values(value)) if (child && typeof child === 'object') queue.push(child);
  }
  return [...out].sort();
}

function markerElements(html, marker) {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<([a-z][a-z0-9:-]*)\\b([^>]*\\b${escaped}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?[^>]*)>([\\s\\S]*?)<\\/\\1>|<([a-z][a-z0-9:-]*)\\b([^>]*\\b${escaped}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?[^>]*)\\/?\\s*>`, 'gi');
  const out = [];
  let match;
  while ((match = re.exec(String(html)))) {
    const tagName = (match[1] || match[4] || '').toLowerCase();
    const rawAttrs = match[2] || match[5] || '';
    const inner = match[3] || '';
    out.push({ tagName, attrs: attrs(`<${tagName} ${rawAttrs}>`), inner, raw: match[0], index: match.index });
  }
  return out;
}

function accessibleName(element) {
  return String(element?.attrs?.['aria-label'] || element?.attrs?.title || textContent(element?.inner || '')).trim();
}

function distributionSignals(html) {
  const footers = markerElements(html, 'data-arwp-distribution-footer');
  const share = markerElements(html, 'data-arwp-share');
  const copy = markerElements(html, 'data-arwp-copy-link');
  const providers = markerElements(html, 'data-arwp-share-provider');
    .map(item => ({ ...item, provider: String(item.attrs['data-arwp-share-provider'] || '').trim().toLowerCase() }))
    .filter(item => item.provider);
  const uniqueProviders = [...new Set(providers.map(item => item.provider))];
  return { footers, share, copy, providers, uniqueProviders };
}

function feedbackSignals(html) {
  const feedback = markerElements(html, 'data-arwp-feedback');
  const counts = markerElements(html, 'data-arwp-feedback-count');
  const sinked = feedback.filter(item => String(item.attrs['data-arwp-feedback-sink'] || '').trim());
  const localOnly = feedback.filter(item => String(item.attrs['data-arwp-feedback-local-only'] || '').toLowerCase() === 'true');
  const sourcedCounts = counts.filter(item => String(item.attrs['data-arwp-feedback-aggregate-source'] || '').trim());
  return { feedback, counts, sinked, localOnly, sourcedCounts };
}

function result(id, priority, status, message, evidence = []) {
  return { id, priority, status, message, evidence: evidence.filter(Boolean) };
}

function statusSummary(checks) {
  const counts = { pass: 0, fail: 0, watch: 0, 'not-applicable': 0, unknown: 0 };
  for (const check of checks) counts[check.status] = (counts[check.status] || 0) + 1;
  return {
    ...counts,
    p0Failures: checks.filter(check => check.priority === 'P0' && check.status === 'fail').length,
    p1Failures: checks.filter(check => check.priority === 'P1' && check.status === 'fail').length,
    strictPass: !checks.some(check => ['P0', 'P1'].includes(check.priority) && check.status === 'fail')
  };
}

/**
 * Inspect final HTML for a page already classified as a content/detail page.
 * This is deterministic static evidence only. It does not prove browser runtime,
 * external provider previews, Search selection or completed social sharing.
 */
export function inspectContentPageQuality({ html, url }) {
  if (typeof html !== 'string') throw new TypeError('html must be a string.');
  if (Buffer.byteLength(html, 'utf8') > MAX_CONTENT_HTML_BYTES) throw new RangeError('HTML exceeds the 2 MiB content-page inspection limit.');
  const pageUrl = normalizedUrl(url);
  if (!pageUrl) throw new TypeError('url must be an absolute HTTP(S) URL without credentials.');

  const metas = metaMap(html);
  const titles = titleValues(html);
  const descriptions = metas.get('description') || [];
  const canonicals = canonicalLinks(html, pageUrl);
  const language = htmlLang(html);
  const viewport = metas.get('viewport') || [];
  const robots = (metas.get('robots') || []).join(',').toLowerCase();
  const json = jsonLd(html);
  const types = structuredTypes(json.parsed);
  const distribution = distributionSignals(html);
  const feedback = feedbackSignals(html);
  const checks = [];
  const add = (...args) => checks.push(result(...args));

  const oneTitle = titles.length === 1 && titles[0].length >= 3;
  const oneDescription = descriptions.length === 1 && descriptions[0].length >= 20;
  const oneCanonical = canonicals.length === 1 && normalizedUrl(canonicals[0]);
  const canonicalMatches = oneCanonical && equalUrl(canonicals[0], pageUrl);
  add('CPQ-01-page-identity-and-indexability', 'P0',
    oneTitle && oneDescription && language && viewport.length === 1 && canonicalMatches && !/(^|[,\s])noindex([,\s]|$)/.test(robots) ? 'pass' : 'fail',
    oneTitle && oneDescription && language && viewport.length === 1 && canonicalMatches && !/(^|[,\s])noindex([,\s]|$)/.test(robots)
      ? 'Page-specific identity, language, viewport and self-canonical indexability signals are present.'
      : `Identity contract incomplete: title=${titles.length}, description=${descriptions.length}, lang=${Boolean(language)}, viewport=${viewport.length}, canonical=${canonicals.length}, selfCanonical=${Boolean(canonicalMatches)}, noindex=${/(^|[,\s])noindex([,\s]|$)/.test(robots)}.`,
    [pageUrl, ...canonicals]);

  const h1 = textContent(String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
  const opening = textContent(String(html).match(/<(?:main|article)\b[^>]*>([\s\S]{0,4000}?)(?:<h2\b|<\/main>|<\/article>)/i)?.[1] || '').slice(0, 500);
  add('CPQ-02-search-snippet-surface', 'P0',
    oneTitle && oneDescription && h1 && opening.length >= 40 ? 'pass' : 'watch',
    oneTitle && oneDescription && h1 && opening.length >= 40
      ? 'Title, H1, description and useful opening-copy signals are present; editorial coherence still requires content review.'
      : 'Static evidence cannot fully establish a useful title/snippet surface. Review title/H1/opening-copy coherence and snippet pollution.',
    [titles[0], h1, descriptions[0]]);

  const og = Object.fromEntries(REQUIRED_OG.map(key => [key, metas.get(key) || []]));
  const ogComplete = REQUIRED_OG.every(key => og[key].length === 1 && String(og[key][0]).trim());
  const ogUrlMatches = og['og:url'].length === 1 && canonicalMatches && equalUrl(og['og:url'][0], canonicals[0]);
  const ogImage = og['og:image'][0] ? absoluteHttps(og['og:image'][0], pageUrl) : null;
  const twitterCard = (metas.get('twitter:card') || [])[0] || null;
  add('CPQ-03-social-preview-metadata', 'P0',
    ogComplete && ogUrlMatches && ogImage && twitterCard ? 'pass' : 'fail',
    ogComplete && ogUrlMatches && ogImage && twitterCard
      ? 'Open Graph identity, HTTPS representative image and explicit card compatibility metadata are present.'
      : `Social preview contract incomplete: requiredOg=${REQUIRED_OG.filter(key => og[key].length === 1).length}/${REQUIRED_OG.length}, ogUrlMatchesCanonical=${Boolean(ogUrlMatches)}, httpsImage=${Boolean(ogImage)}, twitterCard=${Boolean(twitterCard)}.`,
    [og['og:url'][0], og['og:image'][0], twitterCard]);

  const width = Number((metas.get('og:image:width') || [])[0]);
  const height = Number((metas.get('og:image:height') || [])[0]);
  const ratio = width > 0 && height > 0 ? width / height : null;
  const dimensionSignal = ratio ? width >= 600 && height >= 300 && ratio >= 1.5 && ratio <= 2.1 : false;
  add('CPQ-04-representative-share-image', 'P1',
    ogImage && dimensionSignal ? 'pass' : 'watch',
    ogImage && dimensionSignal
      ? `Share image declares ${width}x${height}, a usable wide-card signal; visual relevance/crop still requires review.`
      : 'An HTTPS share image may exist, but usable card dimensions/relevance/crop are not fully proven by final HTML.',
    [ogImage, width && height ? `${width}x${height}` : null]);

  const shareNamesOk = distribution.share.every(item => accessibleName(item));
  const copyNamesOk = distribution.copy.every(item => accessibleName(item));
  const providerNamesOk = distribution.providers.every(item => accessibleName(item));
  const footerPresent = distribution.footers.length === 1;
  const sharePresent = distribution.share.length >= 1;
  const copyPresent = distribution.copy.length >= 1;
  const providerCountOk = distribution.uniqueProviders.length >= 2;
  add('CPQ-05-end-of-content-sharing', 'P0',
    footerPresent && sharePresent && copyPresent && providerCountOk ? 'pass' : 'fail',
    footerPresent && sharePresent && copyPresent && providerCountOk
      ? `One distribution footer exposes Share, Copy link and ${distribution.uniqueProviders.length} direct provider target(s): ${distribution.uniqueProviders.join(', ')}.`
      : `Distribution footer incomplete: footers=${distribution.footers.length}, share=${distribution.share.length}, copy=${distribution.copy.length}, directProviders=${distribution.uniqueProviders.length}. Use data-arwp-distribution-footer/data-arwp-share/data-arwp-copy-link/data-arwp-share-provider test hooks or an equivalent site-specific verifier.`,
    distribution.uniqueProviders);

  add('CPQ-06-sharing-accessibility-and-resilience', 'P0',
    sharePresent && copyPresent && shareNamesOk && copyNamesOk && providerNamesOk ? 'pass' : 'fail',
    sharePresent && copyPresent && shareNamesOk && copyNamesOk && providerNamesOk
      ? 'Static share/copy/provider controls expose accessible-name signals. Keyboard/focus/API failure behavior still needs rendered runtime evidence.'
      : 'At least one required share/copy/provider control is missing an accessible-name signal or is absent.',
    distribution.share.concat(distribution.copy, distribution.providers).map(accessibleName));

  add('CPQ-07-structured-content-semantics', 'P1',
    json.invalid === 0 && json.parsed.length > 0 ? 'pass' : json.invalid > 0 ? 'fail' : 'watch',
    json.invalid > 0
      ? `${json.invalid} JSON-LD block(s) failed to parse.`
      : json.parsed.length
        ? `JSON-LD parses; observed types: ${types.join(', ') || 'none'}. Visible-fact parity and truthful authors/dates still require semantic review.`
        : 'No JSON-LD was observed. Structured data is not mandatory for every page, but page-type applicability should be reviewed.',
    types);

  const hasContentType = types.some(type => KNOWN_CONTENT_TYPES.has(type));
  add('CPQ-08-favicon-and-page-image-separation', 'P1',
    ogImage ? 'watch' : 'fail',
    ogImage
      ? 'A page share image is declared. Verify separately that the hostname favicon remains a stable site-identity asset and that this image is page-relevant rather than an accidental favicon/logo fallback.'
      : 'No usable HTTPS page share image was observed.',
    [ogImage, hasContentType ? 'article-like structured type observed' : null]);

  if (!feedback.feedback.length && !feedback.counts.length) {
    add('CPQ-09-feedback-integrity', 'P1', 'not-applicable', 'No ARWP-instrumented feedback/reaction control was observed; feedback is optional.');
  } else {
    const feedbackBacked = feedback.feedback.length > 0 && feedback.feedback.every(item => String(item.attrs['data-arwp-feedback-sink'] || '').trim() || String(item.attrs['data-arwp-feedback-local-only'] || '').toLowerCase() === 'true');
    const countsBacked = feedback.counts.length === 0 || feedback.sourcedCounts.length === feedback.counts.length;
    add('CPQ-09-feedback-integrity', 'P1', feedbackBacked && countsBacked ? 'pass' : 'fail',
      feedbackBacked && countsBacked
        ? 'Feedback controls declare a real sink or explicit local-only behavior; any displayed aggregate count declares a source.'
        : 'Feedback/reaction UI is missing a sink/local-only declaration or exposes an aggregate count without a declared aggregate source. Do not imply recorded engagement without real persistence/measurement.',
      [String(feedback.feedback.length), String(feedback.counts.length)]);
  }

  const continuation = markerElements(html, 'data-arwp-continuation');
  add('CPQ-10-continuation-and-citation', 'P1', continuation.length ? 'pass' : 'watch',
    continuation.length ? 'A continuation surface is present. Verify that its relations are semantically useful and canonical.' : 'No explicit continuation marker was observed; this may be valid for an intentionally terminal page.',
    continuation.map(accessibleName));

  add('CPQ-11-share-and-feedback-measurement', 'P2', 'watch',
    'Static HTML cannot prove analytics semantics. If share/feedback measurement exists, distinguish intent/menu opening/provider click from confirmed external publication and preserve missing data as unknown.');

  add('CPQ-12-final-artifact-family-gate', 'P0', 'pass',
    'This page was inspected as a final HTML artifact. A strict site-family claim still requires running the same deterministic checks over every applicable canonical content/detail artifact and runtime-testing each distinct implementation.', [pageUrl]);

  return {
    version: CONTENT_PAGE_QUALITY_VERSION,
    reviewedAt: CONTENT_PAGE_QUALITY_REVIEWED_AT,
    url: pageUrl,
    staticEvidenceOnly: true,
    hooks: {
      distributionFooter: 'data-arwp-distribution-footer',
      share: 'data-arwp-share',
      copyLink: 'data-arwp-copy-link',
      shareProvider: 'data-arwp-share-provider',
      feedback: 'data-arwp-feedback',
      continuation: 'data-arwp-continuation'
    },
    observations: {
      titles,
      descriptions,
      language,
      canonicals,
      structuredTypes: types,
      providers: distribution.uniqueProviders,
      feedbackControls: feedback.feedback.length,
      feedbackCounts: feedback.counts.length
    },
    checks,
    summary: statusSummary(checks)
  };
}

function listHtmlFiles(root) {
  const out = [];
  const stack = [path.resolve(root)];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile() && /\.html?$/i.test(entry.name)) out.push(absolute);
    }
  }
  return out.sort();
}

export function urlForBuiltHtml(file, root, baseUrl) {
  const relative = path.relative(path.resolve(root), path.resolve(file)).split(path.sep).join('/');
  let route = relative;
  if (/^index\.html?$/i.test(relative)) route = '';
  else if (/\/index\.html?$/i.test(relative)) route = relative.replace(/index\.html?$/i, '');
  else route = relative.replace(/\.html?$/i, '');
  const base = new URL(baseUrl);
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  return new URL(route, base).href;
}

/** Audit a deterministic build directory. The caller supplies inclusion logic so
 * ARWP never guesses that every HTML route is a content/detail page. */
export function inspectContentPageDirectory({ root, baseUrl, include }) {
  if (!root || !fs.statSync(root).isDirectory()) throw new TypeError('root must be a readable build directory.');
  if (typeof include !== 'function') throw new TypeError('include(file, url, html) must explicitly classify content/detail pages.');
  const files = listHtmlFiles(root);
  const pages = [];
  const excluded = [];
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const url = urlForBuiltHtml(file, root, baseUrl);
    if (!include(file, url, html)) {
      excluded.push({ file, url, reason: 'not classified as content/detail by caller' });
      continue;
    }
    pages.push({ file, report: inspectContentPageQuality({ html, url }) });
  }
  const p0Failures = pages.reduce((sum, page) => sum + page.report.summary.p0Failures, 0);
  const p1Failures = pages.reduce((sum, page) => sum + page.report.summary.p1Failures, 0);
  return {
    version: CONTENT_PAGE_QUALITY_VERSION,
    root: path.resolve(root),
    baseUrl: new URL(baseUrl).href,
    discoveredHtmlFiles: files.length,
    auditedContentPages: pages.length,
    excludedHtmlFiles: excluded.length,
    pages,
    excluded,
    summary: {
      p0Failures,
      p1Failures,
      strictPass: pages.length > 0 && p0Failures === 0 && p1Failures === 0
    }
  };
}
