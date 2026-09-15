import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPublicText } from './public-fetch.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.join(here, '..', 'registry', 'search-build-gate-practices.json');

export const SEARCH_BUILD_GATE_VERSION = '0.1';
export const MAX_HTML_BYTES = 1024 * 1024;
export const DEFAULT_MAX_FILES = 10000;
export const DEFAULT_MAX_LIVE_PAGES = 24;

export function loadSearchBuildGateRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function normalizeSpace(value) {
  return decodeEntities(String(value || '')).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function decodeEntities(value) {
  return String(value).replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, token => {
    const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    const lower = token.toLowerCase();
    if (named[lower]) return named[lower];
    const code = lower.startsWith('&#x') ? parseInt(lower.slice(3, -1), 16) : parseInt(lower.slice(2, -1), 10);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd';
  });
}
function attributes(tag) {
  const out = Object.create(null);
  const body = String(tag).replace(/^<\/?[a-z0-9:-]+\b/i, '').replace(/>$/, '');
  const pattern = /([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of body.matchAll(pattern)) {
    const key = match[1].toLowerCase();
    if (!(key in out)) out[key] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return out;
}
function tokens(value) {
  return String(value || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
}
function absoluteUrl(value, base) {
  try {
    const url = new URL(String(value || '').trim(), base);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function normalizeSite(value) {
  const url = new URL(String(value || '').trim());
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('site must be HTTP(S)');
  url.hash = '';
  url.search = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}
function underSite(candidate, site) {
  try {
    const target = new URL(candidate);
    const root = new URL(site);
    return target.origin === root.origin && (target.pathname === root.pathname.slice(0, -1) || target.pathname.startsWith(root.pathname));
  } catch { return false; }
}
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function parseHtmlSignals(html, pageUrl) {
  const headMatch = String(html).match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i);
  const head = headMatch?.[1] || '';
  const titles = [...head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/gi)].map(m => normalizeSpace(m[1])).filter(Boolean);
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map(m => attributes(m[0]));
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map(m => attributes(m[0]));
  const canonicals = links.filter(a => tokens(a.rel).includes('canonical')).map(a => absoluteUrl(a.href, pageUrl)).filter(Boolean);
  const descriptions = metas.filter(a => String(a.name || '').toLowerCase() === 'description').map(a => normalizeSpace(a.content)).filter(Boolean);
  const robotContents = metas.filter(a => ['robots', 'googlebot'].includes(String(a.name || '').toLowerCase())).map(a => String(a.content || '').toLowerCase());
  const noindex = robotContents.some(value => tokens(value).includes('noindex'));
  const ogUrls = metas.filter(a => String(a.property || '').toLowerCase() === 'og:url').map(a => absoluteUrl(a.content, pageUrl)).filter(Boolean);
  let invalidJsonLd = 0;
  let jsonLdCount = 0;
  for (const match of head.matchAll(/<script\b[^>]*type\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    jsonLdCount += 1;
    try { JSON.parse(match[1]); } catch { invalidJsonLd += 1; }
  }
  return {
    explicitHead: Boolean(headMatch), titles: [...new Set(titles)], descriptions: [...new Set(descriptions)],
    canonicals: [...new Set(canonicals)], noindex, ogUrls: [...new Set(ogUrls)], invalidJsonLd, jsonLdCount
  };
}
function derivedUrl(rel, site) {
  const posix = rel.split(path.sep).join('/');
  if (posix === 'index.html') return site;
  if (posix.endsWith('/index.html')) return new URL(`${posix.slice(0, -'index.html'.length)}`, site).href;
  return new URL(posix, site).href;
}
function isErrorFile(rel) {
  const posix = rel.split(path.sep).join('/').toLowerCase();
  return posix === '404.html' || posix.endsWith('/404.html') || posix.endsWith('/404/index.html');
}
function walk(root, maxFiles) {
  const files = [];
  const queue = [''];
  while (queue.length) {
    const relDir = queue.shift();
    const absDir = path.join(root, relDir);
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = path.join(relDir, entry.name);
      const abs = path.join(root, rel);
      const stat = fs.lstatSync(abs);
      if (stat.isSymbolicLink()) throw new Error(`artifact contains symbolic link: ${rel}`);
      if (entry.isDirectory()) queue.push(rel);
      else if (entry.isFile()) {
        files.push(rel);
        if (files.length > maxFiles) throw new Error(`artifact exceeds maxFiles (${maxFiles})`);
      }
    }
  }
  return files;
}
function readHtml(abs) {
  const stat = fs.statSync(abs);
  if (stat.size > MAX_HTML_BYTES) throw new Error(`HTML exceeds ${MAX_HTML_BYTES} bytes: ${abs}`);
  return fs.readFileSync(abs, 'utf8');
}
function sitemapUrls(root, site) {
  const file = path.join(root, 'sitemap.xml');
  if (!fs.existsSync(file)) return { present: false, urls: [], issues: [] };
  const text = fs.readFileSync(file, 'utf8');
  const urls = [...text.matchAll(/<loc\b[^>]*>([^<]+)<\/loc>/gi)].map(m => decodeEntities(m[1].trim()));
  const issues = [];
  if (new Set(urls).size !== urls.length) issues.push('duplicate-sitemap-url');
  for (const url of urls) if (!underSite(url, site)) issues.push(`out-of-scope-sitemap-url:${url}`);
  return { present: true, urls: [...new Set(urls)], issues };
}
function pageContract(page, site) {
  const fail = [];
  const watch = [];
  const s = page.signals;
  if (!s.explicitHead) fail.push('missing-explicit-head');
  if (s.titles.length !== 1) fail.push(s.titles.length ? 'multiple-titles' : 'missing-title');
  if (s.canonicals.length !== 1) fail.push(s.canonicals.length ? 'multiple-canonicals' : 'missing-canonical');
  if (s.canonicals.length === 1) {
    if (!underSite(s.canonicals[0], site)) fail.push('canonical-outside-site');
    if (s.canonicals[0] !== page.publicUrl) fail.push('canonical-route-mismatch');
  }
  if (s.noindex) fail.push('unexpected-noindex');
  if (s.invalidJsonLd) fail.push('invalid-jsonld');
  if (!s.descriptions.length) watch.push('missing-meta-description');
  else if (s.descriptions.length > 1) watch.push('multiple-meta-descriptions');
  if (s.ogUrls.some(url => url !== page.publicUrl)) fail.push('og-url-mismatch');
  return { fail, watch };
}
function errorContract(page) {
  const fail = [];
  const watch = [];
  if (page.signals.canonicals.length) fail.push('error-page-canonical-present');
  if (!page.signals.noindex) watch.push('error-page-noindex-not-observed');
  if (page.signals.invalidJsonLd) fail.push('error-page-invalid-jsonld');
  return { fail, watch };
}

export function compileSearchArtifact({ artifactRoot, site, sourceSha = null, maxFiles = DEFAULT_MAX_FILES, registry = loadSearchBuildGateRegistry() } = {}) {
  if (!artifactRoot) throw new Error('artifactRoot is required');
  const root = path.resolve(artifactRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`artifactRoot is not a directory: ${root}`);
  const canonicalSite = normalizeSite(site);
  const files = walk(root, maxFiles);
  if (!files.includes('index.html')) throw new Error('artifact root must contain index.html');
  const htmlFiles = files.filter(file => file.toLowerCase().endsWith('.html'));
  const pages = htmlFiles.map(rel => {
    const abs = path.join(root, rel);
    const html = readHtml(abs);
    const fallbackUrl = derivedUrl(rel, canonicalSite);
    const initial = parseHtmlSignals(html, fallbackUrl);
    const publicUrl = initial.canonicals.length === 1 ? initial.canonicals[0] : fallbackUrl;
    const signals = publicUrl === fallbackUrl ? initial : parseHtmlSignals(html, publicUrl);
    return { file: rel.split(path.sep).join('/'), publicUrl, fallbackUrl, errorRoute: isErrorFile(rel), bytes: Buffer.byteLength(html), sha256: sha256(html), signals, html };
  });
  const sitemap = sitemapUrls(root, canonicalSite);
  const byUrl = new Map(pages.filter(p => !p.errorRoute).map(p => [p.publicUrl, p]));
  const cohortUrls = sitemap.present ? sitemap.urls : pages.filter(p => !p.errorRoute).map(p => p.publicUrl);
  const missingArtifactUrls = cohortUrls.filter(url => !byUrl.has(url));
  const cohortPages = cohortUrls.map(url => byUrl.get(url)).filter(Boolean);
  const pageFindings = cohortPages.map(page => ({ file: page.file, url: page.publicUrl, ...pageContract(page, canonicalSite) }));
  const errorFindings = pages.filter(p => p.errorRoute).map(page => ({ file: page.file, url: page.publicUrl, ...errorContract(page) }));
  const failures = [
    ...sitemap.issues,
    ...missingArtifactUrls.map(url => `sitemap-url-missing-artifact:${url}`),
    ...pageFindings.flatMap(p => p.fail.map(issue => `${p.url}:${issue}`)),
    ...errorFindings.flatMap(p => p.fail.map(issue => `${p.file}:${issue}`))
  ];
  const watches = [
    ...(sitemap.present ? [] : ['root-sitemap-not-observed']),
    ...pageFindings.flatMap(p => p.watch.map(issue => `${p.url}:${issue}`)),
    ...errorFindings.flatMap(p => p.watch.map(issue => `${p.file}:${issue}`))
  ];
  return {
    version: SEARCH_BUILD_GATE_VERSION,
    reviewedAt: registry.reviewedAt,
    artifactRoot: root,
    site: canonicalSite,
    sourceSha,
    inventory: { files: files.length, htmlFiles: htmlFiles.length, sitemapPresent: sitemap.present, sitemapUrls: sitemap.urls.length, indexCohort: cohortPages.length, errorPages: errorFindings.length },
    coverage: sitemap.present ? 'sitemap-cohort' : 'artifact-html',
    failures,
    watches,
    pages: pages.map(({ html, ...page }) => page),
    pageFindings,
    errorFindings,
    sitemap,
    pass: failures.length === 0,
    guardrails: registry.guardrails
  };
}
function searchFingerprint(signals) {
  return {
    titles: signals.titles,
    descriptions: signals.descriptions,
    canonicals: signals.canonicals,
    noindex: signals.noindex,
    ogUrls: signals.ogUrls,
    invalidJsonLd: signals.invalidJsonLd
  };
}
function sameFingerprint(a, b) { return JSON.stringify(searchFingerprint(a)) === JSON.stringify(searchFingerprint(b)); }
function validSha(value) { return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value); }

export async function verifySearchArtifactLive(manifest, {
  deployedSha = null,
  maxLivePages = DEFAULT_MAX_LIVE_PAGES,
  parityMode = 'search-surface',
  fetchImpl = fetch,
  resolveImpl,
  timeoutMs = 8000,
  maxBytes = MAX_HTML_BYTES
} = {}) {
  if (!manifest?.pages || !manifest?.site) throw new Error('compiled artifact manifest is required');
  if (!Number.isInteger(maxLivePages) || maxLivePages < 1) throw new Error('maxLivePages must be a positive integer');
  if (!['search-surface', 'exact'].includes(parityMode)) throw new Error('parityMode must be search-surface or exact');
  const indexUrls = manifest.pageFindings.map(item => item.url);
  const selected = indexUrls.slice(0, maxLivePages);
  const localByUrl = new Map(manifest.pages.map(page => [page.publicUrl, page]));
  const pages = [];
  for (const url of selected) {
    let fetched;
    try {
      fetched = await fetchPublicText(url, {
        fetchImpl,
        ...(resolveImpl ? { resolveImpl } : {}), timeoutMs, maxBytes,
        accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1', userAgent: 'arwp-search-build/0.1'
      });
    } catch (error) {
      pages.push({ url, state: 'fail', issues: [`live-fetch-error:${error?.message || error}`] });
      continue;
    }
    if (!fetched.ok || !fetched.text) {
      pages.push({ url, state: 'fail', issues: [`live-http-${fetched.status || 'unknown'}`] });
      continue;
    }
    const local = localByUrl.get(url);
    const liveSignals = parseHtmlSignals(fetched.text, url);
    const issues = [];
    if (!sameFingerprint(local.signals, liveSignals)) issues.push('search-surface-drift');
    if (parityMode === 'exact' && sha256(fetched.text) !== local.sha256) issues.push('byte-drift');
    pages.push({ url, state: issues.length ? 'fail' : 'pass', issues, localSha256: local.sha256, liveSha256: sha256(fetched.text), liveSignals });
  }
  const revision = (() => {
    const sourceSha = manifest.sourceSha;
    if (sourceSha && !validSha(sourceSha)) return { state: 'fail', message: 'sourceSha is not a 40-character commit SHA' };
    if (deployedSha && !validSha(deployedSha)) return { state: 'fail', message: 'deployedSha is not a 40-character commit SHA' };
    if (sourceSha && deployedSha) return sourceSha.toLowerCase() === deployedSha.toLowerCase()
      ? { state: 'pass', message: 'source and deployed revision match', sourceSha, deployedSha }
      : { state: 'fail', message: 'source and deployed revision differ', sourceSha, deployedSha };
    return { state: 'watch', message: 'source/deployed revision parity is incomplete', sourceSha: sourceSha || null, deployedSha: deployedSha || null };
  })();
  const failures = pages.filter(page => page.state === 'fail').length + (revision.state === 'fail' ? 1 : 0);
  const coverage = indexUrls.length <= maxLivePages ? 'complete-index-cohort' : 'bounded-index-cohort';
  return {
    version: SEARCH_BUILD_GATE_VERSION,
    reviewedAt: manifest.reviewedAt || null,
    site: manifest.site,
    parityMode,
    coverage,
    expectedPages: indexUrls.length,
    checkedPages: pages.length,
    revision,
    pages,
    pass: failures === 0 && coverage === 'complete-index-cohort',
    failures,
    watches: (coverage === 'bounded-index-cohort' ? 1 : 0) + (revision.state === 'watch' ? 1 : 0),
    note: 'Live parity proves only that the checked production representation matches the compiled Search artifact contract. It does not prove indexing, ranking, snippet selection or traffic.'
  };
}

export function formatSearchBuildReport(report) {
  if (report.inventory) {
    const lines = [
      `ARWP Production Search Build Gate ${report.version}`,
      `Site: ${report.site}`,
      `Artifact: ${report.artifactRoot}`,
      `Coverage: ${report.coverage}`,
      `Index cohort: ${report.inventory.indexCohort}`,
      `Result: ${report.pass ? 'PASS' : 'FAIL'}`
    ];
    if (report.failures.length) lines.push('', 'Failures:', ...report.failures.map(item => `- ${item}`));
    if (report.watches.length) lines.push('', 'Watch:', ...report.watches.map(item => `- ${item}`));
    return lines.join('\n');
  }
  const lines = [
    `ARWP Production Search Build Gate ${report.version}`,
    `Site: ${report.site}`,
    `Live coverage: ${report.coverage} (${report.checkedPages}/${report.expectedPages})`,
    `Revision: ${report.revision.state.toUpperCase()} — ${report.revision.message}`,
    `Result: ${report.pass ? 'PASS' : 'NOT COMPLETE/PASS'}`
  ];
  for (const page of report.pages.filter(item => item.state !== 'pass')) lines.push(`- ${page.url}: ${page.issues.join(', ')}`);
  return lines.join('\n');
}
