import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  createAiSearchProfileStarter,
  planAiSearchProfile,
  validateAiSearchProfile
} from '../lib/ai-search-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'ai', 'ai-search-profile.json'), 'utf8'));
const published = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'ai', 'ai-search-profile.json'), 'utf8'));

assert.deepEqual(published, source, 'GitHub Pages AI Search Profile must match the canonical repository profile');

const selfValidation = validateAiSearchProfile(source);
assert.equal(selfValidation.valid, true, JSON.stringify(selfValidation.errors, null, 2));
assert.equal(source.guardrails.noReadinessScore, true);
assert.equal(source.modules.originalResearch.status, 'active');
assert.equal(source.modules.protocolObservatory.status, 'planned');
assert.equal(source.surfaces.history.status, 'active');

const starter = createAiSearchProfileStarter('https://example.com/docs/', {
  name: 'Example Docs',
  languages: ['en', 'de'],
  canonicalLanguage: 'en'
});
const starterValidation = validateAiSearchProfile(starter);
assert.equal(starterValidation.valid, true, JSON.stringify(starterValidation.errors, null, 2));
assert.equal(starter.site.canonicalUrl, 'https://example.com/docs/');
assert.equal(starter.surfaces.entityHome.status, 'active');
assert.equal(starter.surfaces.siteProfile.status, 'planned');
assert.equal(starter.surfaces.siteProfile.url, 'https://example.com/docs/ai/site-profile.json');
assert.equal(starter.surfaces.robots.url, 'https://example.com/robots.txt');
assert.equal(Object.values(starter.modules).every(module => module.status === 'planned'), true);

const plan = planAiSearchProfile(starter);
assert.equal(plan.valid, true);
assert.equal(plan.summary.active, 0);
assert.equal(plan.summary.planned, 15);
assert.equal(plan.summary.nextPriority, 'P0');
assert.deepEqual(plan.next.filter(item => item.priority === 'P0').map(item => item.key).sort(), ['answerPages', 'originalResearch', 'protocolObservatory']);

const invalid = structuredClone(starter);
invalid.guardrails.noReadinessScore = false;
assert.equal(validateAiSearchProfile(invalid).valid, false, 'guardrails must not permit readiness-score mode');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-ai-search-'));
const output = path.join(temp, 'profile.json');
const cli = path.join(root, 'bin', 'arwp-ai-search.mjs');
const init = spawnSync(process.execPath, [cli, 'init', 'https://example.org/', '--name=Example Org', '--languages=en,ru', `--output=${output}`], { encoding: 'utf8' });
assert.equal(init.status, 0, init.stderr || init.stdout);
assert.ok(fs.existsSync(output));
const generated = JSON.parse(fs.readFileSync(output, 'utf8'));
assert.deepEqual(generated.site.languages, ['en', 'ru']);

const validate = spawnSync(process.execPath, [cli, 'validate', output], { encoding: 'utf8' });
assert.equal(validate.status, 0, validate.stderr || validate.stdout);
assert.match(validate.stdout, /PASS/);

const planned = spawnSync(process.execPath, [cli, 'plan', output], { encoding: 'utf8' });
assert.equal(planned.status, 0, planned.stderr || planned.stdout);
assert.match(planned.stdout, /P0 originalResearch/);

console.log('PASS AI Search & Citation Profile validates, plans prioritized citation surfaces, publishes a matching self-profile, and generates reusable site plans');
