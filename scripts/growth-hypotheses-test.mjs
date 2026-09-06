import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGrowthHypothesisProgram, loadGrowthHypotheses, validateGrowthHypotheses } from '../lib/growth-hypotheses.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = loadGrowthHypotheses();
const validation = validateGrowthHypotheses(registry);
assert.equal(validation.valid, true, validation.errors.join('\n'));
assert.ok(registry.hypotheses.length >= 10);
assert.equal(new Set(registry.hypotheses.map(x => x.id)).size, registry.hypotheses.length);

const general = buildGrowthHypothesisProgram(registry, { vertical: 'general' });
assert.ok(general.hypotheses.some(x => x.id === 'search-foundation-first'));
assert.ok(general.hypotheses.some(x => x.id === 'chatgpt-search-access'));
assert.ok(!general.hypotheses.some(x => x.id === 'discover-visual-preview'));

const editorial = buildGrowthHypothesisProgram(registry, { vertical: 'editorial', surface: 'google-discover' });
assert.ok(editorial.hypotheses.some(x => x.id === 'discover-visual-preview'));
assert.ok(editorial.hypotheses.some(x => x.id === 'search-foundation-first'));

const noExperiments = buildGrowthHypothesisProgram(registry, { vertical: 'general', includeExperiments: false });
assert.ok(!noExperiments.hypotheses.some(x => x.evidenceClass === 'project-experiment'));

const high = buildGrowthHypothesisProgram(registry, { vertical: 'general', confidence: 'high' });
assert.ok(high.hypotheses.length > 0);
assert.ok(high.hypotheses.every(x => x.confidence === 'high'));

const publicCopy = JSON.parse(fs.readFileSync(path.join(root, 'docs/growth/hypotheses.json'), 'utf8'));
assert.equal(publicCopy.version, registry.version);
assert.deepEqual(publicCopy.hypotheses.map(x => x.id), registry.hypotheses.map(x => x.id));

console.log(`PASS Growth Hypotheses registry (${registry.hypotheses.length} hypotheses)`);
