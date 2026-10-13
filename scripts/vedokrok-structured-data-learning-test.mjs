import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const base = 'research/product/2026-10-12-vedokrok-structured-data';
const record = JSON.parse(read(`${base}.json`));
const prose = read(`${base}.md`);
assert.equal(record.authorship.kind, 'agent');
assert.equal(record.authorship.humanReviewClaimed, false);
assert.match(record.authorship.guideCommit, /^[a-f0-9]{40}$/);
for (const flag of Object.values(record.policy)) assert.equal(flag, true);
for (const [key, value] of Object.entries(record.publicationScope)) {
  if (typeof value === 'boolean') assert.equal(value, false, key);
}
assert.equal(record.evidence.implementationSessionReport.kind, 'agent-reported-completed-checks');
assert.equal(record.evidence.implementationSessionReport.hostedCi, 'not-executed');
for (const outcome of Object.values(record.evidence.outcomes)) {
  assert.equal(outcome.status, 'not-measured');
  assert.equal(outcome.value, null);
}
const refresh = record.evidence.liveRefresh;
assert.equal(refresh.kind, 'direct-public-http-observation');
assert(Number.isFinite(Date.parse(refresh.observedAt)));
assert(prose.includes(refresh.observedAt));
assert.equal(new Set(refresh.files.map(file => file.sourceId)).size, refresh.files.length);
for (const file of refresh.files) {
  assert.equal(file.url, record.sourceCatalog[file.sourceId].url);
  assert.equal(file.httpStatus, 200);
  assert.match(file.contentType, /^application\/json\b/);
  assert.match(file.sha256, /^[a-f0-9]{64}$/);
  assert(Number.isSafeInteger(file.bytes) && file.bytes > 0);
  assert(Number.isSafeInteger(file.count) && file.count >= 0);
  assert(prose.includes(file.url));
}
assert.equal(new Set(record.lessons.map(lesson => lesson.id)).size, record.lessons.length);
for (const lesson of record.lessons) {
  assert.match(lesson.id, /^[a-z0-9]+(?:-[a-z0-9]+)+$/);
  assert.equal(lesson.evidenceClass, 'implementation-session-observation');
  assert.equal(lesson.transfer.status, 'inferred-recommendation');
  for (const key of ['whenApplicable', 'verification', 'limit']) assert(lesson.transfer[key].trim());
  assert(lesson.sourceIds.length > 0);
  for (const id of lesson.sourceIds) assert(id in record.sourceCatalog, `Unknown source: ${id}`);
}
for (const source of Object.values(record.sourceCatalog)) {
  const url = new URL(source.url);
  assert.equal(url.protocol, 'https:');
  assert(['public-interface', 'standard'].includes(source.kind));
  assert(prose.includes(`](${source.url})`), `Missing inspectable source: ${source.url}`);
}
// Public case must not silently grow into a private run archive or an outcome receipt.
const publicText = JSON.stringify(record) + prose;
assert.doesNotMatch(publicText, /github\.com\/dkharlanau\/vedokrok(?:\/|["\s])|\/Users\/|billing|GOOGLE_APPLICATION_CREDENTIALS|access_token/i);
for (const file of ['README.md', 'REPO_MAP.md']) assert(read(file).includes(`${base}.json`));
assert(prose.includes('not measured'));
console.log(`PASS ${record.lessons.length} lessons: source references, evidence separation, snapshot metadata, public scope and navigation.`);
