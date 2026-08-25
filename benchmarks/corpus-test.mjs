import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpusDir = path.join(root, 'benchmarks', 'corpus');
const schema = JSON.parse(fs.readFileSync(path.join(corpusDir, 'fixture.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const files = fs.readdirSync(corpusDir)
  .filter(name => name.endsWith('.json') && name !== 'fixture.schema.json')
  .sort();
assert.ok(files.length >= 1, 'benchmark corpus must keep at least the non-scoring example fixture');

const ids = new Set();
let independent = 0;
for (const file of files) {
  const fixture = JSON.parse(fs.readFileSync(path.join(corpusDir, file), 'utf8'));
  assert.equal(validate(fixture), true, `${file}: ${JSON.stringify(validate.errors, null, 2)}`);
  assert.equal(ids.has(fixture.id), false, `duplicate benchmark fixture id: ${fixture.id}`);
  ids.add(fixture.id);
  if (fixture.ownership === 'independent') {
    independent += 1;
    assert.ok(fixture.evidence.length > 0, `${file}: independent fixtures require reviewed public evidence`);
  }
}

console.log(`PASS benchmark corpus validates ${files.length} fixture(s); ${independent} independent fixture(s) currently count toward external evidence`);
