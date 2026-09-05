import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditContentItem,
  createContentItemStarter,
  createContentProfileStarter,
  formatContentPlan,
  loadContentArchetypes,
  validateContentItem,
  validateContentProfile
} from '../lib/content-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));

const source = readJson('ai/content-profile.json');
const published = readJson('docs/ai/content-profile.json');
const research = readJson('examples/content-item.research.json');
const registry = loadContentArchetypes();

assert.deepEqual(published, source, 'published Content Profile must match the canonical repository profile');

const profileValidation = validateContentProfile(source);
assert.equal(profileValidation.valid, true, JSON.stringify(profileValidation.errors, null, 2));
assert.equal(registry.archetypes.length, 12);
assert.equal(source.archetypes.enabled.length, 12);
assert.equal(source.guardrails.contentGrammarNotTemplate, true);
assert.equal(source.guardrails.noUniformSectionOrder, true);
assert.equal(source.guardrails.noQueryVariantPageFactory, true);
assert.equal(source.guardrails.noSyntheticStatistics, true);
assert.equal(source.guardrails.noRankingPromise, true);
assert.equal(source.style.lintMode, 'warn');
assert.equal(source.publication.discover.recommendedMinWidth, 1200);
assert.equal(source.publication.discover.recommendedMinPixels, 300000);
assert.equal(source.publication.preferredSources.status, 'planned');

const researchValidation = validateContentItem(research);
assert.equal(researchValidation.valid, true, JSON.stringify(researchValidation.errors, null, 2));
const researchAudit = auditContentItem(research, source);
assert.equal(researchAudit.valid, true);
assert.equal(researchAudit.warnings.length, 0, researchAudit.warnings.join('\n'));
assert.equal(researchAudit.styleWarnings.length, 0, researchAudit.styleWarnings.join('\n'));

const incomplete = structuredClone(research);
incomplete.id = 'research-without-method';
incomplete.blocks = ['context', 'evidence', 'result'];
const incompleteAudit = auditContentItem(incomplete, source);
assert.ok(incompleteAudit.warnings.some(item => /method/i.test(item)));
assert.ok(incompleteAudit.warnings.some(item => /limitations/i.test(item)));

const formulaic = structuredClone(research);
formulaic.id = 'style-warning-example';
formulaic.contentSample = "In today's fast-paced world, it is important to note that this article explores a revolutionary approach. In conclusion, the result is clear.";
const formulaicAudit = auditContentItem(formulaic, source);
assert.equal(formulaicAudit.valid, true, 'style lint must be warning-only');
assert.ok(formulaicAudit.styleWarnings.length >= 3, 'formulaic sample should emit multiple style warnings');

const starterProfile = createContentProfileStarter('https://example.com/knowledge/', {
  name: 'Example Knowledge',
  languages: ['en', 'de'],
  canonicalLanguage: 'en'
});
assert.equal(validateContentProfile(starterProfile).valid, true);
assert.equal(starterProfile.guardrails.noMandatoryFaq, true);
assert.equal(starterProfile.guardrails.noForcedWordCount, true);
assert.equal(starterProfile.publication.preferredSources.status, 'planned');

const comparison = createContentItemStarter('https://example.com/knowledge/a-vs-b', {
  title: 'A versus B',
  archetype: 'comparison',
  language: 'en',
  author: 'Example Author',
  datePublished: '2026-09-05'
});
assert.equal(validateContentItem(comparison).valid, true);
assert.ok(comparison.blocks.includes('decision-criteria'));
assert.ok(comparison.blocks.includes('tradeoffs'));

const opinionPlan = formatContentPlan('opinion');
assert.match(opinionPlan, /Do not force:/);
assert.match(opinionPlan, /not visible headings/i);
assert.match(opinionPlan, /author context/i);

console.log('PASS Adaptive Content Profile preserves format diversity, evidence discipline, graph semantics and warning-only style lint');
