import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
const fixtureByFile = new Map();
let independent = 0;
for (const file of files) {
  const content = fs.readFileSync(path.join(corpusDir, file), 'utf8');
  const fixture = JSON.parse(content);
  assert.equal(validate(fixture), true, `${file}: ${JSON.stringify(validate.errors, null, 2)}`);
  assert.equal(ids.has(fixture.id), false, `duplicate benchmark fixture id: ${fixture.id}`);
  ids.add(fixture.id);
  fixtureByFile.set(file, { content, fixture });
  if (fixture.ownership === 'independent') {
    independent += 1;
    assert.ok(fixture.evidence.length > 0, `${file}: independent fixtures require reviewed public evidence`);
  }
}

function gitBlobSha(content) {
  const bytes = Buffer.byteLength(content);
  return createHash('sha1')
    .update(`blob ${bytes}\0`)
    .update(content)
    .digest('hex');
}

const reviewPath = path.join(root, 'benchmarks', 'reviews', 'semantic-review-v0.2.json');
let reviewed = 0;
if (fs.existsSync(reviewPath)) {
  const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
  assert.equal(review.version, 1, 'semantic review manifest version must be 1');
  assert.ok(Array.isArray(review.fixtures), 'semantic review manifest fixtures must be an array');

  const reviewedFiles = new Set();
  for (const receipt of review.fixtures) {
    assert.match(receipt.file, /^[a-z0-9][a-z0-9._-]*\.json$/, `invalid reviewed fixture filename: ${receipt.file}`);
    assert.equal(reviewedFiles.has(receipt.file), false, `duplicate semantic review receipt: ${receipt.file}`);
    reviewedFiles.add(receipt.file);

    const current = fixtureByFile.get(receipt.file);
    assert.ok(current, `semantic review receipt references missing fixture: ${receipt.file}`);
    assert.equal(current.fixture.ownership, 'independent', `${receipt.file}: semantic review receipts are only for independent fixtures`);
    assert.equal(receipt.id, current.fixture.id, `${receipt.file}: semantic review id does not match fixture id`);
    assert.match(receipt.reviewedAt, /^\d{4}-\d{2}-\d{2}$/, `${receipt.file}: semantic review date must be YYYY-MM-DD`);
    assert.ok(receipt.reviewedAt >= current.fixture.reviewedAt, `${receipt.file}: semantic review predates fixture reviewedAt`);
    assert.ok(['confirmed', 'corrected'].includes(receipt.status), `${receipt.file}: semantic review status must be confirmed or corrected`);
    assert.equal(receipt.blobSha, gitBlobSha(current.content), `${receipt.file}: fixture changed after semantic review; re-review it and refresh the receipt`);

    const fixtureEvidence = new Set(current.fixture.evidence.map(item => item.url));
    assert.ok(Array.isArray(receipt.evidenceBasis) && receipt.evidenceBasis.length > 0, `${receipt.file}: semantic review requires evidenceBasis`);
    for (const evidenceUrl of receipt.evidenceBasis) {
      assert.equal(fixtureEvidence.has(evidenceUrl), true, `${receipt.file}: semantic review basis must reference current fixture evidence: ${evidenceUrl}`);
    }
    reviewed += 1;
  }
}

console.log(`PASS benchmark corpus validates ${files.length} fixture(s); ${independent} independent fixture(s) currently count toward external evidence; ${reviewed} independent fixture(s) have byte-pinned semantic review receipts`);
