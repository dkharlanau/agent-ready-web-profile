import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

assert.equal(pkg.bin?.['arwp-growth'], 'bin/arwp-growth.mjs');
assert.equal(pkg.bin?.['arwp-trends'], 'bin/arwp-trends.mjs');
assert.equal(pkg.bin?.['arwp-trend-history'], 'bin/arwp-trend-history.mjs');
assert.equal(pkg.scripts?.growth, 'node bin/arwp-growth.mjs');
assert.equal(pkg.scripts?.trends, 'node bin/arwp-trends.mjs');
assert.equal(pkg.scripts?.['trend-history'], 'node bin/arwp-trend-history.mjs');
assert.equal(typeof pkg.scripts?.['test:trends'], 'string');
assert.match(pkg.scripts['test:trends'], /trend-history-test\.mjs/);

for (const file of [
  'bin/arwp-growth.mjs',
  'bin/arwp-trends.mjs',
  'bin/arwp-trend-history.mjs',
  'lib/growth-plan.mjs',
  'lib/trend-radar.mjs',
  'lib/trend-history.mjs',
  'registry/trends.json',
  'docs/TREND-RADAR.md',
  'docs/TREND-HISTORY.md'
]) {
  assert.equal(fs.existsSync(file), true, `${file} must exist`);
}

for (const publishedPath of ['bin/', 'lib/', 'registry/', 'docs/TREND-RADAR.md', 'docs/TREND-HISTORY.md']) {
  assert(pkg.files.includes(publishedPath), `${publishedPath} must be present in package files`);
}

assert(pkg.keywords.includes('trend-radar'));
assert(pkg.keywords.includes('trend-history'));
assert(pkg.keywords.includes('generative-search'));

console.log('PASS trend-package-test');
