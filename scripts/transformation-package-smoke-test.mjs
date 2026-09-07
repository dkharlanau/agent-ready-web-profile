import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

assert.equal(pkg.bin['arwp-dataset'], 'bin/arwp-dataset.mjs');
assert.equal(pkg.bin['arwp-upgrade'], 'bin/arwp-upgrade.mjs');
assert.equal(pkg.bin['arwp-transform'], 'bin/arwp-transform.mjs');
assert.equal(pkg.scripts.dataset, 'node bin/arwp-dataset.mjs');
assert.equal(pkg.scripts.upgrade, 'node bin/arwp-upgrade.mjs');
assert.equal(pkg.scripts.transform, 'node bin/arwp-transform.mjs');
assert.match(pkg.scripts['test:transform'] || '', /transformation-engine-test\.mjs/);
for (const file of ['bin/arwp-dataset.mjs', 'bin/arwp-upgrade.mjs', 'bin/arwp-transform.mjs', 'lib/adaptive-upgrade.mjs', 'lib/transformation-engine.mjs', 'schema/adaptive-upgrade-graph.schema.json', 'schema/transformation-bundle.schema.json']) {
  assert.ok(fs.existsSync(path.join(root, file)), `package surface references missing file ${file}`);
}
for (const doc of ['docs/ADAPTIVE-SITE-UPGRADE.md', 'docs/TARGET-SITE-TRANSFORMATION.md']) assert.ok(pkg.files.includes(doc), `npm package files must include ${doc}`);
for (const keyword of ['adaptive-upgrade', 'target-site-transformation', 'transformation-engine']) assert.ok(pkg.keywords.includes(keyword), `package keywords must include ${keyword}`);

console.log('PASS npm metadata exposes dataset, adaptive-upgrade and target-transformation product CLIs');
