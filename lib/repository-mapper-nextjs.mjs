import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { validateSiteStateGraph } from './repository-mapper.mjs';

export const NEXTJS_REPOSITORY_MAPPER_VERSION = '0.1';

const CONFIG_NAMES = ['next.config.js', 'next.config.mjs', 'next.config.cjs', 'next.config.ts'];
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.md', '.mdx', '.txt', '.xml', '.yml', '.yaml']);
const PAGE_NAMES = new Set(['page.js', 'page.jsx', 'page.ts', 'page.tsx']);
const LAYOUT_NAMES = new Set(['layout.js', 'layout.jsx', 'layout.ts', 'layout.tsx']);
const METADATA_ROUTES = new Map([
  ['robots.js', { routePath: '/robots.txt', surfaceType: 'robots-file', mutationClass: 'policy-gated' }],
  ['robots.ts', { routePath: '/robots.txt', surfaceType: 'robots-file', mutationClass: 'policy-gated' }],
  ['sitemap.js', { routePath: '/sitemap.xml', surfaceType: 'sitemap', mutationClass: 'grounded-template' }],
  ['sitemap.ts', { routePath: '/sitemap.xml', surfaceType: 'sitemap', mutationClass: 'grounded-template' }],
  ['manifest.js', { routePath: '/manifest.webmanifest', surfaceType: 'other-machine-surface', mutationClass: 'grounded-template' }],
  ['manifest.ts', { routePath: '/manifest.webmanifest', surfaceType: 'other-machine-surface', mutationClass: 'grounded-template' }]
]);
const IGNORED_DIRECTORIES = new Set(['.git', '.hg', '.svn', 'node_modules', '.next', 'out', 'dist', 'build', '.vercel', '.turbo', 'coverage']);
const GENERATED_DIRECTORIES = new Set(['.next', 'out', 'dist', 'build', '.vercel']);

function posix(value) { return String(value).replaceAll('\\', '/'); }
function digest(buffer) { return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`; }
function shortHash(value, length = 20) { return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, length); }
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

function normalizeBase(value) {
  if (!value) return '/';
  let result = String(value).trim();
  if (!result.startsWith('/')) result = `/${result}`;
  result = result.replace(/\/{2,}/g, '/');
  if (!result.endsWith('/')) result += '/';
  return result;
}

function publicUrl(site, routePath) {
  const base = site.basePath === '/' ? '' : site.basePath.replace(/\/$/, '');
  return new URL(`${base}${routePath}`.replace(/\/{2,}/g, '/'), site.origin).href;
}

function isTextCandidate(repositoryPath) {
  const base = path.posix.basename(repositoryPath);
  return base === 'package.json' || CONFIG_NAMES.includes(base) || SOURCE_EXTENSIONS.has(path.posix.extname(base).toLowerCase());
}

function scanRepository(repositoryRoot, siteRoot, options = {}) {
  const maxFiles = Number.isInteger(options.maxFiles) ? options.maxFiles : 12000;
  const maxFileBytes = Number.isInteger(options.maxFileBytes) ? options.maxFileBytes : 2 * 1024 * 1024;
  const projectRoot = path.resolve(repositoryRoot, siteRoot === '.' ? '' : siteRoot);
  ensureInside(repositoryRoot, projectRoot, 'siteRoot');
  const entries = new Map();
  const warnings = [];
  let inspected = 0;

  function walk(directory, projectRelative = '') {
    for (const child of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const nextRelative = projectRelative ? `${projectRelative}/${child.name}` : child.name;
      const absolute = path.join(directory, child.name);
      const stat = fs.lstatSync(absolute);
      const repositoryPath = siteJoin(siteRoot, posix(nextRelative));
      if (stat.isSymbolicLink()) {
        warnings.push({ code: 'symlink-skipped', message: 'Next.js Repository Mapper does not follow symbolic links.', path: repositoryPath });
        continue;
      }
      if (stat.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(child.name)) {
          if (GENERATED_DIRECTORIES.has(child.name)) warnings.push({ code: 'generated-output-skipped', message: `Generated/output directory ${child.name} was not considered source ownership.`, path: repositoryPath });
          continue;
        }
        walk(absolute, nextRelative);
        continue;
      }
      if (!stat.isFile() || !isTextCandidate(repositoryPath)) continue;
      inspected += 1;
      if (inspected > maxFiles) throw new Error(`Next.js Repository Mapper exceeded maxFiles=${maxFiles}. Narrow siteRoot or raise the explicit limit.`);
      if (stat.size > maxFileBytes) {
        warnings.push({ code: 'file-too-large', message: `File exceeds mapper maxFileBytes=${maxFileBytes}; ownership was not inferred from it.`, path: repositoryPath });
        continue;
      }
      const buffer = fs.readFileSync(absolute);
      entries.set(repositoryPath, { path: repositoryPath, projectRelative: posix(nextRelative), bytes: buffer.length, sha256: digest(buffer), text: buffer.toString('utf8') });
    }
  }

  walk(projectRoot);
  return { entries, warnings };
}

function packageState(entries, siteRoot) {
  const pathname = siteJoin(siteRoot, 'package.json');
  const entry = entries.get(pathname);
  if (!entry) return { path: null, nextDependency: false };
  try {
    const json = JSON.parse(entry.text);
    const dependencies = { ...(json.dependencies || {}), ...(json.devDependencies || {}), ...(json.peerDependencies || {}) };
    return { path: pathname, nextDependency: typeof dependencies.next === 'string' };
  } catch {
    return { path: pathname, nextDependency: false };
  }
}

export function detectNextRepositorySignals(options = {}) {
  const repositoryRoot = fs.realpathSync(path.resolve(options.root || '.'));
  const siteRoot = normalizeRepoPath(options.siteRoot || options.repository?.siteRoot || '.', 'siteRoot');
  const projectRoot = fs.realpathSync(path.resolve(repositoryRoot, siteRoot));
  ensureInside(repositoryRoot, projectRoot, 'siteRoot');
  const signals = [];
  for (const name of CONFIG_NAMES) if (fs.existsSync(path.join(projectRoot, name))) signals.push(`config:${siteJoin(siteRoot, name)}`);
  const packagePath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packagePath)) {
    try {
      const json = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const dependencies = { ...(json.dependencies || {}), ...(json.devDependencies || {}), ...(json.peerDependencies || {}) };
      if (typeof dependencies.next === 'string') signals.push(`package:${siteJoin(siteRoot, 'package.json')}:next`);
    } catch {
      // Invalid package.json is not evidence that this is a Next.js repository.
    }
  }
  return signals;
}

function configState(entries, siteRoot, site, warnings) {
  const configs = CONFIG_NAMES.map(name => siteJoin(siteRoot, name)).filter(name => entries.has(name));
  if (configs.length > 1) throw new Error(`Next.js adapter found multiple config files: ${configs.join(', ')}`);
  const pathname = configs[0] || null;
  const text = pathname ? entries.get(pathname).text : '';
  let routingResolved = true;

  const baseMention = /\bbasePath\b/.test(text);
  const baseMatch = /\bbasePath\s*:\s*(["'])([^"']*)\1/.exec(text);
  if (baseMention && !baseMatch) {
    routingResolved = false;
    warnings.push({ code: 'next-basepath-not-literal', message: 'Next.js basePath is referenced but not reducible to a literal config value; route URLs were not guessed.', path: pathname });
  }
  if (baseMatch && normalizeBase(baseMatch[2]) !== site.basePath) throw new Error(`Next.js config basePath ${normalizeBase(baseMatch[2])} conflicts with requested site basePath ${site.basePath}.`);

  const trailingMention = /\btrailingSlash\b/.test(text);
  const trailingMatch = /\btrailingSlash\s*:\s*(true|false)\b/.exec(text);
  if (trailingMention && !trailingMatch) {
    routingResolved = false;
    warnings.push({ code: 'next-trailing-slash-not-literal', message: 'Next.js trailingSlash is referenced but not reducible to a literal boolean; route URL normalization was not guessed.', path: pathname });
  }
  const trailingSlash = trailingMatch ? trailingMatch[1] === 'true' : false;

  const skipTrailingMention = /\bskipTrailingSlashRedirect\b/.test(text);
  const skipTrailingMatch = /\bskipTrailingSlashRedirect\s*:\s*(true|false)\b/.exec(text);
  if (skipTrailingMention && (!skipTrailingMatch || skipTrailingMatch[1] === 'true')) {
    routingResolved = false;
    warnings.push({ code: 'next-trailing-slash-redirect-unresolved', message: 'skipTrailingSlashRedirect may make multiple URL spellings routable; v0.1 does not select a canonical route spelling.', path: pathname });
  }

  const hasRewrites = /\b(?:async\s+)?rewrites\s*\(/.test(text);
  if (/\b(?:async\s+)?redirects\s*\(/.test(text)) warnings.push({ code: 'next-redirects-not-executed', message: 'Next.js redirects are not executed by Repository Mapper; source route ownership is mapped separately.', path: pathname });
  if (/\b(?:async\s+)?headers\s*\(/.test(text)) warnings.push({ code: 'next-headers-not-executed', message: 'Next.js response headers are runtime/config behavior and are not represented as route metadata ownership.', path: pathname });
  if (hasRewrites) warnings.push({ code: 'next-rewrites-not-executed', message: 'Next.js rewrites can change public routing; v0.1 preserves affected route ownership conservatively.', path: pathname });
  return { path: pathname, routingResolved, hasRewrites, trailingSlash };
}

function appRoot(entries) {
  const roots = ['app', 'src/app'].filter(root => [...entries.values()].some(entry => entry.projectRelative.startsWith(`${root}/`)));
  if (roots.length > 1) throw new Error(`Next.js adapter found both app/ and src/app/ source roots: ${roots.join(', ')}`);
  if (!roots.length) throw new Error('Next.js v0.1 requires App Router source ownership under app/ or src/app/. Pages Router-only repositories are unsupported.');
  return roots[0];
}

function routeFromPage(projectRelative, appRootPath, trailingSlash = false) {
  const prefix = `${appRootPath}/`;
  if (!projectRelative.startsWith(prefix) || !PAGE_NAMES.has(path.posix.basename(projectRelative))) return null;
  const directory = path.posix.dirname(projectRelative.slice(prefix.length));
  if (directory === '.') return { routePath: '/', dynamic: false, reason: null };
  const segments = [];
  for (const segment of directory.split('/').filter(Boolean)) {
    if (segment.startsWith('@') || segment.startsWith('(..') || segment.startsWith('(.)') || segment.startsWith('(...)')) return { routePath: null, dynamic: true, reason: 'parallel-or-intercepting-route' };
    if (/\[[^\]]+\]/.test(segment)) return { routePath: null, dynamic: true, reason: 'dynamic-segment' };
    if (/^\(.+\)$/.test(segment)) continue;
    segments.push(segment);
  }
  const stem = segments.length ? `/${segments.join('/')}` : '/';
  return { routePath: stem === '/' ? '/' : `${stem}${trailingSlash ? '/' : ''}`, dynamic: false, reason: null };
}

function ancestorLayouts(pagePath, entries, appRootPath, siteRoot) {
  const relative = siteRoot === '.' ? pagePath : pagePath.slice(siteRoot.length + 1);
  let directory = path.posix.dirname(relative);
  const result = [];
  while (directory === appRootPath || directory.startsWith(`${appRootPath}/`)) {
    for (const name of LAYOUT_NAMES) {
      const candidatePath = siteJoin(siteRoot, `${directory}/${name}`);
      if (entries.has(candidatePath)) { result.push(candidatePath); break; }
    }
    if (directory === appRootPath) break;
    directory = path.posix.dirname(directory);
  }
  return result.reverse();
}

function candidate(pathname, evidenceClass, evidence, confidence = 'deterministic') {
  return { path: pathname, evidenceClass, confidence, evidence: unique(evidence) };
}

function buildRoutes(entries, siteRoot, appRootPath, site, config, packageInfo, warnings) {
  const routes = [];
  const ownership = [];
  for (const entry of entries.values()) {
    const mapped = routeFromPage(entry.projectRelative, appRootPath, config.trailingSlash);
    if (!mapped) continue;
    const sourcePath = entry.path;
    if (/\b(?:export\s+)?(?:async\s+)?function\s+generateMetadata\b|\bexport\s+const\s+generateMetadata\b/.test(entry.text)) {
      warnings.push({ code: 'next-computed-metadata-unmapped', message: 'generateMetadata() was detected; v0.1 does not infer metadata field ownership from executable code.', path: sourcePath });
    }
    if (mapped.dynamic || !config.routingResolved || config.hasRewrites) {
      const evidence = [
        `next:app-router:${entry.projectRelative}`,
        ...(mapped.reason ? [`next:${mapped.reason}`] : []),
        ...(!config.routingResolved ? ['next:routing-config-unresolved'] : []),
        ...(config.hasRewrites ? ['next:rewrites-present'] : [])
      ];
      warnings.push({ code: 'next-route-unresolved', message: 'Next.js route was kept unresolved because dynamic/config routing requires execution or additional evidence.', path: sourcePath });
      routes.push({ id: `route:unresolved:${shortHash(sourcePath, 18)}`, routePath: mapped.routePath, url: mapped.routePath ? publicUrl(site, mapped.routePath) : null, state: 'unresolved', ownerPath: null, candidates: [candidate(sourcePath, 'next-dynamic-route', evidence, 'ambiguous')], buildPath: [], evidence });
      continue;
    }
    const buildPath = unique([sourcePath, ...ancestorLayouts(sourcePath, entries, appRootPath, siteRoot), config.path, packageInfo.path]);
    const evidence = [`next:app-file-route:${entry.projectRelative}->${mapped.routePath}`];
    const route = { id: `route:${shortHash(mapped.routePath, 20)}`, routePath: mapped.routePath, url: publicUrl(site, mapped.routePath), state: 'resolved', ownerPath: sourcePath, candidates: [candidate(sourcePath, 'next-app-route', evidence)], buildPath, evidence };
    routes.push(route);
    ownership.push({ surfaceKey: `route:${mapped.routePath}:document`, surfaceType: 'document', routePath: mapped.routePath, state: 'resolved', ownerPath: sourcePath, candidates: route.candidates, mutationClass: 'grounded-template', evidenceClass: 'direct-source', value: route.url, locator: null, evidence });
  }
  return { routes, ownership };
}

function buildMetadataRoutes(entries, appRootPath, site, warnings) {
  const ownership = [];
  const appPrefix = `${appRootPath}/`;
  for (const entry of entries.values()) {
    if (!entry.projectRelative.startsWith(appPrefix)) continue;
    const rel = entry.projectRelative.slice(appPrefix.length);
    if (rel.includes('/')) continue;
    const descriptor = METADATA_ROUTES.get(rel);
    if (!descriptor) continue;

    if (rel.startsWith('sitemap.') && /\bgenerateSitemaps\b/.test(entry.text)) {
      const evidence = [`next:metadata-route:${rel}`, 'next:generate-sitemaps-dynamic'];
      warnings.push({ code: 'next-dynamic-sitemap-unmapped', message: 'generateSitemaps() changes sitemap output paths; v0.1 does not invent sitemap IDs or /sitemap.xml ownership.', path: entry.path });
      ownership.push({
        surfaceKey: `machine:unresolved:sitemap:${shortHash(entry.path, 12)}`,
        surfaceType: 'sitemap',
        routePath: null,
        state: 'unresolved',
        ownerPath: null,
        candidates: [candidate(entry.path, 'next-metadata-route', evidence, 'ambiguous')],
        mutationClass: 'grounded-template',
        evidenceClass: 'unresolved',
        value: null,
        locator: null,
        evidence
      });
      continue;
    }

    const evidence = [`next:metadata-route:${rel}->${descriptor.routePath}`];
    ownership.push({
      surfaceKey: `machine:${descriptor.routePath}`,
      surfaceType: descriptor.surfaceType,
      routePath: descriptor.routePath,
      state: 'resolved',
      ownerPath: entry.path,
      candidates: [candidate(entry.path, 'next-metadata-route', evidence)],
      mutationClass: descriptor.mutationClass,
      evidenceClass: 'machine-file-path',
      value: publicUrl(site, descriptor.routePath),
      locator: null,
      evidence
    });
  }
  return ownership;
}

function fileRole(entry, appRootPath, siteRoot, pagePaths, metadataPaths, configPath, packagePath) {
  if (metadataPaths.has(entry.path)) return 'machine-surface';
  if (pagePaths.has(entry.path)) return 'page-source';
  if (entry.path === configPath || entry.path === packagePath) return 'build-config';
  const relative = siteRoot === '.' ? entry.path : entry.path.slice(siteRoot.length + 1);
  if (relative.startsWith(`${appRootPath}/`) && LAYOUT_NAMES.has(path.posix.basename(relative))) return 'layout';
  if (/^(?:src\/)?components\//.test(relative)) return 'include';
  if (/^(?:src\/)?data\//.test(relative)) return 'data';
  if (/^(?:src\/)?content\//.test(relative)) return 'content';
  return 'other';
}

function summarize(files, routes, ownership) {
  return {
    files: files.length,
    routes: routes.length,
    resolvedRoutes: routes.filter(route => route.state === 'resolved').length,
    ambiguousRoutes: routes.filter(route => route.state === 'ambiguous').length,
    unresolvedRoutes: routes.filter(route => route.state === 'unresolved').length,
    ownershipClaims: ownership.length,
    resolvedOwnership: ownership.filter(item => item.state === 'resolved').length,
    ambiguousOwnership: ownership.filter(item => item.state === 'ambiguous').length,
    unresolvedOwnership: ownership.filter(item => item.state === 'unresolved').length,
    facts: 0
  };
}

export function compileNextSiteStateGraph(options = {}) {
  const repositoryRoot = fs.realpathSync(path.resolve(options.root || '.'));
  const siteRoot = normalizeRepoPath(options.siteRoot || options.repository?.siteRoot || '.', 'siteRoot');
  const projectRoot = fs.realpathSync(path.resolve(repositoryRoot, siteRoot));
  ensureInside(repositoryRoot, projectRoot, 'siteRoot');
  const repository = {
    fullName: String(options.repository?.fullName || options.repositoryFullName || '').trim(),
    baseRef: String(options.repository?.baseRef || options.baseRef || 'main').trim(),
    baseCommitSha: options.repository?.baseCommitSha || options.baseCommitSha || null,
    siteRoot
  };
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository.fullName)) throw new Error('repository.fullName must use owner/name form.');
  if (repository.baseCommitSha != null && !/^[0-9a-f]{40}$/.test(repository.baseCommitSha)) throw new Error('repository.baseCommitSha must be a lowercase 40-character git SHA or null.');
  const parsedOrigin = new URL(String(options.site?.origin || options.origin || ''));
  if (parsedOrigin.protocol !== 'https:') throw new Error('site.origin must use https.');
  const site = { origin: parsedOrigin.origin, basePath: normalizeBase(options.site?.basePath || options.basePath || '/') };

  const scanned = scanRepository(repositoryRoot, siteRoot, options);
  const packageInfo = packageState(scanned.entries, siteRoot);
  const configs = CONFIG_NAMES.map(name => siteJoin(siteRoot, name)).filter(name => scanned.entries.has(name));
  if (!configs.length && !packageInfo.nextDependency) throw new Error('Next.js adapter requires next.config.* or a next package dependency as repository evidence.');
  const config = configState(scanned.entries, siteRoot, site, scanned.warnings);
  const appRootPath = appRoot(scanned.entries);
  const built = buildRoutes(scanned.entries, siteRoot, appRootPath, site, config, packageInfo, scanned.warnings);
  const machineOwnership = buildMetadataRoutes(scanned.entries, appRootPath, site, scanned.warnings);
  const ownership = [...built.ownership, ...machineOwnership].sort((a, b) => a.surfaceKey.localeCompare(b.surfaceKey));
  const pagePaths = new Set([...scanned.entries.values()].filter(entry => routeFromPage(entry.projectRelative, appRootPath, config.trailingSlash)).map(entry => entry.path));
  const metadataPaths = new Set(machineOwnership.map(item => item.ownerPath).filter(Boolean));
  const machineByPath = new Map(machineOwnership.filter(item => item.ownerPath).map(item => [item.ownerPath, item]));
  const files = [...scanned.entries.values()].map(entry => {
    const role = fileRole(entry, appRootPath, siteRoot, pagePaths, metadataPaths, config.path, packageInfo.path);
    let mutationClass = 'grounded-template';
    if (role === 'content') mutationClass = 'editorial';
    if (role === 'machine-surface') mutationClass = machineByPath.get(entry.path)?.mutationClass || 'grounded-template';
    return { path: entry.path, sha256: entry.sha256, bytes: entry.bytes, role, mutationClass, generated: false };
  }).sort((a, b) => a.path.localeCompare(b.path));

  const detection = unique([...configs.map(pathname => `config:${pathname}`), ...(packageInfo.nextDependency ? [`package:${packageInfo.path}:next`] : []), `app-router:${siteJoin(siteRoot, appRootPath)}`]);
  const graph = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/site-state-graph.schema.json',
    version: '0.1',
    generatedAt: new Date(options.generatedAt || Date.now()).toISOString(),
    repository,
    site,
    adapter: { id: 'nextjs', version: NEXTJS_REPOSITORY_MAPPER_VERSION, detection, confidence: 'explicit-config' },
    files,
    routes: built.routes.sort((a, b) => String(a.routePath || a.id).localeCompare(String(b.routePath || b.id))),
    ownership,
    facts: [],
    warnings: scanned.warnings,
    summary: summarize(files, built.routes, ownership),
    guardrails: { noPathGuessing: true, ambiguityPreserved: true, generatedOutputNotPreferred: true, ownershipIsNotAuthorization: true, policyAndEditorialRemainGated: true, symlinksNotFollowed: true, noRankingGuarantee: true }
  };
  const validation = validateSiteStateGraph(graph);
  if (!validation.valid) throw new Error(`Generated Next.js Site State Graph is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return graph;
}
