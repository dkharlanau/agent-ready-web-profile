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
const frozenExact = new Set(['CHANGELOG.md', 'docs/history.html', 'docs/history.json']);
const selfFiles = new Set(['scripts/goose-brand-test.mjs']);
const extensions = new Set(['.html', '.md', '.txt', '.json', '.jsonld', '.xml', '.mjs', '.js', '.yml', '.yaml']);
const currentPrefixes = ['docs/', 'lib/', 'skills/', 'registry/', 'examples/', 'templates/'];

function inCurrentScope(file) {
  if (selfFiles.has(file) || frozenExact.has(file) || frozenPrefixes.some(prefix => file.startsWith(prefix))) return false;
  if (file === 'README.md' || file === 'TRADEMARKS.md') return true;
  if (currentPrefixes.some(prefix => file.startsWith(prefix))) return extensions.has(path.extname(file));
  if (file === 'scripts/build-discoverability.mjs') return true;
  return false;
}

const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter(inCurrentScope);

const legacy = [];
for (const file of files) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
  let text;
  try { text = fs.readFileSync(absolute, 'utf8'); } catch { continue; }
  if (text.includes('Cite Goose') || text.includes('CITE GOOSE')) legacy.push(file);
}

if (legacy.length) {
  throw new Error(`Legacy public brand remains in current surfaces: ${legacy.join(', ')}`);
}

const expectations = [
  ['docs/index.html', '<strong>Goose</strong>'],
  ['docs/index.html', '<title>Goose — Make your site worth citing.</title>'],
  ['docs/site-focus.html', 'Goose'],
  ['docs/site-pattern-graph.html', 'Goose'],
  ['docs/discoverability.html', 'Goose — Discoverability Pattern Library'],
  ['docs/trust/brand.html', 'Goose'],
  ['docs/evidence-lab/index.html', '<strong>Goose</strong>'],
  ['examples/editorial/section-graph.html', 'Goose example'],
  ['docs/examples/editorial/section-graph.html', 'Goose example'],
  ['README.md', 'Goose'],
  ['TRADEMARKS.md', 'Goose'],
  ['docs/BRAND-GOOSE.md', 'Goose'],
  ['docs/BRAND-CITE-GOOSE.md', 'Legacy brand-path compatibility']
];

for (const [file, needle] of expectations) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) throw new Error(`Missing brand surface: ${file}`);
  const text = fs.readFileSync(absolute, 'utf8');
  if (!text.includes(needle)) throw new Error(`${file} is missing expected Goose identity: ${needle}`);
}

const home = fs.readFileSync(path.join(root, 'docs', 'index.html'), 'utf8');
if (!home.includes('Agent-Ready Web Profile') || !home.includes('ARWP')) {
  throw new Error('Technical Agent-Ready Web Profile / ARWP identity must remain on the Goose home page.');
}

const legacyDoc = fs.readFileSync(path.join(root, 'docs', 'BRAND-CITE-GOOSE.md'), 'utf8');
if (!legacyDoc.includes('BRAND-GOOSE.md')) throw new Error('Legacy brand path must point to the canonical Goose brand document.');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const required of ['docs/BRAND-GOOSE.md', 'docs/BRAND-CITE-GOOSE.md']) {
  if (!pkg.files?.includes(required)) throw new Error(`npm package surface is missing ${required}`);
}

console.log(`PASS Goose brand contract across ${files.length} current public/source surfaces; ARWP remains the technical identity, both canonical and compatibility brand docs ship in the package, and frozen history is excluded.`);
