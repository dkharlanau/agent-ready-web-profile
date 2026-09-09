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
const currentPrefixes = [
  'ai/',
  'benchmarks/',
  'bin/',
  'docs/',
  'examples/',
  'gateway/',
  'lib/',
  'monitor/',
  'registry/',
  'resolver/',
  'router/',
  'scanner-service/',
  'schema/',
  'scripts/',
  'skills/',
  'templates/'
];

function isRegressionFixture(file) {
  return (
    /(^|\/)tests?\//.test(file) ||
    /(^|\/)[^/]*-test\.mjs$/.test(file) ||
    /(^|\/)[^/]*\.test\.[cm]?[jt]s$/.test(file)
  );
}

function inCurrentScope(file) {
  if (selfFiles.has(file) || isRegressionFixture(file) || frozenExact.has(file) || frozenPrefixes.some(prefix => file.startsWith(prefix))) return false;
  if (file === 'README.md' || file === 'TRADEMARKS.md') return true;
  if (currentPrefixes.some(prefix => file.startsWith(prefix))) return extensions.has(path.extname(file));
  return false;
}

function countLegacy(text) {
  return (text.match(/Cite Goose|CITE GOOSE/g) || []).length;
}

function isBoundedDeprecatedReference(file, text) {
  const occurrences = countLegacy(text);
  if (occurrences !== 1) return false;

  if (file === 'TRADEMARKS.md') {
    return /\*\*Cite Goose\*\*\s+—\s+deprecated legacy public name retained only where history\/path compatibility requires it/i.test(text)
      && /Goose ARWP/.test(text);
  }

  if (file === 'docs/project/marks.html') {
    return /<strong>Cite Goose<\/strong><\/td><td>Legacy public name retained only where history\/path compatibility requires it<\/td><td><span class="project-status legacy">Deprecated<\/span>/i.test(text)
      && /<title>Names &amp; Marks — Goose ARWP<\/title>/i.test(text);
  }

  if (file === 'docs/project/profile.json') {
    try {
      const value = JSON.parse(text);
      const legacy = value.projectNames?.filter(item => item?.name === 'Cite Goose') || [];
      return legacy.length === 1
        && legacy[0].role === 'legacy-public-name'
        && /^deprecated-/.test(legacy[0].status)
        && value.product?.name === 'Goose ARWP';
    } catch {
      return false;
    }
  }

  return false;
}

const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter(inCurrentScope);

const legacy = [];
const boundedLegacy = [];
for (const file of files) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
  let text;
  try { text = fs.readFileSync(absolute, 'utf8'); } catch { continue; }
  if (!text.includes('Cite Goose') && !text.includes('CITE GOOSE')) continue;
  if (isBoundedDeprecatedReference(file, text)) boundedLegacy.push(file);
  else legacy.push(file);
}

if (legacy.length) {
  throw new Error(`Legacy public brand remains in current surfaces: ${legacy.join(', ')}`);
}

const expectedBoundedLegacy = ['TRADEMARKS.md', 'docs/project/marks.html', 'docs/project/profile.json'];
for (const file of expectedBoundedLegacy) {
  if (!boundedLegacy.includes(file)) throw new Error(`Expected bounded deprecated brand reference is missing or no longer explicitly deprecated: ${file}`);
}
if (boundedLegacy.some(file => !expectedBoundedLegacy.includes(file))) {
  throw new Error(`Unexpected current surface contains a deprecated brand reference: ${boundedLegacy.filter(file => !expectedBoundedLegacy.includes(file)).join(', ')}`);
}

const expectations = [
  ['ai/site-profile.json', '"name": "Goose ARWP"'],
  ['docs/ai/site-profile.json', '"name": "Goose ARWP"'],
  ['docs/index.html', '<strong>Goose</strong><span>ARWP<br>GET FOUND.</span>'],
  ['docs/index.html', '<title>Goose ARWP — Get Found.</title>'],
  ['docs/index.html', '<h1>Get<br>Found.</h1>'],
  ['docs/site-focus.html', '<strong>Goose</strong><span>ARWP<br>GET FOUND.</span>'],
  ['docs/site-pattern-graph.html', 'Goose'],
  ['docs/discoverability.html', 'Goose ARWP — Discoverability Pattern Library'],
  ['docs/discoverability.html', '<h1>Get<br>Found.</h1>'],
  ['docs/trust/brand.html', 'Goose ARWP'],
  ['docs/evidence-lab/index.html', '<strong>Goose</strong><span>ARWP<br>GET FOUND.</span>'],
  ['examples/editorial/section-graph.html', 'Goose example'],
  ['docs/examples/editorial/section-graph.html', 'Goose example'],
  ['README.md', '# Goose ARWP'],
  ['README.md', '**Get Found.**'],
  ['TRADEMARKS.md', 'Goose ARWP'],
  ['docs/BRAND-GOOSE.md', 'Goose ARWP — Get Found.'],
  ['docs/BRAND-CITE-GOOSE.md', 'Legacy brand-path compatibility']
];

for (const [file, needle] of expectations) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) throw new Error(`Missing brand surface: ${file}`);
  const text = fs.readFileSync(absolute, 'utf8');
  if (!text.includes(needle)) throw new Error(`${file} is missing expected Goose ARWP identity: ${needle}`);
}

const rootProfile = fs.readFileSync(path.join(root, 'ai', 'site-profile.json'), 'utf8');
const docsProfile = fs.readFileSync(path.join(root, 'docs', 'ai', 'site-profile.json'), 'utf8');
if (rootProfile !== docsProfile) throw new Error('Canonical and GitHub Pages self-profiles must remain byte-identical.');

const home = fs.readFileSync(path.join(root, 'docs', 'index.html'), 'utf8');
if (!home.includes('Agent-Ready Web Profile') || !home.includes('ARWP')) {
  throw new Error('Technical Agent-Ready Web Profile / ARWP identity must remain on the Goose ARWP home page.');
}

const productLine = JSON.parse(fs.readFileSync(path.join(root, 'registry', 'product-line.json'), 'utf8'));
if (productLine.brand !== 'Goose ARWP' || productLine.tagline !== 'Get Found.') {
  throw new Error('Product-line registry must keep Goose ARWP as the canonical brand and Get Found. as the tagline.');
}
if (!productLine.brandAliases?.includes('Goose')) throw new Error('Goose short form must remain an explicit brand alias.');

const legacyDoc = fs.readFileSync(path.join(root, 'docs', 'BRAND-CITE-GOOSE.md'), 'utf8');
if (!legacyDoc.includes('BRAND-GOOSE.md')) throw new Error('Legacy brand path must point to the canonical Goose ARWP brand document.');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const required of ['docs/BRAND-GOOSE.md', 'docs/BRAND-CITE-GOOSE.md']) {
  if (!pkg.files?.includes(required)) throw new Error(`npm package surface is missing ${required}`);
}

console.log(`PASS Goose ARWP brand contract across ${files.length} current public/source surfaces; Get Found. is the primary tagline, Goose remains the short form, Agent-Ready Web Profile / ARWP remains the technical identity, canonical self-profiles are byte-identical, exactly three policy/registry surfaces may retain one explicitly deprecated Cite Goose reference each, regression fixtures may mention legacy copy only as negative test data, both brand docs ship in the package, and frozen history is excluded.`);
