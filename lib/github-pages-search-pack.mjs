import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileSearchArtifact } from './search-build-gate.mjs';
import { evaluateSearchPlatformEligibility } from './search-platform-eligibility.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.join(here, '..', 'registry', 'github-pages-search-pack-practices.json');
const WORKFLOW_EXTENSIONS = new Set(['.yml', '.yaml']);
const MAX_HTML_BYTES = 1024 * 1024;

export const GITHUB_PAGES_SEARCH_PACK_VERSION = '0.1';

export function loadGithubPagesSearchPackRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function posix(value) { return String(value).replaceAll('\\', '/'); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function normalizeRepoPath(value, label) {
  const normalized = path.posix.normalize(posix(String(value || '.').replace(/^\.\//, '')) || '.');
  if (path.posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../')) throw new Error(`${label} must stay inside the repository.`);
  return normalized;
}
function normalizeSite(value) {
  const url = new URL(String(value || '').trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('site must be HTTP(S)');
  url.hash = '';
  url.search = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}
function ensureInside(root, target, label) {
  const relative = path.relative(root, target);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return;
  throw new Error(`${label} resolves outside repository root.`);
}
function siteContains(site, candidate) {
  try {
    const url = new URL(candidate, site.href);
    const root = new URL(site.href);
    const rootPath = root.pathname.endsWith('/') ? root.pathname : `${root.pathname}/`;
    return url.origin === root.origin && (url.pathname === rootPath.slice(0, -1) || url.pathname.startsWith(rootPath));
  } catch { return false; }
}
function attrs(tag) {
  const out = Object.create(null);
  const pattern = /([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const body = String(tag).replace(/^<\/?[a-z0-9:-]+\b/i, '').replace(/>$/, '');
  for (const match of body.matchAll(pattern)) {
    const key = match[1].toLowerCase();
    if (!(key in out)) out[key] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return out;
}
function tokens(value) { return String(value || '').toLowerCase().split(/[\s,]+/).filter(Boolean); }
function finding(severity, code, message, evidence = []) {
  return { severity, code, message, evidence: unique(evidence) };
}
function parseRepository(fullName) {
  const match = /^([^/]+)\/([^/]+)$/.exec(String(fullName || '').trim());
  if (!match) throw new Error('repository must be owner/name');
  return { owner: match[1], name: match[2], fullName: `${match[1]}/${match[2]}` };
}

function classifyIdentity(repository, site) {
  const host = site.hostname.toLowerCase();
  const defaultHost = `${repository.owner.toLowerCase()}.github.io`;
  const repoName = repository.name.toLowerCase();
  const pathName = site.pathname;
  const expectedProjectPath = `/${repository.name}/`;
  const findings = [];
  let kind = 'custom-domain-root';
  let siteScope = 'hostname-root';

  if (host === defaultHost) {
    if (repoName === defaultHost && pathName === '/') {
      kind = 'github-host-root';
      siteScope = 'hostname-root';
    } else if (repoName !== defaultHost && pathName.toLowerCase() === expectedProjectPath.toLowerCase()) {
      kind = 'github-project-subpath';
      siteScope = 'subdirectory';
    } else {
      kind = 'github-io-unresolved';
      siteScope = pathName === '/' ? 'hostname-root' : 'subdirectory';
      findings.push(finding('fail', 'github-pages-site-repo-path-mismatch', `The supplied github.io public root (${site.href}) does not match the expected repository Pages identity.`, [repository.fullName, `expected-host=${defaultHost}`, `expected-project-path=${expectedProjectPath}`]));
    }
  } else if (pathName !== '/') {
    kind = 'custom-domain-subpath';
    siteScope = 'subdirectory';
    findings.push(finding('fail', 'github-pages-custom-domain-subpath', 'A GitHub Pages custom domain is a hostname-level site identity; the supplied public site root contains a subdirectory.', [site.href]));
  }
  if (site.protocol !== 'https:') findings.push(finding('fail', 'github-pages-non-https-public-root', 'GitHub Pages Search release evidence should use the HTTPS public root.', [site.href]));
  return { kind, siteScope, defaultHost, expectedProjectPath, findings };
}

function readCname(repositoryRoot, pagesSource, artifactRoot) {
  const candidates = [];
  const sourceRoot = path.resolve(repositoryRoot, pagesSource === '.' ? '' : pagesSource);
  ensureInside(repositoryRoot, sourceRoot, 'pagesSource');
  candidates.push({ lane: 'source', file: path.join(sourceRoot, 'CNAME') });
  if (artifactRoot) candidates.push({ lane: 'artifact', file: path.join(path.resolve(artifactRoot), 'CNAME') });
  const observed = [];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate.file) || !fs.statSync(candidate.file).isFile()) continue;
    const value = fs.readFileSync(candidate.file, 'utf8').trim().split(/\s+/)[0] || '';
    if (value) observed.push({ lane: candidate.lane, value: value.toLowerCase(), path: candidate.file });
  }
  return observed;
}

function scanWorkflows(repositoryRoot) {
  const directory = path.join(repositoryRoot, '.github', 'workflows');
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) return { files: [], pagesFiles: [] };
  const files = [];
  const pagesFiles = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !WORKFLOW_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    const absolute = path.join(directory, entry.name);
    const text = fs.readFileSync(absolute, 'utf8');
    const rel = `.github/workflows/${entry.name}`;
    files.push(rel);
    if (/actions\/(?:deploy-pages|upload-pages-artifact|configure-pages)@/i.test(text) || /pages:\s*write/i.test(text)) pagesFiles.push(rel);
  }
  return { files: files.sort(), pagesFiles: pagesFiles.sort() };
}

function publicationEvidence(repositoryRoot, pagesSource, mode, workflows) {
  const findings = [];
  const sourceRoot = path.resolve(repositoryRoot, pagesSource === '.' ? '' : pagesSource);
  ensureInside(repositoryRoot, sourceRoot, 'pagesSource');
  if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
    findings.push(finding('fail', 'github-pages-source-missing', `Declared Pages source does not exist: ${pagesSource}.`, [pagesSource]));
    return { findings, jekyllBoundary: 'unknown', nojekyll: false };
  }
  const nojekyll = fs.existsSync(path.join(sourceRoot, '.nojekyll'));
  let jekyllBoundary = mode === 'branch' ? (nojekyll ? 'nojekyll' : 'jekyll-default') : 'not-applicable';

  if (mode === 'unknown') findings.push(finding('watch', 'github-pages-publication-mode-unknown', 'Resolve whether Pages publishes from a branch or custom GitHub Actions before treating repository state as deployment evidence.'));
  else if (!['branch', 'github-actions'].includes(mode)) findings.push(finding('fail', 'github-pages-publication-mode-invalid', `Unsupported Pages publication mode: ${mode}.`, [mode]));

  if (mode === 'branch') {
    if (!['.', 'docs'].includes(pagesSource)) findings.push(finding('fail', 'github-pages-branch-source-invalid', 'GitHub Pages branch publishing supports only repository root or /docs as the source folder.', [pagesSource]));
    if (workflows.pagesFiles.length) findings.push(finding('watch', 'github-pages-custom-workflow-also-present', 'A Pages-oriented custom workflow is present while branch publication is declared. Confirm the active Pages setting instead of inferring it from files.', workflows.pagesFiles));
  }
  if (mode === 'github-actions' && !workflows.pagesFiles.length) {
    findings.push(finding('watch', 'github-pages-actions-workflow-unproven', 'Custom GitHub Actions publication is declared, but no standard Pages action/configuration signal was observed in repository workflows. A custom reusable workflow may still be valid.', workflows.files));
  }
  return { findings, jekyllBoundary, nojekyll };
}

function inspectCustomDomain(site, identity, cnameObserved) {
  const findings = [];
  const custom = !site.hostname.toLowerCase().endsWith('.github.io');
  if (custom) {
    if (!cnameObserved.length) findings.push(finding('watch', 'github-pages-custom-domain-runtime-unproven', 'The supplied site uses a custom domain, but no CNAME declaration was observed in the inspected source/artifact. GitHub Pages settings or API configuration may still be authoritative.', [site.hostname]));
    for (const item of cnameObserved) {
      if (item.value !== site.hostname.toLowerCase()) findings.push(finding('fail', 'github-pages-cname-host-mismatch', `Observed CNAME (${item.value}) does not match the supplied public custom-domain host (${site.hostname}).`, [item.lane, item.value, site.hostname]));
    }
  } else if (cnameObserved.length) {
    findings.push(finding('watch', 'github-pages-cname-present-on-github-host', 'A CNAME declaration exists, but the supplied public root is still github.io. Treat CNAME as source intent only and verify the live Pages custom-domain setting.', cnameObserved.map(item => `${item.lane}:${item.value}`)));
  }
  return findings;
}

function artifactFileForUrl(artifactRoot, site, url) {
  try {
    const target = new URL(url, site.href);
    if (!siteContains(site, target.href)) return null;
    const rootPath = site.pathname.endsWith('/') ? site.pathname : `${site.pathname}/`;
    let rel = decodeURIComponent(target.pathname.slice(rootPath.length));
    if (!rel || rel.endsWith('/')) rel += 'index.html';
    return path.join(artifactRoot, ...rel.split('/'));
  } catch { return null; }
}

function inspectArtifactBasePath(artifactRoot, site, identity) {
  const findings = [];
  if (!artifactRoot || identity.kind !== 'github-project-subpath') return findings;
  const root = path.resolve(artifactRoot);
  const htmlFiles = [];
  const queue = [''];
  while (queue.length) {
    const relDir = queue.shift();
    const absDir = path.join(root, relDir);
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const rel = path.join(relDir, entry.name);
      const abs = path.join(root, rel);
      if (entry.isDirectory()) queue.push(rel);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) htmlFiles.push(rel);
    }
  }
  for (const rel of htmlFiles) {
    const abs = path.join(root, rel);
    const stat = fs.statSync(abs);
    if (stat.size > MAX_HTML_BYTES) { findings.push(finding('watch', 'github-pages-html-too-large-for-basepath-scan', `Skipped base-path scan for oversized HTML: ${posix(rel)}.`, [String(stat.size)])); continue; }
    const html = fs.readFileSync(abs, 'utf8');
    for (const match of html.matchAll(/<(?:a|link|script|img|source|form|iframe|video|audio)\b[^>]*>/gi)) {
      const a = attrs(match[0]);
      const raw = a.href || a.src || a.action || a.poster;
      if (!raw || !raw.startsWith('/') || raw.startsWith('//')) continue;
      const resolved = new URL(raw, site.origin).href;
      if (!siteContains(site, resolved)) findings.push(finding('watch', 'github-pages-root-relative-reference-escapes-project', `Root-relative reference escapes the GitHub Pages project base path in ${posix(rel)}: ${raw}`, [posix(rel), raw]));
    }
    for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
      const a = attrs(match[0]);
      const href = a.href ? new URL(a.href, new URL(posix(rel), site.href)).href : null;
      if (!href) continue;
      const relTokens = tokens(a.rel);
      const isFeed = relTokens.includes('alternate') && /application\/(?:rss|atom)\+xml/i.test(a.type || '');
      const isHreflang = relTokens.includes('alternate') && Boolean(a.hreflang);
      if ((isFeed || isHreflang) && new URL(href).origin === site.origin && !siteContains(site, href)) {
        findings.push(finding('fail', isFeed ? 'github-pages-feed-escapes-project' : 'github-pages-hreflang-escapes-project', `${isFeed ? 'Feed autodiscovery' : 'hreflang alternate'} escapes the project site root in ${posix(rel)}.`, [href]));
      }
      if (isFeed && siteContains(site, href)) {
        const file = artifactFileForUrl(root, site, href);
        if (file && !fs.existsSync(file)) findings.push(finding('fail', 'github-pages-feed-artifact-missing', `Feed autodiscovery points to a URL not present in the final artifact: ${href}`, [posix(rel), href]));
      }
    }
  }
  const robots = path.join(root, 'robots.txt');
  if (fs.existsSync(robots)) {
    const text = fs.readFileSync(robots, 'utf8');
    for (const match of text.matchAll(/^\s*Sitemap\s*:\s*(\S+)/gim)) {
      const url = match[1];
      if (new URL(url, site.href).origin === site.origin && !siteContains(site, url)) findings.push(finding('fail', 'github-pages-robots-sitemap-escapes-project', 'robots.txt advertises a sitemap outside the GitHub Pages project root.', [url]));
    }
  }
  return findings;
}

export function compileGithubPagesSearchPack(options = {}) {
  const registry = options.registry || loadGithubPagesSearchPackRegistry();
  const repositoryRoot = fs.realpathSync(path.resolve(options.root || '.'));
  const repository = parseRepository(options.repository?.fullName || options.repositoryFullName);
  const site = normalizeSite(options.site?.url || options.siteUrl || options.site);
  const pagesSource = normalizeRepoPath(options.pagesSource || options.publishing?.source || '.', 'pagesSource');
  const publicationMode = options.publishingMode || options.publishing?.mode || 'unknown';
  const artifactRoot = options.artifactRoot ? path.resolve(options.artifactRoot) : null;
  if (artifactRoot) ensureInside(repositoryRoot, artifactRoot, 'artifactRoot');

  const identity = classifyIdentity(repository, site);
  const workflows = scanWorkflows(repositoryRoot);
  const publication = publicationEvidence(repositoryRoot, pagesSource, publicationMode, workflows);
  const cnameObserved = readCname(repositoryRoot, pagesSource, artifactRoot);
  const findings = [...identity.findings, ...publication.findings, ...inspectCustomDomain(site, identity, cnameObserved)];

  let artifact = { provided: false, state: 'not-provided', report: null };
  if (artifactRoot) {
    const report = compileSearchArtifact({ artifactRoot, site: site.href, sourceSha: options.sourceSha || options.repository?.baseCommitSha || null });
    artifact = { provided: true, state: report.pass ? 'pass' : 'fail', report };
    if (!report.pass) findings.push(finding('fail', 'github-pages-final-artifact-search-contract-failed', 'The supplied final Pages artifact failed Production Search Build Gate.', report.failures));
    findings.push(...inspectArtifactBasePath(artifactRoot, site, identity));
  } else {
    findings.push(finding('watch', 'github-pages-final-artifact-not-provided', 'Final Pages artifact was not supplied. Repository/source checks cannot prove the published Search representation.'));
  }

  const platform = evaluateSearchPlatformEligibility({
    site: site.href,
    siteScope: identity.siteScope,
    stack: 'static',
    provider: 'github-pages',
    structuredDataTypes: [],
    publishing: { mode: publicationMode, finalArtifactVerified: artifact.provided ? artifact.state === 'pass' : undefined, cnameObserved: cnameObserved.length > 0 }
  });
  const platformFindings = platform.findings.filter(item => ['SPE-01-preferred-sources-scope', 'SPE-06-github-pages-publication-boundary'].includes(item.id));
  for (const item of platformFindings) {
    if (item.state === 'fail') findings.push(finding('fail', `platform:${item.id}`, item.message, item.evidence));
    else if (item.state === 'watch') findings.push(finding('watch', `platform:${item.id}`, item.message, item.evidence));
  }

  const failures = findings.filter(item => item.severity === 'fail');
  const watches = findings.filter(item => item.severity === 'watch');
  const artifactEvidenceComplete = failures.length === 0 && publicationMode !== 'unknown' && artifact.provided && artifact.state === 'pass';
  return {
    version: GITHUB_PAGES_SEARCH_PACK_VERSION,
    reviewedAt: registry.reviewedAt,
    repository,
    site: site.href,
    identity: { kind: identity.kind, siteScope: identity.siteScope, defaultHost: identity.defaultHost, expectedProjectPath: identity.expectedProjectPath },
    publication: { mode: publicationMode, source: pagesSource, jekyllBoundary: publication.jekyllBoundary, nojekyll: publication.nojekyll, pagesWorkflowFiles: workflows.pagesFiles },
    customDomain: { activeByInput: !site.hostname.toLowerCase().endsWith('.github.io'), cnameObserved: cnameObserved.map(item => ({ lane: item.lane, value: item.value })) },
    platform: { preferredSources: platformFindings.find(item => item.id === 'SPE-01-preferred-sources-scope'), publicationBoundary: platformFindings.find(item => item.id === 'SPE-06-github-pages-publication-boundary') },
    artifact,
    findings,
    failures,
    watches,
    pass: failures.length === 0,
    artifactEvidenceComplete,
    guardrails: registry.guardrails,
    note: 'This pack proves bounded GitHub Pages host/source/artifact evidence only. Exact deployed revision and live parity remain Production Search Build Gate evidence; indexing, ranking, Preferred Sources selection and traffic remain external outcomes.'
  };
}

export function formatGithubPagesSearchPackReport(report) {
  const preferred = report.platform.preferredSources;
  const lines = [
    `ARWP GitHub Pages Search Pack v${report.version}`,
    `Repository: ${report.repository.fullName}`,
    `Site: ${report.site}`,
    `Identity: ${report.identity.kind} · scope ${report.identity.siteScope}`,
    `Publishing: ${report.publication.mode} · source ${report.publication.source} · ${report.publication.jekyllBoundary}`,
    `Artifact: ${report.artifact.state}`,
    `Preferred Sources scope: ${preferred?.state || 'unknown'}`,
    `Result: ${report.pass ? 'PASS' : 'FAIL'} · ${report.failures.length} fail · ${report.watches.length} watch`,
    `Artifact evidence: ${report.artifactEvidenceComplete ? 'COMPLETE' : 'INCOMPLETE'}`
  ];
  if (report.findings.length) lines.push('', ...report.findings.map(item => `- ${item.severity.toUpperCase()} ${item.code}: ${item.message}`));
  lines.push('', report.note);
  return lines.join('\n');
}
