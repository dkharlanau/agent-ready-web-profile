#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const target = path.resolve(process.argv[2] || '.');

function exists(rel) {
  return fs.existsSync(path.join(target, rel));
}

function readJson(rel) {
  try { return JSON.parse(fs.readFileSync(path.join(target, rel), 'utf8')); }
  catch { return null; }
}

const pkg = readJson('package.json');
const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };

const frameworkRules = [
  ['next', () => Boolean(deps.next) || exists('next.config.js') || exists('next.config.mjs') || exists('next.config.ts')],
  ['astro', () => Boolean(deps.astro) || exists('astro.config.mjs') || exists('astro.config.ts')],
  ['nuxt', () => Boolean(deps.nuxt) || Boolean(deps['@nuxt/core']) || exists('nuxt.config.ts') || exists('nuxt.config.js')],
  ['sveltekit', () => Boolean(deps['@sveltejs/kit']) || exists('svelte.config.js')],
  ['docusaurus', () => Boolean(deps['@docusaurus/core']) || exists('docusaurus.config.js') || exists('docusaurus.config.ts')],
  ['vite', () => Boolean(deps.vite) || exists('vite.config.js') || exists('vite.config.ts') || exists('vite.config.mjs')],
  ['mkdocs', () => exists('mkdocs.yml') || exists('mkdocs.yaml')],
  ['hugo', () => exists('hugo.toml') || exists('hugo.yaml') || exists('config.toml')],
  ['jekyll', () => exists('_config.yml') || exists('_config.yaml')]
];

const frameworks = frameworkRules.filter(([, fn]) => fn()).map(([name]) => name);
const publicRoots = ['public', 'static', 'docs', 'site'].filter(exists);

const candidateSurfaces = [
  'robots.txt', 'sitemap.xml', 'sitemap.md', 'llms.txt', 'AGENTS.md',
  'ai/site-profile.json', 'ai/ai-search-profile.json', 'ai/product.jsonld', 'ai/product-classification.json',
  '.well-known/ard.json', '.well-known/agent-card.json', '.well-known/agent-skills/index.json',
  'openapi.json', 'openapi.yaml', 'openapi.yml'
];

const surfaces = [];
for (const rel of candidateSurfaces) {
  if (exists(rel)) surfaces.push(rel);
  for (const root of publicRoots) {
    const nested = path.join(root, rel);
    if (exists(nested)) surfaces.push(nested);
  }
}

const configs = [
  'package.json', 'next.config.js', 'next.config.mjs', 'next.config.ts', 'astro.config.mjs', 'astro.config.ts',
  'nuxt.config.js', 'nuxt.config.ts', 'svelte.config.js', 'docusaurus.config.js', 'docusaurus.config.ts',
  'vite.config.js', 'vite.config.ts', 'mkdocs.yml', 'mkdocs.yaml', 'hugo.toml', 'hugo.yaml', '_config.yml',
  'netlify.toml', 'vercel.json', 'wrangler.toml', '.github/workflows'
].filter(exists);

const scripts = pkg?.scripts || {};
const buildCommands = ['build', 'test', 'lint', 'check', 'typecheck']
  .filter(name => typeof scripts[name] === 'string')
  .map(name => ({ name, command: `npm run ${name}`, script: scripts[name] }));

const sourceHints = ['src', 'app', 'pages', 'content', 'posts', 'blog', 'components', 'layouts'].filter(exists);

const result = {
  inspectorVersion: '0.1',
  target,
  packageManagerHints: {
    npm: exists('package-lock.json'),
    pnpm: exists('pnpm-lock.yaml'),
    yarn: exists('yarn.lock'),
    bun: exists('bun.lock') || exists('bun.lockb')
  },
  frameworks,
  configs,
  publicRoots,
  sourceHints,
  buildCommands,
  observedSurfaces: [...new Set(surfaces)].sort(),
  boundaries: {
    networkUsed: false,
    fileContentsRead: ['package.json'],
    secretsRead: false,
    note: 'This helper reports repository signals only. It does not prove deployed routes, Search eligibility, runtime protocol conformance, or publisher intent.'
  },
  nextStep: 'Use the detected framework/public-root/source-of-truth before applying ARWP templates. Run live arwp audit/growth only after a canonical deployed URL is known.'
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
