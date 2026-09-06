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
    const key = raw.slice(0, colon).trim();
    const value = raw.slice(colon + 1).trim();
    out[key] = value;
  }
  return out;
}

assert.equal(index.version, '0.1');
assert.equal(index.standard, 'Agent Skills');
assert.equal(index.skills.length, 4);
assert.equal(index.composition.default, 'arwp-prepare-site');

const directories = fs.readdirSync(skillsRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();
const indexed = index.skills.map(skill => skill.name).sort();
assert.deepEqual(directories, indexed, 'skills/index.json must list every skill directory exactly once');

for (const skill of index.skills) {
  assert.match(skill.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${skill.name} must be kebab-case`);
  assert.ok(skill.name.length <= 64, `${skill.name} must be <=64 chars`);
  const expectedPath = path.join('skills', skill.name, 'SKILL.md');
  assert.equal(skill.path, expectedPath, `${skill.name} index path must be canonical`);
  const absolute = path.join(root, expectedPath);
  assert.ok(fs.existsSync(absolute), `${expectedPath} must exist`);
  const text = fs.readFileSync(absolute, 'utf8');
  const frontmatter = parseFrontmatter(text, expectedPath);
  assert.equal(frontmatter.name, skill.name, `${skill.name} frontmatter name must match folder`);
  assert.ok(frontmatter.description?.length > 80, `${skill.name} needs a trigger-rich description`);
  assert.ok(frontmatter.description.length <= 1024, `${skill.name} description must fit Agent Skills limits`);
  assert.match(frontmatter.license || '', /Apache-2\.0/, `${skill.name} should declare the project license`);
  assert.match(text, /## Workflow|## Decision order|## Core rule/i, `${skill.name} must contain actionable workflow guidance`);
  assert.match(text, /ranking|citation|readiness/i, `${skill.name} must state the relevant quality boundary`);
  assert.ok(!/meta name=["']keywords["']/i.test(text), `${skill.name} must not recommend meta keywords`);
}

const prepare = fs.readFileSync(path.join(skillsRoot, 'arwp-prepare-site', 'SKILL.md'), 'utf8');
for (const expected of ['arwp audit', 'arwp-growth', 'arwp assert', 'Evidence Receipts']) {
  assert.match(prepare, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `orchestrator must reference ${expected}`);
}
assert.match(prepare, /Do not stop at a plan/i, 'orchestrator must be implementation-oriented');

const content = fs.readFileSync(path.join(skillsRoot, 'arwp-ai-search-content', 'SKILL.md'), 'utf8');
assert.match(content, /non-commodity/i);
assert.match(content, /primary sources/i);
assert.match(content, /generic FAQ schema/i);

const discovery = fs.readFileSync(path.join(skillsRoot, 'arwp-agent-discovery', 'SKILL.md'), 'utf8');
for (const mechanism of ['Agent Skills', 'ARD', 'MCP', 'A2A', 'WebMCP', 'OpenAPI']) assert.match(discovery, new RegExp(mechanism, 'i'));

const evidence = fs.readFileSync(path.join(skillsRoot, 'arwp-evidence-ci', 'SKILL.md'), 'utf8');
assert.match(evidence, /read-only/i);
assert.match(evidence, /project-reference/);
assert.match(evidence, /independent-benchmark/);

console.log(`PASS ${index.skills.length} ARWP Agent Skills use portable SKILL.md frontmatter, progressive specialization and evidence-safe implementation workflows`);
