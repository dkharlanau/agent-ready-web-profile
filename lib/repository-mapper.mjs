import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, '..');
const schemaPath = path.join(rootDir, 'schema', 'site-state-graph.schema.json');

export const SITE_STATE_GRAPH_VERSION = '0.1';
export const REPOSITORY_MAPPER_VERSION = '0.1';

const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  '.next',
  '.nuxt',
  '.cache',
  '.vercel',
  'coverage',
  'dist',
  'build',
  '_site'
]);

const GENERATED_DIRECTORIES = new Set(['.next', '.nuxt', '.vercel', 'dist', 'build', '_site']);
const TEXT_EXTENSIONS = new Set([
  '.html', '.htm', '.md', '.markdown', '.txt', '.xml', '.json', '.jsonld', '.yml', '.yaml', '.toml', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'
]);
const SPECIAL_TEXT_FILES = new Set(['Gemfile', 'CNAME']);

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

export function canonicalSiteStateJson(value) {
  return JSON.stringify(stable(value));
}

export function siteStateSha256(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value), 'utf8').digest('hex')}`;
}

function bufferSha256(buffer) {
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

function shortHash(value, length = 16) {
  return siteStateSha256(value).slice(7, 7 + length);
}

function posix(value) {
  return String(value).replaceAll('\\', '/');
}

function normalizeRepoPath(value, label = 'path') {
  let text = posix(value == null || value === '' ? '.' : value).replace(/^\.\//, '').replace(/\/+$/g, '');
  if (!text) text = '.';
  if (text.startsWith('/') || /^[A-Za-z]:\//.test(text)) throw new Error(`${label} must be repository-relative.`);
  if (text.split('/').includes('..')) throw new Error(`${label} must not contain '..'.`);
  return text;
}

function ensureInside(parent, child, label) {
  const relative = path.relative(parent, child);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return;
  throw new Error(`${label} escapes the repository root.`);
}

function repoJoin(base, relative) {
  if (base === '.') return relative;
  return `${base}/${relative}`;
}

function relativeToSite(repositoryPath, siteRoot) {
  if (siteRoot === '.') return repositoryPath;
  const prefix = `${siteRoot}/`;
  return repositoryPath.startsWith(prefix) ? repositoryPath.slice(prefix.length) : null;
}

function siteJoin(siteRoot, relative) {
  return siteRoot === '.' ? relative : `${siteRoot}/${relative}`;
}

function isTextCandidate(repositoryPath) {
  const base = path.posix.basename(posix(repositoryPath));
  return SPECIAL_TEXT_FILES.has(base) || TEXT_EXTENSIONS.has(path.posix.extname(base).toLowerCase());
}

function isPageExtension(repositoryPath) {
  return ['.html', '.htm', '.md', '.markdown'].includes(path.posix.extname(repositoryPath).toLowerCase());
}

function scanRepository(root, options = {}) {
  const maxFiles = Number.isInteger(options.maxFiles) ? options.maxFiles : 10000;
  const maxFileBytes = Number.isInteger(options.maxFileBytes) ? options.maxFileBytes : 2 * 1024 * 1024;
  const warnings = [];
  const entries = new Map();
  let inspected = 0;

  function walk(directory, relDirectory = '') {
    const children = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      const relative = relDirectory ? `${relDirectory}/${child.name}` : child.name;
      const absolute = path.join(directory, child.name);
      const stat = fs.lstatSync(absolute);

      if (stat.isSymbolicLink()) {
        warnings.push({ code: 'symlink-skipped', message: 'Repository Mapper does not follow symbolic links.', path: posix(relative) });
        continue;
      }
      if (stat.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(child.name)) {
          if (GENERATED_DIRECTORIES.has(child.name)) {
            warnings.push({ code: 'generated-output-skipped', message: `Generated/output directory ${child.name} was not considered source ownership.`, path: posix(relative) });
          }
          continue;
        }
        walk(absolute, relative);
        continue;
      }
      if (!stat.isFile() || !isTextCandidate(relative)) continue;
      inspected += 1;
      if (inspected > maxFiles) throw new Error(`Repository Mapper exceeded maxFiles=${maxFiles}. Narrow the repository/site root or raise the explicit limit.`);
      if (stat.size > maxFileBytes) {
        warnings.push({ code: 'file-too-large', message: `File exceeds mapper maxFileBytes=${maxFileBytes}; ownership was not inferred from it.`, path: posix(relative) });
        continue;
      }
      const buffer = fs.readFileSync(absolute);
      entries.set(posix(relative), {
        path: posix(relative),
        bytes: buffer.length,
        sha256: bufferSha256(buffer),
        text: buffer.toString('utf8')
      });
    }
  }

  walk(root);
  return { entries, warnings };
}

function parseScalar(value) {
  const text = String(value).trim();
  if (!text) return null;
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) return text.slice(1, -1);
  if (/^(true|false)$/i.test(text)) return text.toLowerCase() === 'true';
  if (/^(null|~)$/i.test(text)) return null;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  if (/^[\[{]/.test(text)) return undefined;
  return text.replace(/\s+#.*$/, '').trim();
}

function parseFrontmatter(text) {
  const normalized = String(text).replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return { present: false, data: {}, lines: {}, body: normalized };
  const lines = normalized.split('\n');
  let closing = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') {
      closing = index;
      break;
    }
  }
  if (closing < 0) return { present: false, data: {}, lines: {}, body: normalized };
  const data = {};
  const lineMap = {};
  for (let index = 1; index < closing; index += 1) {
    if (/^\s/.test(lines[index])) continue;
    const match = lines[index].match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!match) continue;
    const parsed = parseScalar(match[2]);
    if (parsed === undefined) continue;
    data[match[1]] = parsed;
    lineMap[match[1]] = index + 1;
  }
  return { present: true, data, lines: lineMap, body: lines.slice(closing + 1).join('\n') };
}

function lineAt(text, index) {
  return String(text).slice(0, Math.max(0, index)).split(/\r?\n/).length;
}

function tagAttributes(tag) {
  const attributes = {};
  const expression = /([A-Za-z_:][A-Za-z0-9:._-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of String(tag).matchAll(expression)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
}

function compactText(value) {
  return String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function htmlMetadata(text) {
  const surfaces = [];
  const facts = [];
  const source = String(text);
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(source);
  if (titleMatch) {
    const value = compactText(titleMatch[1]);
    const line = lineAt(source, titleMatch.index);
    surfaces.push({ type: 'title', value, line, mutationClass: 'editorial' });
    facts.push({ key: 'title', value, line });
  }
  for (const match of source.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = tagAttributes(match[0]);
    const name = String(attrs.name || '').toLowerCase();
    if (name === 'description' && attrs.content != null) {
      surfaces.push({ type: 'description', value: attrs.content, line: lineAt(source, match.index), mutationClass: 'editorial' });
      facts.push({ key: 'description', value: attrs.content, line: lineAt(source, match.index) });
    }
    if (name === 'robots' && attrs.content != null) {
      surfaces.push({ type: 'robots-meta', value: attrs.content, line: lineAt(source, match.index), mutationClass: 'policy-gated' });
    }
  }
  for (const match of source.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = tagAttributes(match[0]);
    const rel = String(attrs.rel || '').toLowerCase().split(/\s+/);
    if (rel.includes('canonical') && attrs.href != null) {
      surfaces.push({ type: 'canonical', value: attrs.href, line: lineAt(source, match.index), mutationClass: 'grounded-template' });
      facts.push({ key: 'canonical', value: attrs.href, line: lineAt(source, match.index) });
    }
  }
  for (const match of source.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>/gi)) {
    surfaces.push({ type: 'jsonld', value: 'present', line: lineAt(source, match.index), mutationClass: 'grounded-template' });
  }
  return { surfaces, facts };
}

function machineDescriptor(siteRelativePath) {
  const lower = String(siteRelativePath).toLowerCase();
  if (lower === 'robots.txt') return { surfaceType: 'robots-file', mutationClass: 'policy-gated' };
  if (/^sitemap(?:[-_.][a-z0-9-]+)?\.xml$/.test(lower)) return { surfaceType: 'sitemap', mutationClass: 'grounded-template' };
  if (lower === 'llms.txt') return { surfaceType: 'llms', mutationClass: 'editorial' };
  if (lower === 'server.json' || lower === 'ai/site-profile.json' || lower === 'skills/index.json' || lower === '.well-known/agent-card.json') {
    return { surfaceType: 'agent-discovery', mutationClass: 'grounded-template' };
  }
  if (/^(?:api\/)?openapi\.(?:json|ya?ml)$/.test(lower)) return { surfaceType: 'api-description', mutationClass: 'grounded-template' };
  return null;
}

function normalizeRoutePath(value) {
  let route = String(value || '').trim();
  if (!route) return null;
  if (/^[a-z]+:\/\//i.test(route)) {
    try {
      route = new URL(route).pathname;
    } catch {
      return null;
    }
  }
  if (!route.startsWith('/')) route = `/${route}`;
  route = route.replace(/\/{2,}/g, '/');
  return route;
}

function staticRoute(siteRelativePath) {
  const value = posix(siteRelativePath);
  if (!/\.html?$/i.test(value)) return null;
  const lower = value.toLowerCase();
  if (lower === 'index.html' || lower === 'index.htm') return '/';
  if (lower.endsWith('/index.html')) return `/${value.slice(0, -'index.html'.length)}`;
  if (lower.endsWith('/index.htm')) return `/${value.slice(0, -'index.htm'.length)}`;
  return `/${value}`;
}

function jekyllConventionRoute(siteRelativePath) {
  const value = posix(siteRelativePath);
  const extension = path.posix.extname(value).toLowerCase();
  if (!['.md', '.markdown', '.html', '.htm'].includes(extension)) return null;
  const noExtension = value.slice(0, -extension.length);
  const base = path.posix.basename(noExtension).toLowerCase();
  if (base === 'index') {
    const directory = path.posix.dirname(noExtension);
    return directory === '.' ? '/' : `/${directory.replace(/^\/+/, '')}/`;
  }
  if (extension === '.md' || extension === '.markdown') return `/${noExtension}.html`;
  return `/${value}`;
}

function joinPublicUrl(origin, basePath, routePath) {
  if (!routePath) return null;
  const base = basePath === '/' ? '' : basePath.replace(/\/$/, '');
  const target = `${base}${routePath === '/' ? '/' : routePath}`.replace(/\/{2,}/g, '/');
  return new URL(target, origin).href;
}

function candidate(pathname, evidenceClass, evidence, confidence = 'deterministic') {
  return { path: pathname, evidenceClass, confidence, evidence: [...new Set(evidence)] };
}

function jekyllSpecial(siteRelativePath) {
  const first = posix(siteRelativePath).split('/')[0];
  return first.startsWith('_');
}

function configPath(entries, siteRoot) {
  for (const relative of ['_config.yml', '_config.yaml']) {
    const full = siteJoin(siteRoot, relative);
    if (entries.has(full)) return full;
  }
  return null;
}

function detectAdapter(entries, siteRoot, requested = 'auto') {
  if (!['auto', 'static-html', 'jekyll'].includes(requested)) throw new Error(`Unsupported Repository Mapper adapter: ${requested}`);
  const detection = [];
  const config = configPath(entries, siteRoot);
  if (config) detection.push(`config:${config}`);
  const layoutPrefix = `${siteRoot === '.' ? '' : `${siteRoot}/`}_layouts/`;
  if ([...entries.keys()].some(file => file.startsWith(layoutPrefix))) detection.push(`directory:${siteJoin(siteRoot, '_layouts')}`);
  for (const gemfile of [siteJoin(siteRoot, 'Gemfile'), 'Gemfile']) {
    const entry = entries.get(gemfile);
    if (entry && /\bjekyll\b/i.test(entry.text)) {
      detection.push(`gem:${gemfile}:jekyll`);
      break;
    }
  }
  if (requested === 'jekyll') return { id: 'jekyll', version: REPOSITORY_MAPPER_VERSION, detection: ['adapter:forced', ...detection], confidence: 'explicit-config' };
  if (requested === 'static-html') return { id: 'static-html', version: REPOSITORY_MAPPER_VERSION, detection: ['adapter:forced'], confidence: 'deterministic' };
  if (detection.length) return { id: 'jekyll', version: REPOSITORY_MAPPER_VERSION, detection, confidence: 'explicit-config' };
  const hasHtml = [...entries.keys()].some(file => {
    const relative = relativeToSite(file, siteRoot);
    return relative != null && /\.html?$/i.test(relative);
  });
  if (!hasHtml) throw new Error('Repository Mapper could not detect a supported static/Jekyll site. Provide --adapter only when the stack is known explicitly.');
  return { id: 'static-html', version: REPOSITORY_MAPPER_VERSION, detection: ['direct-html-files'], confidence: 'deterministic' };
}

function fileMutationClass(role, descriptor = null) {
  if (descriptor) return descriptor.mutationClass;
  if (role === 'page-source' || role === 'content') return 'editorial';
  if (role === 'build-config' || role === 'layout' || role === 'include' || role === 'data') return 'grounded-template';
  if (role === 'generated-output') return 'blocked';
  return 'grounded-template';
}

function fileRole(repositoryPath, siteRoot, adapter, pageSources) {
  const siteRelativePath = relativeToSite(repositoryPath, siteRoot);
  if (siteRelativePath != null) {
    const machine = machineDescriptor(siteRelativePath);
    if (machine) return { role: 'machine-surface', descriptor: machine };
    if (pageSources.has(repositoryPath)) return { role: 'page-source', descriptor: null };
    if (adapter.id === 'jekyll') {
      if (/^_layouts\//.test(siteRelativePath)) return { role: 'layout', descriptor: null };
      if (/^_includes\//.test(siteRelativePath)) return { role: 'include', descriptor: null };
      if (/^_data\//.test(siteRelativePath)) return { role: 'data', descriptor: null };
      if (/^_(?:posts|drafts)\//.test(siteRelativePath)) return { role: 'content', descriptor: null };
      if (['_config.yml', '_config.yaml'].includes(siteRelativePath)) return { role: 'build-config', descriptor: null };
    }
  }
  if (path.posix.basename(repositoryPath) === 'Gemfile') return { role: 'build-config', descriptor: null };
  return { role: 'other', descriptor: null };
}

function findLayout(entries, siteRoot, name) {
  if (!name || typeof name !== 'string') return null;
  const safe = name.replace(/^\/+/, '');
  if (safe.includes('..')) return null;
  for (const extension of ['.html', '.htm', '.md']) {
    const target = siteJoin(siteRoot, `_layouts/${safe}${extension}`);
    if (entries.has(target)) return target;
  }
  return null;
}

function collectIncludes(text, sourcePath, entries, siteRoot) {
  const includes = [];
  const expression = /{%\s*(include|include_relative)\s+["']?([^"'\s%}]+)["']?[^%]*%}/g;
  for (const match of String(text).matchAll(expression)) {
    let target = null;
    if (match[1] === 'include') {
      target = siteJoin(siteRoot, `_includes/${match[2]}`);
    } else {
      target = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), match[2]));
      if (target.startsWith('../') || target === '..') target = null;
    }
    if (target && entries.has(target)) includes.push(target);
  }
  return [...new Set(includes)];
}

function jekyllBuildPath(sourcePath, frontmatter, entries, siteRoot) {
  const result = [sourcePath];
  const visited = new Set();
  let layoutName = typeof frontmatter.data.layout === 'string' ? frontmatter.data.layout : null;
  let depth = 0;
  while (layoutName && depth < 10) {
    const layout = findLayout(entries, siteRoot, layoutName);
    if (!layout || visited.has(layout)) break;
    visited.add(layout);
    result.push(layout);
    const parsed = parseFrontmatter(entries.get(layout).text);
    layoutName = typeof parsed.data.layout === 'string' ? parsed.data.layout : null;
    depth += 1;
  }
  for (const pathname of [...result]) {
    const entry = entries.get(pathname);
    if (!entry) continue;
    for (const include of collectIncludes(entry.text, pathname, entries, siteRoot)) result.push(include);
  }
  const config = configPath(entries, siteRoot);
  if (config) result.push(config);
  return [...new Set(result)];
}

function metadataFromFrontmatter(frontmatter) {
  const surfaces = [];
  const facts = [];
  const definitions = [
    ['title', 'title', 'editorial'],
    ['description', 'description', 'editorial'],
    ['canonical', 'canonical', 'grounded-template'],
    ['canonical_url', 'canonical', 'grounded-template']
  ];
  for (const [field, type, mutationClass] of definitions) {
    if (!(field in frontmatter.data)) continue;
    const value = frontmatter.data[field];
    if (!['string', 'number', 'boolean'].includes(typeof value) && value !== null) continue;
    surfaces.push({ type, value, line: frontmatter.lines[field] || null, field, mutationClass });
    facts.push({ key: field, value, line: frontmatter.lines[field] || null, field });
  }
  for (const [field, value] of Object.entries(frontmatter.data)) {
    if (['layout', 'permalink', 'published', 'title', 'description', 'canonical', 'canonical_url'].includes(field)) continue;
    if (!['string', 'number', 'boolean'].includes(typeof value) && value !== null) continue;
    facts.push({ key: field, value, line: frontmatter.lines[field] || null, field });
  }
  return { surfaces, facts };
}

function mapPageCandidates(entries, siteRoot, adapter, warnings) {
  const result = [];
  for (const [repositoryPath, entry] of entries.entries()) {
    const siteRelativePath = relativeToSite(repositoryPath, siteRoot);
    if (siteRelativePath == null || !isPageExtension(siteRelativePath)) continue;
    if (/^_(?:layouts|includes|data)\//.test(siteRelativePath)) continue;

    const frontmatter = parseFrontmatter(entry.text);
    if (adapter.id === 'static-html') {
      if (!/\.html?$/i.test(siteRelativePath)) continue;
      const routePath = staticRoute(siteRelativePath);
      const extracted = htmlMetadata(entry.text);
      result.push({
        sourcePath: repositoryPath,
        routePath,
        evidenceClass: 'direct-static-path',
        evidence: [`static:${siteRelativePath}->${routePath}`],
        buildPath: [repositoryPath],
        metadata: extracted.surfaces,
        facts: extracted.facts.map(fact => ({ ...fact, field: fact.key })),
        factEvidenceClass: 'direct-html'
      });
      continue;
    }

    if (frontmatter.present) {
      if (frontmatter.data.published === false) {
        warnings.push({ code: 'unpublished-jekyll-page', message: 'Jekyll source declares published: false and was not mapped to a public route.', path: repositoryPath });
        continue;
      }
      let routePath = null;
      let evidenceClass = 'jekyll-page-convention';
      let evidence = [];
      if (typeof frontmatter.data.permalink === 'string' && frontmatter.data.permalink.trim()) {
        routePath = normalizeRoutePath(frontmatter.data.permalink);
        evidenceClass = 'explicit-permalink';
        evidence = [`frontmatter:permalink:${frontmatter.data.permalink}`];
      } else if (jekyllSpecial(siteRelativePath)) {
        warnings.push({ code: 'jekyll-route-unresolved', message: 'Jekyll post/collection route requires additional config resolution; no public path was guessed.', path: repositoryPath });
      } else {
        routePath = jekyllConventionRoute(siteRelativePath);
        evidence = [`jekyll-page-convention:${siteRelativePath}->${routePath}`];
      }
      const extracted = metadataFromFrontmatter(frontmatter);
      result.push({
        sourcePath: repositoryPath,
        routePath,
        evidenceClass,
        evidence: routePath ? evidence : ['route-unresolved:no-explicit-permalink'],
        buildPath: routePath ? jekyllBuildPath(repositoryPath, frontmatter, entries, siteRoot) : [],
        metadata: extracted.surfaces,
        facts: extracted.facts,
        factEvidenceClass: 'frontmatter-source'
      });
      continue;
    }

    if (/\.html?$/i.test(siteRelativePath) && !jekyllSpecial(siteRelativePath)) {
      const routePath = staticRoute(siteRelativePath);
      const extracted = htmlMetadata(entry.text);
      result.push({
        sourcePath: repositoryPath,
        routePath,
        evidenceClass: 'direct-static-path',
        evidence: [`jekyll-static-copy:${siteRelativePath}->${routePath}`],
        buildPath: [repositoryPath, ...(configPath(entries, siteRoot) ? [configPath(entries, siteRoot)] : [])],
        metadata: extracted.surfaces,
        facts: extracted.facts.map(fact => ({ ...fact, field: fact.key })),
        factEvidenceClass: 'direct-html'
      });
    }
  }
  return result;
}

function buildRoutes(pageCandidates, site, warnings) {
  const groups = new Map();
  const unresolved = [];
  for (const page of pageCandidates) {
    if (!page.routePath) {
      unresolved.push(page);
      continue;
    }
    if (!groups.has(page.routePath)) groups.set(page.routePath, []);
    if (!groups.get(page.routePath).some(existing => existing.sourcePath === page.sourcePath)) groups.get(page.routePath).push(page);
  }

  const routes = [];
  const ownership = [];
  const facts = [];

  for (const page of unresolved) {
    routes.push({
      id: `route:unresolved:${shortHash(page.sourcePath, 18)}`,
      routePath: null,
      url: null,
      state: 'unresolved',
      ownerPath: null,
      candidates: [candidate(page.sourcePath, page.evidenceClass, page.evidence, 'ambiguous')],
      buildPath: [],
      evidence: page.evidence
    });
    for (const fact of page.facts) {
      facts.push({
        key: fact.key,
        value: fact.value,
        routePath: null,
        sourcePath: page.sourcePath,
        locator: { line: fact.line || null, field: fact.field || fact.key },
        evidenceClass: page.factEvidenceClass === 'frontmatter-source' ? 'frontmatter' : 'direct-html'
      });
    }
  }

  for (const [routePath, pages] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const ambiguous = pages.length > 1;
    const routeCandidates = pages.map(page => candidate(page.sourcePath, page.evidenceClass, page.evidence, ambiguous ? 'ambiguous' : (page.evidenceClass === 'explicit-permalink' ? 'explicit' : 'deterministic')));
    if (ambiguous) warnings.push({ code: 'ambiguous-route-owner', message: `Multiple repository sources map to the same public route ${routePath}; no owner was selected.`, path: null });
    const owner = ambiguous ? null : pages[0];
    const route = {
      id: `route:${shortHash(routePath, 20)}`,
      routePath,
      url: joinPublicUrl(site.origin, site.basePath, routePath),
      state: ambiguous ? 'ambiguous' : 'resolved',
      ownerPath: owner?.sourcePath || null,
      candidates: routeCandidates,
      buildPath: owner ? owner.buildPath : [],
      evidence: [...new Set(pages.flatMap(page => page.evidence))]
    };
    routes.push(route);
    ownership.push({
      surfaceKey: `route:${routePath}:document`,
      surfaceType: 'document',
      routePath,
      state: route.state,
      ownerPath: route.ownerPath,
      candidates: routeCandidates,
      mutationClass: 'editorial',
      evidenceClass: ambiguous ? 'ambiguous' : (owner.factEvidenceClass === 'frontmatter-source' ? 'frontmatter-source' : 'direct-source'),
      value: route.url,
      locator: null,
      evidence: route.evidence
    });

    const surfaceTypes = [...new Set(pages.flatMap(page => page.metadata.map(item => item.type)))].sort();
    for (const type of surfaceTypes) {
      const matching = pages.filter(page => page.metadata.some(item => item.type === type));
      const metadataAmbiguous = ambiguous || matching.length !== 1;
      if (metadataAmbiguous) {
        ownership.push({
          surfaceKey: `metadata:${routePath}:${type}`,
          surfaceType: type,
          routePath,
          state: 'ambiguous',
          ownerPath: null,
          candidates: matching.map(page => candidate(page.sourcePath, page.evidenceClass, [...page.evidence, `metadata:${type}`], 'ambiguous')),
          mutationClass: matching[0]?.metadata.find(item => item.type === type)?.mutationClass || 'grounded-template',
          evidenceClass: 'ambiguous',
          value: null,
          locator: null,
          evidence: [`ambiguous-metadata-owner:${type}`]
        });
        continue;
      }
      const page = matching[0];
      const metadata = page.metadata.find(item => item.type === type);
      ownership.push({
        surfaceKey: `metadata:${routePath}:${type}`,
        surfaceType: type,
        routePath,
        state: 'resolved',
        ownerPath: page.sourcePath,
        candidates: [candidate(page.sourcePath, page.evidenceClass, [...page.evidence, `metadata:${type}`], page.evidenceClass === 'explicit-permalink' ? 'explicit' : 'deterministic')],
        mutationClass: metadata.mutationClass,
        evidenceClass: page.factEvidenceClass === 'frontmatter-source' ? 'frontmatter-source' : 'direct-source',
        value: metadata.value,
        locator: { line: metadata.line || null, field: metadata.field || type },
        evidence: [...page.evidence, `metadata:${type}`]
      });
    }

    for (const page of pages) {
      for (const fact of page.facts) {
        facts.push({
          key: fact.key,
          value: fact.value,
          routePath,
          sourcePath: page.sourcePath,
          locator: { line: fact.line || null, field: fact.field || fact.key },
          evidenceClass: page.factEvidenceClass === 'frontmatter-source' ? 'frontmatter' : 'direct-html'
        });
      }
    }
  }

  return { routes, ownership, facts };
}

function machineOwnership(entries, siteRoot) {
  const ownership = [];
  for (const [repositoryPath] of entries.entries()) {
    const siteRelativePath = relativeToSite(repositoryPath, siteRoot);
    if (siteRelativePath == null) continue;
    const descriptor = machineDescriptor(siteRelativePath);
    if (!descriptor) continue;
    const routePath = normalizeRoutePath(siteRelativePath);
    ownership.push({
      surfaceKey: `machine:${routePath}`,
      surfaceType: descriptor.surfaceType,
      routePath,
      state: 'resolved',
      ownerPath: repositoryPath,
      candidates: [candidate(repositoryPath, 'machine-file-path', [`machine-file:${siteRelativePath}`], 'deterministic')],
      mutationClass: descriptor.mutationClass,
      evidenceClass: 'machine-file-path',
      value: null,
      locator: null,
      evidence: [`machine-file:${siteRelativePath}`]
    });
  }
  return ownership;
}

function summarize(files, routes, ownership, facts) {
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
    facts: facts.length
  };
}

export function validateSiteStateGraph(graph) {
  const validate = validator();
  const valid = Boolean(validate(graph));
  const errors = [...(validate.errors || [])];
  if (valid) {
    const filePaths = new Set(graph.files.map(file => file.path));
    for (const [index, route] of graph.routes.entries()) {
      if (route.state === 'resolved' && (!route.ownerPath || !filePaths.has(route.ownerPath))) errors.push({ instancePath: `/routes/${index}/ownerPath`, message: 'resolved route owner must exist in files[]' });
      if (route.state !== 'resolved' && route.ownerPath != null) errors.push({ instancePath: `/routes/${index}/ownerPath`, message: 'ambiguous/unresolved route must not select an owner' });
    }
    for (const [index, item] of graph.ownership.entries()) {
      if (item.state === 'resolved' && (!item.ownerPath || !filePaths.has(item.ownerPath))) errors.push({ instancePath: `/ownership/${index}/ownerPath`, message: 'resolved ownership owner must exist in files[]' });
      if (item.state !== 'resolved' && item.ownerPath != null) errors.push({ instancePath: `/ownership/${index}/ownerPath`, message: 'ambiguous/unresolved ownership must not select an owner' });
    }
  }
  return { valid: valid && errors.length === 0, errors };
}

export function compileSiteStateGraph(options = {}) {
  const repositoryRoot = fs.realpathSync(path.resolve(options.root || '.'));
  const siteRoot = normalizeRepoPath(options.siteRoot || options.repository?.siteRoot || '.', 'siteRoot');
  const siteRootAbsolute = fs.realpathSync(path.resolve(repositoryRoot, siteRoot));
  ensureInside(repositoryRoot, siteRootAbsolute, 'siteRoot');

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
  const basePath = normalizeRoutePath(options.site?.basePath || options.basePath || '/') || '/';
  const site = { origin: parsedOrigin.origin, basePath: basePath.endsWith('/') || basePath === '/' ? basePath : `${basePath}/` };

  const scanned = scanRepository(repositoryRoot, options);
  const adapter = detectAdapter(scanned.entries, siteRoot, options.adapter || 'auto');
  const pageCandidates = mapPageCandidates(scanned.entries, siteRoot, adapter, scanned.warnings);
  const pageSources = new Set(pageCandidates.map(page => page.sourcePath));
  const mapped = buildRoutes(pageCandidates, site, scanned.warnings);
  const machines = machineOwnership(scanned.entries, siteRoot);
  const ownership = [...mapped.ownership, ...machines].sort((a, b) => a.surfaceKey.localeCompare(b.surfaceKey));

  const involved = new Set([
    ...pageSources,
    ...mapped.routes.flatMap(route => route.buildPath),
    ...machines.map(item => item.ownerPath),
    ...mapped.facts.map(fact => fact.sourcePath),
    ...(configPath(scanned.entries, siteRoot) ? [configPath(scanned.entries, siteRoot)] : [])
  ].filter(Boolean));
  for (const pathname of scanned.entries.keys()) {
    const siteRelativePath = relativeToSite(pathname, siteRoot);
    if (siteRelativePath && (/^_(?:layouts|includes|data)\//.test(siteRelativePath) || machineDescriptor(siteRelativePath))) involved.add(pathname);
    if (path.posix.basename(pathname) === 'Gemfile' && adapter.id === 'jekyll') involved.add(pathname);
  }

  const files = [...involved].sort().map(pathname => {
    const entry = scanned.entries.get(pathname);
    if (!entry) throw new Error(`Mapped file disappeared during scan: ${pathname}`);
    const classified = fileRole(pathname, siteRoot, adapter, pageSources);
    return {
      path: pathname,
      sha256: entry.sha256,
      bytes: entry.bytes,
      role: classified.role,
      mutationClass: fileMutationClass(classified.role, classified.descriptor),
      generated: false
    };
  });

  const graph = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/site-state-graph.schema.json',
    version: SITE_STATE_GRAPH_VERSION,
    generatedAt: new Date(options.generatedAt || Date.now()).toISOString(),
    repository,
    site,
    adapter,
    files,
    routes: mapped.routes.sort((a, b) => (a.routePath || a.id).localeCompare(b.routePath || b.id)),
    ownership,
    facts: mapped.facts.sort((a, b) => `${a.routePath || ''}:${a.key}:${a.sourcePath}`.localeCompare(`${b.routePath || ''}:${b.key}:${b.sourcePath}`)),
    warnings: scanned.warnings,
    summary: summarize(files, mapped.routes, ownership, mapped.facts),
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
  if (!validation.valid) throw new Error(`Generated Site State Graph is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return graph;
}

export function resolveMappedSurface(graph, selector = {}) {
  const validation = validateSiteStateGraph(graph);
  if (!validation.valid) throw new Error(`Invalid Site State Graph: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  let matches = [];
  if (selector.surfaceKey) matches = graph.ownership.filter(item => item.surfaceKey === selector.surfaceKey);
  else if (selector.routePath && selector.surfaceType) {
    const routePath = normalizeRoutePath(selector.routePath);
    matches = graph.ownership.filter(item => item.routePath === routePath && item.surfaceType === selector.surfaceType);
  } else if (selector.routePath) {
    const routePath = normalizeRoutePath(selector.routePath);
    matches = graph.ownership.filter(item => item.routePath === routePath);
  } else {
    throw new Error('resolveMappedSurface requires surfaceKey or routePath.');
  }
  if (!matches.length) {
    return {
      state: 'unresolved',
      selector,
      ownerPath: null,
      matches: [],
      interpretation: { noPathGuessing: true, ownershipIsNotAuthorization: true }
    };
  }
  const resolved = matches.filter(item => item.state === 'resolved');
  const ownerPaths = [...new Set(resolved.map(item => item.ownerPath).filter(Boolean))];
  return {
    state: matches.some(item => item.state === 'ambiguous') || ownerPaths.length > 1 ? 'ambiguous' : (resolved.length ? 'resolved' : 'unresolved'),
    selector,
    ownerPath: resolved.length && ownerPaths.length === 1 ? ownerPaths[0] : null,
    matches,
    interpretation: { noPathGuessing: true, ownershipIsNotAuthorization: true }
  };
}

const UPGRADE_TARGET_SURFACE_TYPES = [
  { test: /canonical/i, types: ['canonical'] },
  { test: /robots\.txt|crawler/i, types: ['robots-file'] },
  { test: /robots/i, types: ['robots-meta', 'robots-file'] },
  { test: /sitemap/i, types: ['sitemap'] },
  { test: /llms\.txt|llms/i, types: ['llms'] },
  { test: /json[- ]?ld|structured data|schema\.org/i, types: ['jsonld'] },
  { test: /meta description|description/i, types: ['description'] },
  { test: /title/i, types: ['title'] },
  { test: /openapi|api description/i, types: ['api-description'] },
  { test: /agent skill|agent discovery|a2a|mcp|webmcp|ard/i, types: ['agent-discovery'] }
];

function targetSurfaceTypes(target) {
  const match = UPGRADE_TARGET_SURFACE_TYPES.find(item => item.test.test(String(target)));
  return match ? match.types : [];
}

export function resolveUpgradeOwnership(upgradeGraph, siteStateGraph) {
  if (!upgradeGraph || !Array.isArray(upgradeGraph.recommendations)) throw new Error('resolveUpgradeOwnership requires an Adaptive Upgrade graph-like object with recommendations[].');
  const mapValidation = validateSiteStateGraph(siteStateGraph);
  if (!mapValidation.valid) throw new Error(`Invalid Site State Graph: ${mapValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  const recommendations = [];
  for (const recommendation of upgradeGraph.recommendations) {
    const targets = [];
    for (const target of recommendation.change?.targets || []) {
      const surfaceTypes = targetSurfaceTypes(target);
      if (!surfaceTypes.length) {
        targets.push({ target, state: 'unresolved', ownerPath: null, surfaceTypes: [], matches: [], reason: 'target-vocabulary-not-mapped' });
        continue;
      }
      const matches = siteStateGraph.ownership.filter(item => surfaceTypes.includes(item.surfaceType));
      const resolved = matches.filter(item => item.state === 'resolved');
      const ownerPaths = [...new Set(resolved.map(item => item.ownerPath).filter(Boolean))];
      const anyAmbiguous = matches.some(item => item.state === 'ambiguous');
      const state = !matches.length ? 'unresolved' : (anyAmbiguous || ownerPaths.length !== 1 || resolved.length !== 1 ? 'ambiguous' : 'resolved');
      targets.push({
        target,
        state,
        ownerPath: state === 'resolved' ? ownerPaths[0] : null,
        surfaceTypes,
        matches: matches.map(item => ({ surfaceKey: item.surfaceKey, state: item.state, ownerPath: item.ownerPath, mutationClass: item.mutationClass })),
        reason: state === 'resolved' ? 'one-proven-owner' : (state === 'ambiguous' ? 'multiple-or-ambiguous-map-surfaces' : 'no-mapped-surface')
      });
    }
    const safePaths = [...new Set(targets.filter(target => target.state === 'resolved').flatMap(target => {
      const match = siteStateGraph.ownership.find(item => item.surfaceKey === target.matches[0]?.surfaceKey);
      if (!match || ['policy-gated', 'editorial', 'runtime', 'owner-platform', 'blocked'].includes(match.mutationClass)) return [];
      return target.ownerPath ? [target.ownerPath] : [];
    }))];
    recommendations.push({
      recommendationId: recommendation.id,
      automationClass: recommendation.change?.automationClass || null,
      targets,
      resolvedTargets: targets.filter(target => target.state === 'resolved').length,
      ambiguousTargets: targets.filter(target => target.state === 'ambiguous').length,
      unresolvedTargets: targets.filter(target => target.state === 'unresolved').length,
      safeCandidatePaths: ['mechanical', 'grounded-template'].includes(recommendation.change?.automationClass) ? safePaths : []
    });
  }
  return {
    version: REPOSITORY_MAPPER_VERSION,
    site: upgradeGraph.site || null,
    repository: siteStateGraph.repository,
    recommendations,
    allowedPathHints: [...new Set(recommendations.flatMap(item => item.safeCandidatePaths))].sort(),
    guardrails: {
      mapEvidenceDoesNotAuthorizeMutation: true,
      ambiguousOwnershipNeverProducesAllowedPathHint: true,
      policyAndEditorialNeverProduceAllowedPathHint: true,
      operationContentStillRequiresGrounding: true
    }
  };
}
