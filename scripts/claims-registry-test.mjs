import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schema', 'claim.schema.json'), 'utf8'));
const claimsDir = path.join(root, 'docs', 'evidence', 'claims');
const index = JSON.parse(fs.readFileSync(path.join(claimsDir, 'index.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const claimFiles = fs.readdirSync(claimsDir).filter(name => /^ARWP-CLAIM-[0-9]{4}\.json$/.test(name)).sort();
assert.ok(claimFiles.length >= 2, 'claims registry must publish at least two initial claim objects');
const claims = claimFiles.map(name => JSON.parse(fs.readFileSync(path.join(claimsDir, name), 'utf8')));

for (const claim of claims) {
  assert.equal(validate(claim), true, `${claim.id} failed claim schema: ${JSON.stringify(validate.errors, null, 2)}`);
  assert.equal(claim.license, 'CC-BY-4.0');
  assert.equal(claim.reviewedAt, '2026-09-05');
  assert.match(claim.canonicalUrl, new RegExp(`/evidence/claims/${claim.id}\\.html$`));
  assert.ok(fs.existsSync(path.join(claimsDir, `${claim.id}.html`)), `${claim.id} human page missing`);
  assert.ok(claim.doesNotProve.length > 0, `${claim.id} must state explicit limits`);
  for (const evidence of claim.evidence.filter(item => item.type.startsWith('internal-'))) {
    assert.ok(
      /\/blob\/[0-9a-f]{40}\//.test(evidence.url),
      `${claim.id} internal evidence must use an immutable GitHub commit URL: ${evidence.url}`
    );
  }
}

const ids = claims.map(claim => claim.id);
assert.equal(new Set(ids).size, ids.length, 'claim IDs must be unique');
assert.deepEqual(index.claims.map(item => item.id).sort(), ids, 'claims index must list every claim JSON object exactly once');
assert.equal(index.license, 'CC-BY-4.0');
assert.match(index.historyPolicy, /not silently rewritten/i);

const byId = id => claims.find(claim => claim.id === id);
const fact = (claim, name) => claim.facts.find(item => item.name === name)?.value;

const a2a = byId('ARWP-CLAIM-0001');
assert.equal(a2a.status, 'verified');
assert.equal(fact(a2a, 'a2aProtocolVersion'), '1.0');
assert.equal(fact(a2a, 'callableInterfaceField'), 'supportedInterfaces[].url');
assert.ok(a2a.evidence.some(item => item.type === 'primary-spec' && /a2a-protocol\.org/.test(item.url)));
assert.match(a2a.claim, /Agent Card is discovery metadata/i);

const benchmark = byId('ARWP-CLAIM-0002');
assert.equal(benchmark.status, 'verified');
assert.equal(fact(benchmark, 'independentSites'), 20);
assert.equal(fact(benchmark, 'llmsAwareCorrect'), 89);
assert.equal(fact(benchmark, 'resolverUnionCorrect'), 86);
assert.equal(fact(benchmark, 'resolverRegret'), 6);
assert.equal(fact(benchmark, 'resolverUniquelyCorrect'), 0);
assert.ok(benchmark.evidence.some(item => item.type === 'internal-benchmark' && /2026-08-28-r4-openapi-search-eligibility\.md$/.test(item.url)));
assert.ok(benchmark.notes.some(note => /older 81\/100.*historical/i.test(note)));

console.log(`PASS claims registry validates ${claims.length} stable claim objects with scoped evidence, immutable internal sources, machine facts and supersession policy`);
