import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { validateSiteStateGraph } from './repository-mapper.mjs';

export const ASTRO_REPOSITORY_MAPPER_VERSION = '0.1';

const IGNORED_DIRECTORIES = new Set([
  '.git', '.hg', '.svn', 'node_modules', 'dist', 'build', 'out', '.astro', '.next',
  '.vercel', '.netlify', 'coverage', '.cache', '.turbo'
]);
const GENERATED_DIRECTORIES = new Set(['dist', 'build', 'out', '.astro', '.next', '.vercel', '.netlify']);
const TEXT_EXTENSIONS = new Set([
  '.astro', '.md', '.mdx', '.html', '.htm', '.json', '.js', '.mjs', '.cjs', '.ts', '.mts', '.cts',
  '.yml', '.yaml', '.txt', '.xml', '.css', '.scss'
]);
const CONFIG_NAMES = ['astro.config.mjs', 'astro.config.js', 'astro.config.ts', 'astro.config.cjs'];
const PAGE_EXTENSIONS = new Set(['.astro', '.md', '.mdx', '.html']);

function posix(value) {
  return String(value).replaceAll('\\', '/');
}

function normalizeRepoPath(value, label = 'path') {
  const normalized = path.posix.normalize(posix(String(value || '.').replace(/^\.\//, '')) || '.');
  if (path.posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`${label} must stay inside the repository.`);
  }
  return normalized;
}

function siteJoin(siteRoot, relative) {
  return siteRoot === '.' ? relative : `${siteRoot}/${relative}`;
}

function ensureInside(root, target, label) {
  const relative = path.relative(root, target);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return;
  throw new Error(`${label} resolves outside repository root.`);
}

function digest(buffer) {
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

function shortHash(value, length = 20) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, length);
}

function isTextCandidate(repositoryPath) {
  const base = path.posix.basename(repositoryPath);
  return base === 'package.json' || CONFIG_NAMES.includes(base) || TEXT_EXTENSIONS.has(path.posix.extname(base).toLowerCase());
}

function scanRepository(repositoryRoot, siteRoot, options = {}) {
  const maxFiles = Number.isInteger(options.maxFiles) ? options.maxFiles : 10000;
  const maxFileBytes = Number.isInteger(options.maxFileBytes) ? options.maxFileBytes : 2 * 1024 * 1024;
  const projectRoot = path.resolve(repositoryRoot, siteRoot === '.' ? '' : siteRoot);
  ensureInside(repositoryRoot, projectRoot, 'siteRoot');
  const entries = new Map();
  const warnings = [];
  let inspected = 0;

  function walk(directory, projectRelative = '') {
    const children = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      const nextProjectRelative = projectRelative ? `${projectRelative}/${child.name}` : child.name;
      const absolute = path.join(directory, child.name);
      const stat = fs.lstatSync(absolute);
      const repositoryPath = siteJoin(siteRoot, posix(nextProjectRelative));
      if (stat.isSymbolicLink()) {
        warnings.push({ code: 'symlink-skipped', message: 'Astro Repository Mapper does not follow symbolic links.', path: repositoryPath });
        continue;
      }
      if (stat.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(child.name)) {
          if (GENERATED_DIRECTORIES.has(child.name)) warnings.push({ code: 'generated-output-skipped', message: `Generated/output directory ${child.name} was not considered source ownership.`, path: repositoryPath });
          continue;
        }
        walk(absolute, nextProjectRelative);
        continue;
      }
      if (!stat.isFile() || !isTextCandidate(repositoryPath)) continue;
      inspected += 1;
      if (inspected > maxFiles) throw new Error(`Astro Repository Mapper exceeded maxFiles=${maxFiles}. Narrow siteRoot or raise the explicit limit.`);
      if (stat.size > maxFileBytes) {
        warnings.push({ code: 'file-too-large', message: `File exceeds mapper maxFileBytes=${maxFileBytes}; ownership was not inferred from it.`, path: repositoryPath });
        continue;
      }
      const buffer = fs.readFileSync(absolute);
      entries.set(repositoryPath, {
        path: repositoryPath,
        projectRelative: posix(nextProjectRelative),
        bytes: buffer.length,
        sha256: digest(buffer),
        text: buffer.toString('utf8')
      });
    }
  }

  walk(projectRoot);
  return { entries, warnings };
}

function packageInfo(entries, siteRoot) {
  const pathname = siteJoin(siteRoot, 'package.json');
  const entry = entries.get(pathname);
  if (!entry) return { path: null, json: null, astroDependency: false, mdxIntegration: false };
  try {
    const json = JSON.parse(entry.text);
    const dependencies = { ...(json.dependencies || {}), ...(json.devDependencies || {}), ...(json.peerDependencies || {}) };
    return {
      path: pathname,
      json,
      astroDependency: typeof dependencies.astro === 'string',
      mdxIntegration: typeof dependencies['@astrojs/mdx'] === 'string'
    };
  } catch {
    return { path: pathname, json: null, astroDependency: false, mdxIntegration: false };
  }
}

function configEntries(entries, siteRoot) {
  return CONFIG_NAMES.map(name => siteJoin(siteRoot, name)).filter(name => entries.has(name));
}

export function detectAstroRepositorySignals(options = {}) {
  const repositoryRoot = fs.realpathSync(path.resolve(options.root || '.'));
  const siteRoot = normalizeRepoPath(options.siteRoot || options.repository?.siteRoot || '.', 'siteRoot');
  const projectRoot = fs.realpathSync(path.resolve(repositoryRoot, siteRoot));
  ensureInside(repositoryRoot, projectRoot, 'siteRoot');
  const signals = [];
  for (const name of CONFIG_NAMES) {
    if (fs.existsSync(path.join(projectRoot, name))) signals.push(`config:${siteJoin(siteRoot, name)}`);
  }
  const packagePath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packagePath)) {
    try {
      const json = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const dependencies = { ...(json.dependencies || {}), ...(json.devDependencies || {}), ...(json.peerDependencies || {}) };
      if (typeof dependencies.astro === 'string') signals.push(`package:${siteJoin(siteRoot, 'package.json')}:astro`);
    } catch {
      signals.push(`package:${siteJoin(siteRoot, 'package.json')}:invalid-json`);
    }
  }
  return signals;
}

function literalProperty(text, key, allowed = null) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const presence = new RegExp(`\\b${escaped}\\s*:`).test(text);
  const match = new RegExp(`(?:^|[,{]\\s*)${escaped}\\s*:\\s*(["'])([^"']+)\\1`, 'm').exec(text);
  if (!presence) return { present: false, known: true, value: null };
  if (!match) return { present: true, known: false, value: null };
  if (allowed && !allowed.includes(match[2])) return { present: true, known: false, value: match[2] };
  return { present: true, known: true, value: match[2] };
}

function buildFormatProperty(text) {
  const buildPresence = /\bbuild\s*:/.test(text);
  if (!buildPresence) return { present: false, known: true, value: null };
  const simpleBuild = /\bbuild\s*:\s*\{([\s\S]{0,2000}?)\}/m.exec(text);
  if (!simpleBuild) return { present: true, known: false, value: null };
  const format = literalProperty(`{${simpleBuild[1]}}`, 'format', ['file', 'directory', 'preserve']);
  return format.present ? format : { present: false, known: true, value: null };
}

function normalizeBase(value) {
  if (!value) return '/';
  let result = String(value).trim();
  if (!result.startsWith('/')) result = `/${result}`;
  result = result.replace(/\/{2,}/g, '/');
  if (!result.endsWith('/')) result += '/';
  return result;
}

function inspectConfig(entries, siteRoot, site, warnings) {
  const configs = configEntries(entries, siteRoot);
  if (configs.length > 1) throw new Error(`Astro adapter found multiple config files: ${configs.join(', ')}`);
  const pathname = configs[0] || null;
  const text = pathname ? entries.get(pathname).text : '';
  const unsupported = [];

  const output = literalProperty(text, 'output', ['static', 'server']);
  if (!output.known) unsupported.push('output-not-literal');
  const buildFormat = buildFormatProperty(text);
  if (!buildFormat.known) unsupported.push('build.format-not-literal');
  const siteOption = literalProperty(text, 'site');
  if (!siteOption.known) unsupported.push('site-not-literal');
  const base = literalProperty(text, 'base');
  if (!base.known) unsupported.push('base-not-literal');
  const trailingSlash = literalProperty(text, 'trailingSlash', ['always', 'never', 'ignore']);
  if (!trailingSlash.known) unsupported.push('trailingSlash-not-literal');
  const srcDir = literalProperty(text, 'srcDir');
  if (!srcDir.known) unsupported.push('srcDir-not-literal');
  const publicDir = literalProperty(text, 'publicDir');
  if (!publicDir.known) unsupported.push('publicDir-not-literal');
  const rootOption = literalProperty(text, 'root');
  if (rootOption.present && (!rootOption.known || !['.', './'].includes(rootOption.value))) unsupported.push('custom-root-unsupported');
  if (/\bi18n\s*:/.test(text)) unsupported.push('i18n-routing-unsupported');
  if (/\bredirects\s*:/.test(text)) warnings.push({ code: 'astro-redirects-not-mapped', message: 'Astro config defines redirects; v0.1 maps source-owned pages but not redirect-generated routes.', path: pathname });
  if (/\bintegrations\s*:/.test(text)) warnings.push({ code: 'astro-integration-routes-not-mapped', message: 'Astro integrations are not executed; integration-generated routes are outside v0.1 ownership evidence.', path: pathname });

  if (siteOption.value) {
    let configured;
    try { configured = new URL(siteOption.value); } catch { throw new Error(`Astro config site is not a valid absolute URL: ${siteOption.value}`); }
    if (configured.origin !== site.origin) throw new Error(`Astro config site origin ${configured.origin} conflicts with requested site origin ${site.origin}.`);
  }
  if (base.value && normalizeBase(base.value) !== site.basePath) {
    throw new Error(`Astro config base ${normalizeBase(base.value)} conflicts with requested site basePath ${site.basePath}.`);
  }

  const normalizeProjectDirectory = (option, fallback, label) => {
    const raw = option.value || fallback;
    const clean = posix(raw).replace(/^\.\//, '').replace(/\/$/, '');
    if (!clean || clean === '.') return '';
    const normalized = path.posix.normalize(clean);
    if (path.posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../')) {
      unsupported.push(`${label}-outside-project`);
      return fallback;
    }
    return normalized;
  };

  return {
    path: pathname,
    output: output.value || 'static',
    buildFormat: buildFormat.value || 'directory',
    trailingSlash: trailingSlash.value || 'ignore',
    srcDir: normalizeProjectDirectory(srcDir, 'src', 'srcDir'),
    publicDir: normalizeProjectDirectory(publicDir, 'public', 'publicDir'),
    unsupported: [...new Set(unsupported)]
  };
}

function publicUrl(site, routePath) {
  const base = site.basePath === '/' ? '' : site.basePath.replace(/\/$/, '');
  const target = `${base}${routePath}`.replace(/\/{2,}/g, '/');
  return new URL(target, site.origin).href;
}

function pageRoute(projectRelative, pagesPrefix, format) {
  const prefix = `${pagesPrefix}/`;
  if (!projectRelative.startsWith(prefix)) return null;
  const relative = projectRelative.slice(prefix.length);
  const extension = path.posix.extname(relative).toLowerCase();
  if (!PAGE_EXTENSIONS.has(extension)) return null;
  if (relative.includes('[') || relative.includes(']')) return { dynamic: true, routePath: null, relative };
  const noExtension = relative.slice(0, -extension.length);
  const base = path.posix.basename(noExtension).toLowerCase();
  const directory = path.posix.dirname(noExtension);
  const segments = noExtension.split('/').filter(Boolean);

  if (base === 'index') {
    const cleanDirectory = directory === '.' ? '' : directory.replace(/^\/+|\/+$/g, '');
    if (!cleanDirectory) return { dynamic: false, routePath: '/', relative };
    if (format === 'file') return { dynamic: false, routePath: `/${cleanDirectory}.html`, relative };
    return { dynamic: false, routePath: `/${cleanDirectory}/`, relative };
  }

  const clean = segments.join('/');
  if (format === 'directory') return { dynamic: false, routePath: `/${clean}/`, relative };
  return { dynamic: false, routePath: `/${clean}.html`, relative };
}

function pagePrerender(text) {
  const presence = /\bexport\s+const\s+prerender\b/.test(text);
  if (!presence) return { present: false, known: true, value: null };
  const match = /\bexport\s+const\s+prerender\s*=\s*(true|false)\b/.exec(text);
  if (!match) return { present: true, known: false, value: null };
  return { present: true, known: true, value: match[1] === 'true' };
}

function relativeAstroImports(sourcePath, text, entries) {
  const targets = [];
  const expressions = [
    /\bimport\s+[\s\S]*?\s+from\s+["']([^"']+\.astro)["']/g,
    /\bimport\s+["']([^"']+\.astro)["']/g
  ];
  for (const expression of expressions) {
    for (const match of String(text).matchAll(expression)) {
      const specifier = match[1];
      if (!specifier.startsWith('.')) continue;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), specifier));
      if (target === '..' || target.startsWith('../')) continue;
      if (entries.has(target)) targets.push(target);
    }
  }
  return [...new Set(targets)];
}

function dependencyClosure(sourcePath, entries) {
  const result = [];
  const queue = [sourcePath];
  const visited = new Set([sourcePath]);
  let count = 0;
  while (queue.length && count < 200) {
    const current = queue.shift();
    const entry = entries.get(current);
    if (!entry) continue;
    for (const target of relativeAstroImports(current, entry.text, entries)) {
      if (visited.has(target)) continue;
      visited.add(target);
      result.push(target);
      queue.push(target);
    }
    count += 1;
  }
  return result;
}

function attributes(tag) {
  const result = {};
  for (const match of String(tag).matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/g)) result[match[1].toLowerCase()] = match[3];
  return result;
}

function compactText(value) {
  return String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function sourceMetadata(text) {
  const source = String(text);
  const surfaces = [];
  for (const match of source.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    const rel = String(attrs.rel || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (rel.includes('canonical')) surfaces.push({ type: 'canonical', value: attrs.href ?? null, mutationClass: 'grounded-template', evidence: 'astro-source:canonical-link' });
  }
  for (const match of source.matchAll(/<script\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (String(attrs.type || '').toLowerCase() === 'application/ld+json') surfaces.push({ type: 'jsonld', value: 'present', mutationClass: 'grounded-template', evidence: 'astro-source:jsonld-script' });
  }
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(source);
  if (title && !/[{}]/.test(title[1])) surfaces.push({ type: 'title', value: compactText(title[1]), mutationClass: 'editorial', evidence: 'astro-source:literal-title' });
  for (const match of source.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (String(attrs.name || '').toLowerCase() === 'description' && attrs.content != null) surfaces.push({ type: 'description', value: attrs.content, mutationClass: 'editorial', evidence: 'astro-source:literal-description' });
    if (String(attrs.name || '').toLowerCase() === 'robots' && attrs.content != null) surfaces.push({ type: 'robots-meta', value: attrs.content, mutationClass: 'policy-gated', evidence: 'astro-source:robots-meta' });
  }
  return surfaces;
}

function candidate(pathname, evidenceClass, evidence, confidence = 'deterministic') {
  return { path: pathname, evidenceClass, confidence, evidence: [...new Set(evidence)] };
}

function machineDescriptor(publicRelativePath) {
  const lower = String(publicRelativePath).toLowerCase();
  if (lower === 'robots.txt') return { surfaceType: 'robots-file', mutationClass: 'policy-gated' };
  if (/^sitemap(?:[-_.][a-z0-9-]+)?\.xml$/.test(lower)) return { surfaceType: 'sitemap', mutationClass: 'grounded-template' };
  if (lower === 'llms.txt') return { surfaceType: 'llms', mutationClass: 'editorial' };
  if (lower === 'server.json' || lower === 'ai/site-profile.json' || lower === 'skills/index.json' || lower === '.well-known/agent-card.json') return { surfaceType: 'agent-discovery', mutationClass: 'grounded-template' };
  if (/^(?:api\/)?openapi\.(?:json|ya?ml)$/.test(lower)) return { surfaceType: 'api-description', mutationClass: 'grounded-template' };
  return null;
}

function buildPageCandidates(entries, siteRoot, config, packageState, warnings) {
  const pagesPrefix = `${config.srcDir ? `${config.srcDir}/` : ''}pages`;
  const results = [];
  for (const [repositoryPath, entry] of entries.entries()) {
    const route = pageRoute(entry.projectRelative, pagesPrefix, config.buildFormat);
    if (!route) continue;
    const extension = path.posix.extname(entry.projectRelative).toLowerCase();
    if (extension === '.mdx' && !packageState.mdxIntegration) {
      warnings.push({ code: 'astro-mdx-integration-unverified', message: 'MDX page was not mapped because @astrojs/mdx was not proven from package dependencies.', path: repositoryPath });
      results.push({ sourcePath: repositoryPath, routePath: null, state: 'unresolved', evidenceClass: 'astro-dynamic-route', evidence: ['astro:mdx-integration-unverified'], buildPath: [], metadata: [] });
      continue;
    }
    if (route.dynamic) {
      warnings.push({ code: 'astro-dynamic-route-unresolved', message: 'Dynamic Astro route requires getStaticPaths/runtime evaluation; no concrete public path was guessed.', path: repositoryPath });
      results.push({ sourcePath: repositoryPath, routePath: null, state: 'unresolved', evidenceClass: 'astro-dynamic-route', evidence: [`astro:dynamic-route:${route.relative}`], buildPath: [], metadata: sourceMetadata(entry.text) });
      continue;
    }
    const prerender = pagePrerender(entry.text);
    const runtimeByConfig = config.output === 'server' && prerender.value !== true;
    const runtimeByPage = config.output === 'static' && prerender.present && prerender.value === false;
    const computedPrerender = prerender.present && !prerender.known;
    const configUnsupported = config.unsupported.length > 0;
    if (runtimeByConfig || runtimeByPage || computedPrerender || configUnsupported) {
      const reasons = [
        ...(runtimeByConfig ? ['astro:server-output-runtime'] : []),
        ...(runtimeByPage ? ['astro:prerender-false-runtime'] : []),
        ...(computedPrerender ? ['astro:prerender-not-literal'] : []),
        ...config.unsupported.map(reason => `astro:unsupported-config:${reason}`)
      ];
      warnings.push({ code: 'astro-route-runtime-or-config-unresolved', message: 'Astro route ownership was preserved as unresolved because runtime or uninspectable configuration affects the rendered route.', path: repositoryPath });
      results.push({ sourcePath: repositoryPath, routePath: route.routePath, state: 'unresolved', evidenceClass: 'astro-dynamic-route', evidence: reasons, buildPath: [], metadata: sourceMetadata(entry.text) });
      continue;
    }
    const dependencies = dependencyClosure(repositoryPath, entries);
    const buildPath = [repositoryPath, ...dependencies, config.path, packageState.path].filter(Boolean);
    results.push({
      sourcePath: repositoryPath,
      routePath: route.routePath,
      state: 'resolved',
      evidenceClass: 'astro-file-route',
      evidence: [
        `astro:file-route:${entry.projectRelative}->${route.routePath}`,
        `astro:build.format:${config.buildFormat}`,
        `astro:output:${config.output}`,
        `astro:trailingSlash:${config.trailingSlash}`
      ],
      buildPath: [...new Set(buildPath)],
      metadata: sourceMetadata(entry.text)
    });
  }
  return results;
}

function buildRoutes(pageCandidates, site, warnings) {
  const groups = new Map();
  const unresolved = [];
  for (const page of pageCandidates) {
    if (page.state !== 'resolved' || !page.routePath) {
      unresolved.push(page);
      continue;
    }
    if (!groups.has(page.routePath)) groups.set(page.routePath, []);
    groups.get(page.routePath).push(page);
  }
  const routes = [];
  const ownership = [];

  for (const page of unresolved) {
    routes.push({
      id: `route:unresolved:${shortHash(page.sourcePath, 18)}`,
      routePath: page.routePath,
      url: page.routePath ? publicUrl(site, page.routePath) : null,
      state: 'unresolved',
      ownerPath: null,
      candidates: [candidate(page.sourcePath, page.evidenceClass, page.evidence, 'ambiguous')],
      buildPath: [],
      evidence: page.evidence
    });
    if (page.routePath) {
      ownership.push({
        surfaceKey: `route:${page.routePath}:document:${shortHash(page.sourcePath, 10)}`,
        surfaceType: 'document',
        routePath: page.routePath,
        state: 'unresolved',
        ownerPath: null,
        candidates: [candidate(page.sourcePath, page.evidenceClass, page.evidence, 'ambiguous')],
        mutationClass: 'runtime',
        evidenceClass: 'unresolved',
        value: null,
        locator: null,
        evidence: page.evidence
      });
    }
  }

  for (const [routePath, pages] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const ambiguous = pages.length > 1;
    const candidates = pages.map(page => candidate(page.sourcePath, page.evidenceClass, page.evidence, ambiguous ? 'ambiguous' : 'deterministic'));
    if (ambiguous) warnings.push({ code: 'ambiguous-route-owner', message: `Multiple Astro source pages map to ${routePath}; no owner was selected.`, path: null });
    const owner = ambiguous ? null : pages[0];
    routes.push({
      id: `route:${shortHash(routePath, 20)}`,
      routePath,
      url: publicUrl(site, routePath),
      state: ambiguous ? 'ambiguous' : 'resolved',
      ownerPath: owner?.sourcePath || null,
      candidates,
      buildPath: owner ? owner.buildPath : [],
      evidence: [...new Set(pages.flatMap(page => page.evidence))]
    });
    ownership.push({
      surfaceKey: `route:${routePath}:document`,
      surfaceType: 'document',
      routePath,
      state: ambiguous ? 'ambiguous' : 'resolved',
      ownerPath: owner?.sourcePath || null,
      candidates,
      mutationClass: owner && /\.(?:md|mdx)$/i.test(owner.sourcePath) ? 'editorial' : 'grounded-template',
      evidenceClass: ambiguous ? 'ambiguous' : 'direct-source',
      value: publicUrl(site, routePath),
      locator: null,
      evidence: [...new Set(pages.flatMap(page => page.evidence))]
    });

    const surfaceTypes = [...new Set(pages.flatMap(page => page.metadata.map(item => item.type)))];
    for (const type of surfaceTypes) {
      const matching = pages.filter(page => page.metadata.some(item => item.type === type));
      const metadataAmbiguous = ambiguous || matching.length !== 1;
      const metadataCandidates = matching.map(page => candidate(page.sourcePath, page.evidenceClass, [...page.evidence, `astro:metadata:${type}`], metadataAmbiguous ? 'ambiguous' : 'deterministic'));
      if (metadataAmbiguous) {
        ownership.push({ surfaceKey: `metadata:${routePath}:${type}`, surfaceType: type, routePath, state: 'ambiguous', ownerPath: null, candidates: metadataCandidates, mutationClass: matching[0]?.metadata.find(item => item.type === type)?.mutationClass || 'grounded-template', evidenceClass: 'ambiguous', value: null, locator: null, evidence: [`astro:ambiguous-metadata:${type}`] });
        continue;
      }
      const page = matching[0];
      const metadata = page.metadata.find(item => item.type === type);
      ownership.push({ surfaceKey: `metadata:${routePath}:${type}`, surfaceType: type, routePath, state: 'resolved', ownerPath: page.sourcePath, candidates: metadataCandidates, mutationClass: metadata.mutationClass, evidenceClass: 'direct-source', value: metadata.value, locator: null, evidence: [...page.evidence, metadata.evidence] });
    }
  }
  return { routes, ownership };
}

function buildMachineOwnership(entries, siteRoot, config) {
  const ownership = [];
  const prefix = config.publicDir ? `${config.publicDir}/` : '';
  for (const [repositoryPath, entry] of entries.entries()) {
    if (!entry.projectRelative.startsWith(prefix)) continue;
    const publicRelative = entry.projectRelative.slice(prefix.length);
    const descriptor = machineDescriptor(publicRelative);
    if (!descriptor) continue;
    const routePath = `/${publicRelative}`.replace(/\/{2,}/g, '/');
    ownership.push({
      surfaceKey: `machine:${routePath}`,
      surfaceType: descriptor.surfaceType,
      routePath,
      state: 'resolved',
      ownerPath: repositoryPath,
      candidates: [candidate(repositoryPath, 'astro-public-file', [`astro:public:${publicRelative}->${routePath}`])],
      mutationClass: descriptor.mutationClass,
      evidenceClass: 'machine-file-path',
      value: null,
      locator: null,
      evidence: [`astro:public:${publicRelative}->${routePath}`]
    });
  }
  return ownership;
}

function fileRole(repositoryPath, entry, siteRoot, pageSources, machineOwners, config, packagePath) {
  if (machineOwners.has(repositoryPath)) return 'machine-surface';
  if (pageSources.has(repositoryPath)) return 'page-source';
  if (repositoryPath === config.path || repositoryPath === packagePath) return 'build-config';
  const rel = entry.projectRelative;
  if (/^src\/layouts\//.test(rel)) return 'layout';
  if (/^src\/components\//.test(rel)) return 'include';
  if (rel.endsWith('.astro')) return 'include';
  return 'other';
}

function mutationClass(role, repositoryPath, machineOwnership) {
  if (role === 'machine-surface') return machineOwnership.get(repositoryPath).mutationClass;
  if (role === 'page-source') return /\.(?:md|mdx)$/i.test(repositoryPath) ? 'editorial' : 'grounded-template';
  if (role === 'build-config' || role === 'layout' || role === 'include') return 'grounded-template';
  return 'grounded-template';
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

export function compileAstroSiteStateGraph(options = {}) {
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
  const packageState = packageInfo(scanned.entries, siteRoot);
  const configs = configEntries(scanned.entries, siteRoot);
  if (!configs.length && !packageState.astroDependency) throw new Error('Astro adapter requires astro.config.* or an astro package dependency as repository evidence.');
  const config = inspectConfig(scanned.entries, siteRoot, site, scanned.warnings);
  const detection = [
    ...configs.map(pathname => `config:${pathname}`),
    ...(packageState.astroDependency ? [`package:${packageState.path}:astro`] : [])
  ];
  const pageCandidates = buildPageCandidates(scanned.entries, siteRoot, config, packageState, scanned.warnings);
  const mapped = buildRoutes(pageCandidates, site, scanned.warnings);
  const machines = buildMachineOwnership(scanned.entries, siteRoot, config);
  const ownership = [...mapped.ownership, ...machines].sort((a, b) => a.surfaceKey.localeCompare(b.surfaceKey));

  const pageSources = new Set(pageCandidates.map(page => page.sourcePath));
  const machineByPath = new Map(machines.map(item => [item.ownerPath, item]));
  const involved = new Set([
    ...pageSources,
    ...mapped.routes.flatMap(route => route.buildPath),
    ...machines.map(item => item.ownerPath),
    config.path,
    packageState.path
  ].filter(Boolean));
  const files = [...involved].sort().map(repositoryPath => {
    const entry = scanned.entries.get(repositoryPath);
    if (!entry) throw new Error(`Mapped Astro file disappeared during scan: ${repositoryPath}`);
    const role = fileRole(repositoryPath, entry, siteRoot, pageSources, new Set(machineByPath.keys()), config, packageState.path);
    return { path: repositoryPath, sha256: entry.sha256, bytes: entry.bytes, role, mutationClass: mutationClass(role, repositoryPath, machineByPath), generated: false };
  });

  const graph = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/site-state-graph.schema.json',
    version: '0.1',
    generatedAt: new Date(options.generatedAt || Date.now()).toISOString(),
    repository,
    site,
    adapter: { id: 'astro', version: ASTRO_REPOSITORY_MAPPER_VERSION, detection, confidence: configs.length ? 'explicit-config' : 'deterministic' },
    files,
    routes: mapped.routes.sort((a, b) => (a.routePath || a.id).localeCompare(b.routePath || b.id)),
    ownership,
    facts: [],
    warnings: scanned.warnings,
    summary: summarize(files, mapped.routes, ownership),
    guardrails: {
      noPathGuessing: true,
      ambiguityPreserved: true,
      generatedOutputNotPreferred: true,
      ownershipIsNotAuthorization: true,
      policyAndEditorialRemainGated: true,
      symlinksNotFollowed: true,
      noRankingGuarantee: true
    }
  };
  const validation = validateSiteStateGraph(graph);
  if (!validation.valid) throw new Error(`Generated Astro Site State Graph is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return graph;
}
