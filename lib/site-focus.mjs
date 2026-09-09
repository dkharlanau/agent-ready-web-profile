import fs from 'node:fs';
import path from 'node:path';
import { fetchPublicText } from './public-fetch.mjs';

export const SITE_FOCUS_VERSION = '0.1';

const STOP = new Set('a an and are as at be by can do for from get has have how in into is it its of on or our that the their this to use using we what when where which who why with you your'.split(' '));
const GENERIC = new Set('home page pages site website product products service services about docs documentation guide guides help learn more read start overview index'.split(' '));
const ACTION = /\b(start|try|run|find|explore|check|download|contact|book|buy|compare|view|open|read|learn|use|install|create|build|search|scan|resolve|measure|test|see)\b/i;
const TECH = /\b(api|mcp|a2a|schema|json|json-ld|protocol|resolver|benchmark|cli|sdk|oauth|llms|crawler|registry|graph|dataset)\b/i;
const AUDIENCES = [
  ['developer', /\bdevelopers?\b/i], ['publisher', /\bpublishers?\b/i], ['marketer', /\bmarketers?\b/i],
  ['team', /\bteams?\b/i], ['researcher', /\bresearchers?\b/i], ['creator', /\bcreators?\b/i],
  ['speaker', /\bspeakers?\b/i], ['learner', /\b(learners?|students?)\b/i], ['shopper', /\b(shoppers?|buyers?)\b/i],
  ['customer', /\bcustomers?\b/i], ['owner', /\b(site|website|business|product) owners?\b/i]
];

function norm(value) {
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

function cleanUrl(value, base = null) {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function pageTitle(html) {
  return norm(String(html || '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
}

function pageH1(html) {
  return norm(String(html || '').match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
}

function metaDescription(html) {
  for (const tag of String(html || '').match(/<meta\b[^>]*>/gi) || []) {
    const a = attrs(tag);
    if (String(a.name || '').toLowerCase() === 'description') return norm(a.content);
  }
  return '';
}

function canonical(html, base) {
  for (const tag of String(html || '').match(/<link\b[^>]*>/gi) || []) {
    const a = attrs(tag);
    const rel = String(a.rel || '').toLowerCase().split(/\s+/);
    if (rel.includes('canonical') && a.href) return cleanUrl(a.href, base);
  }
  return cleanUrl(base);
}

function anchors(html, base) {
  const out = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(String(html || '')))) {
    const a = attrs(`<a ${match[1]}>`);
    const url = cleanUrl(a.href, base);
    if (url) out.push({ url, text: norm(match[2]) });
  }
  return out;
}

function navAnchors(html, base) {
  const nav = String(html || '').match(/<nav\b[^>]*>[\s\S]*?<\/nav>/i)?.[0] || '';
  return anchors(nav, base);
}

function tokens(value) {
  return [...new Set(norm(value).toLowerCase().replace(/[^\p{L}\p{N}-]+/gu, ' ').split(/\s+/)
    .filter(token => token.length >= 3 && !STOP.has(token) && !GENERIC.has(token)))];
}

function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let intersection = 0;
  for (const item of A) if (B.has(item)) intersection += 1;
  return intersection / (A.size + B.size - intersection);
}

function topSegment(url, root) {
  try {
    const u = new URL(url), r = new URL(root);
    const base = r.pathname.endsWith('/') ? r.pathname : `${r.pathname}/`;
    let relative = u.pathname.startsWith(base) ? u.pathname.slice(base.length) : u.pathname.replace(/^\/+/, '');
    relative = relative.replace(/(?:index)?\.html?$/i, '').replace(/^\/+|\/+$/g, '');
    return relative.split('/').filter(Boolean)[0] || 'home';
  } catch {
    return 'unknown';
  }
}

function contentSignature(page) {
  return tokens(`${page.title} ${page.h1} ${page.description}`);
}

function proofSignals(html, base) {
  const text = norm(html);
  const links = anchors(html, base);
  const external = links.filter(link => {
    try { return new URL(link.url).origin !== new URL(base).origin; } catch { return false; }
  });
  const code = (String(html || '').match(/<(pre|code)\b/gi) || []).length;
  const tables = (String(html || '').match(/<table\b/gi) || []).length;
  const figures = (String(html || '').match(/<(figure|svg|canvas)\b/gi) || []).length;
  const dataWords = /\b(source|sources|evidence|method|methodology|data|dataset|benchmark|result|results|example|case|study|research|citation|doi)\b/i.test(text);
  return { externalLinks: external.length, codeBlocks: code, tables, figures, evidenceLanguage: dataWords, present: external.length > 0 || code > 0 || tables > 0 || figures > 0 || dataWords };
}

function actionCandidates(html, base) {
  return anchors(html, base).filter(link => link.text && ACTION.test(link.text)).slice(0, 8);
}

function audienceSignals(pages) {
  const evidence = new Map();
  for (const page of pages) {
    const text = `${page.title} ${page.h1} ${page.description}`;
    for (const [id, re] of AUDIENCES) if (re.test(text)) {
      const list = evidence.get(id) || [];
      if (list.length < 4) list.push(page.url);
      evidence.set(id, list);
    }
  }
  return [...evidence].map(([id, urls]) => ({ id, evidence: urls }));
}

function duplicateClusters(pages, threshold = 0.62) {
  const pairs = [];
  for (let i = 0; i < pages.length; i += 1) for (let j = i + 1; j < pages.length; j += 1) {
    const similarity = jaccard(pages[i].signature, pages[j].signature);
    if (similarity >= threshold) pairs.push({ urls: [pages[i].url, pages[j].url], similarity: Number(similarity.toFixed(3)) });
  }
  return pairs.sort((a, b) => b.similarity - a.similarity);
}

function disposition(page, { duplicateUrls, homeTokens, root }) {
  const reasons = [];
  const similarityToThesis = jaccard(page.signature, homeTokens);
  if (duplicateUrls.has(page.url)) {
    reasons.push('Content signature substantially overlaps another sampled page; review whether both URLs serve a distinct job.');
    return { decision: 'MERGE', confidence: 'heuristic-medium', similarityToThesis: Number(similarityToThesis.toFixed(3)), reasons };
  }
  const isHome = cleanUrl(page.url) === cleanUrl(root);
  if (!isHome && similarityToThesis < 0.08 && page.signature.length >= 3) {
    reasons.push('Low lexical overlap with the observed homepage thesis; this is an out-of-scope candidate, not proof that the page should be removed.');
    return { decision: 'DEFER', confidence: 'heuristic-low', similarityToThesis: Number(similarityToThesis.toFixed(3)), reasons };
  }
  if (!page.h1 || !page.title || page.actions.length === 0) {
    reasons.push('The page contract is incomplete: title/H1/action evidence does not make one page job and next step sufficiently explicit.');
    return { decision: 'NARROW', confidence: 'heuristic-medium', similarityToThesis: Number(similarityToThesis.toFixed(3)), reasons };
  }
  reasons.push('No sampled focus conflict exceeded the current heuristic thresholds.');
  return { decision: 'KEEP', confidence: 'heuristic-low', similarityToThesis: Number(similarityToThesis.toFixed(3)), reasons };
}

export function buildSiteFocusReportFromPages(input, { canonicalUrl = input?.[0]?.url, discovery = null } = {}) {
  if (!Array.isArray(input) || input.length === 0) throw new Error('pages must be a non-empty array.');
  const root = cleanUrl(canonicalUrl);
  if (!root?.startsWith('https://')) throw new Error('canonicalUrl must be a public HTTPS URL.');

  const pages = input.map(raw => {
    const url = canonical(raw.html, raw.url) || cleanUrl(raw.url);
    const title = pageTitle(raw.html), h1 = pageH1(raw.html), description = metaDescription(raw.html);
    const allLinks = anchors(raw.html, raw.url);
    return {
      url,
      fetchedUrl: cleanUrl(raw.url),
      status: raw.status ?? 200,
      title,
      h1,
      description,
      signature: contentSignature({ title, h1, description }),
      links: allLinks,
      nav: navAnchors(raw.html, raw.url),
      proof: proofSignals(raw.html, raw.url),
      actions: actionCandidates(raw.html, raw.url),
      routeTerritory: topSegment(url, root)
    };
  }).filter(page => page.url);

  const home = pages.find(page => cleanUrl(page.url) === root) || pages[0];
  const homeTokens = home.signature;
  const duplicates = duplicateClusters(pages);
  const duplicateUrls = new Set(duplicates.flatMap(cluster => cluster.urls));
  const pageUrls = new Set(pages.map(page => page.url));
  const inbound = new Map(pages.map(page => [page.url, 0]));
  for (const page of pages) for (const link of page.links) if (pageUrls.has(link.url) && link.url !== page.url) inbound.set(link.url, (inbound.get(link.url) || 0) + 1);

  const contracts = pages.map(page => {
    const dispositionResult = disposition(page, { duplicateUrls, homeTokens, root });
    return {
      url: page.url,
      title: page.title || null,
      h1: page.h1 || null,
      pageJobSignal: page.h1 || page.title || null,
      parentHub: page.routeTerritory === 'home' ? null : page.routeTerritory,
      proof: page.proof,
      primaryActionCandidates: page.actions,
      inboundLinksInSample: inbound.get(page.url) || 0,
      routeTerritory: page.routeTerritory,
      ...dispositionResult
    };
  });

  const routeCounts = {};
  for (const page of pages) routeCounts[page.routeTerritory] = (routeCounts[page.routeTerritory] || 0) + 1;
  const territories = Object.entries(routeCounts).sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ id, count }));
  const homeNav = home.nav.filter(link => {
    try { return new URL(link.url).origin === new URL(root).origin; } catch { return false; }
  });
  const distinctNav = [...new Map(homeNav.map(link => [link.url, link])).values()];
  const techNav = distinctNav.filter(link => TECH.test(link.text));
  const audiences = audienceSignals(pages);
  const orphanCandidates = contracts.filter(page => page.url !== home.url && page.inboundLinksInSample === 0).map(page => page.url);
  const outOfScopeCandidates = contracts.filter(page => page.decision === 'DEFER').map(page => page.url);
  const pagesWithoutClearJob = contracts.filter(page => !page.pageJobSignal || page.decision === 'NARROW').map(page => page.url);
  const pagesWithoutProof = contracts.filter(page => !page.proof.present).map(page => page.url);
  const pagesWithoutUsefulAction = contracts.filter(page => page.primaryActionCandidates.length === 0).map(page => page.url);
  const dispositionCounts = contracts.reduce((acc, page) => (acc[page.decision] = (acc[page.decision] || 0) + 1, acc), {});

  const siteFindings = [];
  if (territories.filter(item => item.id !== 'home').length > 3) siteFindings.push({ id: 'many-route-territories', severity: 'review', evidence: territories, message: 'More than three first-order route territories were sampled. Review whether they represent one problem architecture or several competing site identities.' });
  if (distinctNav.length > 5) siteFindings.push({ id: 'wide-primary-navigation', severity: 'review', evidence: distinctNav, message: 'Primary navigation exceeds the Goose house heuristic of five destinations.' });
  if (techNav.length && techNav.length / Math.max(distinctNav.length, 1) >= 0.4) siteFindings.push({ id: 'technology-led-navigation', severity: 'review', evidence: techNav, message: 'A large share of primary navigation is labeled with implementation technology. Review whether user problems should own those first-order routes instead.' });
  if (audiences.length > 3) siteFindings.push({ id: 'many-audience-signals', severity: 'review', evidence: audiences, message: 'Several audience identities are explicitly named across sampled page contracts. Confirm one primary audience and keep the rest subordinate where possible.' });

  return {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/site-focus-report.schema.json',
    version: SITE_FOCUS_VERSION,
    generatedAt: new Date().toISOString(),
    canonicalUrl: root,
    scope: 'Transparent Site Focus diagnostics. No ranking/readiness/focus score is produced. Lexical similarity, route territories and action/proof detection are heuristics for review, not evidence that a page should rank, be cited, be removed or be split.',
    observedSiteThesis: { title: home.title || null, h1: home.h1 || null, description: home.description || null, tokens: homeTokens },
    metrics: {
      pagesObserved: pages.length,
      primaryNavDestinations: distinctNav.length,
      routeTerritories: territories.filter(item => item.id !== 'home').length,
      audienceSignals: audiences.length,
      pagesWithoutClearJob: pagesWithoutClearJob.length,
      duplicateIntentPairs: duplicates.length,
      orphanCandidates: orphanCandidates.length,
      outOfScopeCandidates: outOfScopeCandidates.length,
      pagesWithoutProof: pagesWithoutProof.length,
      pagesWithoutUsefulAction: pagesWithoutUsefulAction.length,
      technicalNavDestinations: techNav.length
    },
    navigation: { primary: distinctNav, technicalCandidates: techNav },
    territories,
    audienceSignals: audiences,
    duplicateIntentClusters: duplicates,
    orphanCandidates,
    outOfScopeCandidates,
    pagesWithoutClearJob,
    pagesWithoutProof,
    pagesWithoutUsefulAction,
    dispositions: dispositionCounts,
    siteFindings,
    pageContracts: contracts,
    discovery,
    guardrails: {
      noOpaqueScore: true,
      removeNeverAutomatic: true,
      splitRequiresManualReview: true,
      lowSimilarityIsNotRemovalEvidence: true,
      technicalTermsAreNotAutomaticallyBadNavigation: true,
      sampledPagesAreNotACompleteSiteInventoryUnlessDiscoveryProvesCoverage: true
    }
  };
}

function scopeFor(input) {
  const url = new URL(input);
  url.hash = ''; url.search = '';
  const pathPrefix = url.pathname.endsWith('/') ? url.pathname : (url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1) || '/');
  return { origin: url.origin, pathPrefix };
}

function sitemapUrls(xml, base) {
  return [...String(xml || '').matchAll(/<loc\b[^>]*>([^<]+)<\/loc>/gi)].map(match => cleanUrl(match[1].trim(), base)).filter(Boolean);
}

function localHtmlFiles(repoRoot, maxPages) {
  const preferred = ['docs', 'public', 'dist', 'build', '_site'].map(name => path.join(repoRoot, name));
  const root = preferred.find(dir => fs.existsSync(dir) && fs.statSync(dir).isDirectory()) || repoRoot;
  const files = [];
  const walk = dir => {
    if (files.length >= maxPages) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (files.length >= maxPages) break;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.html?$/i.test(entry.name)) files.push(full);
    }
  };
  walk(root);
  return { root, files };
}

function localUrl(file, publicRoot, canonicalUrl) {
  let rel = path.relative(publicRoot, file).split(path.sep).join('/');
  if (/^index\.html?$/i.test(rel)) rel = '';
  else if (/\/index\.html?$/i.test(rel)) rel = rel.replace(/index\.html?$/i, '');
  return cleanUrl(rel, canonicalUrl);
}

export function analyzeSiteFocusRepository(canonicalUrl, repoRoot, { maxPages = 30 } = {}) {
  const resolved = path.resolve(repoRoot);
  const local = localHtmlFiles(resolved, maxPages);
  const pages = local.files.map(file => ({ url: localUrl(file, local.root, canonicalUrl), html: fs.readFileSync(file, 'utf8'), status: 200, file })).filter(page => page.url);
  if (!pages.length) throw new Error(`No HTML files found under ${resolved}.`);
  const report = buildSiteFocusReportFromPages(pages, { canonicalUrl, discovery: { mode: 'repository', repoRoot: resolved, publicRoot: local.root, filesObserved: pages.length, maxPages } });
  const fileByUrl = new Map(pages.map(page => [page.url, path.relative(resolved, page.file).split(path.sep).join('/')]));
  report.pageContracts = report.pageContracts.map(contract => ({ ...contract, file: fileByUrl.get(contract.url) || null }));
  return report;
}

export async function analyzeSiteFocusSite(input, { timeoutMs = 8000, maxBytes = 512 * 1024, maxPages = 30, fetchImpl = fetch, resolveImpl } = {}) {
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100) throw new Error('maxPages must be an integer between 1 and 100.');
  const start = new URL(input);
  if (start.protocol !== 'https:') throw new Error('Site Focus requires a public HTTPS URL.');
  const scope = scopeFor(start.href);
  const network = { timeoutMs, maxBytes, fetchImpl, ...(resolveImpl ? { resolveImpl } : {}) };
  const home = await fetchPublicText(start.href, { ...network, accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1', userAgent: 'arwp-focus/0.1' });
  if (!home.ok || !home.text) throw new Error(`Unable to fetch start page: HTTP ${home.status ?? 'unknown'}`);

  const candidates = new Map();
  const add = (url, source) => {
    const cleaned = cleanUrl(url);
    if (!cleaned) return;
    const parsed = new URL(cleaned);
    if (parsed.origin !== scope.origin || !parsed.pathname.startsWith(scope.pathPrefix)) return;
    const item = candidates.get(cleaned) || { url: cleaned, sources: new Set() };
    item.sources.add(source); candidates.set(cleaned, item);
  };
  add(home.url, 'start');
  for (const link of anchors(home.text, home.url)) add(link.url, 'homepage-link');

  const sitemapUrl = new URL('sitemap.xml', `${scope.origin}${scope.pathPrefix}`).href;
  const sitemap = await fetchPublicText(sitemapUrl, { ...network, accept: 'application/xml, text/xml;q=0.9, */*;q=0.1', userAgent: 'arwp-focus/0.1' }).catch(() => null);
  if (sitemap?.ok && sitemap.text) for (const url of sitemapUrls(sitemap.text, sitemapUrl)) add(url, 'sitemap');

  const ordered = [...candidates.values()].sort((a, b) => Number(!a.sources.has('homepage-link')) - Number(!b.sources.has('homepage-link')) || a.url.localeCompare(b.url)).slice(0, maxPages);
  const pages = [{ url: home.url, html: home.text, status: home.status }];
  for (const candidate of ordered) {
    if (cleanUrl(candidate.url) === cleanUrl(home.url)) continue;
    const response = await fetchPublicText(candidate.url, { ...network, accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1', userAgent: 'arwp-focus/0.1' }).catch(() => null);
    if (response?.ok && response.text && /html|xhtml/i.test(String(response.contentType || 'text/html'))) pages.push({ url: response.url || candidate.url, html: response.text, status: response.status });
    if (pages.length >= maxPages) break;
  }

  return buildSiteFocusReportFromPages(pages, {
    canonicalUrl: cleanUrl(home.url),
    discovery: {
      mode: 'live', startUrl: input, scope, sitemap: sitemap?.ok ? sitemapUrl : null,
      candidates: candidates.size, pagesObserved: pages.length, maxPages, maxBytesPerPage: maxBytes, timeoutMs,
      candidateSources: [...candidates.values()].map(item => ({ url: item.url, sources: [...item.sources] }))
    }
  });
}

export function formatSiteFocusReport(report) {
  const lines = [
    `Goose Site Focus — ${report.canonicalUrl}`,
    `Observed thesis: ${report.observedSiteThesis.h1 || report.observedSiteThesis.title || 'unknown'}`,
    'No focus/readiness/ranking score.',
    '',
    `Pages observed: ${report.metrics.pagesObserved}`,
    `Primary nav destinations: ${report.metrics.primaryNavDestinations}`,
    `Route territories: ${report.metrics.routeTerritories}`,
    `Audience signals: ${report.metrics.audienceSignals}`,
    `Pages without clear job: ${report.metrics.pagesWithoutClearJob}`,
    `Duplicate-intent pairs: ${report.metrics.duplicateIntentPairs}`,
    `Orphan candidates: ${report.metrics.orphanCandidates}`,
    `Out-of-scope candidates: ${report.metrics.outOfScopeCandidates}`,
    `Pages without proof signals: ${report.metrics.pagesWithoutProof}`,
    `Pages without useful-action candidates: ${report.metrics.pagesWithoutUsefulAction}`,
    ''
  ];
  for (const finding of report.siteFindings) lines.push(`REVIEW ${finding.id}: ${finding.message}`);
  if (report.siteFindings.length) lines.push('');
  for (const page of report.pageContracts) {
    lines.push(`${page.decision.padEnd(7)} ${page.url}`);
    lines.push(`  Job: ${page.pageJobSignal || 'unclear'}`);
    lines.push(`  Thesis similarity: ${page.similarityToThesis}; inbound sampled links: ${page.inboundLinksInSample}; proof: ${page.proof.present ? 'observed' : 'not observed'}; actions: ${page.primaryActionCandidates.length}`);
    for (const reason of page.reasons) lines.push(`  Why: ${reason}`);
  }
  lines.push('', 'REMOVE and SPLIT are never automatic. Review sampled evidence and the real business/site boundary before restructuring URLs.');
  return lines.join('\n');
}