import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCohortPageMapTemplate } from '../lib/cohort-search-observation.mjs';
import { reviewCohortIndexInspection } from '../lib/cohort-index-observation.mjs';
import { compareCohortIndexObservations } from '../lib/cohort-index-comparison.mjs';

// Fake observations exercise the exact envelopes of:
// 1) 2026-09-28 recovery-baseline-2026-09-28.json
// 2) the read-only Ptichi scripts/search-observe.py (schema_version 1)
// No private real owner export, URL, query or credential is committed in fixtures.
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const frozen = JSON.parse(fs.readFileSync(path.join(root,
  'knowledge/experiments/2026-09-15-ptichi-cohort-refreeze-r2.json'), 'utf8'));
const cohort = structuredClone(frozen);
cohort.site = 'https://example.com/';
const pageMap = createCohortPageMapTemplate(cohort);
for (const member of pageMap.members) member.url = 'https://example.com/test-only/' + member.id + '/';
const urls = new Map(pageMap.members.map(member => [member.id, member.url]));
const ref = cohort.measurementGate.implementationRef;
const options = { productionRef: ref, deploymentDate: '2026-09-13' };

const oldRows = [
  ['t01', 'NEUTRAL', 'Discovered - currently not indexed'],
  ['t02', 'NEUTRAL', 'URL is unknown to Google'],
  ['t03', 'PASS', 'Submitted and indexed'],
  ['t04', 'PASS', 'Submitted and indexed'],
  ['c01', 'NEUTRAL', 'Discovered - currently not indexed'],
  ['c02', 'NEUTRAL', 'URL is unknown to Google'],
  ['c03', 'PASS', 'Submitted and indexed']
].map(([id, verdict, coverageState]) => ({
  url: urls.get(id), verdict, coverageState, googleCanonical: urls.get(id),
  userCanonical: urls.get(id), lastCrawlTime: '2026-09-18T12:00:00Z'
}));
const oldCounts = Object.fromEntries([...new Set(oldRows.map(row => row.coverageState))]
  .map(key => [key, oldRows.filter(row => row.coverageState === key).length]));
const earlierSource = {
  schema_version: 1, observed_at: '2026-09-28T13:54:00+00:00',
  properties: { [cohort.site]: { inspected: true } },
  current_url_inspection: {
    total: oldRows.length,
    observed_at: '2026-09-28T13:54:00+00:00',
    counts: oldCounts,
    rows: oldRows
  }
};
const before = reviewCohortIndexInspection(cohort, pageMap, earlierSource, options);
assert.equal(before.sourceFormat, 'recovery-inspection-v1');
assert.equal(before.inspectionScope, 'declared-inspection-snapshot');
assert.equal(before.snapshot.matchedFrozenMembers, 7);
assert.match(before.pageMapFingerprint, /^[a-f0-9]{64}$/);
assert.equal(before.frozenImplementationRef, ref);
const reorderedPageMap = { ...pageMap, members: [...pageMap.members].reverse() };
assert.equal(reviewCohortIndexInspection(cohort, reorderedPageMap, earlierSource, options).pageMapFingerprint,
  before.pageMapFingerprint, 'fingerprint must be independent of map file ordering');

const afterRows = [
  ['t01', 'PASS', 'Submitted and indexed'],
  ['t02', 'PASS', 'Submitted and indexed'],
  ['t03', 'PASS', 'Submitted and indexed'],
  ['t04', 'NEUTRAL', 'Discovered - currently not indexed'],
  ['t05', 'PASS', 'Submitted and indexed'],
  ['c01', 'PASS', 'Submitted and indexed'],
  ['c02', 'NEUTRAL', 'URL is unknown to Google']
].map(([id, verdict, coverageState]) => ({
  url: urls.get(id),
  available: true,
  response: {
    inspectionResult: {
      inspectionResultLink: 'https://search.google.com/search-console/inspect?resource_id=fake',
      indexStatusResult: {
        verdict, coverageState,
        lastCrawlTime: '2026-10-08T12:00:00.127378Z',
        googleCanonical: urls.get(id),
        userCanonical: urls.get(id),
        robotsTxtState: 'ALLOWED',
        indexingState: 'INDEXING_ALLOWED',
        pageFetchState: 'SUCCESSFUL'
      }
    }
  }
}));
const observerSource = {
  schema_version: 1,
  retrieved_at: '2026-10-09T15:24:00+00:00',
  timezone: 'America/Los_Angeles',
  search_type: 'web',
  data_state: 'final',
  properties: { [cohort.site]: { freshness: { available: true }, windows: {} } },
  inspection_scope: 'priority_queue',
  sitemap_url_count: 160,
  inspections: afterRows,
  partial: false
};
const after = reviewCohortIndexInspection(cohort, pageMap, observerSource, options);
assert.equal(after.sourceFormat, 'search-observe-v1');
assert.equal(after.inspectionScope, 'priority_queue');
assert.equal(after.timestampBasis, 'observer-report-initialized-at');
assert.equal(after.observedAt, '2026-10-09T15:24:00.000Z');
assert.equal(after.snapshot.inspectedRows, 7);
assert.equal(after.snapshot.matchedFrozenMembers, 7);
assert.equal(after.treatment.stateCounts.indexed, 4);
assert.equal(after.treatment.stateCounts['not-inspected'], 7);
assert.equal(after.control.stateCounts['not-inspected'], 4);
assert.equal(after.pageMapFingerprint, before.pageMapFingerprint);
assert.equal(after.members.find(member => member.id === 't01').lastCrawlDate, '2026-10-08');
assert.ok(!JSON.stringify(after).includes('https://example.com/test-only/'), 'raw private mapped URLs must not leak');
assert.ok(!JSON.stringify(after).includes('resource_id=fake'), 'raw inspection result links must not leak');

const compare = compareCohortIndexObservations(cohort, before, after);
assert.equal(compare.kind, 'cohort-index-longitudinal-review');
assert.equal(compare.entireFrozenCohortComparable, false);
assert.equal(compare.comparableMembers, 6);
assert.equal(compare.unpairedOrUnresolvedMembers, 12);
assert.equal(compare.treatment.frozenMembers, 12);
assert.equal(compare.treatment.comparableMembers, 4);
assert.equal(compare.treatment.beforeIndexedComparable, 2);
assert.equal(compare.treatment.afterIndexedComparable, 3);
assert.equal(compare.treatment.netIndexedChangeOnComparableMembers, 1);
assert.deepEqual(compare.treatment.memberIds.becameIndexed, ['t01', 't02']);
assert.deepEqual(compare.treatment.memberIds.ceasedIndexed, ['t04'], 'losses must not be hidden');
assert.deepEqual(compare.treatment.memberIds.remainedIndexed, ['t03']);
assert.ok(compare.treatment.memberIds.unpairedOrUnresolved.includes('t05'),
  'newly inspected member must not count as becoming indexed when before observation was missing');
assert.equal(compare.control.comparableMembers, 2);
assert.equal(compare.control.netIndexedChangeOnComparableMembers, 1, 'control movement is preserved');
assert.deepEqual(compare.control.memberIds.becameIndexed, ['c01']);
assert.deepEqual(compare.control.memberIds.unpairedOrUnresolved.filter(id => id === 'c03'), ['c03']);
assert.equal(compare.noOutcomeDecision, true);
assert.equal(compare.causalImpactEstablished, false);
assert.ok(!JSON.stringify(compare).includes('https://example.com/test-only/'));
assert.ok(!JSON.stringify(compare).includes('indexStatusResult'));

const invalid = mutator => {
  const copy = structuredClone(observerSource);
  mutator(copy);
  return copy;
};
assert.throws(() => reviewCohortIndexInspection(cohort, pageMap,
  invalid(s => { s.partial = true; }), options), /partial/);
assert.throws(() => reviewCohortIndexInspection(cohort, pageMap,
  invalid(s => { s.inspections[0].available = false; }), options), /unavailable URL Inspection/);
assert.throws(() => reviewCohortIndexInspection(cohort, pageMap,
  invalid(s => { s.inspections[0].response.inspectionResult.indexStatusResult = null; }), options), /indexStatusResult/);
assert.throws(() => reviewCohortIndexInspection(cohort, pageMap,
  invalid(s => { s.inspection_scope = 'arbitrary'; }), options), /inspection_scope/);
assert.throws(() => reviewCohortIndexInspection(cohort, pageMap,
  invalid(s => { s.inspection_scope = 'live_sitemap'; }), options), /full-sitemap inspection/);
assert.throws(() => reviewCohortIndexInspection(cohort, pageMap,
  invalid(s => { s.sitemap_url_count = 2; }), options), /inspection count/);
assert.throws(() => reviewCohortIndexInspection(cohort, pageMap,
  invalid(s => { s.inspections[1].url = s.inspections[0].url; }), options), /Duplicate inspected URL/);
assert.throws(() => reviewCohortIndexInspection(cohort, pageMap,
  invalid(s => { s.retrieved_at = '2026-09-12T11:00:00Z'; }), options), /asOf must not precede/);
assert.throws(() => reviewCohortIndexInspection(cohort, pageMap,
  invalid(s => { s.properties = { 'https://unrelated.example/': {} }; }), options), /exact site property/);
const full = invalid(s => { s.inspection_scope = 'live_sitemap'; s.sitemap_url_count = 7; });
assert.equal(reviewCohortIndexInspection(cohort, pageMap, full, options).inspectionScope, 'live_sitemap');

const changedMap = structuredClone(pageMap);
const first = changedMap.members.find(m => m.id === 't01');
const second = changedMap.members.find(m => m.id === 't02');
[first.url, second.url] = [second.url, first.url];
const mismatched = reviewCohortIndexInspection(cohort, changedMap, observerSource, options);
assert.notEqual(mismatched.pageMapFingerprint, before.pageMapFingerprint);
assert.throws(() => compareCohortIndexObservations(cohort, before, mismatched), /Page-map fingerprints differ/);
assert.throws(() => compareCohortIndexObservations(cohort, after, before), /strictly later/);
assert.throws(() => compareCohortIndexObservations(cohort, before, { ...after, cohortId: 'other-cohort' }), /same frozen cohort/);
assert.throws(() => compareCohortIndexObservations(cohort, before, { ...after, site: 'https://elsewhere.example/' }), /same frozen cohort/);
assert.throws(() => compareCohortIndexObservations(cohort, before, { ...after, observedProductionRefClaim: '0'.repeat(40) }), /source\/live implementation refs/);
assert.throws(() => compareCohortIndexObservations(cohort, before, { ...after, deploymentDateClaim: '2026-10-01' }), /Production\/deployment claims differ/);
assert.throws(() => compareCohortIndexObservations(cohort, before, { ...after, members: [...after.members, after.members[0]] }), /exactly one entry/);
assert.throws(() => compareCohortIndexObservations(cohort, before, { ...after, pageMapFingerprint: undefined }), /lacks the complete/);
const priorHold = structuredClone(cohort);
priorHold.status = 'measurement-hold';
priorHold.measurementGate.state = 'hold';
assert.throws(() => compareCohortIndexObservations(priorHold, before, after), /measurement HOLD/);

const unresolvedSource = invalid(s => {
  s.inspections[0].response.inspectionResult.indexStatusResult.verdict = 'NEUTRAL';
});
const unresolvedReview = reviewCohortIndexInspection(cohort, pageMap, unresolvedSource, options);
const uncertain = compareCohortIndexObservations(cohort, before, unresolvedReview);
assert.equal(uncertain.treatment.comparableMembers, 3);
assert.ok(uncertain.treatment.memberIds.unpairedOrUnresolved.includes('t01'));

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'goose-index-compare-'));
try {
  const cohortFile = path.join(temp, 'cohort.json');
  const pageFile = path.join(temp, 'private-pages.json');
  const observerFile = path.join(temp, 'private-observer.json');
  const beforeFile = path.join(temp, 'private-before.json');
  const afterFile = path.join(temp, 'private-after.json');
  const combinedFile = path.join(temp, 'private-comparison.json');
  fs.writeFileSync(cohortFile, JSON.stringify(cohort));
  fs.writeFileSync(pageFile, JSON.stringify(pageMap));
  fs.writeFileSync(observerFile, JSON.stringify(observerSource));
  fs.writeFileSync(beforeFile, JSON.stringify(before));
  fs.writeFileSync(afterFile, JSON.stringify(after));
  const cmd = path.join(root, 'bin/arwp-cohort.mjs');
  const run = (...args) => spawnSync(process.execPath, [cmd, ...args], {
    cwd: root, encoding: 'utf8'
  });
  let result = run('check-index', cohortFile,
    '--production-ref=' + ref, '--deployment-date=2026-09-13',
    '--page-map=' + pageFile, '--inspection=' + observerFile, '--json');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).inspectionScope, 'priority_queue');
  result = run('compare-index', cohortFile, '--before=' + beforeFile,
    '--after=' + afterFile, '--output=' + combinedFile, '--json');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).comparableMembers, 6);
  assert.equal(JSON.parse(fs.readFileSync(combinedFile, 'utf8')).causalImpactEstablished, false);
  result = run('compare-index', cohortFile, '--before=' + beforeFile,
    '--after=' + afterFile, '--output=' + combinedFile);
  assert.equal(result.status, 1, 'private comparative evidence must not be silently overwritten');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log('PASS index observation bridge + frozen URL comparison: raw provider shape, missingness, losses, control movement, privacy and CLI');
