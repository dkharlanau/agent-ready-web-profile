import { fetchPublicText } from './public-fetch.mjs';

export const CONTENT_DIFFERENTIATION_VERSION = '0.1';
const GOOGLE_AI_GUIDE = 'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide';
const ARTIFACT_PATH = /\.(?:csv|tsv|json|jsonl|ya?ml|xml|pdf|zip|xlsx?|ods|parquet|ipynb)(?:$|[?#])/i;
const RESEARCH_TERMS = /\b(method|methodology|benchmark|experiment|results?|case study|evaluation|research|dataset|analysis)\b/i;

const norm = value => String(value || '').replace(/\s+/g, ' ').trim();

function attrs(tag) {
  const out = {};
  const body = String(tag || '').replace(/^<\/?[A-Za-z0-9:-]+\s*/i, '').replace(/\/?\s*>$/, '');
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = re.exec(body))) out[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return out;
}

function resolve(value, base) {
  if (!value) return null;
  try { return new URL(value, base).href; } catch { return null; }
}

function normalizedPageUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.href;
  } catch { return null; }
}

function contentScope(html) {
  const input = String(html || '');
  return input.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    ?? input.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    ?? input.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]
    ?? input;
}

function visibleText(html) {
  return norm(String(html || '')
    .replace(/<(script|style|template|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>'));
}

function pageSignals(page) {
  const url = normalizedPageUrl(page.url);
  if (!url) return null;
  const html = String(page.html || '');
  const scoped = contentScope(html);
  const text = visibleText(scoped);
  const title = norm(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, ' '));
  const headingText = [...scoped.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map(match => visibleText(match[1]))
    .filter(Boolean)
    .join(' | ');
  const sectionHeadings = (scoped.match(/<h[2-3]\b[^>]*>/gi) ?? []).length;
  const paragraphs = (scoped.match(/<p\b[^>]*>/gi) ?? []).length;
  const tableCount = (scoped.match(/<table\b[^>]*>/gi) ?? []).length;
  const figureCount = (scoped.match(/<figure\b[^>]*>/gi) ?? []).length;
  const codeCount = (scoped.match(/<(?:pre|code)\b[^>]*>/gi) ?? []).length;
  const quoteCount = (scoped.match(/<(?:blockquote|cite)\b[^>]*>/gi) ?? []).length;
  const percentClaims = (text.match(/\b\d+(?:[.,]\d+)?\s*%/g) ?? []).length;
  const hasArticle = /<article\b/i.test(html);
  const externalLinks = [];
  const artifactLinks = [];
  const origin = new URL(url).origin;
  let match;
  const linkRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  while ((match = linkRe.exec(scoped))) {
    const a = attrs(`<a ${match[1]}>`);
    const target = resolve(a.href, url);
    if (!target) continue;
    let parsed;
    try { parsed = new URL(target); } catch { continue; }
    if (parsed.origin !== origin && /^https?:$/.test(parsed.protocol)) externalLinks.push(parsed.href);
    if (ARTIFACT_PATH.test(parsed.pathname + parsed.search + parsed.hash)) artifactLinks.push(parsed.href);
  }
  const categories = [];
  if (externalLinks.length) categories.push('external-reference');
  if (artifactLinks.length) categories.push('downloadable-artifact');
  if (tableCount) categories.push('table');
  if (figureCount) categories.push('figure');
  if (codeCount) categories.push('code-example');
  if (quoteCount) categories.push('quoted-source');
  const path = new URL(url).pathname;
  const substantiveInformational = text.length >= 900
    && paragraphs >= 3
    && (hasArticle || sectionHeadings >= 2 || path.split('/').filter(Boolean).length >= 2);
  const researchLike = RESEARCH_TERMS.test(`${title} ${headingText}`);
  const proofAssetCount = tableCount + figureCount + codeCount + artifactLinks.length;
  return {
    url,
    title,
    textChars: text.length,
    paragraphs,
    sectionHeadings,
    hasArticle,
    externalReferences: externalLinks.length,
    artifactLinks: artifactLinks.length,
    tables: tableCount,
    figures: figureCount,
    codeExamples: codeCount,
    quotesOrCites: quoteCount,
    percentClaims,
    differentiationSignals: categories,
    substantiveInformational,
    researchLike,
    proofAssetCount
  };
}

function action(id, priority, lane, title, reason, page, verification) {
  return {
    id,
    priority,
    lane,
    title,
    reason,
    evidenceClass: 'manual-review',
    evidence: [page.url],
    target: { url: page.url },
    proposal: null,
    verification,
    measurement: [
      `Track page/query Search Console impressions and clicks for ${page.url} after the reviewed change.`,
      'Use Google generative Search / Bing AI visibility evidence when owner-side data is available; do not infer causality from a single change.'
    ],
    sourceCheck: GOOGLE_AI_GUIDE
  };
}

export function analyzeContentDifferentiationPages(inputPages) {
  if (!Array.isArray(inputPages) || !inputPages.length) throw new Error('pages must be a non-empty array.');
  const pages = inputPages.map(pageSignals).filter(Boolean);
  const actions = [];
  for (const page of pages) {
    if (page.substantiveInformational && page.differentiationSignals.length === 0) {
      actions.push(action(
        `content:unique-contribution:${page.url}`,
        'P1',
        'content-differentiation',
        'Review this page for a visible unique contribution',
        `The bounded main/article HTML contains ${page.textChars} text characters and ${page.sectionHeadings} section heading(s), but no table, figure, code example, downloadable artifact, external reference, quote or cite was observed. This does not prove low quality; it creates a manual review gate for first-hand experience, original analysis, data, examples or other evidence instead of adding more generic prose.`,
        page,
        [
          'A human editor confirms the page contains a concrete contribution that is not merely a restatement of common web content.',
          'Re-fetch the page and preserve any visible supporting artifact/source signals that were intentionally added.'
        ]
      ));
    }
    const groundedQuant = page.externalReferences > 0 || page.tables > 0 || page.artifactLinks > 0 || page.figures > 0;
    if (page.substantiveInformational && page.percentClaims >= 2 && !groundedQuant) {
      actions.push(action(
        `content:quantitative-grounding:${page.url}`,
        'P2',
        'claim-grounding',
        'Ground repeated quantitative claims with a visible method or source',
        `${page.percentClaims} percentage-form quantitative claims were observed in the bounded content scope without an external reference, table, figure or downloadable artifact. The numbers may be valid first-party observations; review whether readers can see how they were produced or where they came from.`,
        page,
        [
          'A human reviewer verifies each material quantitative claim is either supported by a visible first-party method/result artifact or an appropriate source.',
          'Do not add decorative citations that do not support the claim.'
        ]
      ));
    }
    if (page.substantiveInformational && page.researchLike && page.proofAssetCount === 0) {
      actions.push(action(
        `content:proof-surface:${page.url}`,
        'P2',
        'evidence-surface',
        'Expose the proof surface for research, benchmark or results content',
        'The page title/headings indicate research, benchmark, analysis, evaluation, dataset, case-study or results content, but no table, figure, code example or downloadable artifact was observed in the bounded content scope. Review whether the method/result can be inspected directly rather than only described.',
        page,
        [
          'A human reviewer confirms the page exposes the relevant method, example, result, data excerpt, reproducible artifact or an explicit reason why no public artifact is appropriate.',
          'Any published artifact must be genuine and consistent with the visible claim.'
        ]
      ));
    }
  }
  return {
    version: CONTENT_DIFFERENTIATION_VERSION,
    scope: 'bounded-observable-content-differentiation-signals-not-quality-score',
    pages: pages.map(page => ({
      url: page.url,
      title: page.title,
      textChars: page.textChars,
      paragraphs: page.paragraphs,
      sectionHeadings: page.sectionHeadings,
      substantiveInformational: page.substantiveInformational,
      researchLike: page.researchLike,
      percentClaims: page.percentClaims,
      differentiationSignals: page.differentiationSignals
    })),
    actions,
    summary: {
      pagesObserved: pages.length,
      informationalPagesObserved: pages.filter(page => page.substantiveInformational).length,
      actions: actions.length,
      byLane: actions.reduce((acc, item) => (acc[item.lane] = (acc[item.lane] || 0) + 1, acc), {})
    },
    source: {
      googleGenerativeSearchGuide: GOOGLE_AI_GUIDE,
      interpretation: 'Observable evidence surfaces are review triggers only; Google does not publish a content-differentiation score or require these artifact types.'
    },
    guardrails: {
      noContentQualityScore: true,
      absenceOfSignalsDoesNotProveLowQuality: true,
      humanEditorialReviewRequired: true,
      noArtificialEvidenceOrCitations: true,
      noThinQueryVariantPageRecommendation: true,
      queryFanOutIsNotAPageFactory: true
    }
  };
}

function scopeFor(input) {
  const url = new URL(input);
  url.hash = '';
  url.search = '';
  const pathPrefix = url.pathname.endsWith('/') ? url.pathname : (url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1) || '/');
  return { origin: url.origin, pathPrefix };
}

function sitemapUrls(xml, base) {
  return [...String(xml || '').matchAll(/<loc\b[^>]*>([^<]+)<\/loc>/gi)]
    .map(match => resolve(match[1].trim(), base))
    .filter(Boolean);
}

function contentLinks(html, base) {
  const links = [];
  const scoped = contentScope(html);
  let match;
  const re = /<a\b([^>]*)>/gi;
  while ((match = re.exec(scoped))) {
    const a = attrs(`<a ${match[1]}>`);
    const url = normalizedPageUrl(resolve(a.href, base));
    if (url) links.push(url);
  }
  return links;
}

export async function analyzeContentDifferentiationSite(input, { timeoutMs = 8000, maxBytes = 256 * 1024, maxPages = 8, fetchImpl = fetch, resolveImpl } = {}) {
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 30) throw new Error('maxPages must be an integer between 1 and 30.');
  const start = new URL(input);
  if (start.protocol !== 'https:') throw new Error('Content differentiation analysis requires a public HTTPS URL.');
  const scope = scopeFor(start.href);
  const network = { timeoutMs, maxBytes, fetchImpl, ...(resolveImpl ? { resolveImpl } : {}) };
  const home = await fetchPublicText(start.href, { ...network, accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1', userAgent: 'arwp-content-differentiation/0.1' });
  if (!home.ok || !home.text) throw new Error(`Unable to fetch start page: HTTP ${home.status ?? 'unknown'}`);
  const candidates = new Set([normalizedPageUrl(home.url || start.href)]);
  for (const value of contentLinks(home.text, home.url || start.href)) {
    const target = new URL(value);
    if (target.origin === scope.origin && target.pathname.startsWith(scope.pathPrefix)) candidates.add(value);
  }
  const sitemapUrl = new URL('sitemap.xml', scope.origin + scope.pathPrefix).href;
  const sitemap = await fetchPublicText(sitemapUrl, { ...network, accept: 'application/xml, text/xml;q=0.9, */*;q=0.1', userAgent: 'arwp-content-differentiation/0.1' }).catch(() => null);
  if (sitemap?.ok && sitemap.text) {
    for (const value of sitemapUrls(sitemap.text, sitemapUrl)) {
      const target = new URL(value);
      if (target.origin === scope.origin && target.pathname.startsWith(scope.pathPrefix)) candidates.add(normalizedPageUrl(value));
    }
  }
  const pages = [{ url: home.url || start.href, html: home.text, status: home.status }];
  for (const url of [...candidates].filter(Boolean).sort()) {
    if (pages.length >= maxPages) break;
    if (normalizedPageUrl(url) === normalizedPageUrl(home.url || start.href)) continue;
    const response = await fetchPublicText(url, { ...network, accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1', userAgent: 'arwp-content-differentiation/0.1' }).catch(() => null);
    if (response?.ok && response.text && /html|xhtml/i.test(String(response.contentType || 'text/html'))) pages.push({ url: response.url || url, html: response.text, status: response.status });
  }
  const report = analyzeContentDifferentiationPages(pages);
  report.canonicalUrl = normalizedPageUrl(home.url || start.href);
  report.discovery = { startUrl: input, sitemap: sitemap?.ok ? sitemapUrl : null, candidates: candidates.size, maxPages, maxBytesPerPage: maxBytes, timeoutMs };
  return report;
}
