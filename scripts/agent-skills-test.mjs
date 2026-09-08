import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = path.join(root, 'skills');
const index = JSON.parse(fs.readFileSync(path.join(skillsRoot, 'index.json'), 'utf8'));

function parseFrontmatter(text, file) {
  const match = String(text).match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, `${file} must start with YAML frontmatter`);
  const out = {};
  for (const raw of match[1].split(/\r?\n/)) {
    if (!raw || /^\s/.test(raw)) continue;
    const colon = raw.indexOf(':');
    if (colon < 1) continue;
    out[raw.slice(0, colon).trim()] = raw.slice(colon + 1).trim();
  }
  return out;
}

assert.equal(index.version, '0.2');
assert.equal(index.standard, 'Agent Skills');
assert.ok(index.skills.length >= 5, 'ARWP must retain its core multi-skill architecture');
assert.equal(index.composition.default, 'arwp-growth-loop');
assert.equal(index.composition.searchMaturity, 'arwp-search-maturity');
assert.equal(index.composition.sitePreparation, 'arwp-prepare-site');
assert.equal(index.composition.upgradeCompiler, 'arwp-adaptive-upgrade');
assert.equal(index.composition.transformationDelivery, 'arwp-target-transformation');
assert.equal(index.composition.provenanceGraph, 'arwp-braidgraph');
assert.equal(index.composition.futureSearch, 'arwp-future-search');

const expectedCoreSkills = [
  'arwp-growth-loop',
  'arwp-search-maturity',
  'arwp-adaptive-upgrade',
  'arwp-target-transformation',
  'arwp-braidgraph',
  'arwp-prepare-site',
  'arwp-ai-search-content',
  'arwp-future-search',
  'arwp-dataset-publication',
  'arwp-agent-discovery',
  'arwp-evidence-ci',
  'arwp-portfolio-fleet'
];
const indexedNames = index.skills.map(skill => skill.name);
for (const name of expectedCoreSkills) assert.ok(indexedNames.includes(name), `skills/index.json must include ${name}`);

const directories = fs.readdirSync(skillsRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
assert.deepEqual(directories, [...indexedNames].sort(), 'skills/index.json must list every skill directory exactly once');
assert.equal(new Set(indexedNames).size, indexedNames.length, 'skill names must be unique');

for (const skill of index.skills) {
  assert.match(skill.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const expectedPath = path.join('skills', skill.name, 'SKILL.md');
  assert.equal(skill.path, expectedPath);
  const text = fs.readFileSync(path.join(root, expectedPath), 'utf8');
  const frontmatter = parseFrontmatter(text, expectedPath);
  assert.equal(frontmatter.name, skill.name);
  assert.ok(frontmatter.description?.length > 80 && frontmatter.description.length <= 1024);
  assert.match(frontmatter.license || '', /Apache-2\.0/);
  assert.match(text, /## Workflow|## Decision order|## Core rule|## Product loop/i);
  assert.match(text, /ranking|citation|readiness|recommend/i);
  assert.ok(!/meta name=["']keywords["']/i.test(text));
}

const growth = fs.readFileSync(path.join(skillsRoot, 'arwp-growth-loop', 'SKILL.md'), 'utf8');
for (const expected of ['arwp-trends', 'arwp-hypotheses', 'arwp-growth', 'research', 'measure', 'negative results']) assert.match(growth, new RegExp(expected, 'i'));

const searchMaturity = fs.readFileSync(path.join(skillsRoot, 'arwp-search-maturity', 'SKILL.md'), 'utf8');
for (const expected of ['reference cohort', 'rankEvidence', 'unknown', 'correlation', 'negative results']) assert.match(searchMaturity, new RegExp(expected, 'i'));

const adaptive = fs.readFileSync(path.join(skillsRoot, 'arwp-adaptive-upgrade', 'SKILL.md'), 'utf8');
for (const expected of ['knowledge', 'verification', 'measurement', 'review-due']) assert.match(adaptive, new RegExp(expected, 'i'));

const transform = fs.readFileSync(path.join(skillsRoot, 'arwp-target-transformation', 'SKILL.md'), 'utf8');
for (const expected of ['digest', 'allowedPaths', 'rollback', 'policy-gated', 'target-repository-transform-pr']) assert.match(transform, new RegExp(expected, 'i'));

const braid = fs.readFileSync(path.join(skillsRoot, 'arwp-braidgraph', 'SKILL.md'), 'utf8');
for (const expected of ['impact', 'missing-evidence', 'superseded', 'causality', 'review-due', 'negative']) assert.match(braid, new RegExp(expected, 'i'));

const prepare = fs.readFileSync(path.join(skillsRoot, 'arwp-prepare-site', 'SKILL.md'), 'utf8');
for (const expected of ['arwp audit', 'arwp-growth', 'arwp assert', 'Evidence Receipts']) assert.match(prepare, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
assert.match(prepare, /Do not stop at a plan/i);
assert.match(prepare, /references\/stack-detection\.md/);
assert.match(prepare, /references\/file-matrix\.md/);

const content = fs.readFileSync(path.join(skillsRoot, 'arwp-ai-search-content', 'SKILL.md'), 'utf8');
assert.match(content, /non-commodity/i);
assert.match(content, /primary sources/i);
const futureSearch = fs.readFileSync(path.join(skillsRoot, 'arwp-future-search', 'SKILL.md'), 'utf8');
for (const expected of ['semantic', 'evidence graph', 'ranking']) assert.match(futureSearch, new RegExp(expected, 'i'));
const dataset = fs.readFileSync(path.join(skillsRoot, 'arwp-dataset-publication', 'SKILL.md'), 'utf8');
for (const expected of ['dataset', 'DOI', 'version']) assert.match(dataset, new RegExp(expected, 'i'));
const discovery = fs.readFileSync(path.join(skillsRoot, 'arwp-agent-discovery', 'SKILL.md'), 'utf8');
for (const mechanism of ['Agent Skills', 'ARD', 'MCP', 'A2A', 'WebMCP', 'OpenAPI']) assert.match(discovery, new RegExp(mechanism, 'i'));
const evidence = fs.readFileSync(path.join(skillsRoot, 'arwp-evidence-ci', 'SKILL.md'), 'utf8');
assert.match(evidence, /read-only/i);

console.log(`PASS ${index.skills.length} ARWP Agent Skills use growth-first orchestration, reference-cohort learning, adaptive upgrade intelligence, BraidGraph provenance, future-search experimentation, safe transformation delivery and evidence-safe workflows`);
