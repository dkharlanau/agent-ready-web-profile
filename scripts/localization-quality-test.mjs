import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = path => readFileSync(resolve(root, path), 'utf8');
const readJson = path => JSON.parse(read(path));

const requiredFiles = [
  'LOCALIZATION.md',
  'docs/LOCALIZATION.md',
  'docs/LOCALIZATION-QUALITY.md',
  'skills/arwp-localization-quality/SKILL.md',
  'skills/arwp-localization-quality/references/prompts.md',
  'skills/arwp-localization-quality/references/ci-gates.md',
  'skills/arwp-localization-quality/references/localization-profile.example.json',
  'skills/arwp-localization-quality/references/glossary.example.json',
  'docs/skills/arwp-localization-quality/SKILL.md',
  'docs/skills/arwp-localization-quality/references/prompts.md',
  'docs/skills/arwp-localization-quality/references/ci-gates.md',
  'docs/skills/arwp-localization-quality/references/localization-profile.example.json',
  'docs/skills/arwp-localization-quality/references/glossary.example.json',
  'skills/index.json',
  'docs/skills/index.json',
  'docs/skills/index.html',
  'docs/skills/llms.txt'
];

for (const path of requiredFiles) {
  assert.ok(existsSync(resolve(root, path)), `Missing localization package file: ${path}`);
}
assert.ok(!existsSync(resolve(root, 'docs/LOCALIZATION-ENTRYPOINT.tmp.md')), 'Temporary localization entry point must not be committed');

const mirrorPairs = [
  ['skills/arwp-localization-quality/SKILL.md', 'docs/skills/arwp-localization-quality/SKILL.md'],
  ['skills/arwp-localization-quality/references/prompts.md', 'docs/skills/arwp-localization-quality/references/prompts.md'],
  ['skills/arwp-localization-quality/references/ci-gates.md', 'docs/skills/arwp-localization-quality/references/ci-gates.md'],
  ['skills/arwp-localization-quality/references/localization-profile.example.json', 'docs/skills/arwp-localization-quality/references/localization-profile.example.json'],
  ['skills/arwp-localization-quality/references/glossary.example.json', 'docs/skills/arwp-localization-quality/references/glossary.example.json']
];
for (const [canonical, published] of mirrorPairs) {
  assert.equal(read(published), read(canonical), `${published} must remain an exact mirror of ${canonical}`);
}

const standard = read('LOCALIZATION.md');
for (const marker of [
  'Build the glossary first',
  'Run an independent reconciliation pass',
  'Verify the built interface',
  'Detect stale localization after source changes',
  'localization impact gate',
  'pseudo-locale',
  'AI and agent surfaces'
]) {
  assert.ok(standard.toLowerCase().includes(marker.toLowerCase()), `LOCALIZATION.md is missing required concept: ${marker}`);
}

const publicPolicy = read('docs/LOCALIZATION.md');
for (const marker of [
  'Localization quality',
  'Agent-facing routing',
  'agentRoutingLanguages',
  'llms.txt',
  'glossary',
  'localization-impact'
]) {
  assert.ok(publicPolicy.toLowerCase().includes(marker.toLowerCase()), `docs/LOCALIZATION.md is missing required public concept: ${marker}`);
}

const skill = read('skills/arwp-localization-quality/SKILL.md');
for (const marker of [
  'Build the localization surface ledger',
  'Build or review the glossary',
  'Run an independent reconciliation pass',
  'Install drift protection in CI'
]) {
  assert.ok(skill.includes(marker), `Localization skill is missing workflow step: ${marker}`);
}

const prompts = read('skills/arwp-localization-quality/references/prompts.md');
for (const name of ['Glossary Builder', 'Content Localizer', 'Localization Reconciler', 'UI Localization Auditor']) {
  assert.ok(prompts.includes(name), `Missing localization prompt contract: ${name}`);
}

const profile = readJson('skills/arwp-localization-quality/references/localization-profile.example.json');
assert.equal(profile.sourceLocale, 'en', 'Example profile must declare a source locale');
assert.ok(Array.isArray(profile.locales) && profile.locales.length >= 2, 'Example profile must show more than one locale role');
assert.ok(profile.locales.some(locale => locale.role === 'human-interface'), 'Example profile must show a human-interface locale');
assert.ok(profile.locales.some(locale => locale.role === 'agent-routing'), 'Example profile must show a limited agent-routing locale');
const surfaceIds = new Set(profile.surfaces.map(surface => surface.id));
for (const id of ['ui', 'runtime-states', 'content', 'content-libraries', 'accessibility', 'seo-search', 'ai-agent']) {
  assert.ok(surfaceIds.has(id), `Example profile is missing surface: ${id}`);
}
assert.ok(Array.isArray(profile.impactRules) && profile.impactRules.length > 0, 'Example profile must include localization impact rules');

const glossary = readJson('skills/arwp-localization-quality/references/glossary.example.json');
assert.ok(Array.isArray(glossary.entries) && glossary.entries.length > 0, 'Glossary example must include entries');
const conceptIds = new Set();
for (const entry of glossary.entries) {
  for (const field of ['conceptId', 'source', 'preferred', 'context', 'status']) {
    assert.ok(typeof entry[field] === 'string' && entry[field].trim(), `Glossary entry missing ${field}`);
  }
  assert.ok(!conceptIds.has(entry.conceptId), `Duplicate glossary conceptId: ${entry.conceptId}`);
  conceptIds.add(entry.conceptId);
}

const sourceIndex = readJson('skills/index.json');
const publicIndex = readJson('docs/skills/index.json');
for (const [name, index] of [['skills/index.json', sourceIndex], ['docs/skills/index.json', publicIndex]]) {
  const entries = index.skills.filter(entry => entry.name === 'arwp-localization-quality');
  assert.equal(entries.length, 1, `${name} must list arwp-localization-quality exactly once`);
}
const sourceSkillNames = sourceIndex.skills.map(entry => entry.name).sort();
const publicSkillNames = publicIndex.skills.map(entry => entry.name).sort();
assert.deepEqual(publicSkillNames, sourceSkillNames, 'Public skill registry must expose the exact canonical skill-name set');
assert.ok(sourceIndex.composition?.specialists?.includes('arwp-localization-quality'), 'Localization skill must be part of the source specialist composition');
assert.equal(sourceIndex.composition?.localizationQuality, 'arwp-localization-quality', 'Localization composition pointer is missing');

const publicSkillsHtml = read('docs/skills/index.html');
const itemCountMatch = publicSkillsHtml.match(/"numberOfItems":(\d+)/);
assert.ok(itemCountMatch, 'Public skills HTML must expose ItemList numberOfItems');
assert.equal(Number(itemCountMatch[1]), publicIndex.skills.length, 'Public skills HTML ItemList count must match docs/skills/index.json');
for (const entry of publicIndex.skills) {
  const inCard = publicSkillsHtml.includes(`<strong>${entry.name}</strong>`);
  const inJsonLd = publicSkillsHtml.includes(`"name":"${entry.name}"`);
  assert.ok(inCard && inJsonLd, `Public skills HTML must expose ${entry.name} in both the visible catalog and JSON-LD ItemList`);
}

const publicSkillsLlms = read('docs/skills/llms.txt');
for (const entry of publicIndex.skills) {
  assert.ok(publicSkillsLlms.includes(entry.name), `Agent-facing skills catalog must include ${entry.name}`);
}
assert.match(publicSkillsLlms, /glossary/i, 'Agent-facing skills catalog must communicate glossary-first localization');
assert.match(publicSkillsLlms, /localization-impact/i, 'Agent-facing skills catalog must communicate localization-impact drift protection');

console.log('localization quality package OK');
