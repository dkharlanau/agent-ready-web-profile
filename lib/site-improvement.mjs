import { fetchPublicText } from './public-fetch.mjs';
import { buildGrowthPlan } from './growth-plan.mjs';
import { analyzeEntityGraphSite } from './entity-gap.mjs';
import { buildEntityRemediationManifest } from './entity-remediation.mjs';

export const SITE_IMPROVEMENT_VERSION = '0.1';
const PRIORITY = { P0: 0, P1: 1, P2: 2, P3: 3 };
const EVIDENCE = { 'grounded-first-party': 0, 'direct-observation': 1, 'source-backed': 2, 'manual-review': 3, advisory: 4 };
const GENERIC_ANCHORS = new Set(['click here', 'learn more', 'read more', 'more', 'here', 'details']);

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

function canonicalFromHtml(html, base) {
  for (const tag of String(html || '').match(/<link\b[^>]*>/gi) ?? []) {
    const a = attrs(tag);
    if (String(a.rel || '').toLowerCase().split(/\s+/).includes('canonical') && a.href) return resolve(a.href, base);
  }
  return null;
}

function pageSignals(page) {
  const html = String(page.html || '');
  const title = norm(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, ' '));
  const h1Count = (html.match(/<h1\b[^>]*>/gi) ?? []).length;
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] || '';
  const lang = attrs(htmlTag).lang || null;
  const canonicalUrl = canonicalFromHtml(html, page.url);
  const links = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html))) {
    const a = attrs(`<a ${match[1]}>`);
    const url = resolve(a.href, page.url);
    if (!url) continue;
    links.push({ url: normalizedPageUrl(url), text: norm(match[2].replace(/<[^>]+>/g, ' ')) });
  }
  return { ...page, url: normalizedPageUrl(page.url), canonicalUrl: normalizedPageUrl(canonicalUrl), title, h1Count, lang, links };
}

function pageAction(id, priority, lane, title, reason, page, extra = {}) {
  return {
    id, priority, lane, title, reason,
    evidenceClass: 'direct-observation',
    evidence: [page.url],
    verification: extra.verification || ['Re-fetch the canonical page and verify the observed condition is resolved.'],
    measurement: extra.measurement || ['Track page-level Search Console impressions and clicks after deployment; do not infer causality from a single change.'],
    target: extra.target || { url: page.url },
    proposal: extra.proposal || null
  };
}

export function analyzePageGraphPages(inputPages, { canonicalUrl = inputPages?.[0]?.url || null } = {}) {
  if (!Array.isArray(inputPages) || !inputPages.length) throw new Error('pages must be a non-empty array.');
  const pages = inputPages.map(pageSignals).filter(page => page.url);
  const pageSet = new Set(pages.map(page => page.url));
  const incoming = new Map(pages.map(page => [page.url, []]));
  const genericByTarget = new Map();
  for (const page of pages) {
    for (const link of page.links) {
      if (!link.url || !pageSet.has(link.url) || link.url === page.url) continue;
      incoming.get(link.url)?.push({ from: page.url, text: link.text });
      if (GENERIC_ANCHORS.has(link.text.toLowerCase())) {
        const list = genericByTarget.get(link.url) || [];
        list.push({ from: page.url, text: link.text });
        genericByTarget.set(link.url, list);
      }
    }
  }

  const actions = [];
  const titles = new Map();
  for (const page of pages) {
    if (!page.canonicalUrl) actions.push(pageAction(`page:canonical:${page.url}`, 'P1', 'technical-search', 'Add or repair the canonical URL', 'No crawlable canonical link was observed on the sampled page.', page));
    if (!page.title) actions.push(pageAction(`page:title:${page.url}`, 'P1', 'content-semantics', 'Publish a descriptive HTML title', 'No non-empty <title> was observed.', page));
    if (!page.h1Count) actions.push(pageAction(`page:h1:${page.url}`, 'P2', 'content-semantics', 'Expose a visible primary heading', 'No <h1> was observed in the sampled HTML.', page));
    else if (page.h1Count > 1) actions.push(pageAction(`page:h1-multiple:${page.url}`, 'P2', 'content-semantics', 'Review primary heading hierarchy', `${page.h1Count} <h1> elements were observed; review whether one primary page heading better represents the page.`, page));
    if (!page.lang) actions.push(pageAction(`page:lang:${page.url}`, 'P2', 'content-semantics', 'Declare the page language', 'No html[lang] value was observed.', page));
    if (page.title) {
      const key = page.title.toLowerCase();
      const list = titles.get(key) || [];
      list.push(page);
      titles.set(key, list);
    }
  }

  for (const group of titles.values()) {
    if (group.length < 2) continue;
    for (const page of group) actions.push(pageAction(`page:duplicate-title:${page.url}`, 'P1', 'content-semantics', 'Differentiate duplicate page titles', `The title “${page.title}” is shared by ${group.length} sampled pages.`, page, { evidence: group.map(item => item.url) }));
  }

  const root = normalizedPageUrl(canonicalUrl);
  for (const page of pages) {
    const inbound = incoming.get(page.url) || [];
    if (page.url !== root && inbound.length === 0) {
      actions.push(pageAction(`link:inbound:${page.url}`, 'P2', 'internal-links', 'Add a contextual internal path to this page', 'No inbound internal link from another sampled page was observed. Sitemap discovery alone is not treated as sufficient contextual linking.', page, {
        verification: ['Re-run the bounded page graph and confirm at least one relevant sampled page links to this canonical URL with meaningful anchor text.'],
        measurement: ['Track crawl/index coverage and page-level impressions/clicks; treat movement as observational evidence, not proof of ranking causality.']
      }));
    }
  }
  for (const [target, links] of genericByTarget) {
    const page = pages.find(item => item.url === target);
    if (!page) continue;
    actions.push(pageAction(`link:anchor:${target}`, 'P2', 'internal-links', 'Use descriptive internal anchor text', `${links.length} sampled internal link(s) use generic anchor text for this target.`, page, {
      evidence: links.map(item => item.from),
      verification: ['Re-run the bounded page graph and confirm contextual links use anchor text that identifies the destination purpose.']
    }));
  }

  return {
    reportVersion: '0.1',
    canonicalUrl: root,
    scope: 'bounded-page-content-and-internal-link-observations',
    pages: pages.map(page => ({ url: page.url, canonicalUrl: page.canonicalUrl, title: page.title, h1Count: page.h1Count, lang: page.lang, inboundLinksObserved: (incoming.get(page.url) || []).length })),
    actions,
    summary: {
      pagesObserved: pages.length,
      actions: actions.length,
      byLane: actions.reduce((acc, action) => (acc[action.lane] = (acc[action.lane] || 0) + 1, acc), {})
    },
    guardrails: {
      boundedSampleNotFullCrawler: true,
      noWordCountQualityScore: true,
      noUniversalInternalLinkQuota: true,
      sitemapOnlyDoesNotProveOrphanStatus: true
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
  return [...String(xml || '').matchAll(/<loc\b[^>]*>([^<]+)<\/loc>/gi)].map(match => resolve(match[1].trim(), base)).filter(Boolean);
}

export async function analyzePageGraphSite(input, { timeoutMs = 8000, maxBytes = 256 * 1024, maxPages = 12, fetchImpl = fetch, resolveImpl } = {}) {
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 50) throw new Error('maxPages must be an integer between 1 and 50.');
  const start = new URL(input);
  if (start.protocol !== 'https:') throw new Error('Page graph analysis requires a public HTTPS URL.');
  const scope = scopeFor(start.href);
  const network = { timeoutMs, maxBytes, fetchImpl, ...(resolveImpl ? { resolveImpl } : {}) };
  const home = await fetchPublicText(start.href, { ...network, accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1', userAgent: 'arwp-improve/0.1' });
  if (!home.ok || !home.text) throw new Error(`Unable to fetch start page: HTTP ${home.status ?? 'unknown'}`);
  const first = pageSignals({ url: home.url, html: home.text, status: home.status });
  const candidates = new Set([first.url]);
  for (const link of first.links) if (link.url) {
    const target = new URL(link.url);
    if (target.origin === scope.origin && target.pathname.startsWith(scope.pathPrefix)) candidates.add(link.url);
  }
  const sitemapUrl = new URL('sitemap.xml', scope.origin + scope.pathPrefix).href;
  const sitemap = await fetchPublicText(sitemapUrl, { ...network, accept: 'application/xml, text/xml;q=0.9, */*;q=0.1', userAgent: 'arwp-improve/0.1' }).catch(() => null);
  if (sitemap?.ok && sitemap.text) for (const value of sitemapUrls(sitemap.text, sitemapUrl)) {
    const target = new URL(value);
    if (target.origin === scope.origin && target.pathname.startsWith(scope.pathPrefix)) candidates.add(normalizedPageUrl(value));
  }
  const pages = [{ url: home.url, html: home.text, status: home.status }];
  for (const url of [...candidates].filter(Boolean).sort().slice(0, maxPages)) {
    if (url === first.url) continue;
    const response = await fetchPublicText(url, { ...network, accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1', userAgent: 'arwp-improve/0.1' }).catch(() => null);
    if (response?.ok && response.text && /html|xhtml/i.test(String(response.contentType || 'text/html'))) pages.push({ url: response.url || url, html: response.text, status: response.status });
    if (pages.length >= maxPages) break;
  }
  const report = analyzePageGraphPages(pages, { canonicalUrl: first.canonicalUrl || first.url });
  report.discovery = { startUrl: input, sitemap: sitemap?.ok ? sitemapUrl : null, candidates: candidates.size, maxPages, maxBytesPerPage: maxBytes, timeoutMs };
  return report;
}

function verificationFor(lane, fallback = []) {
  if (fallback?.length) return fallback;
  if (lane === 'internal-links') return ['Re-run the bounded page graph and verify the intended internal path is visible and crawlable.'];
  if (lane === 'entity-graph') return ['Re-run Entity Graph Gap Report and confirm the specific gap is resolved without creating new identity conflicts.'];
  return ['Re-run the originating ARWP audit after deployment and preserve before/after evidence.'];
}

function measurementFor(lane, target) {
  const page = target?.url || null;
  if (lane === 'internal-links' || lane === 'content-semantics' || lane === 'technical-search') return [
    `Search Console page/query impressions and clicks${page ? ` for ${page}` : ''}`,
    'crawl/index coverage where applicable',
    'compare against a pre-change baseline; do not infer causality from rank movement alone'
  ];
  if (lane === 'entity-graph') return ['structured-data validation after deployment', 'page/query impressions and clicks for the affected entity page', 'AI/search citation evidence only when owner-side data is available'];
  return ['the measurement refs from the originating Growth action', 'owner-side Search/AI evidence when available', 'record keep/revise/revert after an observation window'];
}

function fromGrowth(action) {
  return {
    id: `growth:${action.id}`,
    sourceKind: 'growth',
    priority: action.priority || 'P2',
    lane: action.lane || 'growth',
    title: action.title || action.id,
    reason: action.reason || '',
    evidenceClass: 'source-backed',
    evidence: action.evidence || [],
    target: action.implementation || null,
    proposal: action.implementation || null,
    verification: verificationFor(action.lane),
    measurement: action.measurementRefs || measurementFor(action.lane, action.implementation),
    dependencies: []
  };
}

function fromEntity(item) {
  const grounded = item.disposition === 'grounded-json-patch-proposal' || item.disposition === 'grounded-structured-data-proposal';
  const direct = item.disposition === 'verify-deployment';
  return {
    id: `entity:${item.gapId}`,
    sourceKind: 'entity-remediation',
    priority: item.priority || 'P2',
    lane: 'entity-graph',
    title: item.problem || item.gapId,
    reason: item.recommendation || item.problem || '',
    evidenceClass: grounded ? 'grounded-first-party' : direct ? 'direct-observation' : 'manual-review',
    evidence: item.evidence || [],
    target: item.target || { entityId: item.entityId },
    proposal: item.proposal || null,
    verification: verificationFor('entity-graph'),
    measurement: measurementFor('entity-graph', item.target),
    dependencies: grounded ? ['human-review-visible-fact-parity'] : ['human-review']
  };
}

function fromPage(action) {
  return { ...action, sourceKind: 'page-graph', dependencies: [], measurement: action.measurement || measurementFor(action.lane, action.target) };
}

function candidateOrder(a, b) {
  return (PRIORITY[a.priority] ?? 9) - (PRIORITY[b.priority] ?? 9)
    || (EVIDENCE[a.evidenceClass] ?? 9) - (EVIDENCE[b.evidenceClass] ?? 9)
    || Number(!a.proposal) - Number(!b.proposal)
    || a.id.localeCompare(b.id);
}

function dedupe(candidates) {
  const seen = new Set();
  const out = [];
  for (const candidate of candidates.sort(candidateOrder)) {
    const target = candidate.target?.file || candidate.target?.url || candidate.target?.entityId || '';
    const key = `${candidate.lane}|${String(candidate.title).toLowerCase()}|${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

function selectCandidates(candidates, maxActions) {
  const selected = [];
  for (const priority of ['P0', 'P1', 'P2', 'P3']) {
    const group = candidates.filter(item => item.priority === priority && !selected.includes(item));
    const lanes = new Set();
    for (const item of group) {
      if (selected.length >= maxActions) break;
      if (lanes.has(item.lane)) continue;
      selected.push(item);
      lanes.add(item.lane);
    }
    for (const item of group) {
      if (selected.length >= maxActions) break;
      if (!selected.includes(item)) selected.push(item);
    }
    if (selected.length >= maxActions) break;
  }
  return selected;
}

export function buildSiteImprovementPlanFromEvidence({ canonicalUrl, growthPlan = null, entityRemediation = null, pageGraph = null }, { maxActions = 8, generatedAt = null } = {}) {
  if (!/^https:\/\//.test(String(canonicalUrl || ''))) throw new Error('canonicalUrl must be a public HTTPS URL.');
  if (!Number.isInteger(maxActions) || maxActions < 1 || maxActions > 25) throw new Error('maxActions must be an integer between 1 and 25.');
  const candidates = dedupe([
    ...(growthPlan?.actions || []).map(fromGrowth),
    ...(entityRemediation?.items || []).map(fromEntity),
    ...(pageGraph?.actions || []).map(fromPage)
  ]);
  const selected = selectCandidates(candidates, maxActions);
  const now = generatedAt == null ? new Date() : new Date(generatedAt);
  if (Number.isNaN(now.getTime())) throw new Error('generatedAt must be a valid date/time.');
  return {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/site-improvement-plan.schema.json',
    version: SITE_IMPROVEMENT_VERSION,
    generatedAt: now.toISOString(),
    site: canonicalUrl,
    scope: 'bounded-prioritized-improvement-plan-not-ranking-score',
    summary: {
      candidates: candidates.length,
      selected: selected.length,
      suppressed: candidates.length - selected.length,
      byPriority: selected.reduce((acc, item) => (acc[item.priority] = (acc[item.priority] || 0) + 1, acc), {}),
      byLane: selected.reduce((acc, item) => (acc[item.lane] = (acc[item.lane] || 0) + 1, acc), {})
    },
    actions: selected.map((item, index) => ({ order: index + 1, ...item })),
    sourceSummary: {
      growthActions: growthPlan?.actions?.length || 0,
      entityRemediationItems: entityRemediation?.items?.length || 0,
      pageGraphActions: pageGraph?.actions?.length || 0
    },
    prioritization: {
      method: 'priority-then-evidence-then-actionability-with-lane-diversity',
      universalNumericScore: false,
      priorityOrder: ['P0', 'P1', 'P2', 'P3'],
      evidenceOrder: ['grounded-first-party', 'direct-observation', 'source-backed', 'manual-review', 'advisory'],
      maxActions
    },
    guardrails: {
      noRankingPromise: true,
      noUniversalReadinessScore: true,
      noAutomaticRepositoryMutation: true,
      noInventedFacts: true,
      humanReviewForStructuredDataAndEditorialChanges: true,
      boundedCrawlDoesNotProveWholeSiteCoverage: true,
      measurementDoesNotProveCausality: true
    }
  };
}

export async function buildSiteImprovementPlan(input, options = {}) {
  const shared = { timeoutMs: options.timeoutMs || 8000, maxBytes: options.maxBytes || 256 * 1024, fetchImpl: options.fetchImpl || fetch, ...(options.resolveImpl ? { resolveImpl: options.resolveImpl } : {}) };
  const [growthPlan, entityGapReport, pageGraph] = await Promise.all([
    buildGrowthPlan(input, { ...options, ...shared }),
    analyzeEntityGraphSite(input, { ...shared, maxPages: options.maxPages || 12 }),
    analyzePageGraphSite(input, { ...shared, maxPages: options.maxPages || 12 })
  ]);
  const entityRemediation = buildEntityRemediationManifest(entityGapReport, { repoRoot: options.repoRoot, generatedAt: options.generatedAt, maxFiles: options.maxFiles, maxFileBytes: options.maxFileBytes });
  return buildSiteImprovementPlanFromEvidence({ canonicalUrl: growthPlan.canonicalUrl || entityGapReport.canonicalUrl, growthPlan, entityRemediation, pageGraph }, { maxActions: options.maxActions || 8, generatedAt: options.generatedAt });
}

export function formatSiteImprovementPlan(plan) {
  const lines = [
    `ARWP Site Improvement Plan — ${plan.site}`,
    `Selected ${plan.summary.selected}/${plan.summary.candidates} candidates; no universal score`,
    ''
  ];
  for (const action of plan.actions) {
    lines.push(`${action.order}. ${action.priority} [${action.lane}] ${action.title}`);
    lines.push(`   Evidence: ${action.evidenceClass}`);
    lines.push(`   ${action.reason}`);
    if (action.target?.file) lines.push(`   Target: ${action.target.file}`);
    else if (action.target?.url) lines.push(`   Target: ${action.target.url}`);
    if (action.proposal?.type) lines.push(`   Proposal: ${action.proposal.type}`);
    lines.push(`   Verify: ${action.verification[0]}`);
  }
  lines.push('', 'ARWP intentionally does not predict ranking lift. Implement, verify, measure, then keep/revise/revert using owner-side evidence.');
  return lines.join('\n');
}
