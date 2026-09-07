import fs from 'node:fs';
import path from 'node:path';
import { compileSiteStateGraph } from './repository-mapper.mjs';
import { compileAstroSiteStateGraph, detectAstroRepositorySignals } from './repository-mapper-astro.mjs';

function normalizeSiteRoot(value) {
  const normalized = path.posix.normalize(String(value || '.').replaceAll('\\', '/').replace(/^\.\//, '') || '.');
  if (path.posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../')) throw new Error('siteRoot must stay inside the repository.');
  return normalized;
}

function projectPath(root, siteRoot, relative) {
  return path.resolve(root, siteRoot === '.' ? relative : path.join(siteRoot, relative));
}

function jekyllSignals(options = {}) {
  const root = fs.realpathSync(path.resolve(options.root || '.'));
  const siteRoot = normalizeSiteRoot(options.siteRoot || options.repository?.siteRoot || '.');
  const signals = [];
  for (const config of ['_config.yml', '_config.yaml']) {
    if (fs.existsSync(projectPath(root, siteRoot, config))) signals.push(`config:${siteRoot === '.' ? config : `${siteRoot}/${config}`}`);
  }
  if (fs.existsSync(projectPath(root, siteRoot, '_layouts'))) signals.push(`directory:${siteRoot === '.' ? '_layouts' : `${siteRoot}/_layouts`}`);
  const gemfile = projectPath(root, siteRoot, 'Gemfile');
  if (fs.existsSync(gemfile)) {
    try {
      if (/\bjekyll\b/i.test(fs.readFileSync(gemfile, 'utf8'))) signals.push(`gem:${siteRoot === '.' ? 'Gemfile' : `${siteRoot}/Gemfile`}:jekyll`);
    } catch {}
  }
  return signals;
}

export function detectRepositoryMapperAdapter(options = {}) {
  const requested = options.adapter || 'auto';
  if (!['auto', 'static-html', 'jekyll', 'astro'].includes(requested)) throw new Error(`Unsupported Repository Mapper adapter: ${requested}`);
  if (requested !== 'auto') return { id: requested, evidence: [`adapter:forced:${requested}`] };

  const astro = detectAstroRepositorySignals(options);
  const jekyll = jekyllSignals(options);
  if (astro.length && jekyll.length) {
    throw new Error(`Repository Mapper found conflicting framework signals: Astro (${astro.join(', ')}) and Jekyll (${jekyll.join(', ')}). Select --adapter explicitly only after confirming the owning site stack.`);
  }
  if (astro.length) return { id: 'astro', evidence: astro };
  if (jekyll.length) return { id: 'jekyll', evidence: jekyll };
  return { id: 'static-html', evidence: ['fallback:core-static-detection'] };
}

export function compileRepositorySiteStateGraph(options = {}) {
  const detected = detectRepositoryMapperAdapter(options);
  if (detected.id === 'astro') return compileAstroSiteStateGraph({ ...options, adapter: 'astro' });
  return compileSiteStateGraph({ ...options, adapter: options.adapter === 'auto' || !options.adapter ? 'auto' : detected.id });
}
