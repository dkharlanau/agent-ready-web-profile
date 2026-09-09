import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCorpus, corpusFingerprint } from '../lib/discoverability.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const corpus = loadCorpus();
const indexPath = path.join(docs, 'discoverability.html');
const routingPath = path.join(docs, 'discoverability', 'index.json');

assert.ok(fs.existsSync(indexPath), 'discoverability.html must be generated.');
assert.ok(fs.existsSync(routingPath), 'discoverability routing index must be generated.');

const index = fs.readFileSync(indexPath, 'utf8');
const routing = JSON.parse(fs.readFileSync(routingPath, 'utf8'));
const MAX_ROUTE_BYTES = 512 * 1024;

assert.ok(Buffer.byteLength(index) < MAX_ROUTE_BYTES, `Discoverability index must stay below ${MAX_ROUTE_BYTES} bytes; split detail into evidence hubs instead of growing one monolith.`);
assert.equal(routing.corpus_version, corpus.version);
assert.equal(routing.corpus_sha256, corpusFingerprint(corpus));
assert.equal(routing.categories.length, corpus.categories.length);
assert.equal(new Set(routing.categories.map(item => item.id)).size, corpus.categories.length);

const routedIds = [];
for (const category of corpus.categories) {
  const route = routing.categories.find(item => item.id === category.id);
  assert.ok(route, `Missing routing entry for ${category.id}`);
  const tactics = corpus.tactics.filter(tactic => tactic.category === category.id);
  assert.equal(route.count, tactics.length, `${category.id}: route count drift.`);
  assert.deepEqual(route.pattern_ids, tactics.map(tactic => tactic.id), `${category.id}: route ID order drift.`);

  const file = path.join(docs, 'discoverability', `${category.id}.html`);
  assert.ok(fs.existsSync(file), `Missing evidence hub for ${category.id}`);
  const html = fs.readFileSync(file, 'utf8');
  const bytes = Buffer.byteLength(html);
  assert.ok(bytes < MAX_ROUTE_BYTES, `${category.id}: evidence hub ${bytes} bytes exceeds bounded route budget.`);
  assert.match(html, new RegExp(`<link rel="canonical" href="https://dkharlanau\\.github\\.io/agent-ready-web-profile/discoverability/${category.id}\\.html">`));
  assert.ok(html.includes('Full static implementation detail, checks, measurement and evidence.'), `${category.id}: evidence-hub contract missing.`);
  assert.ok(!html.includes('discoverability.js'), `${category.id}: full evidence hub must not require client JS.`);

  for (const tactic of tactics) {
    assert.ok(index.includes(`id="${tactic.id}"`), `${tactic.id}: stable index anchor missing.`);
    assert.ok(index.includes(`./discoverability/${category.id}.html#${tactic.id}`), `${tactic.id}: index does not route to full evidence.`);
    assert.ok(html.includes(`id="${tactic.id}"`), `${tactic.id}: full evidence anchor missing from ${category.id}.`);
    assert.ok(html.includes(`<code class="tactic-id">${tactic.id}</code>`), `${tactic.id}: full evidence passport/routing missing.`);
    routedIds.push(tactic.id);
  }
}

assert.equal(routedIds.length, corpus.tactics.length);
assert.equal(new Set(routedIds).size, corpus.tactics.length, 'Every pattern must have exactly one category evidence home.');
assert.deepEqual(new Set(routedIds), new Set(corpus.tactics.map(tactic => tactic.id)));

for (const source of corpus.sources) assert.ok(index.includes(`id="source-${source.id}"`), `Canonical source register anchor missing: ${source.id}`);

const generatedFiles = fs.readdirSync(path.join(docs, 'discoverability')).filter(name => name.endsWith('.html'));
assert.equal(generatedFiles.length, corpus.categories.length, 'One static HTML evidence hub per meaningful corpus category; do not create per-pattern thin pages.');

console.log(`discoverability routing tests passed: index=${Buffer.byteLength(index)} bytes, hubs=${generatedFiles.length}, patterns=${routedIds.length}`);
