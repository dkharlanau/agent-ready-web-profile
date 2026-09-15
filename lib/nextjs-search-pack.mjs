import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileNextSiteStateGraph } from './repository-mapper-nextjs.mjs';
import { compileSearchArtifact } from './search-build-gate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.join(here, '..', 'registry', 'nextjs-search-pack-practices.json');
const CONFIG_NAMES = ['next.config.js', 'next.config.mjs', 'next.config.cjs', 'next.config.ts'];
const CODE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);
const PAGE_NAMES = new Set(['page.js', 'page.jsx', 'page.ts', 'page.tsx']);
const LAYOUT_NAMES = new Set(['layout.js', 'layout.jsx', 'layout.ts', 'layout.tsx']);
const ROUTE_NAMES = new Set(['route.js', 'route.ts']);
const IGNORED_DIRECTORIES = new Set(['.git', '.hg', '.svn', 'node_modules', '.next', 'out', 'dist', 'build', '.vercel', '.turbo', 'coverage']);

export const NEXTJS_SEARCH_PACK_VERSION = '0.2';

export function loadNextjsSearchPackRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function posix(value) { return String(value).replaceAll('\\', '/'); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function normalizeRepoPath(value, label = 'path') {
  const normalized = path.posix.normalize(posix(String(value || '.').replace(/^\.\//, '')) || '.');
  if (path.posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../')) throw new Error(`${label} must stay inside the repository.`);
  return normalized;
}
function siteJoin(siteRoot, relative) { return siteRoot === '.' ? relative : `${siteRoot}/${relative}`; }
function ensureInside(root, target, label) {
  const relative = path.relative(root, target);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return;
  throw new Error(`${label} resolves outside repository root.`);
}
function readBounded(file, maxFileBytes) {
  const stat = fs.statSync(file);
  if (stat.size > maxFileBytes) return null;
  return fs.readFileSync(file, 'utf8');
}

function scanCode(repositoryRoot, siteRoot, { maxFiles = 12000, maxFileBytes = 2 * 1024 * 1024 } = {}) {
  const projectRoot = path.resolve(repositoryRoot, siteRoot === '.' ? '' : siteRoot);
  ensureInside(repositoryRoot, projectRoot, 'siteRoot');
  const files = new Map();
  const skipped = [];
  let count = 0;
  function walk(directory, projectRelative = '') {
    for (const child of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = projectRelative ? `${projectRelative}/${child.name}` : child.name;
      const absolute = path.join(directory, child.name);
      const stat = fs.lstatSync(absolute);
      const repositoryPath = siteJoin(siteRoot, posix(rel));
      if (stat.isSymbolicLink()) { skipped.push({ path: repositoryPath, reason: 'symlink' }); continue; }
      if (stat.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(child.name)) walk(absolute, rel);
        continue;
      }
      if (!stat.isFile()) continue;
      const base = path.posix.basename(repositoryPath);
      if (base !== 'package.json' && !CONFIG_NAMES.includes(base) && !CODE_EXTENSIONS.has(path.posix.extname(base).toLowerCase())) continue;
      count += 1;
      if (count > maxFiles) throw new Error(`Next.js Search Pack exceeded maxFiles=${maxFiles}. Narrow siteRoot or raise the explicit limit.`);
      const text = readBounded(absolute, maxFileBytes);
      if (text == null) { skipped.push({ path: repositoryPath, reason: 'file-too-large' }); continue; }
      files.set(repositoryPath, { path: repositoryPath, projectRelative: posix(rel), text });
    }
  }
  walk(projectRoot);
  return { files, skipped };
}

function packageState(files, siteRoot) {
  const pathname = siteJoin(siteRoot, 'package.json');
  const entry = files.get(pathname);
  if (!entry) return { path: null, nextVersion: null };
  try {
    const json = JSON.parse(entry.text);
    const all = { ...(json.dependencies || {}), ...(json.devDependencies || {}), ...(json.peerDependencies || {}) };
    return { path: pathname, nextVersion: typeof all.next === 'string' ? all.next : null };
  } catch {
    return { path: pathname, nextVersion: null };
  }
}

function configState(files, siteRoot) {
  const paths = CONFIG_NAMES.map(name => siteJoin(siteRoot, name)).filter(name => files.has(name));
  if (paths.length > 1) throw new Error(`Next.js Search Pack found multiple config files: ${paths.join(', ')}`);
  const pathname = paths[0] || null;
  const text = pathname ? files.get(pathname).text : '';
  const outputMatch = /\boutput\s*:\s*(['"])([^'"]+)\1/.exec(text);
  const outputValue = outputMatch?.[2] || null;
  const outputExport = outputValue === 'export';
  const outputMentioned = /\boutput\s*:/.test(text) || /(?:\{|,)\s*output\s*(?:,|\})/.test(text);
  const distDir = /\bdistDir\s*:\s*(['"])([^'"]+)\1/.exec(text)?.[2] || null;
  const customImageLoader = /\bimages\s*:\s*\{[\s\S]*?\b(?:loader\s*:\s*['"]custom['"]|loaderFile\s*:|unoptimized\s*:\s*true)/m.test(text);
  return {
    path: pathname,
    text,
    deploymentMode: outputExport ? 'static-export' : 'dynamic-or-unspecified',
    outputResolved: !outputMentioned || Boolean(outputMatch),
    outputValue,
    expectedArtifactDirectory: outputExport ? (distDir || 'out') : null,
    distDir,
    customImageLoader,
    htmlLimitedBotsMentioned: /\bhtmlLimitedBots\b/.test(text),
    basePathMentioned: /\bbasePath\b/.test(text),
    assetPrefixMentioned: /\bassetPrefix\b/.test(text)
  };
}

function appRoot(files) {
  const roots = ['app', 'src/app'].filter(root => [...files.values()].some(entry => entry.projectRelative.startsWith(`${root}/`)));
  if (roots.length > 1) throw new Error(`Next.js Search Pack found both app/ and src/app/: ${roots.join(', ')}`);
  return roots[0] || null;
}

function directive(text, value) {
  const prefix = String(text).slice(0, 512);
  return new RegExp(`(?:^|\\n)\\s*['"]${value}['"]\\s*;?`).test(prefix);
}
function exportsStaticMetadata(text) { return /\bexport\s+const\s+metadata\b/.test(text); }
function exportsGenerateMetadata(text) { return /\bexport\s+(?:async\s+)?function\s+generateMetadata\b|\bexport\s+const\s+generateMetadata\b/.test(text); }
function hasGenerateStaticParams(text) { return /\bexport\s+(?:async\s+)?function\s+generateStaticParams\b|\bexport\s+const\s+generateStaticParams\b/.test(text); }
function isAppPage(entry, root) {
  return root && entry.projectRelative.startsWith(`${root}/`) && PAGE_NAMES.has(path.posix.basename(entry.projectRelative));
}
function isAppLayout(entry, root) {
  return root && entry.projectRelative.startsWith(`${root}/`) && LAYOUT_NAMES.has(path.posix.basename(entry.projectRelative));
}
function isRouteHandler(entry, root) {
  return root && entry.projectRelative.startsWith(`${root}/`) && ROUTE_NAMES.has(path.posix.basename(entry.projectRelative));
}
function routeDirectorySegments(projectRelative, root) {
  if (!root || !projectRelative.startsWith(`${root}/`)) return [];
  return path.posix.dirname(projectRelative.slice(root.length + 1)).split('/').filter(Boolean);
}
function dynamicSegments(projectRelative, root) {
  return routeDirectorySegments(projectRelative, root).filter(segment => /\[[^\]]+\]/.test(segment));
}
function interceptingSegments(projectRelative, root) {
  return routeDirectorySegments(projectRelative, root).filter(segment => segment.startsWith('(.)') || segment.startsWith('(..)') || segment.startsWith('(...)'));
}
function routeHasStaticParams(entry, root, files, siteRoot) {
  let directory = path.posix.dirname(entry.projectRelative);
  while (directory === root || directory.startsWith(`${root}/`)) {
    for (const name of [...PAGE_NAMES, ...LAYOUT_NAMES]) {
      const candidate = files.get(siteJoin(siteRoot, `${directory}/${name}`));
      if (candidate && hasGenerateStaticParams(candidate.text)) return candidate.path;
    }
    if (directory === root) break;
    directory = path.posix.dirname(directory);
  }
  return null;
}
function issue(severity, code, message, pathname = null, evidence = []) {
  return { severity, code, message, path: pathname, evidence: unique(evidence) };
}

function sourceDiagnostics(files, siteRoot, root, config) {
  const findings = [];
  const metadata = { staticExports: [], generateMetadata: [], metadataBase: [], htmlLimitedBots: config.htmlLimitedBotsMentioned ? [config.path].filter(Boolean) : [] };
  const dynamicRoutes = [];
  let nextImageImports = 0;

  if (!config.outputResolved) findings.push(issue('watch', 'next-output-mode-unresolved', 'next.config contains output configuration that is not reducible to a literal value. Deployment mode remains unresolved rather than guessed.', config.path));
  if (config.deploymentMode === 'static-export') {
    const configChecks = [
      ['rewrites', /\b(?:async\s+)?rewrites\s*\(/],
      ['redirects', /\b(?:async\s+)?redirects\s*\(/],
      ['headers', /\b(?:async\s+)?headers\s*\(/]
    ];
    for (const [name, pattern] of configChecks) {
      if (pattern.test(config.text)) findings.push(issue('fail', `next-static-export-${name}-unsupported`, `Next.js static export does not support config ${name}().`, config.path, [`next.config:${name}`]));
    }
    if (config.outputValue === 'export' && /\bexperimental\s*:\s*\{[\s\S]*?\boutput\s*:\s*['"]standalone['"]/m.test(config.text)) findings.push(issue('watch', 'next-static-export-mixed-output-signal', 'Static export config also contains a standalone output signal; review the effective config instead of guessing.', config.path));
  }
  if (config.htmlLimitedBotsMentioned) findings.push(issue('watch', 'next-html-limited-bots-overridden', 'htmlLimitedBots is explicitly configured. Review crawler-class metadata behavior; the Next.js default is normally sufficient.', config.path));
  if (config.assetPrefixMentioned && config.basePathMentioned) findings.push(issue('watch', 'next-asset-prefix-and-basepath', 'Both assetPrefix and basePath are configured. Verify sub-path routing and asset URLs in the final artifact.', config.path));

  for (const entry of files.values()) {
    const text = entry.text;
    const pageOrLayout = isAppPage(entry, root) || isAppLayout(entry, root);
    if (pageOrLayout) {
      if (exportsStaticMetadata(text)) metadata.staticExports.push(entry.path);
      if (exportsGenerateMetadata(text)) metadata.generateMetadata.push(entry.path);
      if (/\bmetadataBase\s*:/.test(text)) metadata.metadataBase.push(entry.path);
      if (directive(text, 'use client') && (exportsStaticMetadata(text) || exportsGenerateMetadata(text))) {
        findings.push(issue('fail', 'next-client-metadata-export', 'A Client Component also exports Next.js metadata/generateMetadata, which is a Server Component API.', entry.path));
      }
      const segments = dynamicSegments(entry.projectRelative, root);
      if (segments.length && isAppPage(entry, root)) {
        const paramsOwner = routeHasStaticParams(entry, root, files, siteRoot);
        dynamicRoutes.push({ path: entry.path, segments, generateStaticParamsOwner: paramsOwner });
        if (config.deploymentMode === 'static-export' && !paramsOwner) findings.push(issue('fail', 'next-static-export-dynamic-route-without-static-params', 'Static export dynamic routes require inspectable generateStaticParams() evidence.', entry.path, segments.map(segment => `segment:${segment}`)));
      }
      const intercepting = interceptingSegments(entry.projectRelative, root);
      if (config.deploymentMode === 'static-export' && intercepting.length && isAppPage(entry, root)) {
        findings.push(issue('fail', 'next-static-export-intercepting-route', 'Intercepting routes are unsupported by Next.js static export.', entry.path, intercepting.map(segment => `segment:${segment}`)));
      }
      if (config.deploymentMode === 'static-export' && /\bexport\s+const\s+dynamicParams\s*=\s*true\b/.test(text)) {
        findings.push(issue('fail', 'next-static-export-dynamic-params-true', 'dynamicParams=true is incompatible with static export because unknown dynamic paths require runtime handling.', entry.path));
      }
    }

    if (/\bfrom\s+['"]next\/image['"]|\brequire\(\s*['"]next\/image['"]\s*\)/.test(text)) nextImageImports += 1;

    if (config.deploymentMode === 'static-export') {
      if (directive(text, 'use server')) findings.push(issue('fail', 'next-static-export-server-action', 'Server Actions are unsupported in static export.', entry.path));
      const revalidateMatch = /\bexport\s+const\s+revalidate\s*=\s*([^;\n]+)/.exec(text);
      if (revalidateMatch) {
        const value = revalidateMatch[1].trim();
        if (/^\d+$/.test(value)) findings.push(issue('fail', 'next-static-export-isr', `revalidate=${value} requests runtime/ISR behavior that static export does not support.`, entry.path));
        else if (value !== 'false') findings.push(issue('watch', 'next-static-export-revalidate-unresolved', 'revalidate is exported but its value is not a literal false or integer; review the effective build behavior instead of guessing.', entry.path, [`revalidate:${value.slice(0, 80)}`]));
      }
      if (/\bfrom\s+['"]next\/headers['"]/.test(text)) {
        for (const api of ['cookies', 'headers', 'draftMode']) {
          if (new RegExp(`\\b${api}\\s*\\(`).test(text)) findings.push(issue('fail', `next-static-export-${api}-runtime`, `${api}() requires runtime/request state and is unsupported by static export.`, entry.path));
        }
      }
      if (isRouteHandler(entry, root)) {
        const functionVerbs = [...text.matchAll(/\bexport\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map(match => match[1]);
        const constVerbs = [...text.matchAll(/\bexport\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=/g)].map(match => match[1]);
        const verbs = unique([...functionVerbs, ...constVerbs]);
        const nonGet = verbs.filter(verb => verb !== 'GET');
        if (nonGet.length) findings.push(issue('fail', 'next-static-export-route-handler-non-get', `Static export Route Handlers support GET only; found ${nonGet.join(', ')}.`, entry.path));
        if (/\b(?:request|req)\s*\./.test(text)) findings.push(issue('fail', 'next-static-export-route-handler-request-dependent', 'Route Handler reads incoming Request data, which cannot be resolved by static export.', entry.path));
      }
    }

    const jsonLd = /application\/ld\+json/i.test(text);
    if (jsonLd && /JSON\.stringify\s*\(/.test(text)) {
      const inspectableSanitizer = /\\u003c/i.test(text) || /\.replace\s*\(\s*\/</.test(text) || /serialize-javascript/.test(text);
      if (!inspectableSanitizer) findings.push(issue('watch', 'next-jsonld-sanitization-unproven', 'JSON-LD uses JSON.stringify but no inspectable less-than escaping or known serializer was observed. Review custom sanitization before treating this as unsafe.', entry.path));
    }
  }

  for (const entry of files.values()) {
    const relative = entry.projectRelative;
    if (config.deploymentMode !== 'static-export') continue;
    if (/^(?:src\/)?(?:proxy|middleware)\.(?:js|ts)$/.test(relative)) findings.push(issue('fail', 'next-static-export-proxy-unsupported', 'Proxy/middleware requires server/runtime behavior and is unsupported in static export.', entry.path));
  }

  if (config.deploymentMode === 'static-export' && nextImageImports && !config.customImageLoader) {
    findings.push(issue('watch', 'next-static-export-image-loader-unproven', 'next/image is used, but a static-export-compatible custom loader or unoptimized config was not proven from next.config. Per-component loaders may still make this valid; prove it with the final build.', config.path));
  }

  return { findings, metadata: { ...metadata, staticExports: unique(metadata.staticExports), generateMetadata: unique(metadata.generateMetadata), metadataBase: unique(metadata.metadataBase) }, dynamicRoutes, nextImageImports };
}

export function compileNextjsSearchPack(options = {}) {
  const registry = options.registry || loadNextjsSearchPackRegistry();
  const repositoryRoot = fs.realpathSync(path.resolve(options.root || '.'));
  const siteRoot = normalizeRepoPath(options.siteRoot || options.repository?.siteRoot || '.', 'siteRoot');
  const scanned = scanCode(repositoryRoot, siteRoot, options);
  const pkg = packageState(scanned.files, siteRoot);
  const config = configState(scanned.files, siteRoot);
  if (!pkg.nextVersion && !config.path) throw new Error('Next.js Search Pack requires a next package dependency or next.config.* evidence.');
  const root = appRoot(scanned.files);
  if (!root) throw new Error('Next.js Search Pack v0.2 requires App Router source under app/ or src/app/.');

  const mapper = compileNextSiteStateGraph({
    ...options,
    root: repositoryRoot,
    siteRoot,
    repository: options.repository || { fullName: options.repositoryFullName, baseRef: options.baseRef, baseCommitSha: options.baseCommitSha },
    site: options.site || { origin: options.origin, basePath: options.basePath }
  });
  const source = sourceDiagnostics(scanned.files, siteRoot, root, config);
  const sourceFailures = source.findings.filter(item => item.severity === 'fail');
  const mapperUnresolved = mapper.routes.filter(route => route.state !== 'resolved').length + mapper.ownership.filter(item => item.state !== 'resolved').length;

  let artifact = { provided: false, state: 'not-provided', expectedDirectory: config.expectedArtifactDirectory, report: null };
  if (options.artifactRoot) {
    const report = compileSearchArtifact({
      artifactRoot: options.artifactRoot,
      site: options.artifactSite || options.siteUrl || `${mapper.site.origin}${mapper.site.basePath}`,
      sourceSha: options.sourceSha || mapper.repository.baseCommitSha || null
    });
    artifact = { provided: true, state: report.pass ? 'pass' : 'fail', expectedDirectory: config.expectedArtifactDirectory, report };
  }

  const findings = [...source.findings];
  if (config.deploymentMode === 'static-export' && !artifact.provided) findings.push(issue('watch', 'next-static-export-final-artifact-not-provided', `Static export is declared; inspect the final ${config.expectedArtifactDirectory || 'out'} artifact before release evidence is complete.`, config.path));
  if (artifact.provided && !artifact.report.pass) findings.push(issue('fail', 'next-final-artifact-search-contract-failed', 'The supplied final artifact failed Production Search Build Gate. Source-level correctness is not enough for release.', null, artifact.report.failures));

  const failures = findings.filter(item => item.severity === 'fail');
  const watches = findings.filter(item => item.severity === 'watch');
  const releaseEvidenceComplete = failures.length === 0 && (config.deploymentMode !== 'static-export' || (artifact.provided && artifact.state === 'pass'));

  return {
    version: NEXTJS_SEARCH_PACK_VERSION,
    reviewedAt: registry.reviewedAt,
    repository: mapper.repository,
    site: mapper.site,
    framework: { adapter: mapper.adapter.id, mapperVersion: mapper.adapter.version, nextVersion: pkg.nextVersion, appRoot: root },
    deployment: {
      mode: config.deploymentMode,
      configPath: config.path,
      expectedArtifactDirectory: config.expectedArtifactDirectory,
      outputResolved: config.outputResolved,
      customImageLoaderProven: config.customImageLoader
    },
    source: {
      scannedFiles: scanned.files.size,
      skipped: scanned.skipped,
      mapperSummary: mapper.summary,
      mapperWarnings: mapper.warnings,
      mapperUnresolved,
      metadata: source.metadata,
      dynamicRoutes: source.dynamicRoutes,
      nextImageImports: source.nextImageImports
    },
    artifact,
    findings,
    failures,
    watches,
    sourcePass: sourceFailures.length === 0,
    pass: failures.length === 0,
    releaseEvidenceComplete,
    guardrails: registry.guardrails
  };
}

export function formatNextjsSearchPackReport(report) {
  const lines = [
    `ARWP Next.js Search Pack v${report.version}`,
    `Repository: ${report.repository.fullName}`,
    `Next.js: ${report.framework.nextVersion || 'version-unresolved'} · App Router ${report.framework.appRoot}`,
    `Deployment: ${report.deployment.mode}${report.deployment.expectedArtifactDirectory ? ` · artifact ${report.deployment.expectedArtifactDirectory}/` : ''}`,
    `Source: ${report.sourcePass ? 'PASS' : 'FAIL'} · ${report.failures.length} fail · ${report.watches.length} watch`,
    `Artifact: ${report.artifact.state}`,
    `Release evidence: ${report.releaseEvidenceComplete ? 'COMPLETE' : 'INCOMPLETE'}`
  ];
  if (report.findings.length) lines.push('', ...report.findings.map(item => `- ${item.severity.toUpperCase()} ${item.code}${item.path ? ` (${item.path})` : ''}: ${item.message}`));
  lines.push('', 'This report does not prove indexing, ranking, Search-selected presentation, AI citation, traffic or business impact.');
  return lines.join('\n');
}
