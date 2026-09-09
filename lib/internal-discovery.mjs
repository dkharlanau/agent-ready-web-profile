import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { fetchPublicText } from './public-fetch.mjs';
import { siteGate } from './site-gate.mjs';

export const INTERNAL_DISCOVERY_VERSION = '0.1';
export const INTERNAL_DISCOVERY_MAX_LINKS_PER_PAGE = 1000;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'internal-discovery-report.schema.json');
const GOOGLE_LINK_SOURCE = 'https://developers.google.com/search/docs/crawling-indexing/links-crawlable';
const GOOGLE_MOVE_SOURCE = 'https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes';
const ACTION_TEXT = /\b(start|try|run|open|use|practice|test|check|scan|calculate|download|book|buy|contact|search|explore)\b/i;
const HUB_MARKER = /\b(breadcrumb|related|topic|topics|category|categories|collection|cluster|hub|more-like|recommended)\b/i;
const STRUCTURAL = new Set(['nav', 'header', 'footer', 'main', 'article', 'aside', 'section']);

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

export function validateInternalDiscoveryReport(report) {
  const validate = validator();
  const valid = Boolean(validate(report));
  return { valid, errors: validate.errors || [] };
}

function mediaType(value) {
  return String(value || '').split(';', 1)[0].trim().toLowerCase();
}

function isHtml(value) {
  return ['text/html', 'application/xhtml+xml'].includes(mediaType(value));
}

function normalizeUrl(value, base = null) {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function cleanText(value) {
  return String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
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

function canonicalFromHtml(html, base) {
  const head = String(html || '').match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  for (const tag of head.match(/<link\b[^>]*>/gi) || []) {
    const a = attrs(tag);
    const rel = String(a.rel || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (rel.includes('canonical') && a.href) return normalizeUrl(a.href, base);
  }
  return null;
}

function noindexFromPage(html, headers = {}) {
  const values = [];
  for (const tag of String(html || '').match(/<meta\b[^>]*>/gi) || []) {
    const a = attrs(tag);
    const name = String(a.name || '').toLowerCase();
    if (name === 'robots' || name === 'googlebot') values.push(String(a.content || ''));
  }
  values.push(String(headers?.xRobotsTag || ''));
  return values.some(value => value.toLowerCase().split(/[,;]/).some(token => token.trim() === 'noindex'));
}

function containerSignal(stack) {
  const semanticHub = stack.some(item => HUB_MARKER.test(`${item.attrs.id || ''} ${item.attrs.class || ''} ${item.attrs['aria-label'] || ''} ${item.attrs.role || ''}`));
  if (semanticHub) return { linkClass: 'hub', classEvidence: 'semantic-container' };
  if (stack.some(item => item.name === 'nav' || item.name === 'header' || item.name === 'footer')) {
    return { linkClass: 'global', classEvidence: 'structural-container' };
  }
  if (stack.some(item => ['main', 'article', 'section', 'aside'].includes(item.name))) {
    return { linkClass: 'contextual', classEvidence: 'structural-container' };
  }
  return { linkClass: 'unclassified', classEvidence: 'unclassified' };
}

function extractInternalAnchors(html, base, origin, maxLinks = INTERNAL_DISCOVERY_MAX_LINKS_PER_PAGE) {
  const stack = [];
  const links = [];
  let truncated = false;
  const token = /<!--[\s\S]*?(?:-->|$)|<\/?[a-z][a-z0-9:-]*\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
  let match;
  while ((match = token.exec(String(html || '')))) {
    if (match[0].startsWith('<!--')) continue;
    const tag = match[0].match(/^<(\/)?([a-z0-9:-]+)\b([\s\S]*?)>$/i);
    if (!tag) continue;
    const closing = Boolean(tag[1]);
    const name = tag[2].toLowerCase();
    if (closing) {
      if (STRUCTURAL.has(name)) {
        for (let i = stack.length - 1; i >= 0; i -= 1) {
          if (stack[i].name === name) { stack.splice(i, 1); break; }
        }
      }
      continue;
    }
    const a = attrs(tag[3]);
    if (STRUCTURAL.has(name) && !/\/\s*>$/.test(match[0])) stack.push({ name, attrs: a });
    if (name !== 'a') continue;
    const rawHref = String(a.href || '').trim();
    if (!rawHref || /^(?:javascript:|data:|mailto:|tel:)/i.test(rawHref)) continue;
    const target = normalizeUrl(rawHref, base);
    if (!target) continue;
    let parsed;
    try { parsed = new URL(target); } catch { continue; }
    if (parsed.origin !== origin) continue;
    const closeStart = String(html || '').toLowerCase().indexOf('</a', token.lastIndex);
    const inner = closeStart >= 0 ? String(html || '').slice(token.lastIndex, closeStart) : '';
    const anchorText = cleanText(inner).slice(0, 500) || null;
    let classification = containerSignal(stack);
    if (classification.linkClass === 'contextual' || classification.linkClass === 'unclassified') {
      if (anchorText && ACTION_TEXT.test(anchorText)) classification = { linkClass: 'utility', classEvidence: 'derived-action-text' };
    }
    links.push({ to: target, anchorText, ...classification });
    if (links.length >= maxLinks) { truncated = true; break; }
  }
  return { links, truncated };
}

function observePage(raw, canonicalRoot) {
  const requestedUrl = normalizeUrl(raw.requestedUrl || raw.url) || String(raw.requestedUrl || raw.url);
  const finalUrl = normalizeUrl(raw.url || raw.requestedUrl) || requestedUrl;
  const status = raw.status ?? null;
  const htmlLike = raw.ok && raw.html != null && isHtml(raw.contentType || 'text/html');
  if (!raw.ok || !htmlLike) {
    return {
      requestedUrl, url: finalUrl, status, contentType: raw.contentType || null, nodeClass: 'unknown', canonical: null,
      noindex: false, redirected: requestedUrl !== finalUrl, evidence: [raw.ok ? 'non-html-representation' : 'bounded-fetch-unavailable'],
      _html: null, _links: [], _truncated: false
    };
  }
  const canonical = canonicalFromHtml(raw.html, finalUrl);
  const noindex = noindexFromPage(raw.html, raw.headers || {});
  const redirected = requestedUrl !== finalUrl;
  let nodeClass = 'canonical-owner';
  const evidence = [];
  if (redirected) { nodeClass = 'redirect-alias'; evidence.push(`requested-url-resolved-to:${finalUrl}`); }
  else if (noindex) { nodeClass = 'non-indexable-state'; evidence.push('noindex-observed'); }
  else if (canonical && normalizeUrl(canonical) !== normalizeUrl(finalUrl)) { nodeClass = 'canonical-alias'; evidence.push(`canonical-points-to:${canonical}`); }
  else {
    evidence.push(canonical ? 'self-canonical-or-equivalent-observed' : 'no-conflicting-canonical-observed');
    if (normalizeUrl(finalUrl) === normalizeUrl(canonicalRoot)) evidence.push('cohort-root');
  }
  const origin = new URL(canonicalRoot).origin;
  const extraction = extractInternalAnchors(raw.html, finalUrl, origin, raw.maxLinksPerPage || INTERNAL_DISCOVERY_MAX_LINKS_PER_PAGE);
  if (extraction.truncated) evidence.push(`internal-anchor-observation-capped-at:${raw.maxLinksPerPage || INTERNAL_DISCOVERY_MAX_LINKS_PER_PAGE}`);
  return {
    requestedUrl, url: finalUrl, status, contentType: raw.contentType || null, nodeClass, canonical, noindex, redirected,
    evidence: [...new Set(evidence)], _html: raw.html, _links: extraction.links, _truncated: extraction.truncated
  };
}

function dedupeEdges(edges) {
  const map = new Map();
  for (const edge of edges) {
    const key = `${edge.from}\n${edge.to}\n${edge.linkClass}`;
    if (!map.has(key)) map.set(key, edge);
  }
  return [...map.values()];
}

function action(id, priority, url, title, reason, verification, source = GOOGLE_LINK_SOURCE) {
  return {
    id, priority, status: 'review', url, title, reason, verification, source,
    doesNotProve: 'Changing internal links does not by itself prove improved crawling, indexing, ranking, AI citation, traffic or conversion.'
  };
}

export function analyzeInternalDiscoveryFromPages({ canonicalUrl, pages, cohort = null, generatedAt = new Date().toISOString() }) {
  const rootUrl = normalizeUrl(canonicalUrl);
  if (!rootUrl || !rootUrl.startsWith('https://')) throw new Error('canonicalUrl must be a public HTTPS URL.');
  if (!Array.isArray(pages) || !pages.length) throw new Error('pages must be a non-empty bounded page array.');
  if (pages.length > 50) throw new Error('internal discovery supports at most 50 reviewed pages.');
  const observed = pages.map(page => observePage(page, rootUrl));
  const owners = observed.filter(node => node.nodeClass === 'canonical-owner');
  const ownersByUrl = new Map(owners.map(node => [normalizeUrl(node.url), node]));
  const nodesByAnyUrl = new Map();
  for (const node of observed) {
    nodesByAnyUrl.set(normalizeUrl(node.requestedUrl), node);
    nodesByAnyUrl.set(normalizeUrl(node.url), node);
  }
  const rawEdges = [];
  for (const node of owners) {
    for (const link of node._links) {
      const target = normalizeUrl(link.to);
      const targetNode = nodesByAnyUrl.get(target);
      let targetState = 'out-of-cohort';
      if (targetNode?.nodeClass === 'canonical-owner') targetState = 'canonical-owner';
      else if (targetNode && targetNode.nodeClass !== 'unknown') targetState = 'transition';
      else if (targetNode?.nodeClass === 'unknown') targetState = 'unknown';
      rawEdges.push({
        from: node.url, to: target, targetState, linkClass: link.linkClass, classEvidence: link.classEvidence,
        anchorText: link.anchorText, crawlable: true, sameOrigin: true
      });
    }
  }
  const edges = dedupeEdges(rawEdges);
  if (edges.length > 50000) throw new Error('bounded internal discovery edge limit exceeded. Reduce the page cohort.');

  const ownerEdges = edges.filter(edge => edge.targetState === 'canonical-owner' && ownersByUrl.has(normalizeUrl(edge.from)));
  const incoming = new Map(owners.map(node => [normalizeUrl(node.url), []]));
  const outgoing = new Map(owners.map(node => [normalizeUrl(node.url), []]));
  for (const edge of ownerEdges) {
    incoming.get(normalizeUrl(edge.to))?.push(edge);
    outgoing.get(normalizeUrl(edge.from))?.push(edge);
  }
  const truncatedOwners = owners.filter(node => node._truncated);
  const gapEvaluationState = truncatedOwners.length ? 'partial' : 'complete';
  const rootKey = normalizeUrl(rootUrl);
  const withoutInbound = gapEvaluationState === 'complete'
    ? owners.filter(node => normalizeUrl(node.url) !== rootKey && (incoming.get(normalizeUrl(node.url)) || []).length === 0).map(node => node.url)
    : [];
  const globalOnlyInbound = gapEvaluationState === 'complete'
    ? owners.filter(node => {
      if (normalizeUrl(node.url) === rootKey) return false;
      const list = incoming.get(normalizeUrl(node.url)) || [];
      return list.length > 0 && list.every(edge => edge.linkClass === 'global');
    }).map(node => node.url)
    : [];
  const withoutContinuation = owners.filter(node => {
    if (node._truncated) return false;
    const list = outgoing.get(normalizeUrl(node.url)) || [];
    return !list.some(edge => ['contextual', 'hub', 'utility'].includes(edge.linkClass) && normalizeUrl(edge.to) !== normalizeUrl(node.url));
  }).map(node => node.url);
  const transitionTargets = [...new Set(edges.filter(edge => edge.targetState === 'transition').map(edge => edge.to))];
  const unknownPages = observed.filter(node => node.nodeClass === 'unknown').map(node => node.url);

  const actions = [];
  for (const url of withoutInbound) actions.push(action(
    `internal-discovery:inbound:${Buffer.from(url).toString('base64url').slice(0, 20)}`, 'P1', url,
    'Review a missing inbound crawlable path',
    'No other canonical owner in the complete bounded cohort linked to this page. Google recommends that every page you care about have a link from at least one other page on the site.',
    'Add a useful crawlable link from a relevant canonical owner or hub only when it helps the reader, then rerun the same bounded cohort.'
  ));
  for (const url of globalOnlyInbound) actions.push(action(
    `internal-discovery:context:${Buffer.from(url).toString('base64url').slice(0, 20)}`, 'P2', url,
    'Review global-only discovery',
    'The bounded cohort reaches this owner only through global navigation. This is not a crawl failure, but it provides weaker topic/job context than a useful in-context relationship.',
    'Review whether another page genuinely benefits from an in-context link to this owner; do not inject sitewide links merely to improve a count.'
  ));
  for (const url of withoutContinuation) actions.push(action(
    `internal-discovery:continuation:${Buffer.from(url).toString('base64url').slice(0, 20)}`, 'P2', url,
    'Review missing contextual continuation',
    'No contextual, hub or utility edge from this canonical owner to another owner was observed in the bounded HTML graph.',
    'Confirm whether the page is intentionally terminal. If not, add only a useful next-step, related evidence, hub or product-action link and remeasure separately from Search outcomes.'
  ));
  for (const url of transitionTargets.slice(0, 20)) actions.push(action(
    `internal-discovery:transition:${Buffer.from(url).toString('base64url').slice(0, 20)}`, 'P2', url,
    'Review internal links that target an alias/state',
    'At least one canonical owner links to a sampled redirect, canonical alias or non-indexable state rather than directly to a canonical owner.',
    'Verify the transition is intentional. When a stable canonical destination exists, prefer updating internal links to the final intended URL rather than relying on a transition.',
    GOOGLE_MOVE_SOURCE
  ));

  const publicNodes = observed.map(node => ({
    requestedUrl: node.requestedUrl, url: node.url, status: node.status, contentType: node.contentType,
    nodeClass: node.nodeClass, canonical: node.canonical, noindex: node.noindex, redirected: node.redirected, evidence: node.evidence
  }));
  const linkCount = name => ownerEdges.filter(edge => edge.linkClass === name).length;
  const summary = {
    reviewedPages: observed.length,
    canonicalOwners: owners.length,
    redirectAliases: observed.filter(node => node.nodeClass === 'redirect-alias').length,
    canonicalAliases: observed.filter(node => node.nodeClass === 'canonical-alias').length,
    nonIndexableStates: observed.filter(node => node.nodeClass === 'non-indexable-state').length,
    unknownNodes: observed.filter(node => node.nodeClass === 'unknown').length,
    ownerEdges: ownerEdges.length,
    contextualOwnerEdges: linkCount('contextual'),
    hubOwnerEdges: linkCount('hub'),
    utilityOwnerEdges: linkCount('utility'),
    globalOwnerEdges: linkCount('global'),
    unclassifiedOwnerEdges: linkCount('unclassified'),
    transitionEdges: edges.filter(edge => edge.targetState === 'transition').length,
    outOfCohortInternalEdges: edges.filter(edge => edge.targetState === 'out-of-cohort').length,
    ownersWithoutInbound: withoutInbound.length,
    ownersWithGlobalOnlyInbound: globalOnlyInbound.length,
    ownersWithoutContinuation: withoutContinuation.length,
    truncatedPages: observed.filter(node => node._truncated).length,
    gapEvaluationState
  };
  const report = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/internal-discovery-report.schema.json',
    version: INTERNAL_DISCOVERY_VERSION,
    generatedAt: new Date(generatedAt).toISOString(),
    canonicalUrl: rootUrl,
    scope: `Bounded rendered-HTML internal discovery evidence. Canonical-owner graph edges are deduplicated by source, target and class. Raw HTML structural classification is a review heuristic. At most ${INTERNAL_DISCOVERY_MAX_LINKS_PER_PAGE} same-origin anchors are observed per page; if any owner is truncated, inbound gap evaluation becomes partial rather than silently treating missing edges as absence.`,
    cohort: cohort || {
      id: null, digestSha256: null, selectedPages: observed.length,
      urls: observed.map(node => node.requestedUrl),
      selectionMethod: 'caller-supplied bounded page observations'
    },
    summary,
    nodes: publicNodes,
    edges,
    gaps: { withoutInbound, globalOnlyInbound, withoutContinuation, transitionTargets, unknownPages },
    actions,
    sources: [GOOGLE_LINK_SOURCE, GOOGLE_MOVE_SOURCE],
    guardrails: {
      noCompositeScore: true,
      noPageRankApproximation: true,
      noRankingPromise: true,
      boundedCohortNotWholeSite: true,
      rawHtmlRegionClassificationIsHeuristic: true,
      redirectsNotContentNodes: true,
      unknownRemainsUnknown: true,
      linkCountNotCausality: true
    }
  };
  const validation = validateInternalDiscoveryReport(report);
  if (!validation.valid) throw new Error(`Generated internal discovery report is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return report;
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

export async function internalDiscovery(input, {
  maxPages = 20,
  concurrency = 4,
  timeoutMs = 8000,
  maxBytes = 512 * 1024,
  fetchImpl = fetch,
  resolveImpl
} = {}) {
  const gate = await siteGate(input, { maxPages, concurrency, timeoutMs, maxBytes, fetchImpl, ...(resolveImpl ? { resolveImpl } : {}) });
  const network = { timeoutMs, maxBytes, fetchImpl, ...(resolveImpl ? { resolveImpl } : {}) };
  const pages = await mapLimit(gate.cohort.urls, concurrency, async requestedUrl => {
    const response = await fetchPublicText(requestedUrl, {
      ...network,
      accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1',
      userAgent: 'goose-internal-discovery/0.1'
    }).catch(error => ({ ok: false, status: null, url: requestedUrl, text: null, headers: {}, contentType: null, error: String(error.message ?? error) }));
    return {
      requestedUrl,
      url: response?.url || requestedUrl,
      ok: Boolean(response?.ok),
      status: response?.status ?? null,
      contentType: response?.contentType || null,
      headers: response?.headers || {},
      html: response?.text ?? null,
      maxLinksPerPage: INTERNAL_DISCOVERY_MAX_LINKS_PER_PAGE
    };
  });
  return analyzeInternalDiscoveryFromPages({
    canonicalUrl: gate.canonicalUrl,
    pages,
    cohort: {
      id: gate.cohort.id || null,
      digestSha256: gate.cohort.digestSha256 || null,
      selectedPages: gate.cohort.selectedPages,
      urls: gate.cohort.urls,
      selectionMethod: gate.cohort.selectionMethod
    }
  });
}

export function formatInternalDiscoveryReport(report) {
  const s = report.summary;
  const lines = [
    `Goose Internal Discovery v${report.version} — ${report.canonicalUrl}`,
    `Owners ${s.canonicalOwners}/${s.reviewedPages}; owner edges=${s.ownerEdges}; contextual=${s.contextualOwnerEdges}; hub=${s.hubOwnerEdges}; utility=${s.utilityOwnerEdges}; global=${s.globalOwnerEdges}`,
    `Gaps: inbound=${s.ownersWithoutInbound}; global-only inbound=${s.ownersWithGlobalOnlyInbound}; no continuation=${s.ownersWithoutContinuation}; transitions=${s.transitionEdges}; gap evaluation=${s.gapEvaluationState}`,
    'No PageRank, authority, SEO or readiness score.',
    ''
  ];
  for (const item of report.actions.slice(0, 30)) lines.push(`${item.priority} REVIEW ${item.title} — ${item.url}`);
  if (report.actions.length > 30) lines.push(`... ${report.actions.length - 30} more review action(s)`);
  lines.push('', 'Link classes and graph gaps are bounded implementation evidence. Search/AI/user outcomes remain separate measurements.');
  return lines.join('\n');
}
