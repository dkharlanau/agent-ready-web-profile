/** Bounded, offline observations; not a browser, JSON-LD processor or Google validator. */
export const SEARCH_APPEARANCE_VERSION = '0.1';
export const SEARCH_APPEARANCE_REVIEWED_AT = '2026-09-06';
export const MAX_HTML_BYTES = 1024 * 1024;
export const SOURCES = Object.freeze({
  siteName: 'https://developers.google.com/search/docs/appearance/site-names',
  favicon: 'https://developers.google.com/search/docs/appearance/favicon-in-search'
});
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
const text = value => typeof value === 'string' ? value.trim() : '';
const unique = values => [...new Set(values)];
const schemaContext = value => typeof value === 'string' && /^https?:\/\/schema\.org\/?$/.test(value);
const tokens = value => text(value).toLowerCase().split(/\s+/).filter(Boolean);
const supportedTypes = new Set(['image/bmp', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/jpeg', 'image/x-portable-pixmap', 'image/tiff']);
const supportedExtensions = new Set(['bmp', 'gif', 'ico', 'png', 'jpg', 'jpeg', 'ppm', 'tif', 'tiff']);

function httpUrl(value, base) {
  if (!text(value)) return null;
  try {
    const url = new URL(value, base);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch { return null; }
}

function entities(value) {
  return String(value).replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, token => {
    const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    const lower = token.toLowerCase();
    if (named[lower]) return named[lower];
    const code = lower.startsWith('&#x') ? parseInt(lower.slice(3, -1), 16) : parseInt(lower.slice(2, -1), 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '\ufffd';
  });
}

function attributes(value) {
  const out = Object.create(null);
  const pattern = /([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of value.matchAll(pattern)) {
    const key = match[1].toLowerCase();
    if (!(key in out)) out[key] = entities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return out;
}

function parseHtml(html) {
  const out = { json: [], invalidJson: 0, icons: [], ogNames: [], base: null, explicitHead: false, incompleteRawText: false };
  let inHead = false;
  let inertDepth = 0;
  // A raw-text start consumes through its first closing tag, or the rest of the
  // file. No repeated suffix scans for adversarial unclosed <script> sequences.
  const pattern = /<!--[\s\S]*?(?:-->|$)|<\/?[a-z][a-z0-9:-]*\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    if (match[0].startsWith('<!--')) continue;
    const tag = match[0].match(/^<(\/)?([a-z0-9:-]+)\b([\s\S]*?)>$/i);
    const name = tag[2].toLowerCase();
    if (!tag[1] && ['script', 'style', 'textarea', 'title'].includes(name)) {
      const endPattern = new RegExp(`</${name}\\s*>`, 'gi');
      endPattern.lastIndex = pattern.lastIndex;
      const end = endPattern.exec(html);
      if (!end) { out.incompleteRawText = true; break; }
      if (!inertDepth && name === 'script' && text(attributes(tag[3]).type).toLowerCase() === 'application/ld+json') {
        try { out.json.push(JSON.parse(html.slice(pattern.lastIndex, end.index))); } catch { out.invalidJson += 1; }
      }
      pattern.lastIndex = endPattern.lastIndex;
      continue;
    }
    if (['template', 'noscript'].includes(name)) {
      inertDepth = Math.max(0, inertDepth + (tag[1] ? -1 : 1));
      continue;
    }
    if (inertDepth) continue;
    if (name === 'head') { inHead = !tag[1]; out.explicitHead = true; continue; }
    if (name === 'body') inHead = false;
    if (tag[1] || !inHead) continue;
    const attrs = attributes(tag[3]);
    if (name === 'base' && out.base === null && 'href' in attrs) out.base = attrs.href;
    if (name === 'meta' && text(attrs.property).toLowerCase() === 'og:site_name' && text(attrs.content)) out.ogNames.push(text(attrs.content));
    if (name === 'link' && tokens(attrs.rel).some(rel => ['icon', 'apple-touch-icon', 'apple-touch-icon-precomposed'].includes(rel))) out.icons.push(attrs);
  }
  return out;
}

function websiteNodes(payloads, pageUrl) {
  const groups = new Map();
  const queue = [];
  let limited = false;
  const enqueue = (value, context) => {
    if (queue.length >= 2049) { limited = true; return false; }
    queue.push({ value, context });
    return true;
  };
  for (const value of payloads) if (!enqueue(value, false)) break;
  let visited = 0;
  let unsupportedContext = false;
  for (let cursor = 0; cursor < queue.length && visited < 2048; cursor += 1) {
    const { value, context } = queue[cursor];
    visited += 1;
    if (Array.isArray(value)) {
      for (const item of value) if (!enqueue(item, context)) break;
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    const localContext = '@context' in value ? schemaContext(value['@context']) : context;
    if ('@context' in value && !localContext) unsupportedContext = true;
    if (value['@graph']) enqueue(value['@graph'], localContext);
    if (!localContext) continue; // Context expansion is deliberately not guessed.
    const id = text(value['@id']);
    const key = id ? (httpUrl(id, pageUrl)?.href || id) : `anonymous:${visited}`;
    const group = groups.get(key) || { id: id || null, types: [], names: [], urls: [], alternateNames: [] };
    group.types.push(...array(value['@type']).map(text));
    group.names.push(...array(value.name).map(text).filter(Boolean));
    group.urls.push(...array(value.url).map(text).filter(Boolean));
    group.alternateNames.push(...array(value.alternateName).map(text).filter(Boolean));
    groups.set(key, group);
  }
  const websites = [...groups.values()].filter(group => group.types.some(type => ['WebSite', 'https://schema.org/WebSite', 'http://schema.org/WebSite'].includes(type)))
    .map(group => ({ ...group, names: unique(group.names), urls: unique(group.urls), alternateNames: unique(group.alternateNames) }));
  return { websites, unsupportedContext, limited: limited || queue.length > visited };
}

/** Inspect supplied HTML at its actual public URL. Performs zero network requests. */
export function inspectSearchAppearance({ html, url }) {
  if (typeof html !== 'string') throw new TypeError('html must be a string.');
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) throw new RangeError('HTML exceeds the 1 MiB inspection limit.');
  const page = httpUrl(url);
  if (!page) throw new TypeError('url must be an absolute HTTP(S) URL without credentials.');
  const parsed = parseHtml(html);
  const graph = websiteNodes(parsed.json, page.href);
  const rootPage = page.pathname === '/' && !page.search;
  const checks = [];
  const add = (id, status, title, message, source, details = {}) => checks.push({ id: `appearance:${id}`, status, title, message, source, ...details });
  add('jsonld-syntax', parsed.invalidJson ? 'fail' : 'observed', 'Review JSON-LD syntax',
    parsed.invalidJson ? `${parsed.invalidJson} JSON-LD script(s) could not be parsed. Repair the existing blocks; do not append replacements.` : `${parsed.json.length} JSON-LD script(s) parsed. This is syntax observation, not semantic validation.`, SOURCES.siteName);
  add('site-scope', rootPage ? 'observed' : 'not-applicable', 'Check hostname-level Search appearance',
    rootPage ? 'The inspected URL is a domain/subdomain root.' : 'This is not a domain/subdomain root. A subdirectory has no separate Google site-name or Search-favicon scope; inspect the hostname homepage separately.', SOURCES.siteName);

  if (rootPage) {
    const incomplete = graph.unsupportedContext || graph.limited || parsed.invalidJson > 0 || parsed.incompleteRawText;
    if (!graph.websites.length) {
      add('site-name', incomplete ? 'not-assessed' : 'not-observed', 'Review the existing homepage WebSite declaration',
        'No supported WebSite JSON-LD declaration was observed. Check existing microdata, RDFa, rendered markup and unsupported contexts before adding or editing a node.', SOURCES.siteName);
    } else {
      const invalid = graph.websites.filter(node => node.names.length !== 1 || node.urls.length !== 1 || !node.urls.every(value => {
        const target = httpUrl(value);
        return target && target.origin === page.origin && target.pathname === '/' && !target.search && !target.hash;
      }));
      const names = unique(graph.websites.flatMap(node => node.names));
      const review = invalid.length > 0 || names.length > 1 || graph.websites.length > 1;
      add('site-name', review ? 'review' : 'observed', 'Keep one coherent homepage WebSite identity',
        review ? 'Missing or conflicting name/url declarations, multiple WebSite nodes, or a URL outside the inspected canonical root need review. Check legitimate canonical aliases before editing; merge existing nodes rather than adding a competing identity.' : 'One named WebSite declaration points to this root URL. Google still chooses the displayed site name.', SOURCES.siteName);
      const accepted = new Set(graph.websites.flatMap(node => [...node.names, ...node.alternateNames]).map(value => value.toLocaleLowerCase('en')));
      if (parsed.ogNames.length) add('name-consistency', parsed.ogNames.some(name => !accepted.has(name.toLocaleLowerCase('en'))) ? 'review' : 'observed',
        'Align declared homepage names', 'Compare og:site_name with WebSite.name and genuine alternateName values; visible branding still requires editorial review.', SOURCES.siteName);
    }
  }

  const base = parsed.base === null ? page : httpUrl(parsed.base, page.href);
  const icons = parsed.icons.map(icon => {
    const target = base ? httpUrl(icon.href, base.href) : null;
    const type = text(icon.type).toLowerCase().split(';')[0];
    const extension = target?.pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || null;
    const dimensionTokens = tokens(icon.sizes);
    const dimensions = dimensionTokens.map(value => value.match(/^(\d+)x(\d+)$/)).filter(Boolean).map(match => ({ width: Number(match[1]), height: Number(match[2]) }));
    return { url: target?.href || null, declaredType: type || null, extension, declaredSizes: text(icon.sizes) || null,
      formatHint: type ? (supportedTypes.has(type) ? 'listed' : 'unlisted') : extension ? (supportedExtensions.has(extension) ? 'listed' : 'unlisted') : 'unknown',
      sizeHint: dimensions.some(size => size.width === size.height && size.width >= 8) ? 'minimum-declared' : dimensions.length && dimensions.length === dimensionTokens.length ? 'below-minimum-or-nonsquare' : 'unknown' };
  });
  if (rootPage) {
    const usable = icons.filter(icon => icon.url);
    add('favicon-link', !parsed.explicitHead || parsed.incompleteRawText ? 'not-assessed' : usable.length ? 'observed' : parsed.icons.length ? 'review' : 'not-observed',
      'Declare a favicon in the homepage head', 'Inspect an icon link with a usable HTTP(S) URL. Relative and CDN-hosted URLs are allowed; a declaration is not a successful fetch.', SOURCES.favicon);
    if (usable.length) {
      add('favicon-format', usable.every(icon => icon.formatHint === 'unlisted') ? 'review' : 'not-assessed', 'Verify the favicon file format',
        'The reviewed Google documentation lists BMP, GIF, ICO, PNG, JPEG, PPM and TIFF. File suffixes and type attributes are hints, not byte-level verification. Keep a supported raster/ICO alternative when only SVG is declared.', SOURCES.favicon);
      add('favicon-dimensions', usable.every(icon => icon.sizeHint === 'below-minimum-or-nonsquare') ? 'review' : 'not-assessed', 'Verify actual favicon dimensions',
        'The actual image must be square and at least 8x8; larger than 48x48 is recommended. HTML sizes are declarations only. Do not apply an obsolete multiple-of-48 requirement.', SOURCES.favicon);
    }
  }
  const actions = checks.filter(check => ['fail', 'review', 'not-observed'].includes(check.status)).map(check => ({
    id: `growth:${check.id}`, priority: check.status === 'fail' ? 'P1' : 'P2', lane: 'search-appearance',
    title: check.title, reason: check.message, status: 'review', source: check.source,
    evidence: [page.href], implementation: { autofix: false, note: 'Review existing declarations and publisher identity before editing. Never overwrite hostname-wide branding from a project-subdirectory rollout.' }
  }));
  return {
    searchAppearanceVersion: SEARCH_APPEARANCE_VERSION, reviewedAt: SEARCH_APPEARANCE_REVIEWED_AT,
    pageUrl: page.href, hostnameHomepage: `${page.origin}/`, scope: rootPage ? 'hostname-root' : 'non-root',
    evidenceClass: 'static-html-observation', checks, actions,
    observations: { websites: graph.websites, ogSiteNames: unique(parsed.ogNames), faviconDeclarations: icons },
    coverage: { explicitHead: parsed.explicitHead, incompleteRawText: parsed.incompleteRawText, unsupportedJsonLdContext: graph.unsupportedContext, graphLimitReached: graph.limited,
      renderedDom: 'not-assessed', microdataAndRdfa: 'not-assessed', assetBytesAndCrawlability: 'not-assessed', actualSearchAppearance: 'not-assessed' },
    manualChecks: ['Confirm the supplied URL and HTML represent the same deployed page.', 'Check visible brand consistency and genuine canonical aliases.', 'Verify Googlebot homepage access and Googlebot-Image access to the favicon.', 'Inspect actual icon bytes, square dimensions and stable URL.', 'Observe Search appearance separately; passing static checks proves neither selection nor ranking.'],
    guardrails: { noRankingClaim: true, noAppearanceGuarantee: true, noNetworkRequests: true, noAutomaticEdits: true, noUniversalScore: true }
  };
}
