import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fetchPublicText } from './public-fetch.mjs';
import { robotsRootAccess } from './site-audit.mjs';
import { buildSiteFocusReportFromPages } from './site-focus.mjs';

export const SITE_GATE_VERSION = '0.1';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const checklistPath = path.join(root, 'registry', 'site-readiness-checklist.json');
const DATA_SITE_TYPES = new Set(['data-site', 'research-dataset', 'large-knowledge-site']);
const STATUS_ORDER = ['pass', 'fail', 'watch', 'owner-data', 'not-applicable'];
const BINARY_EXT = /\.(?:avif|bmp|css|csv|docx?|gif|gz|ico|jpe?g|js|json|map|mp3|mp4|pdf|png|pptx?|rss|svg|tar|tgz|txt|webm|webp|woff2?|xlsx?|xml|zip)$/i;
const UTILITY_PATH = /\/(?:login|logout|signin|signup|search|privacy|terms|cookie|feed|api)(?:\/|$)/i;

export function loadSiteReadinessChecklist() {
  return JSON.parse(fs.readFileSync(checklistPath, 'utf8'));
}

function cleanText(value) {
  return String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function attrs(tag) {
  const out = {};
  const body = String(tag || '').replace(/^<\/?[\w:-]+\s*/i, '').replace(/\/?\s*>$/, '');
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = re.exec(body))) out[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return out;
}

function normalizeUrl(value, base = null, { stripSearch = true } = {}) {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    if (url.protocol !== 'https:') return null;
    url.hash = '';
    if (stripSearch) url.search = '';
    return url.href;
  } catch {
    return null;
  }
}

function scopeFor(value) {
  const url = new URL(value);
  const pathPrefix = url.pathname.endsWith('/')
    ? url.pathname
    : url.pathname.replace(/[^/]*$/, '');
  return { origin: url.origin, pathPrefix: pathPrefix || '/' };
}

function inScope(value, scope) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === scope.origin && url.pathname.startsWith(scope.pathPrefix);
  } catch {
    return false;
  }
}

function pageDepth(value, scope) {
  try {
    const url = new URL(value);
    const relative = url.pathname.slice(scope.pathPrefix.length).replace(/^\/+|\/+$/g, '');
    return relative ? relative.split('/').filter(Boolean).length : 0;
  } catch {
    return 99;
  }
}

function routeSegment(value, scope) {
  try {
    const url = new URL(value);
    const relative = url.pathname.slice(scope.pathPrefix.length).replace(/^\/+|\/+$/g, '');
    return relative.split('/').filter(Boolean)[0] || 'home';
  } catch {
    return 'unknown';
  }
}

function isPageCandidate(value, scope) {
  if (!inScope(value, scope)) return false;
  const url = new URL(value);
  if (url.search) return false;
  if (BINARY_EXT.test(url.pathname)) return false;
  return true;
}

function htmlCanonical(html, base) {
  for (const tag of String(html || '').match(/<link\b[^>]*>/gi) || []) {
    const a = attrs(tag);
    const rel = String(a.rel || '').toLowerCase().split(/\s+/);
    if (rel.includes('canonical') && a.href) return normalizeUrl(a.href, base);
  }
  return null;
}

function htmlRobots(html, headers = {}) {
  const directives = new Set();
  for (const tag of String(html || '').match(/<meta\b[^>]*>/gi) || []) {
    const a = attrs(tag);
    const name = String(a.name || '').toLowerCase();
    if (!['robots', 'googlebot'].includes(name)) continue;
    for (const token of String(a.content || '').toLowerCase().split(/[,;]/).map(v => v.trim()).filter(Boolean)) directives.add(token);
  }
  for (const token of String(headers.xRobotsTag || '').toLowerCase().split(/[,;]/).map(v => v.trim()).filter(Boolean)) directives.add(token);
  return [...directives];
}

function headingStats(html) {
  const headings = String(html || '').match(/<h[1-6]\b[^>]*>/gi) || [];
  const ids = headings.filter(tag => /\bid\s*=/i.test(tag)).length;
  return { headings: headings.length, headingIds: ids };
}

function interactiveStats(html) {
  let total = 0;
  let unlabeled = 0;
  for (const match of String(html || '').matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    total += 1;
    const a = attrs(`<${match[1]} ${match[2]}>`);
    const text = cleanText(match[3]);
    const labelled = Boolean(text || a['aria-label'] || a.title || /<img\b[^>]*\balt\s*=\s*["'][^"']+["']/i.test(match[3]));
    if (!labelled) unlabeled += 1;
  }
  return {
    total,
    unlabeled,
    semanticLandmark: /<(?:main|article)\b/i.test(String(html || '')),
    navPresent: /<nav\b/i.test(String(html || ''))
  };
}

function structuredTypes(html) {
  const out = new Set();
  for (const match of String(html || '').matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const payload = JSON.parse(match[1]);
      const walk = value => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) return value.forEach(walk);
        const type = value['@type'];
        if (Array.isArray(type)) type.forEach(item => out.add(String(item)));
        else if (type) out.add(String(type));
        for (const child of Object.values(value)) walk(child);
      };
      walk(payload);
    } catch {
      out.add('__invalid_jsonld__');
    }
  }
  return [...out].sort();
}

function anchors(html, base) {
  const out = [];
  for (const match of String(html || '').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const a = attrs(`<a ${match[1]}>`);
    const url = normalizeUrl(a.href, base);
    if (url) out.push({ url, text: cleanText(match[2]) });
  }
  return out;
}

function robotsSitemaps(text, base) {
  const out = [];
  for (const match of String(text || '').matchAll(/^\s*Sitemap\s*:\s*(\S+)\s*$/gim)) {
    const url = normalizeUrl(match[1], base, { stripSearch: false });
    if (url) out.push(url);
  }
  return [...new Set(out)];
}

function parseSitemapUrls(xml, base) {
  const entries = [];
  for (const match of String(xml || '').matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)) {
    const body = match[1];
    const loc = body.match(/<loc\b[^>]*>([^<]+)<\/loc>/i)?.[1]?.trim();
    const lastmod = body.match(/<lastmod\b[^>]*>([^<]+)<\/lastmod>/i)?.[1]?.trim() || null;
    const url = loc ? normalizeUrl(loc, base, { stripSearch: false }) : null;
    if (url) entries.push({ url, lastmod });
  }
  return entries;
}

function parseSitemapChildren(xml, base) {
  if (!/<sitemapindex\b/i.test(String(xml || ''))) return [];
  return [...String(xml || '').matchAll(/<loc\b[^>]*>([^<]+)<\/loc>/gi)]
    .map(match => normalizeUrl(match[1].trim(), base, { stripSearch: false }))
    .filter(Boolean);
}

async function collectSitemap(rootUrl, network, { maxSitemaps = 5 } = {}) {
  const visited = new Set();
  const entries = [];
  const sources = [];
  const queue = [rootUrl].filter(Boolean);
  while (queue.length && visited.size < maxSitemaps) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);
    const response = await fetchPublicText(url, {
      ...network,
      accept: 'application/xml, text/xml, text/plain;q=0.9, */*;q=0.1',
      userAgent: 'arwp-site-gate/0.1'
    }).catch(error => ({ ok: false, status: null, url, error: String(error.message ?? error), text: null }));
    sources.push({ url, ok: Boolean(response?.ok), status: response?.status ?? null, error: response?.error || null });
    if (!response?.ok || !response.text) continue;
    const children = parseSitemapChildren(response.text, response.url || url);
    if (children.length) {
      for (const child of children) if (!visited.has(child) && queue.length + visited.size < maxSitemaps * 3) queue.push(child);
    } else entries.push(...parseSitemapUrls(response.text, response.url || url));
  }
  const deduped = new Map();
  for (const entry of entries) if (!deduped.has(entry.url)) deduped.set(entry.url, entry);
  return { rootUrl, entries: [...deduped.values()], sources };
}

function candidateScore(item, scope) {
  let score = 0;
  if (item.sources.has('start')) score += 10000;
  if (item.sources.has('homepage-link')) score += 1000;
  if (item.sources.has('sitemap')) score += 300;
  score -= pageDepth(item.url, scope) * 12;
  if (UTILITY_PATH.test(new URL(item.url).pathname)) score -= 250;
  return score;
}

function selectPriorityCandidates(candidateMap, scope, maxPages) {
  const all = [...candidateMap.values()].map(item => ({
    ...item,
    score: candidateScore(item, scope),
    segment: routeSegment(item.url, scope),
    sources: [...item.sources].sort()
  }));
  all.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
  const start = all.find(item => item.sources.includes('start')) || all[0];
  const selected = start ? [start] : [];
  const used = new Set(selected.map(item => item.url));
  const buckets = new Map();
  for (const item of all) {
    if (used.has(item.url)) continue;
    const list = buckets.get(item.segment) || [];
    list.push(item);
    buckets.set(item.segment, list);
  }
  for (const list of buckets.values()) list.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
  while (selected.length < maxPages && buckets.size) {
    const segments = [...buckets.entries()].sort((a, b) => (b[1][0]?.score ?? -Infinity) - (a[1][0]?.score ?? -Infinity) || a[0].localeCompare(b[0]));
    let progressed = false;
    for (const [segment, list] of segments) {
      if (selected.length >= maxPages) break;
      const item = list.shift();
      if (item) {
        selected.push(item);
        used.add(item.url);
        progressed = true;
      }
      if (!list.length) buckets.delete(segment);
    }
    if (!progressed) break;
  }
  return { all, selected };
}

async function mapLimit(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, run));
  return results;
}

function observeFetchedPage(candidate, response, scope, sitemapSet) {
  if (!response?.ok || !response.text) {
    return {
      requestedUrl: candidate.url,
      url: response?.url || candidate.url,
      ok: false,
      status: response?.status ?? null,
      error: response?.error || null,
      selection: { score: candidate.score, segment: candidate.segment, sources: candidate.sources },
      sitemapMember: sitemapSet.size ? sitemapSet.has(candidate.url) : null
    };
  }
  const finalUrl = normalizeUrl(response.url || candidate.url) || candidate.url;
  const canonical = htmlCanonical(response.text, finalUrl);
  const robotDirectives = htmlRobots(response.text, response.headers);
  const headings = headingStats(response.text);
  const interactive = interactiveStats(response.text);
  const internalLinks = anchors(response.text, finalUrl).filter(link => inScope(link.url, scope)).length;
  return {
    requestedUrl: candidate.url,
    url: finalUrl,
    ok: true,
    status: response.status,
    contentType: response.contentType || null,
    canonical,
    robotDirectives,
    noindex: robotDirectives.includes('noindex'),
    headings: headings.headings,
    headingIds: headings.headingIds,
    semanticLandmark: interactive.semanticLandmark,
    navPresent: interactive.navPresent,
    interactiveTotal: interactive.total,
    unlabeledInteractive: interactive.unlabeled,
    internalLinks,
    structuredTypes: structuredTypes(response.text),
    selection: { score: candidate.score, segment: candidate.segment, sources: candidate.sources },
    sitemapMember: sitemapSet.size ? sitemapSet.has(candidate.url) || sitemapSet.has(finalUrl) || (canonical ? sitemapSet.has(canonical) : false) : null,
    _html: response.text
  };
}

function result(status, message, evidence = [], extra = {}) {
  return { status, message, evidence: evidence.filter(Boolean), ...extra };
}

function indexabilityResult(pages, sitemapAvailable) {
  const hard = [];
  const review = [];
  for (const page of pages) {
    if (!page.ok || page.status < 200 || page.status >= 300) {
      hard.push(`${page.requestedUrl} is not a successful HTML fetch`);
      continue;
    }
    if (page.noindex) hard.push(`${page.url} exposes noindex`);
    if (page.sitemapMember && page.canonical && normalizeUrl(page.canonical) !== normalizeUrl(page.url)) {
      hard.push(`${page.url} is in the sampled sitemap but canonicalizes to ${page.canonical}`);
    }
    if (!page.canonical) review.push(`${page.url} has no canonical link in fetched HTML`);
    if (sitemapAvailable && page.sitemapMember === false) review.push(`${page.url} is in the priority cohort but not in the sampled sitemap`);
  }
  if (hard.length) return result('fail', hard.slice(0, 5).join('; '), pages.map(page => page.url), { issueCount: hard.length, reviewCount: review.length });
  if (review.length) return result('watch', review.slice(0, 5).join('; '), pages.map(page => page.url), { reviewCount: review.length });
  return result('pass', 'No sampled priority-page HTTP/indexability/canonical/sitemap contradiction was observed.', pages.map(page => page.url));
}

function meaningfulLastmodResult(sitemap) {
  if (!sitemap.entries.length) return result('watch', 'No sitemap URL entries were available for lastmod review.', sitemap.sources.map(item => item.url));
  const withLastmod = sitemap.entries.filter(entry => entry.lastmod);
  const valid = withLastmod.filter(entry => !Number.isNaN(Date.parse(entry.lastmod)));
  if (!withLastmod.length) return result('watch', 'Sitemap entries were observed, but no lastmod values were present. Whether lastmod is needed depends on the publishing workflow.', sitemap.sources.map(item => item.url));
  if (valid.length !== withLastmod.length) return result('watch', `${valid.length}/${withLastmod.length} observed lastmod values are syntactically parseable; semantic freshness still requires publisher review.`, sitemap.sources.map(item => item.url));
  return result('watch', `${valid.length} parseable lastmod value(s) observed. The gate cannot prove they represent meaningful content changes rather than build time.`, sitemap.sources.map(item => item.url));
}

function variantResult(pages, sitemap) {
  const queries = sitemap.entries.filter(entry => {
    try { return Boolean(new URL(entry.url).search); } catch { return false; }
  });
  const canonicalTargets = new Map();
  for (const page of pages) if (page.canonical) {
    const key = normalizeUrl(page.canonical);
    const urls = canonicalTargets.get(key) || [];
    urls.push(page.url);
    canonicalTargets.set(key, urls);
  }
  const duplicates = [...canonicalTargets.entries()].filter(([, urls]) => new Set(urls).size > 1);
  if (queries.length || duplicates.length) {
    return result('watch', `Variant review needed: ${queries.length} sitemap URL(s) with query strings and ${duplicates.length} sampled duplicate canonical target(s).`, [
      ...queries.slice(0, 5).map(item => item.url),
      ...duplicates.slice(0, 5).flatMap(([, urls]) => urls)
    ]);
  }
  return result('pass', 'No obvious query-variant sitemap entries or duplicate sampled canonical targets were observed.', pages.map(page => page.url).slice(0, 8));
}

function addressableSectionsResult(pages) {
  const withHeadings = pages.filter(page => page.ok && page.headings > 0);
  if (!withHeadings.length) return result('watch', 'No headings were observed on sampled priority pages, so section addressability needs review.');
  const addressable = withHeadings.filter(page => page.headingIds > 0);
  const ratio = addressable.length / withHeadings.length;
  if (ratio >= 0.8) return result('pass', `${addressable.length}/${withHeadings.length} sampled pages with headings expose at least one heading ID.`, addressable.map(page => page.url));
  return result('watch', `${addressable.length}/${withHeadings.length} sampled pages with headings expose at least one heading ID; review deep-link targets on important sections.`, withHeadings.map(page => page.url));
}

function semanticAgentUxResult(pages) {
  const htmlPages = pages.filter(page => page.ok);
  if (!htmlPages.length) return result('fail', 'No successful priority HTML pages were available for semantic-agent UX review.');
  const landmarks = htmlPages.filter(page => page.semanticLandmark).length;
  const unlabeled = htmlPages.reduce((sum, page) => sum + (page.unlabeledInteractive || 0), 0);
  const interactive = htmlPages.reduce((sum, page) => sum + (page.interactiveTotal || 0), 0);
  if (landmarks === htmlPages.length && unlabeled === 0) {
    return result('pass', `All ${htmlPages.length} sampled pages expose a main/article landmark and no obviously unlabeled link/button was detected (${interactive} interactive elements sampled).`, htmlPages.map(page => page.url));
  }
  return result('watch', `${landmarks}/${htmlPages.length} sampled pages expose a main/article landmark; ${unlabeled}/${interactive} sampled link/button elements appear unlabeled by this bounded HTML heuristic.`, htmlPages.map(page => page.url));
}

function buildCheckMap(context) {
  const { pages, robots, sitemap, focus, llms, siteType } = context;
  const google = robotsRootAccess(robots.text, 'Googlebot');
  const oai = robotsRootAccess(robots.text, 'OAI-SearchBot');
  const gptbot = robotsRootAccess(robots.text, 'GPTBot');
  const httpFailures = pages.filter(page => !page.ok || page.status < 200 || page.status >= 300);
  const successful = pages.filter(page => page.ok && page.status >= 200 && page.status < 300);
  const headingsResult = addressableSectionsResult(pages);
  const semanticResult = semanticAgentUxResult(pages);
  const datasetObserved = pages.some(page => (page.structuredTypes || []).includes('Dataset'));
  const invalidJsonLd = pages.filter(page => (page.structuredTypes || []).includes('__invalid_jsonld__'));
  const structuredPages = pages.filter(page => (page.structuredTypes || []).some(type => type !== '__invalid_jsonld__'));
  const sitemapAvailable = sitemap.entries.length > 0;
  const canonicalDuplicates = new Map();
  for (const page of pages) if (page.canonical) {
    const key = normalizeUrl(page.canonical);
    canonicalDuplicates.set(key, (canonicalDuplicates.get(key) || 0) + 1);
  }
  const duplicateCanonicalCount = [...canonicalDuplicates.values()].filter(count => count > 1).length;
  const deepOrphans = focus?.metrics?.orphanCandidates ?? null;
  const proofMissing = focus?.metrics?.pagesWithoutProof ?? null;
  const jobMissing = focus?.metrics?.pagesWithoutClearJob ?? null;

  const map = new Map();
  map.set('primary-problem', result('watch', focus?.observedSiteThesis?.h1 || focus?.observedSiteThesis?.title
    ? `Observed homepage thesis: ${focus.observedSiteThesis.h1 || focus.observedSiteThesis.title}. Confirm this is the primary user/problem/task, not merely a headline.`
    : 'No clear homepage thesis was observed; owner review is required.'));
  map.set('scope-exclusion', result('watch', 'Public HTML cannot reliably prove the intended anti-scope. Record what the site deliberately does not cover.'));
  map.set('priority-cohort', result('pass', `A bounded ${pages.length}-page public priority cohort was generated deterministically.`, pages.map(page => page.url)));
  map.set('real-outcome', result('owner-data', 'Define at least one site-specific downstream task or conversion before interpreting acquisition outcomes.'));

  map.set('priority-http-success', httpFailures.length
    ? result('fail', `${httpFailures.length}/${pages.length} priority page(s) failed the successful HTTP fetch gate.`, httpFailures.map(page => page.requestedUrl))
    : result('pass', `${successful.length}/${pages.length} priority page(s) returned a successful fetch.`, pages.map(page => page.url)));
  if (google.status === 'blocked') map.set('crawler-access-intentional', result('fail', 'Googlebot appears root-blocked by robots.txt; this blocks the stated Search acquisition objective until intentionally changed.', [robots.url]));
  else if (google.status === 'unknown') map.set('crawler-access-intentional', result('watch', `Googlebot access is unknown. OAI-SearchBot=${oai.status}; GPTBot=${gptbot.status}.`, [robots.url]));
  else if (oai.status === 'blocked') map.set('crawler-access-intentional', result('watch', 'Googlebot is not root-blocked, but OAI-SearchBot appears blocked. Confirm this is an intentional answer/search policy; training policy remains a separate decision.', [robots.url]));
  else map.set('crawler-access-intentional', result('pass', `No root-wide Googlebot or OAI-SearchBot block was observed. GPTBot=${gptbot.status}; training and answer/search policies remain separate.`, [robots.url]));
  map.set('indexability-canonical-sitemap-parity', indexabilityResult(pages, sitemapAvailable));
  map.set('meaningful-lastmod', meaningfulLastmodResult(sitemap));
  map.set('variant-control', variantResult(pages, sitemap));

  map.set('direct-answer-or-value', result('watch', jobMissing === null
    ? 'Manual first-useful-content review is required.'
    : `${jobMissing}/${pages.length} sampled pages were flagged by Site Focus as lacking a clear page job; manually verify the first useful content answers the page intent.`));
  map.set('non-commodity-contribution', result('watch', proofMissing === null
    ? 'Manual originality/evidence review is required.'
    : `${Math.max(0, pages.length - proofMissing)}/${pages.length} sampled pages exposed at least one bounded proof signal; this is not proof of originality or usefulness.`));
  map.set('claim-evidence-boundary', result('watch', 'Material claim-to-source support requires content review; the gate does not infer factual support from links alone.'));
  map.set('addressable-sections', headingsResult);
  map.set('standalone-useful', result('watch', 'Standalone usefulness requires a human/task review; direct landing quality is not reduced to a text heuristic.'));

  map.set('stable-entity-identity', duplicateCanonicalCount
    ? result('watch', `${duplicateCanonicalCount} duplicate sampled canonical target(s) require entity/variant review.`, pages.filter(page => page.canonical).map(page => page.url))
    : result('watch', 'Sampled canonical identities are not obviously duplicated, but stable entity identity across HTML, datasets and graph surfaces still requires review.'));
  if (invalidJsonLd.length) map.set('visible-structured-parity', result('fail', `${invalidJsonLd.length} sampled page(s) contain JSON-LD that could not be parsed; parity cannot be trusted until fixed.`, invalidJsonLd.map(page => page.url)));
  else if (structuredPages.length) map.set('visible-structured-parity', result('watch', `${structuredPages.length} sampled page(s) expose parseable JSON-LD. Confirm machine-readable facts match visible public facts.`, structuredPages.map(page => page.url)));
  else map.set('visible-structured-parity', result('watch', 'No JSON-LD was observed in the sampled cohort; review any other machine-readable exports for visible-fact parity.'));
  map.set('genuine-dataset', DATA_SITE_TYPES.has(siteType) || datasetObserved
    ? result('watch', `Dataset-oriented signals are applicable (${datasetObserved ? 'Dataset JSON-LD observed' : `site type ${siteType}`}); verify metadata describes a real reusable corpus.`)
    : result('not-applicable', 'No data-site classification or Dataset JSON-LD was observed in this run.'));
  map.set('relation-truth', DATA_SITE_TYPES.has(siteType)
    ? result('watch', 'For this data/knowledge site, review whether published relationships represent meaningful semantics rather than generated adjacency.')
    : result('watch', 'If entity relationships or graph exports are published, review their semantic truth; public HTML alone cannot prove this.'));

  map.set('crawler-purpose-split', result('watch', `Observed root policy states: Googlebot=${google.status}, OAI-SearchBot=${oai.status}, GPTBot=${gptbot.status}. Confirm answer/search retrieval and model-training policy separately.`, [robots.url]));
  map.set('real-agent-surface', llms?.ok
    ? result('watch', 'A scoped llms.txt was observed. Confirm every declared content/capability surface is real and useful; existence alone is not conformance.', [llms.url])
    : result('watch', 'No scoped llms.txt was observed. Agent-specific files are optional; add only real useful surfaces.'));
  map.set('runtime-evidence', result('owner-data', 'Runtime MCP/A2A/WebMCP/tool claims require runtime receipts/evals; static HTTP evidence is insufficient.'));
  map.set('semantic-agent-ux', semanticResult);

  for (const id of ['dated-window', 'google-generative-native', 'bing-ai-native', 'ai-referral-attribution', 'crawler-observability', 'task-outcome']) {
    map.set(id, result('owner-data', 'Owner-native measurement evidence is required; public crawling intentionally leaves this unknown.'));
  }
  map.set('provider-local-denominator', result('pass', 'site-gate computes no cross-provider ratios; any later derived ratio must stay within one provider/population/window unless a real join key exists.'));
  map.set('no-cross-provider-conversion', result('pass', 'No Bing/Google/crawler/referral pseudo-conversion rate is computed by this report.'));
  map.set('no-single-ai-score', result('pass', 'No synthetic AI visibility/readiness score exists in the report.'));
  map.set('missing-is-unknown', result('pass', 'Missing provider metrics remain owner-data/unknown; they are never coerced to zero.'));
  map.set('replayable-provenance', result('watch', 'Public evidence URLs are recorded. Preserve provider exports/log locations separately when owner evidence is added.'));

  map.set('predeclared-hypothesis', result('watch', 'Attach one or more Growth hypothesis IDs before reviewing outcome movement.'));
  map.set('bounded-treatment', result('pass', `The generated treatment seed is bounded to ${pages.length} priority URL(s).`, pages.map(page => page.url)));
  map.set('control-or-baseline', result('watch', 'Keep comparable unchanged pages when practical, otherwise preserve a dated pre-change provider baseline.'));
  map.set('success-guardrail-stop', result('watch', 'Define success signals, guardrails and stop conditions before interpreting an experiment.'));

  map.set('page-value-gate', result('watch', `Data-site page-value review remains manual. Site Focus flags: clear-job gaps=${jobMissing ?? 'unknown'}, proof-signal gaps=${proofMissing ?? 'unknown'}.`));
  map.set('deep-discovery-path', deepOrphans === 0
    ? result('pass', 'No orphan candidate was observed inside the bounded priority sample.', pages.map(page => page.url))
    : result('watch', `${deepOrphans ?? 'Unknown number of'} priority sample page(s) appear to lack an inbound link inside the sampled cohort; inspect hub/related-entity paths.`));
  map.set('deep-page-contribution', result('owner-data', 'Measure deep-page exposure, citations, referrals and task outcomes separately; raw page count is not contribution.'));
  map.set('crawl-growth-vs-value', result('owner-data', 'Compare crawl/index growth with useful discovery and task growth; raw crawl or URL growth is not success.'));
  return map;
}

function fallbackForMode(check) {
  if (check.mode === 'owner-data' || check.mode === 'runtime') return result('owner-data', 'This check requires owner/runtime evidence that public site-gate does not fabricate.');
  return result('watch', `No safe automatic decision is defined for ${check.mode}; review the requirement explicitly.`);
}

function inferSiteType(requested, discovery, pages) {
  if (requested && requested !== 'auto') return requested;
  if (pages.some(page => (page.structuredTypes || []).includes('Dataset'))) return 'data-site';
  if ((discovery.sitemapCandidates || 0) >= 50) return 'large-knowledge-site';
  return 'general';
}

function summarizeGates(gates) {
  const counts = Object.fromEntries(STATUS_ORDER.map(status => [status, 0]));
  let p0Failures = 0;
  let p0Watch = 0;
  let p0OwnerData = 0;
  for (const gate of gates) {
    for (const check of gate.checks) {
      counts[check.status] = (counts[check.status] || 0) + 1;
      if (gate.priority === 'P0' && check.status === 'fail') p0Failures += 1;
      if (gate.priority === 'P0' && check.status === 'watch') p0Watch += 1;
      if (gate.priority === 'P0' && check.status === 'owner-data') p0OwnerData += 1;
    }
  }
  return {
    counts,
    p0Failures,
    p0Watch,
    p0OwnerData,
    publicImplementationState: p0Failures ? 'blocked' : (p0Watch ? 'provisional' : 'ready'),
    outcomeInterpretationState: p0Failures || p0Watch || p0OwnerData ? 'blocked' : 'ready'
  };
}

export function buildSiteGateReport({
  inputUrl,
  canonicalUrl,
  requestedSiteType = 'auto',
  discovery,
  pages,
  robots,
  sitemap,
  llms = null,
  focus = null,
  generatedAt = new Date().toISOString(),
  checklist = loadSiteReadinessChecklist()
}) {
  if (!Array.isArray(pages) || pages.length === 0) throw new Error('site-gate requires at least one priority page observation.');
  const siteType = inferSiteType(requestedSiteType, discovery, pages);
  const applicableDataSite = DATA_SITE_TYPES.has(siteType);
  const checkMap = buildCheckMap({ pages, robots, sitemap, focus, llms, siteType });
  const gates = checklist.gates.map(gate => {
    const applicable = !gate.appliesTo || gate.appliesTo.includes(siteType);
    const checks = gate.checks.map(def => {
      const evaluated = applicable ? (checkMap.get(def.id) || fallbackForMode(def)) : result('not-applicable', `Gate does not apply to site type ${siteType}.`);
      return { id: def.id, mode: def.mode, requirement: def.requirement, ...evaluated };
    });
    return {
      id: gate.id,
      priority: gate.priority,
      applicable,
      blocking: gate.priority === 'P0' && checks.some(check => check.status === 'fail'),
      checks
    };
  });
  const cohortUrls = pages.map(page => normalizeUrl(page.url || page.requestedUrl)).filter(Boolean);
  const digest = crypto.createHash('sha256').update(cohortUrls.slice().sort().join('\n')).digest('hex');
  const cohortId = `site-gate-${digest.slice(0, 12)}`;
  const summary = summarizeGates(gates);
  const publicMetrics = {
    candidatesDiscovered: discovery.candidatesDiscovered,
    sitemapCandidates: discovery.sitemapCandidates,
    homepageLinkCandidates: discovery.homepageLinkCandidates,
    priorityPages: pages.length,
    successfulPages: pages.filter(page => page.ok).length,
    noindexPages: pages.filter(page => page.noindex).length,
    sitemapMembers: pages.filter(page => page.sitemapMember === true).length,
    pagesWithStructuredData: pages.filter(page => (page.structuredTypes || []).some(type => type !== '__invalid_jsonld__')).length,
    pagesWithHeadingIds: pages.filter(page => page.headingIds > 0).length
  };
  return {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/site-gate-report.schema.json',
    version: SITE_GATE_VERSION,
    checklistVersion: checklist.version,
    generatedAt,
    inputUrl,
    canonicalUrl,
    siteType,
    siteTypeBasis: requestedSiteType === 'auto'
      ? (siteType === 'data-site' ? 'Dataset JSON-LD observed' : siteType === 'large-knowledge-site' ? '50+ sitemap candidates observed' : 'no data-site threshold observed')
      : 'explicit CLI selection',
    scope: 'Public, bounded Site Readiness Gate. It separates automated failures, manual review, and owner-only evidence. It does not predict rankings, citations or traffic and does not produce a composite readiness/AI score.',
    summary,
    cohort: {
      id: cohortId,
      digestSha256: digest,
      requestedMaxPages: discovery.maxPages,
      selectedPages: cohortUrls.length,
      selectionMethod: 'same-scope homepage links + bounded sitemap discovery; source-priority, path-depth and route-diversity ordering; no demand claim without owner query/page evidence',
      urls: cohortUrls
    },
    discovery,
    publicBaseline: {
      capturedAt: generatedAt,
      cohortId,
      metrics: publicMetrics,
      robots: {
        url: robots.url,
        googlebot: robotsRootAccess(robots.text, 'Googlebot'),
        oaiSearchBot: robotsRootAccess(robots.text, 'OAI-SearchBot'),
        gptBot: robotsRootAccess(robots.text, 'GPTBot')
      },
      sitemap: {
        rootUrl: sitemap.rootUrl,
        sources: sitemap.sources,
        entriesObserved: sitemap.entries.length,
        entriesWithLastmod: sitemap.entries.filter(entry => entry.lastmod).length
      },
      ownerEvidenceState: 'owner-data'
    },
    priorityPages: pages.map(page => ({
      requestedUrl: page.requestedUrl,
      url: page.url,
      ok: page.ok,
      status: page.status,
      canonical: page.canonical || null,
      noindex: Boolean(page.noindex),
      sitemapMember: page.sitemapMember,
      headings: page.headings ?? null,
      headingIds: page.headingIds ?? null,
      semanticLandmark: page.semanticLandmark ?? null,
      structuredTypes: (page.structuredTypes || []).filter(type => type !== '__invalid_jsonld__'),
      jsonLdParseError: (page.structuredTypes || []).includes('__invalid_jsonld__'),
      selection: page.selection
    })),
    siteFocusSignals: focus ? {
      observedSiteThesis: focus.observedSiteThesis,
      metrics: focus.metrics,
      siteFindings: focus.siteFindings
    } : null,
    gates,
    experimentSeed: {
      state: 'proposal',
      cohortId,
      treatmentUrls: cohortUrls,
      hypothesisIds: [],
      changeAt: null,
      baselineWindow: { start: null, end: null, status: 'owner-data' },
      measurementStages: [
        { stage: 'access', evidence: 'crawler/server/edge logs', status: 'owner-data' },
        { stage: 'exposure', evidence: 'Google Generative AI/Search provider-native report', status: 'owner-data' },
        { stage: 'citation', evidence: 'Bing AI Performance citations/cited pages/grounding queries when available', status: 'owner-data' },
        { stage: 'visit', evidence: 'AI referral source/referrer/UTM analytics', status: 'owner-data' },
        { stage: 'task', evidence: 'first-party downstream task/conversion', status: 'owner-data' }
      ],
      guardrails: [
        'Do not treat raw page count, crawl count or index count as an outcome.',
        'Do not divide metrics from unrelated providers/populations.',
        'Do not convert missing owner evidence to zero.',
        'Do not interpret movement causally until a hypothesis, change timestamp and baseline/control are recorded.'
      ],
      provenanceHandoff: {
        status: 'proposal',
        braidGraphContract: 'docs/BRAIDGRAPH.md',
        attachAfter: [
          'Growth hypothesis IDs are selected',
          'a concrete repository transformation/change receipt exists',
          'provider-native or first-party outcome evidence is collected'
        ],
        intendedPath: 'hypothesis/recommendation → transform/change receipt → measurement',
        note: 'site-gate does not mutate BraidGraph by itself because a public readiness crawl is baseline evidence, not proof that a repository change occurred.'
      }
    },
    companionCommands: [
      `arwp audit ${canonicalUrl} --json`,
      `arwp-focus ${canonicalUrl} --max-pages=${discovery.maxPages} --json`,
      'arwp-visibility merge <provider-snapshots...> --json',
      'arwp-visibility funnel <merged-snapshot.json> --json'
    ],
    references: {
      checklist: 'registry/site-readiness-checklist.json',
      measurementOs: 'docs/MEASUREMENT-OS.md',
      measurementPatterns: 'registry/measurement-patterns.json',
      growthExperiments: 'docs/GROWTH-EXPERIMENTS.md'
    },
    guardrails: {
      noCompositeReadinessScore: true,
      noRankingPromise: true,
      missingOwnerDataIsUnknown: true,
      publicCohortIsNotDemandRanking: true,
      dataSiteSpecializationApplied: applicableDataSite
    }
  };
}

export async function siteGate(input, {
  timeoutMs = 8000,
  maxBytes = 512 * 1024,
  maxPages = 30,
  concurrency = 4,
  siteType = 'auto',
  fetchImpl = fetch,
  resolveImpl
} = {}) {
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 50) throw new Error('maxPages must be an integer between 1 and 50.');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10) throw new Error('concurrency must be an integer between 1 and 10.');
  const requested = new URL(input);
  if (requested.protocol !== 'https:') throw new Error('site-gate requires a public HTTPS URL.');
  const network = { timeoutMs, maxBytes, fetchImpl, ...(resolveImpl ? { resolveImpl } : {}) };

  const home = await fetchPublicText(requested.href, {
    ...network,
    accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1',
    userAgent: 'arwp-site-gate/0.1'
  });
  if (!home.ok || !home.text) throw new Error(`Unable to fetch start page: HTTP ${home.status ?? 'unknown'}`);

  const observedHomeCanonical = htmlCanonical(home.text, home.url);
  const canonicalUrl = observedHomeCanonical && new URL(observedHomeCanonical).origin === new URL(home.url).origin
    ? observedHomeCanonical
    : normalizeUrl(home.url);
  const scope = scopeFor(canonicalUrl);
  const robotsUrl = new URL('/robots.txt', scope.origin).href;
  const robotsResponse = await fetchPublicText(robotsUrl, {
    ...network,
    accept: 'text/plain, */*;q=0.1',
    userAgent: 'arwp-site-gate/0.1'
  }).catch(error => ({ ok: false, status: null, url: robotsUrl, text: null, error: String(error.message ?? error) }));
  const robots = { url: robotsUrl, text: robotsResponse?.ok ? robotsResponse.text : '', ok: Boolean(robotsResponse?.ok), status: robotsResponse?.status ?? null };

  const declaredSitemaps = robotsSitemaps(robots.text, robotsUrl).filter(url => {
    try { return new URL(url).origin === scope.origin; } catch { return false; }
  });
  const conventionalSitemap = new URL('sitemap.xml', `${scope.origin}${scope.pathPrefix}`).href;
  const sitemapRoot = declaredSitemaps.find(url => inScope(url, scope)) || declaredSitemaps[0] || conventionalSitemap;
  const sitemap = await collectSitemap(sitemapRoot, network);
  const sitemapSet = new Set(sitemap.entries.map(entry => normalizeUrl(entry.url)).filter(Boolean));

  const candidates = new Map();
  const add = (value, source) => {
    const url = normalizeUrl(value);
    if (!url || !isPageCandidate(url, scope)) return;
    const item = candidates.get(url) || { url, sources: new Set() };
    item.sources.add(source);
    candidates.set(url, item);
  };
  add(canonicalUrl, 'start');
  for (const link of anchors(home.text, home.url)) add(link.url, 'homepage-link');
  for (const entry of sitemap.entries) add(entry.url, 'sitemap');

  const selection = selectPriorityCandidates(candidates, scope, maxPages);
  const responses = await mapLimit(selection.selected, concurrency, async candidate => {
    if (normalizeUrl(candidate.url) === normalizeUrl(home.url) || normalizeUrl(candidate.url) === normalizeUrl(canonicalUrl)) {
      return { candidate, response: home };
    }
    const response = await fetchPublicText(candidate.url, {
      ...network,
      accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1',
      userAgent: 'arwp-site-gate/0.1'
    }).catch(error => ({ ok: false, status: null, url: candidate.url, text: null, error: String(error.message ?? error) }));
    return { candidate, response };
  });
  const pageObservations = responses.map(({ candidate, response }) => observeFetchedPage(candidate, response, scope, sitemapSet));

  const focusPages = pageObservations.filter(page => page.ok && page._html).map(page => ({ url: page.url, html: page._html, status: page.status }));
  let focus = null;
  if (focusPages.length) {
    try {
      focus = buildSiteFocusReportFromPages(focusPages, {
        canonicalUrl,
        discovery: { mode: 'site-gate', pagesObserved: focusPages.length, maxPages }
      });
    } catch {
      focus = null;
    }
  }

  const llmsUrl = new URL('llms.txt', `${scope.origin}${scope.pathPrefix}`).href;
  const llms = await fetchPublicText(llmsUrl, {
    ...network,
    accept: 'text/plain, text/markdown;q=0.9, */*;q=0.1',
    userAgent: 'arwp-site-gate/0.1'
  }).catch(() => null);

  const reportPages = pageObservations.map(page => {
    const copy = { ...page };
    delete copy._html;
    return copy;
  });
  return buildSiteGateReport({
    inputUrl: requested.href,
    canonicalUrl,
    requestedSiteType: siteType,
    discovery: {
      mode: 'live',
      scope,
      maxPages,
      concurrency,
      maxBytesPerPage: maxBytes,
      timeoutMs,
      candidatesDiscovered: selection.all.length,
      sitemapCandidates: selection.all.filter(item => item.sources.includes('sitemap')).length,
      homepageLinkCandidates: selection.all.filter(item => item.sources.includes('homepage-link')).length,
      sitemapRoot,
      sitemapSourcesFetched: sitemap.sources.length,
      selectionPreview: selection.selected.map(item => ({ url: item.url, score: item.score, segment: item.segment, sources: item.sources }))
    },
    pages: reportPages,
    robots,
    sitemap,
    llms: llms ? { ok: Boolean(llms.ok), status: llms.status ?? null, url: llms.url || llmsUrl } : { ok: false, status: null, url: llmsUrl },
    focus
  });
}

export function formatSiteGateReport(report) {
  const lines = [
    `ARWP Site Readiness Gate v${report.version} — ${report.canonicalUrl}`,
    `Site type: ${report.siteType} (${report.siteTypeBasis})`,
    `Priority cohort: ${report.cohort.selectedPages} page(s), ${report.cohort.id}`,
    `Public implementation: ${report.summary.publicImplementationState}; outcome interpretation: ${report.summary.outcomeInterpretationState}`,
    `P0: fail=${report.summary.p0Failures}, watch=${report.summary.p0Watch}, owner-data=${report.summary.p0OwnerData}`,
    'No composite readiness/AI score.',
    ''
  ];
  for (const gate of report.gates) {
    lines.push(`${gate.priority} ${gate.id}${gate.applicable ? '' : ' [not applicable]'}`);
    for (const check of gate.checks) {
      lines.push(`  ${check.status.toUpperCase().padEnd(14)} ${check.id} — ${check.message}`);
    }
  }
  lines.push('', 'Next measurement chain: access → exposure → citation → visit → task.');
  lines.push(`Experiment seed: ${report.experimentSeed.cohortId}; hypothesis IDs and owner baselines are intentionally empty until supplied.`);
  return lines.join('\n');
}
