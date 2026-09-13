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
  'docs/LOCALIZATION-ENGINE.md',
  'bin/arwp-localization.mjs',
  'lib/localization-quality.mjs',
  'lib/surface-integrity.mjs',
  'schema/localization-profile.schema.json',
  'schema/localization-report.schema.json',
  'schema/quality-debt-ledger.schema.json',
  'schema/surface-integrity-contract.schema.json',
  'schema/surface-integrity-report.schema.json',
  'skills/arwp-localization-quality/SKILL.md',
  'skills/arwp-localization-quality/references/prompts.md',
  'skills/arwp-localization-quality/references/ci-gates.md',
  'skills/arwp-localization-quality/references/localization-profile.example.json',
  'skills/arwp-localization-quality/references/glossary.example.json',
  'skills/arwp-localization-quality/references/cognitive-biases-dogfood.md',
  'docs/skills/arwp-localization-quality/SKILL.md',
  'docs/skills/arwp-localization-quality/references/prompts.md',
  'docs/skills/arwp-localization-quality/references/ci-gates.md',
  'docs/skills/arwp-localization-quality/references/localization-profile.example.json',
  'docs/skills/arwp-localization-quality/references/glossary.example.json',
  'docs/skills/arwp-localization-quality/references/cognitive-biases-dogfood.md',
  'skills/index.json',
  'docs/skills/index.json',
  'docs/skills/index.html',
  'docs/skills/llms.txt'
];

for (const file of requiredFiles) {
  assert.ok(existsSync(resolve(root, file)), `Missing localization package file: ${file}`);
}
assert.ok(!existsSync(resolve(root, 'docs/LOCALIZATION-ENTRYPOINT.tmp.md')), 'Temporary localization entry point must not be committed');

const mirrorPairs = [
  ['skills/arwp-localization-quality/SKILL.md', 'docs/skills/arwp-localization-quality/SKILL.md'],
  ['skills/arwp-localization-quality/references/prompts.md', 'docs/skills/arwp-localization-quality/references/prompts.md'],
  ['skills/arwp-localization-quality/references/ci-gates.md', 'docs/skills/arwp-localization-quality/references/ci-gates.md'],
  ['skills/arwp-localization-quality/references/localization-profile.example.json', 'docs/skills/arwp-localization-quality/references/localization-profile.example.json'],
  ['skills/arwp-localization-quality/references/glossary.example.json', 'docs/skills/arwp-localization-quality/references/glossary.example.json'],
  ['skills/arwp-localization-quality/references/cognitive-biases-dogfood.md', 'docs/skills/arwp-localization-quality/references/cognitive-biases-dogfood.md']
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
  '## Workflow',
  'Build the localization surface ledger',
  'Build or review the glossary',
  'Run an independent reconciliation pass',
  'Install drift protection in CI',
  'Verify the built experience',
  'Verify Search and machine-readable parity',
  'arwp localization check',
  'arwp localization impact',
  'Surface Integrity',
  'Quality Debt',
  'routing-only',
  'market-specific',
  'Agent Eval',
  'PolyForm-Strict-1.0.0',
  'cognitive-biases-dogfood.md'
]) {
  assert.ok(skill.includes(marker), `Localization skill is missing workflow/executable concept: ${marker}`);
}

const prompts = read('skills/arwp-localization-quality/references/prompts.md');
for (const name of ['Glossary Builder', 'Content Localizer', 'Localization Reconciler', 'UI Localization Auditor']) {
  assert.ok(prompts.includes(name), `Missing localization prompt contract: ${name}`);
}

const profile = readJson('skills/arwp-localization-quality/references/localization-profile.example.json');
assert.equal(profile.version, '0.2', 'Example profile must use executable v0.2');
assert.equal(profile.sourceLocale, 'en', 'Example profile must declare the source locale');
assert.ok(Array.isArray(profile.locales) && profile.locales.length >= 3, 'Example profile must show multiple locale roles');
assert.ok(profile.locales.some(locale => locale.role === 'canonical'), 'Example profile must show the canonical locale');
assert.ok(profile.locales.some(locale => locale.role === 'human-interface'), 'Example profile must show a human-interface locale');
assert.ok(profile.locales.some(locale => locale.role === 'routing-only'), 'Example profile must show a routing-only locale');
assert.ok(Array.isArray(profile.markets) && profile.markets.length > 0, 'Example profile must separate markets from locales');

const surfaceIds = new Set(profile.surfaces.map(surface => surface.id));
for (const id of ['ui', 'runtime-states', 'content', 'content-libraries', 'accessibility', 'seo-search', 'ai-agent', 'agent-routing']) {
  assert.ok(surfaceIds.has(id), `Example profile is missing mature surface: ${id}`);
}
const parityModes = new Set(profile.surfaces.map(surface => surface.parity));
for (const parity of ['exact', 'semantic', 'adapted', 'market-specific', 'routing-only']) {
  assert.ok(parityModes.has(parity), `Example profile is missing parity mode: ${parity}`);
}
assert.ok(Array.isArray(profile.impactRules) && profile.impactRules.length > 0, 'Example profile must include localization impact rules');
assert.match(profile.evidenceBoundary || '', /does not prove|no .* guarantee|implementation/i, 'Example profile must preserve an evidence boundary');

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

const dogfood = read('skills/arwp-localization-quality/references/cognitive-biases-dogfood.md');
for (const marker of ['Locale roles', 'localization-impact gate', 'glossary-first', 'freshness', 'CI environment parity']) {
  assert.ok(dogfood.toLowerCase().includes(marker.toLowerCase()), `Dogfood reference is missing reusable lesson: ${marker}`);
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
assert.match(sourceIndex.composition?.principle || '', /Localization Quality/i, 'Canonical orchestration must route applicable localization work');

const publicSkillsHtml = read('docs/skills/index.html');
const itemCountMatch = publicSkillsHtml.match(/"numberOfItems":(\d+)/);
assert.ok(itemCountMatch, 'Public skills HTML must expose ItemList numberOfItems');
assert.equal(Number(itemCountMatch[1]), publicIndex.skills.length, 'Public skills HTML ItemList count must match docs/skills/index.json');
for (const entry of publicIndex.skills) {
  const inCard = publicSkillsHtml.includes(`<strong>${entry.name}</strong>`);
  const inJsonLd = publicSkillsHtml.includes(`"name":"${entry.name}"`);
  assert.ok(inCard && inJsonLd, `Public skills HTML must expose ${entry.name} in visible catalog and JSON-LD ItemList`);
}

const publicSkillsLlms = read('docs/skills/llms.txt');
for (const entry of publicIndex.skills) {
  assert.ok(publicSkillsLlms.includes(entry.name), `Agent-facing skills catalog must include ${entry.name}`);
}
assert.match(publicSkillsLlms, /glossary/i, 'Agent-facing skills catalog must communicate glossary-first localization');
assert.match(publicSkillsLlms, /localization-impact/i, 'Agent-facing skills catalog must communicate localization-impact drift protection');

const engineDoc = read('docs/LOCALIZATION-ENGINE.md');
for (const marker of ['Surface Integrity', 'Quality Debt', 'routing-only', 'market-specific', 'arwp localization gate']) {
  assert.ok(engineDoc.includes(marker), `Executable localization guide is missing: ${marker}`);
}

console.log('localization quality package and executable extension OK');
