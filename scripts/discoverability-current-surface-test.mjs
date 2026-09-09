import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCorpus } from '../lib/discoverability.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const corpus = loadCorpus();
const count = corpus.tactics.length;
const categories = corpus.categories.length;

const llms = fs.readFileSync(path.join(docs, 'llms.txt'), 'utf8');
const growth = fs.readFileSync(path.join(docs, 'growth', 'index.html'), 'utf8');
const recommendations = fs.readFileSync(path.join(docs, 'recommendations', 'index.html'), 'utf8');

assert.ok(llms.includes(`Discoverability Library](https://dkharlanau.github.io/agent-ready-web-profile/discoverability.html): ${count} concrete practices across ${categories} bounded categories`), 'llms.txt discoverability count/category drift.');
assert.ok(llms.includes('discoverability/index.json'), 'llms.txt must route agents through the lightweight discoverability index.');
assert.ok(llms.includes('<!-- BEGIN DISCOVERABILITY ROUTING -->') && llms.includes('<!-- END DISCOVERABILITY ROUTING -->'), 'llms.txt managed routing block missing.');

for (const [label, text] of [['growth', growth], ['recommendations', recommendations]]) {
  assert.ok(text.includes(`Browse ${count} practices across ${categories} categories`), `${label}: current practice count/category drift.`);
  assert.ok(text.includes('../discoverability/index.json'), `${label}: lightweight routing index link missing.`);
  assert.match(text, /technical-integrity/, `${label}: Technical Integrity preflight missing from current workflow surface.`);
  assert.doesNotMatch(text, /Browse 144 practices across 16 categories/, `${label}: stale 144-pattern current-surface copy returned.`);
}

assert.match(growth, /research → classify → technical preflight → baseline/, 'Growth public loop must include technical preflight.');
assert.match(recommendations, /arwp technical-integrity https:\/\/example\.com\//, 'Recommendations public workflow must include Technical Integrity command.');

console.log(`discoverability current-surface tests passed: ${count} patterns, ${categories} categories`);
