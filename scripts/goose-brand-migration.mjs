#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const frozenPrefixes = [
  'docs/changelog/',
  'docs/evidence/receipts/',
  'docs/research/state-of-agentic-web/releases/',
  'docs/research/portfolio-growth/runs/',
  'knowledge/experiments/',
  'knowledge/research/'
];

const frozenExact = new Set([
  'CHANGELOG.md',
  'docs/history.html',
  'docs/history.json'
]);

const migrationControlFiles = new Set([
  'scripts/goose-brand-migration.mjs',
  'scripts/goose-brand-test.mjs'
]);

const rootCurrentFiles = new Set([
  'README.md',
  'TRADEMARKS.md'
]);

const currentExtensions = new Set([
  '.html', '.md', '.txt', '.json', '.jsonld', '.xml', '.mjs', '.js', '.yml', '.yaml'
]);

const currentPrefixes = [
  'docs/',
  'scripts/',
  'lib/',
  'skills/',
  'registry/',
  'examples/',
  'templates/'
];

function isFrozen(file) {
  return frozenExact.has(file) || frozenPrefixes.some(prefix => file.startsWith(prefix));
}

function isCurrentBrandSurface(file) {
  if (migrationControlFiles.has(file) || isFrozen(file)) return false;
  if (rootCurrentFiles.has(file)) return true;
  if (file === 'docs/BRAND-CITE-GOOSE.md') return true;
  if (currentPrefixes.some(prefix => file.startsWith(prefix))) return currentExtensions.has(path.extname(file));
  return false;
}

const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter(isCurrentBrandSurface);

const changed = [];
for (const file of files) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
  let source;
  try {
    source = fs.readFileSync(absolute, 'utf8');
  } catch {
    continue;
  }
  if (!source.includes('Cite Goose') && !source.includes('CITE GOOSE') && !source.includes('BRAND-CITE-GOOSE.md')) continue;

  const next = source
    .replaceAll('CITE GOOSE', 'GOOSE')
    .replaceAll('Cite Goose', 'Goose')
    .replaceAll('BRAND-CITE-GOOSE.md', 'BRAND-GOOSE.md');

  if (next !== source) {
    fs.writeFileSync(absolute, next);
    changed.push(file);
  }
}

const legacyBrandPath = path.join(root, 'docs', 'BRAND-CITE-GOOSE.md');
const canonicalBrandPath = path.join(root, 'docs', 'BRAND-GOOSE.md');
if (fs.existsSync(legacyBrandPath)) {
  const migratedBrand = fs.readFileSync(legacyBrandPath, 'utf8');
  const canonical = migratedBrand.startsWith('# Goose')
    ? migratedBrand
    : `# Goose\n\n${migratedBrand}`;
  fs.writeFileSync(canonicalBrandPath, canonical);
  fs.writeFileSync(
    legacyBrandPath,
    '# Legacy brand-path compatibility\n\nThe current public product brand is **Goose**. The technical core remains **Agent-Ready Web Profile (ARWP)**.\n\nUse the canonical brand document: [BRAND-GOOSE.md](./BRAND-GOOSE.md).\n\nThis file path is retained so older repository links do not break.\n'
  );
  if (!changed.includes('docs/BRAND-CITE-GOOSE.md')) changed.push('docs/BRAND-CITE-GOOSE.md');
  changed.push('docs/BRAND-GOOSE.md');
}

console.log(`Goose brand migration updated ${changed.length} file(s).`);
for (const file of changed.sort()) console.log(`- ${file}`);
