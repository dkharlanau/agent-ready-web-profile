import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = file => {
  const source = read(file);
  assert.match(source, /<!doctype html>/i, `${file}: HTML document missing`);
  assert.match(source, /<main\b/, `${file}: main content missing`);
  assert.match(source, /<\/html>/, `${file}: HTML document incomplete`);
  return source;
};
const schemaFrom = source => {
  const match = source.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, 'Missing public JSON-LD');
  return JSON.parse(match[1]);
};
const licensed = 'https://polyformproject.org/licenses/strict/1.0.0';

const home = html('docs/index.html');
assert.match(home, /You have something useful on your site/);
assert.match(home, /Can we learn what helps\?/);
assert.match(home, /data-nosnippet role="dialog"/);
assert.doesNotMatch(home, /optional, anonymous measurement/i);
assert.ok(home.includes(licensed));

const measure = html('docs/measurement/index.html');
assert.match(measure, /Did the change help anyone\?/);
assert.match(measure, /Unknown does not mean zero/);
assert.doesNotMatch(measure, /<p>[^<]*<details\b/i, 'Details must not be nested in a paragraph.');

const product = html('docs/product/index.html');
const productSchema = schemaFrom(product);
const software = productSchema['@graph'].find(n => Array.isArray(n['@type']) && n['@type'].includes('SoftwareApplication'));
assert.equal(software.license, licensed);
assert.match(product, /Current software is licensed under PolyForm Strict 1\.0\.0/);
assert.doesNotMatch(product, /under Apache-2\.0|<span>Open source<\/span>/);

const services = html('docs/services/index.html');
const servicesSchema = schemaFrom(services);
assert.ok(servicesSchema['@graph'].filter(n => n['@type'] === 'Service').length >= 4);
assert.match(services, /Find out why a page is hard to discover/);
assert.match(services, /These are capabilities of a public software project/);

assert.match(read('COPYRIGHT.md'), /Current repository software is available under PolyForm Strict/);
assert.match(html('docs/project/rights.html'), /Current repository software is made available under PolyForm Strict/);
assert.equal(JSON.parse(read('docs/ai/product.jsonld'))['@graph'][0].license, licensed);
assert.match(html('docs/growth/index.html'), /research → classify → technical preflight → baseline/);

const corpus = JSON.parse(read('knowledge/discoverability-corpus.json'));
const published = JSON.parse(read('docs/knowledge/discoverability-corpus.json'));
assert.deepEqual(published, corpus, 'Published practice data must match its canonical source.');
assert.equal(corpus.tactics.length, 219);
assert.equal(corpus.sources.length, 132);
assert.equal(new Set(corpus.tactics.map(t => t.id)).size, corpus.tactics.length);
assert.equal(corpus.previous_release.version, '1.12.0');
assert.match(read('lib/discoverability.mjs'), /'1\.12\.0': '052df898da23b1953a629225a8c1c783e5b87e078b31d6d2e5c8ee3f081676f7'/);

const index = html('docs/discoverability.html');
const firstId = 'arwp-measurement-baseline';
const start = index.indexOf(`id="${firstId}"`);
assert.ok(start > 0, 'Example practice missing from generated index.');
const card = index.slice(start, start + 2400);
assert.match(card, /<strong>Start here:<\/strong>/, 'A first useful action must be visible without expanding the card.');

const category = html('docs/discoverability/measurement.html');
const detailStart = category.indexOf(`id="${firstId}"`);
assert.ok(detailStart > 0);
const detail = category.slice(detailStart, detailStart + 9000);
const actionIndex = detail.indexOf('<h3>What to do</h3>');
const evidenceIndex = detail.indexOf('<details class="pattern-evidence">');
assert.ok(actionIndex > 0 && evidenceIndex > actionIndex, 'Actions must precede the technical evidence record.');
assert.match(category, /Updated 10 Oct 2026/, 'Category must not mislabel the corpus update as a new source review.');
assert.ok(read('docs/discoverability.css').includes('.practice-first'));

console.log('Editorial voice and publication consistency checks passed.');
