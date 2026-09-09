import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = ['AGENTS.md', 'docs/AGENTS.md'];
const BEGIN = '<!-- BEGIN GOOSE TECHNICAL PREFLIGHT -->';
const END = '<!-- END GOOSE TECHNICAL PREFLIGHT -->';

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  assert.equal(text.split(BEGIN).length - 1, 1, `${file}: Technical preflight block must occur exactly once.`);
  assert.equal(text.split(END).length - 1, 1, `${file}: Technical preflight end marker must occur exactly once.`);
  assert.match(text, /node bin\/arwp\.mjs technical-integrity https:\/\/example\.com\/ --max-pages=20 --json/, `${file}: executable Technical Integrity command missing.`);
  for (const status of ['FAIL', 'WATCH', 'PASS', 'not-applicable']) assert.ok(text.includes(`\`${status}\``), `${file}: ${status} interpretation missing.`);
  assert.match(text, /bounded fetch failure remains unknown rather than becoming an indexability failure/i, `${file}: audit-limit truth boundary missing.`);
  assert.match(text, /detector false positive/i, `${file}: detector self-correction rule missing.`);
}

const publicAgents = fs.readFileSync('docs/AGENTS.md', 'utf8');
assert.match(publicAgents, /classify evidence -> technical preflight -> select hypotheses/, 'docs/AGENTS.md primary workflow must expose technical preflight.');
const preflightPos = publicAgents.indexOf('node bin/arwp.mjs technical-integrity https://example.com/ --max-pages=20 --json');
const growthPos = publicAgents.indexOf('node bin/arwp-growth.mjs https://example.com --vertical=editorial --json');
assert.ok(preflightPos >= 0 && growthPos > preflightPos, 'docs/AGENTS.md must run Technical Integrity before Growth planning.');

console.log('technical preflight agent instruction tests passed');
