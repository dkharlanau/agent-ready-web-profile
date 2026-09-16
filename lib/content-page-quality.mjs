import fs from 'node:fs';
import path from 'node:path';

export const CONTENT_PAGE_QUALITY_VERSION = '0.1';
export const CONTENT_PAGE_QUALITY_REVIEWED_AT = '2026-09-16';
export const MAX_CONTENT_HTML_BYTES = 2 * 1024 * 1024;

const REQUIRED_OG = ['og:title', 'og:description', 'og:url', 'og:type', 'og:image', 'og:image:alt'];

function decodeEntities(value) {
  return String(value || '').replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, token => {
    const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    const lower = token.toLowerCase();
    if (named[lower]) return named[lower];
    const code = lower.startsWith('&#x')
      ? Number.parseInt(lower.slice(3, -1), 16)
      : Number.parseInt(lower.slice(2, -1), 10);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd';
  });
}

function parseAttrs(raw) {
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

function normalizeUrl(value, base) {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function isHttpsUrl(value, base) {
  const normalized = normalizeUrl(value, base);
  return normalized && new URL(normalized).protocol === 'https:' ? normalized : null;
}

function comparableUrl(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  const pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '');
  return `${url.origin}${pathname}${url.search}`;
}

function sameUrl(a, b) {
  const left = comparableUrl(a);
  const right = comparableUrl(b);
  return Boolean(left && right && left === right);
}

function titleValues(html) {
  return [...String(html).matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)]
    .map(match => textContent(match[1]))
    .filter(Boolean);
}

function metaMap(html) {
  const map = new Map();
  for (const tag of String(html).match(/<meta\b[^>]*>/gi) || []) {
    const a = parseAttrs(tag);
    const key = String(a.property || a.name || '').trim().toLowerCase();
    const content = String(a.content || '').trim();
    if (!key || !content) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(content);
  }
  return map;
}

function canonicalLinks(html, base) {
  const out = [];
  for (const tag of String(html).match(/<link\b[^>]*>/gi) || []) {
    const a = parseAttrs(tag);
    const rel = String(a.rel || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (rel.includes('canonical') && a.href) out.push(normalizeUrl(a.href, base) || String(a.href));
  }
  return out;
}

function htmlLang(html) {
  const tag = String(html).match(/<html\b[^>]*>/i)?.[0];
  return tag ? String(parseAttrs(tag).lang || '').trim() : '';
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
    for (const child of Object.values(value)) {
      if (child && typeof child === 'object') queue.push(child);
    }
  }
  return [...out].sort();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function elementsWithAttribute(html, attribute) {
  const attr = escapeRegex(attribute);
  const paired = new RegExp(`<([a-z][a-z0-9:-]*)\\b([^>]*\\b${attr}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?[^>]*)>([\\s\\S]*?)<\\/\\1>`, 'gi');
  const singles = new RegExp(`<([a-z][a-z0-9:-]*)\\b([^>]*\\b${attr}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?[^>]*)\\/?\\s*>`, 'gi');
  const out = [];
  const pairedStarts = new Set();
  let match;
  while ((match = paired.exec(String(html)))) {
    pairedStarts.add(match.index);
    out.push({ tagName: match[1].toLowerCase(), attrs: parseAttrs(`<${match[1]} ${match[2]}>`), inner: match[3], index: match.index });
  }
  while ((match = singles.exec(String(html)))) {
    if (pairedStarts.has(match.index)) continue;
    out.push({ tagName: match[1].toLowerCase(), attrs: parseAttrs(`<${match[1]} ${match[2]}>`), inner: '', index: match.index });
  }
  return out.sort((a, b) => a.index - b.index)
    .filter(item => Object.prototype.hasOwnProperty.call(item.attrs, attribute));
}

function accessibleName(element) {
  return String(
    element?.attrs?.['aria-label'] ||
    element?.attrs?.title ||
    textContent(element?.inner || '')
  ).trim();
}

function distributionSignals(html) {
  const footers = elementsWithAttribute(html, 'data-arwp-distribution-footer');
  const share = elementsWithAttribute(html, 'data-arwp-share');
  const copy = elementsWithAttribute(html, 'data-arwp-copy-link');
  const providers = elementsWithAttribute(html, 'data-arwp-share-provider')
    .map(item => ({ ...item, provider: String(item.attrs['data-arwp-share-provider'] || '').trim().toLowerCase() }))
    .filter(item => item.provider);
  const uniqueProviders = [...new Set(providers.map(item => item.provider))];
  return { footers, share, copy, providers, uniqueProviders };
}

function feedbackSignals(html) {
  const feedback = elementsWithAttribute(html, 'data-arwp-feedback');
  const counts = elementsWithAttribute(html, 'data-arwp-feedback-count');
  const backed = feedback.filter(item =>
    String(item.attrs['data-arwp-feedback-sink'] || '').trim() ||
    String(item.attrs['data-arwp-feedback-local-only'] || '').toLowerCase() === 'true'
  );
  const sourcedCounts = counts.filter(item => String(item.attrs['data-arwp-feedback-aggregate-source'] || '').trim());
  return { feedback, counts, backed, sourcedCounts };
}

function check(id, priority, status, message, evidence = []) {
  return { id, priority, status, message, evidence: evidence.filter(Boolean) };
}

function summarize(checks) {
  const counts = { pass: 0, fail: 0, watch: 0, 'not-applicable': 0, unknown: 0 };
  for (const item of checks) counts[item.status] = (counts[item.status] || 0) + 1;
  const p0Failures = checks.filter(item => item.priority === 'P0' && item.status === 'fail').length;
  const p1Failures = checks.filter(item => item.priority === 'P1' && item.status === 'fail').length;
  return { ...counts, p0Failures, p1Failures, strictPass: p0Failures === 0 && p1Failures === 0 };
}

/**
 * Deterministic final-HTML inspection for a route already classified as a
 * content/detail page. This cannot prove rendered runtime behavior, external
 * social preview selection, Search selection or completed social sharing.
 */
export function inspectContentPageQuality({ html, url }) {
  if (typeof html !== 'string') throw new TypeError('html must be a string.');
  if (Buffer.byteLength(html, 'utf8') > MAX_CONTENT_HTML_BYTES) {
    throw new RangeError('HTML exceeds the 2 MiB content-page inspection limit.');
  }
  const pageUrl = normalizeUrl(url);
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

  const titleOk = titles.length === 1 && titles[0].length >= 3;
  const descriptionOk = descriptions.length === 1 && descriptions[0].length >= 20;
  const canonicalOk = canonicals.length === 1 && sameUrl(canonicals[0], pageUrl);
  const noindex = /(^|[,\s])noindex([,\s]|$)/.test(robots);
  const identityOk = titleOk && descriptionOk && Boolean(language) && viewport.length === 1 && canonicalOk && !noindex;
  checks.push(check(
    'CPQ-01-page-identity-and-indexability',
    'P0',
    identityOk ? 'pass' : 'fail',
    identityOk
      ? 'Title, description, language, viewport and self-canonical indexability signals are present.'
      : `Identity contract incomplete: title=${titles.length}, description=${descriptions.length}, lang=${Boolean(language)}, viewport=${viewport.length}, canonical=${canonicals.length}, selfCanonical=${canonicalOk}, noindex=${noindex}.`,
    [pageUrl, ...canonicals]
  ));

  const h1 = textContent(String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
  const mainBody = String(html).match(/<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/i)?.[1] || '';
  const opening = textContent(mainBody).slice(0, 500);
  const snippetSignal = titleOk && descriptionOk && h1.length >= 3 && opening.length >= 40;
  checks.push(check(
    'CPQ-02-search-snippet-surface',
    'P0',
    snippetSignal ? 'pass' : 'watch',
    snippetSignal
      ? 'Title, H1, description and useful opening-copy signals are present; editorial coherence still requires review.'
      : 'Static evidence cannot fully establish a useful snippet surface. Review title/H1/opening-copy coherence and snippet pollution.',
    [titles[0], h1, descriptions[0]]
  ));

  const og = Object.fromEntries(REQUIRED_OG.map(key => [key, metas.get(key) || []]));
  const ogComplete = REQUIRED_OG.every(key => og[key].length === 1 && String(og[key][0]).trim());
  const ogUrlMatches = og['og:url'].length === 1 && canonicalOk && sameUrl(og['og:url'][0], canonicals[0]);
  const ogImage = og['og:image'][0] ? isHttpsUrl(og['og:image'][0], pageUrl) : null;
  const card = (metas.get('twitter:card') || [])[0] || null;
  const previewOk = ogComplete && ogUrlMatches && Boolean(ogImage) && Boolean(card);
  checks.push(check(
    'CPQ-03-social-preview-metadata',
    'P0',
    previewOk ? 'pass' : 'fail',
    previewOk
      ? 'Open Graph identity, HTTPS image and explicit card compatibility metadata are present.'
      : `Social preview contract incomplete: requiredOg=${REQUIRED_OG.filter(key => og[key].length === 1).length}/${REQUIRED_OG.length}, ogUrlMatchesCanonical=${ogUrlMatches}, httpsImage=${Boolean(ogImage)}, card=${Boolean(card)}.`,
    [og['og:url'][0], og['og:image'][0], card]
  ));

  const width = Number((metas.get('og:image:width') || [])[0]);
  const height = Number((metas.get('og:image:height') || [])[0]);
  const ratio = width > 0 && height > 0 ? width / height : null;
  const usableWideCard = Boolean(ogImage && ratio && width >= 600 && height >= 300 && ratio >= 1.5 && ratio <= 2.1);
  checks.push(check(
    'CPQ-04-representative-share-image',
    'P1',
    usableWideCard ? 'pass' : 'watch',
    usableWideCard
      ? `Share image declares ${width}x${height}; visual relevance and crop still require review.`
      : 'An HTTPS share image may exist, but dimensions/relevance/crop are not fully proven by final HTML.',
    [ogImage, width && height ? `${width}x${height}` : null]
  ));

  const shareNamesOk = distribution.share.length > 0 && distribution.share.every(item => accessibleName(item));
  const copyNamesOk = distribution.copy.length > 0 && distribution.copy.every(item => accessibleName(item));
  const providerNamesOk = distribution.providers.length > 0 && distribution.providers.every(item => accessibleName(item));
  const footerOk = distribution.footers.length === 1;
  const providerCountOk = distribution.uniqueProviders.length >= 2;
  const distributionOk = footerOk && shareNamesOk && copyNamesOk && providerCountOk;
  checks.push(check(
    'CPQ-05-end-of-content-sharing',
    'P0',
    distributionOk ? 'pass' : 'fail',
    distributionOk
      ? `Distribution footer exposes Share, Copy link and ${distribution.uniqueProviders.length} direct provider targets: ${distribution.uniqueProviders.join(', ')}.`
      : `Distribution footer incomplete: footers=${distribution.footers.length}, share=${distribution.share.length}, copy=${distribution.copy.length}, directProviders=${distribution.uniqueProviders.length}.`,
    distribution.uniqueProviders
  ));

  const accessibilitySignal = distributionOk && providerNamesOk;
  checks.push(check(
    'CPQ-06-sharing-accessibility-and-resilience',
    'P0',
    accessibilitySignal ? 'pass' : 'fail',
    accessibilitySignal
      ? 'Static controls expose accessible-name signals. Keyboard/focus/Web Share failure behavior still needs rendered runtime evidence.'
      : 'One or more required share/copy/provider controls are absent or lack an accessible-name signal.',
    distribution.share.concat(distribution.copy, distribution.providers).map(accessibleName)
  ));

  checks.push(check(
    'CPQ-07-structured-content-semantics',
    'P1',
    json.invalid > 0 ? 'fail' : json.parsed.length > 0 ? 'pass' : 'watch',
    json.invalid > 0
      ? `${json.invalid} JSON-LD block(s) failed to parse.`
      : json.parsed.length > 0
        ? `JSON-LD parses; observed types: ${types.join(', ') || 'none'}. Visible-fact parity still requires semantic review.`
        : 'No JSON-LD was observed. Structured data is not mandatory for every page, but applicability should be reviewed.',
    types
  ));

  checks.push(check(
    'CPQ-08-favicon-and-page-image-separation',
    'P1',
    ogImage ? 'watch' : 'fail',
    ogImage
      ? 'A page share image is declared. Separately verify stable hostname favicon identity and that the share image is page-relevant rather than an accidental logo/favicon fallback.'
      : 'No usable HTTPS page share image was observed.',
    [ogImage]
  ));

  if (!feedback.feedback.length && !feedback.counts.length) {
    checks.push(check('CPQ-09-feedback-integrity', 'P1', 'not-applicable', 'No ARWP-instrumented feedback/reaction control was observed; feedback is optional.'));
  } else {
    const feedbackBacked = feedback.feedback.length > 0 && feedback.backed.length === feedback.feedback.length;
    const countsBacked = feedback.counts.length === 0 || feedback.sourcedCounts.length === feedback.counts.length;
    checks.push(check(
      'CPQ-09-feedback-integrity',
      'P1',
      feedbackBacked && countsBacked ? 'pass' : 'fail',
      feedbackBacked && countsBacked
        ? 'Feedback controls declare a real sink or explicit local-only behavior; displayed aggregate counts declare a source.'
        : 'Feedback/reaction UI is missing a sink/local-only declaration or exposes an aggregate count without a declared aggregate source.',
      [String(feedback.feedback.length), String(feedback.counts.length)]
    ));
  }

  const continuation = elementsWithAttribute(html, 'data-arwp-continuation');
  checks.push(check(
    'CPQ-10-continuation-and-citation',
    'P1',
    continuation.length ? 'pass' : 'watch',
    continuation.length
      ? 'A continuation surface is present; verify that its relations are useful and canonical.'
      : 'No explicit continuation marker was observed; this can be valid for an intentionally terminal page.',
    continuation.map(accessibleName)
  ));

  checks.push(check(
    'CPQ-11-share-and-feedback-measurement',
    'P2',
    'watch',
    'Static HTML cannot prove analytics semantics. If measurement exists, distinguish share intent/menu opening/provider click from confirmed external publication and preserve missing data as unknown.'
  ));

  checks.push(check(
    'CPQ-12-final-artifact-family-gate',
    'P0',
    'watch',
    'This final HTML artifact was inspected. A family-wide claim still requires enumerating every applicable content/detail artifact and runtime-testing each distinct interactive implementation.',
    [pageUrl]
  ));

  return {
    version: CONTENT_PAGE_QUALITY_VERSION,
    reviewedAt: CONTENT_PAGE_QUALITY_REVIEWED_AT,
    url: pageUrl,
    staticEvidenceOnly: true,
    hooks: {
      contentDetail: 'data-arwp-content-detail',
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
    summary: summarize(checks)
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
  let route;
  if (/^index\.html?$/i.test(relative)) route = '';
  else if (/\/index\.html?$/i.test(relative)) route = relative.replace(/index\.html?$/i, '');
  else route = relative.replace(/\.html?$/i, '');
  const base = new URL(baseUrl);
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  return new URL(route, base).href;
}

/**
 * Inspect a deterministic build directory. The caller supplies `include` so
 * ARWP does not guess that every HTML route is a content/detail page.
 */
export function inspectContentPageDirectory({ root, baseUrl, include }) {
  if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new TypeError('root must be a readable build directory.');
  }
  if (typeof include !== 'function') {
    throw new TypeError('include(file, url, html) must explicitly classify content/detail pages.');
  }
  const normalizedBase = normalizeUrl(baseUrl);
  if (!normalizedBase) throw new TypeError('baseUrl must be an absolute HTTP(S) URL without credentials.');

  const files = listHtmlFiles(root);
  const pages = [];
  const excluded = [];
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const url = urlForBuiltHtml(file, root, normalizedBase);
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
    baseUrl: normalizedBase,
    discoveredHtmlFiles: files.length,
    auditedContentPages: pages.length,
    excludedHtmlFiles: excluded.length,
    pages,
    excluded,
    familyGate: {
      deterministicCoverageDeclaredByCaller: true,
      runtimeEvidenceRequiredSeparately: true,
      p0Failures,
      p1Failures,
      strictPass: pages.length > 0 && p0Failures === 0 && p1Failures === 0
    }
  };
}
