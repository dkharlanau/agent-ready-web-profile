import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const research = JSON.parse(read('research/product/2026-10-11-applied-deep-run.json'));
const narrative = read('research/product/2026-10-11-applied-deep-run.md');
const benchmarks = read('docs/DISCOVERABILITY-BENCHMARKS.md');
const future = read('skills/arwp-future-search/SKILL.md');
const map = read('REPO_MAP.md');
assert.equal(research.reviewDate, '2026-10-11');
assert.equal(research.status, 'review-candidates-not-product-ships');
for (const value of Object.values(research.policy)) assert.equal(value, true);
assert.equal(research.opportunities.length, 20);
assert.equal(new Set(research.opportunities.map(item => item.id)).size, 20);
assert.deepEqual(research.opportunities.map(item => item.rank), Array.from({length: 20}, (_, i) => i + 1));
for (const item of research.opportunities) {
  assert.match(item.id, /^[a-z0-9]+(?:-[a-z0-9]+)+$/);
  assert(['P0','P1','P2'].includes(item.priority));
  assert(Array.isArray(item.projects) && item.projects.length >= 1);
  assert(Array.isArray(item.sourceIds) && item.sourceIds.length > 0);
  assert(['reuse-or-pilot','conditional-pilot','watch'].includes(item.maturity));
  for (const key of ['insight','existingFirstAction','verification','stopCondition']) {
    assert(item[key].length >= 65, item.id + ' missing useful ' + key);
  }
  for (const id of item.sourceIds) assert(id in research.sourceCatalog, item.id + ' unknown source ' + id);
  assert(narrative.includes('### ' + item.rank + '. ' + item.id.replaceAll('-', ' ')), 'Missing review card: ' + item.id);
}
for (const source of Object.values(research.sourceCatalog)) {
  const url = new URL(source.url);
  assert.equal(url.protocol, 'https:');
  assert(['official','official-experimental','preprint'].includes(source.kind));
  assert(narrative.includes('](' + source.url + ')'), 'Missing readable source: ' + source.url);
}
assert.match(narrative, /M1 proof before more product/);
assert.match(narrative, /No silent changes to owner crawler preferences/);
assert.match(narrative, /STOP WHEN:/);
assert.match(narrative, /preprints, not settled scientific consensus/);
assert.match(benchmarks, /original source passage/);
assert.match(benchmarks, /multimodal Search filter/);
assert.match(future, /plain accessible HTML baseline/);
assert.match(future, /mid-chain failure/);
assert(map.includes('2026-10-11-applied-deep-run.json'));
console.log('PASS 20 applied Deep Run candidates: primary/preprint distinctions, scoped portability, stop gates, evaluative methodology and prompt.');
