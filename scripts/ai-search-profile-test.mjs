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
assert.equal(source.modules.protocolObservatory.status, 'active');
assert.equal(source.modules.protocolObservatory.url, 'https://dkharlanau.github.io/agent-ready-web-profile/observatory/');
assert.deepEqual(source.modules.protocolObservatory.machineReadable, ['https://dkharlanau.github.io/agent-ready-web-profile/observatory/protocols.json']);
assert.equal(source.surfaces.history.status, 'active');
assert.equal(source.modules.openReuseAssets.status, 'active');
assert.equal(source.surfaces.pressKit.status, 'active');
assert.equal(source.surfaces.reuseRights.url, 'https://dkharlanau.github.io/agent-ready-web-profile/media/rights.json');
assert.equal(source.modules.answerPages.status, 'active');
assert.equal(source.modules.comparisonPages.status, 'active');
assert.equal(source.modules.conceptDefinitions.status, 'active');
assert.ok(source.modules.answerPages.machineReadable.includes('https://dkharlanau.github.io/agent-ready-web-profile/citation-index.json'));
assert.equal(source.vocabulary.every(item => item.status === 'active'), true);

const citationIndex = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'citation-index.json'), 'utf8'));
assert.equal(citationIndex.license, 'CC-BY-4.0');
assert.ok(citationIndex.items.some(item => item.id === 'concept-resolver-regret'));
assert.ok(citationIndex.items.some(item => item.id === 'compare-static-runtime'));

const observatoryPath = path.join(root, 'docs', 'observatory', 'protocols.json');
const frozenObservatoryPath = path.join(root, 'docs', 'observatory', 'history', '2026-09-05.json');
const observatoryHistoryPath = path.join(root, 'docs', 'observatory', 'history', 'index.json');
for (const file of [observatoryPath, frozenObservatoryPath, observatoryHistoryPath, path.join(root, 'docs', 'observatory', 'index.html')]) {
  assert.ok(fs.existsSync(file), `missing observatory file: ${path.relative(root, file)}`);
}
const observatory = JSON.parse(fs.readFileSync(observatoryPath, 'utf8'));
const frozenObservatory = JSON.parse(fs.readFileSync(frozenObservatoryPath, 'utf8'));
const observatoryHistory = JSON.parse(fs.readFileSync(observatoryHistoryPath, 'utf8'));
assert.equal(observatory.snapshotDate, '2026-09-05');
assert.equal(observatory.mechanisms.length, 10);
assert.equal(observatory.methodology.noAdoptionInference, true);
assert.equal(observatory.methodology.noReadinessScore, true);
assert.deepEqual(frozenObservatory, observatory, 'first frozen observatory snapshot must equal the published current snapshot at creation time');
assert.equal(observatoryHistory.snapshots[0].date, '2026-09-05');
assert.equal(observatoryHistory.snapshots[0].mechanisms, 10);

const mechanism = id => observatory.mechanisms.find(item => item.id === id);
assert.equal(mechanism('a2a').currentVersion, '1.0.0');
assert.match(mechanism('mcp').currentVersion, /2026-07-28/);
assert.equal(mechanism('ucp-commerce').currentVersion, 'v2026-08-25');
assert.equal(mechanism('webmcp').arwpSupport.staticDiscovery, 'not-assessed-as-runtime');
assert.equal(mechanism('acp-commerce').arwpSupport.staticDiscovery, 'watchlist-no-adapter');
assert.equal(mechanism('ucp-commerce').arwpSupport.staticDiscovery, 'watchlist-no-adapter');
assert.match(mechanism('agent-skills').notes, /core public specification defines the SKILL\.md format/i);

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
assert.equal(starter.surfaces.pressKit.url, 'https://example.com/docs/media/');
assert.equal(starter.surfaces.reuseRights.url, 'https://example.com/docs/media/rights.json');
assert.equal(starter.modules.openReuseAssets.priority, 'P1');
assert.equal(Object.values(starter.modules).every(module => module.status === 'planned'), true);

const plan = planAiSearchProfile(starter);
assert.equal(plan.valid, true);
assert.equal(plan.summary.active, 0);
assert.equal(plan.summary.planned, 16);
assert.equal(plan.summary.nextPriority, 'P0');
assert.deepEqual(plan.next.filter(item => item.priority === 'P0').map(item => item.key).sort(), ['answerPages', 'originalResearch', 'protocolObservatory']);
assert.ok(plan.next.some(item => item.key === 'openReuseAssets' && item.priority === 'P1'));

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
assert.equal(generated.modules.openReuseAssets.status, 'planned');
assert.equal(generated.modules.protocolObservatory.status, 'planned');

const validate = spawnSync(process.execPath, [cli, 'validate', output], { encoding: 'utf8' });
assert.equal(validate.status, 0, validate.stderr || validate.stdout);
assert.match(validate.stdout, /PASS/);

const planned = spawnSync(process.execPath, [cli, 'plan', output], { encoding: 'utf8' });
assert.equal(planned.status, 0, planned.stderr || planned.stdout);
assert.match(planned.stdout, /P0 originalResearch/);
assert.match(planned.stdout, /P0 protocolObservatory/);
assert.match(planned.stdout, /P1 openReuseAssets/);

console.log('PASS AI Search & Citation Profile validates, publishes frozen protocol observatory evidence, plans reusable citation/open-reuse surfaces, and preserves conservative capability states');
