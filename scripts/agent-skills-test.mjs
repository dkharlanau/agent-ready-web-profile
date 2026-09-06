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

assert.equal(index.version, '0.1');
assert.equal(index.standard, 'Agent Skills');
assert.equal(index.skills.length, 5);
assert.equal(index.composition.default, 'arwp-growth-loop');
assert.equal(index.composition.sitePreparation, 'arwp-prepare-site');

const directories = fs.readdirSync(skillsRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
assert.deepEqual(directories, index.skills.map(skill => skill.name).sort(), 'skills/index.json must list every skill directory exactly once');

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

const prepare = fs.readFileSync(path.join(skillsRoot, 'arwp-prepare-site', 'SKILL.md'), 'utf8');
for (const expected of ['arwp audit', 'arwp-growth', 'arwp assert', 'Evidence Receipts']) assert.match(prepare, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
assert.match(prepare, /Do not stop at a plan/i);
assert.match(prepare, /references\/stack-detection\.md/);
assert.match(prepare, /references\/file-matrix\.md/);

const content = fs.readFileSync(path.join(skillsRoot, 'arwp-ai-search-content', 'SKILL.md'), 'utf8');
assert.match(content, /non-commodity/i);
assert.match(content, /primary sources/i);
const discovery = fs.readFileSync(path.join(skillsRoot, 'arwp-agent-discovery', 'SKILL.md'), 'utf8');
for (const mechanism of ['Agent Skills', 'ARD', 'MCP', 'A2A', 'WebMCP', 'OpenAPI']) assert.match(discovery, new RegExp(mechanism, 'i'));
const evidence = fs.readFileSync(path.join(skillsRoot, 'arwp-evidence-ci', 'SKILL.md'), 'utf8');
assert.match(evidence, /read-only/i);

console.log(`PASS ${index.skills.length} ARWP Agent Skills use growth-first orchestration and evidence-safe workflows`);
