import fs from 'node:fs';
import path from 'node:path';
import { compileSiteStateGraph } from './repository-mapper.mjs';
import { compileAstroSiteStateGraph, detectAstroRepositorySignals } from './repository-mapper-astro.mjs';
import { compileNextSiteStateGraph, detectNextRepositorySignals } from './repository-mapper-nextjs.mjs';

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
  if (!['auto', 'static-html', 'jekyll', 'astro', 'nextjs'].includes(requested)) throw new Error(`Unsupported Repository Mapper adapter: ${requested}`);
  if (requested !== 'auto') return { id: requested, evidence: [`adapter:forced:${requested}`] };

  const frameworks = [
    { id: 'astro', evidence: detectAstroRepositorySignals(options) },
    { id: 'jekyll', evidence: jekyllSignals(options) },
    { id: 'nextjs', evidence: detectNextRepositorySignals(options) }
  ].filter(item => item.evidence.length);
  if (frameworks.length > 1) {
    throw new Error(`Repository Mapper found conflicting framework signals: ${frameworks.map(item => `${item.id} (${item.evidence.join(', ')})`).join('; ')}. Select --adapter explicitly only after confirming the owning site stack.`);
  }
  if (frameworks.length === 1) return frameworks[0];
  return { id: 'static-html', evidence: ['fallback:core-static-detection'] };
}

export function compileRepositorySiteStateGraph(options = {}) {
  const detected = detectRepositoryMapperAdapter(options);
  if (detected.id === 'astro') return compileAstroSiteStateGraph({ ...options, adapter: 'astro' });
  if (detected.id === 'nextjs') return compileNextSiteStateGraph({ ...options, adapter: 'nextjs' });
  return compileSiteStateGraph({ ...options, adapter: options.adapter === 'auto' || !options.adapter ? 'auto' : detected.id });
}
