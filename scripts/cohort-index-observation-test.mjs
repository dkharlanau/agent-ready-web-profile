import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCohortPageMapTemplate } from '../lib/cohort-search-observation.mjs';
import { reviewCohortIndexInspection } from '../lib/cohort-index-observation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r2 = JSON.parse(fs.readFileSync(path.join(root,
  'knowledge/experiments/2026-09-15-ptichi-cohort-refreeze-r2.json'), 'utf8'));
const held = JSON.parse(fs.readFileSync(path.join(root,
  'knowledge/experiments/2026-09-09-ptichi-cohort-freeze.json'), 'utf8'));

const cohort = structuredClone(r2);
cohort.site = 'https://example.com/';
const pageMap = createCohortPageMapTemplate(cohort);
for (const member of pageMap.members) member.url = 'https://example.com/fixture/' + member.id + '/';
const byId = new Map(pageMap.members.map(member => [member.id, member.url]));
const makeRow = (id, verdict, coverageState, extra = {}) => ({
  url: byId.get(id), verdict, coverageState, ...extra
});
const rows = [
  makeRow('t01', 'PASS', 'Submitted and indexed', {
    googleCanonical: byId.get('t01'), userCanonical: byId.get('t01'),
    lastCrawlTime: '2026-09-20T12:30:00Z', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED'
  }),
  makeRow('t02', 'NEUTRAL', 'Discovered - currently not indexed', {
    robotsTxtState: 'ROBOTS_TXT_STATE_UNSPECIFIED',
    indexingState: 'INDEXING_STATE_UNSPECIFIED'
  }),
  makeRow('t03', 'NEUTRAL', 'URL is unknown to Google'),
  makeRow('t04', 'NEUTRAL', 'Crawled - currently not indexed', { lastCrawlTime: '2026-09-10T12:00:00Z' }),
  makeRow('t05', 'NEUTRAL', 'Blocked by robots.txt', { robotsTxtState: 'DISALLOWED' }),
  makeRow('t06', 'NEUTRAL', 'Excluded by noindex', { indexingState: 'BLOCKED_BY_META_TAG' }),
  makeRow('t07', 'NEUTRAL', 'Soft 404', { pageFetchState: 'SOFT_404' }),
  makeRow('c01', 'PASS', 'Indexed, not submitted in sitemap', {
    googleCanonical: 'https://example.com/another-page/',
    userCanonical: byId.get('c01'),
    lastCrawlTime: '2026-09-13T20:00:00Z'
  }),
  { url: 'https://example.com/unrelated/', verdict: 'PASS', coverageState: 'Submitted and indexed' }
];
const counts = Object.fromEntries([...new Set(rows.map(x => x.coverageState))].map(label => [
  label, rows.filter(row => row.coverageState === label).length
]));
const snapshot = {
  schema_version: 1,
  observed_at: '2026-09-28T14:00:16Z',
  properties: { [cohort.site]: { data_state: 'final' } },
  current_url_inspection: {
    observed_at: '2026-09-28T14:00:16Z',
    total: rows.length, counts, rows
  }
};
const options = {
  productionRef: cohort.measurementGate.implementationRef,
  deploymentDate: '2026-09-13'
};

const review = reviewCohortIndexInspection(cohort, pageMap, snapshot, options);
assert.equal(review.kind, 'cohort-url-index-observation');
assert.equal(review.productionGate, 'ready');
assert.equal(review.sourceClass, 'owner-supplied-url-inspection-snapshot');
assert.equal(review.indexedVersionNotLiveTest, true);
assert.equal(review.ownerSourceAuthenticatedByThisTool, false);
assert.equal(review.observedAt, '2026-09-28T14:00:16.000Z');
assert.deepEqual(review.frozen, { treatment: 12, control: 6, searchQueries: 12 });
assert.equal(review.snapshot.inspectedRows, 9);
assert.equal(review.snapshot.matchedFrozenMembers, 8);
assert.equal(review.snapshot.outsideFrozenMembers, 1);
assert.equal(review.treatment.inspectedMembers, 7);
assert.equal(review.treatment.stateCounts.indexed, 1);
assert.equal(review.treatment.stateCounts['discovered-not-indexed'], 1);
assert.equal(review.treatment.stateCounts['unknown-to-google'], 1);
assert.equal(review.treatment.stateCounts['crawled-not-indexed'], 1);
assert.equal(review.treatment.stateCounts['blocked-robots'], 1);
assert.equal(review.treatment.stateCounts['blocked-noindex'], 1);
assert.equal(review.treatment.stateCounts['fetch-problem'], 1);
assert.equal(review.treatment.stateCounts['not-inspected'], 5);
assert.equal(review.control.stateCounts.indexed, 1);
assert.equal(review.control.stateCounts['not-inspected'], 5);
assert.deepEqual(review.treatment.lastCrawlNotAfterDeploymentMembers, ['t04']);
assert.deepEqual(review.control.lastCrawlNotAfterDeploymentMembers, ['c01'], 'same-day crawl cannot prove new deployment was processed');
assert.deepEqual(review.control.canonicalDifferenceMembers, ['c01']);
assert.equal(review.members.find(row => row.id === 't08').state, 'not-inspected');
assert.equal(review.members.find(row => row.id === 't08').coverageState, null);
assert.equal(review.members.find(row => row.id === 't03').state, 'unknown-to-google');
assert.equal(review.members.find(row => row.id === 't01').lastCrawlNotAfterDeployment, false);
assert.equal(review.noOutcomeDecision, true);
assert.ok(review.nextChecks.some(text => /Discovered|discovered/i.test(text)));
assert.ok(review.nextChecks.some(text => /without.*deployment|before or on the deployment/i.test(text)));
assert.ok(!JSON.stringify(review).includes('https://example.com/fixture/'), 'private page mapping must not appear in review output');
assert.ok(!JSON.stringify(review).includes('https://example.com/another-page/'), 'Google-selected canonical must remain private');

const altered = tweak => {
  const item = structuredClone(snapshot);
  tweak(item);
  return item;
};
assert.throws(() => reviewCohortIndexInspection(cohort, pageMap, altered(x => { delete x.properties[cohort.site]; }), options), /exact site property/);
assert.throws(() => reviewCohortIndexInspection(cohort, pageMap, altered(x => { x.current_url_inspection.total++; }), options), /total must equal/);
assert.throws(() => reviewCohortIndexInspection(cohort, pageMap, altered(x => { x.current_url_inspection.counts['Submitted and indexed']++; }), options), /counts disagree/);
assert.throws(() => reviewCohortIndexInspection(cohort, pageMap, altered(x => { x.current_url_inspection.rows[1].url = x.current_url_inspection.rows[0].url; }), options), /Duplicate inspected URL/);
assert.throws(() => reviewCohortIndexInspection(cohort, pageMap, altered(x => { x.current_url_inspection.rows[0].coverageState = ''; }), options), /coverageState/);
assert.throws(() => reviewCohortIndexInspection(cohort, pageMap, altered(x => { x.current_url_inspection.observed_at = '2026-02-30T12:00:00Z'; }), options), /timestamp|calendar date/);
assert.throws(() => reviewCohortIndexInspection(cohort, pageMap, altered(x => { x.current_url_inspection.observed_at = '2026-09-10T12:00:00Z'; }), options), /asOf must not precede/);
assert.throws(() => reviewCohortIndexInspection(cohort, pageMap, snapshot, { ...options, productionRef: '0'.repeat(40) }), /on HOLD/);
const historical = structuredClone(held);
historical.site = cohort.site;
const oldMap = createCohortPageMapTemplate(historical);
for (const member of oldMap.members) member.url = 'https://example.com/fixture/' + member.id + '/';
assert.throws(() => reviewCohortIndexInspection(historical, oldMap, snapshot, {
  ...options, productionRef: historical.measurementGate.implementationRef
}), /on HOLD/, 'a historical held freeze must not be promoted by re-supplying its SHA');

const conflict = altered(x => {
  x.current_url_inspection.rows[0].verdict = 'NEUTRAL';
  x.current_url_inspection.rows[1].verdict = 'PASS';
});
const conflicts = reviewCohortIndexInspection(cohort, pageMap, conflict, options);
assert.equal(conflicts.treatment.stateCounts.unresolved, 2, 'conflicting verdict/coverage must stay unresolved');
assert.equal(conflicts.treatment.stateCounts.indexed, 0);
const noInspect = altered(x => {
  x.current_url_inspection.rows = [x.current_url_inspection.rows[8]];
  x.current_url_inspection.total = 1;
  x.current_url_inspection.counts = { 'Submitted and indexed': 1 };
});
const onlyOutside = reviewCohortIndexInspection(cohort, pageMap, noInspect, options);
assert.equal(onlyOutside.treatment.stateCounts['not-inspected'], 12);
assert.equal(onlyOutside.control.stateCounts['not-inspected'], 6);
assert.equal(onlyOutside.snapshot.matchedFrozenMembers, 0);
const all = reviewCohortIndexInspection(cohort, pageMap, snapshot, options);
assert.ok(all.nextChecks.every(x => !/automatically improve|guaranteed ranking|indexing win/i.test(x)));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'goose-index-'));
try {
  const pathCohort = path.join(dir, 'cohort.json');
  const pathMap = path.join(dir, 'map.json');
  const pathSnapshot = path.join(dir, 'private-index.json');
  const pathResult = path.join(dir, 'review.json');
  fs.writeFileSync(pathCohort, JSON.stringify(cohort));
  fs.writeFileSync(pathMap, JSON.stringify(pageMap));
  fs.writeFileSync(pathSnapshot, JSON.stringify(snapshot));
  const cli = path.join(root, 'bin/arwp-cohort.mjs');
  const run = (...argv) => spawnSync(process.execPath, [cli, ...argv], { cwd: root, encoding: 'utf8' });
  let result = run('check-index', pathCohort, '--production-ref=' + options.productionRef,
    '--deployment-date=2026-09-13', '--page-map=' + pathMap, '--inspection=' + pathSnapshot, '--json',
    '--output=' + pathResult);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).snapshot.matchedFrozenMembers, 8);
  assert.equal(JSON.parse(fs.readFileSync(pathResult, 'utf8')).noOutcomeDecision, true);
  result = run('check-index', pathCohort, '--production-ref=' + options.productionRef,
    '--deployment-date=2026-09-13', '--page-map=' + pathMap, '--inspection=' + pathSnapshot,
    '--output=' + pathResult);
  assert.equal(result.status, 1, 'evidence must not be overwritten by accident');
  result = run('check-index', pathCohort, '--production-ref=' + options.productionRef);
  assert.equal(result.status, 1, 'missing owner-supplied file must fail');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('PASS cohort URL Inspection review: frozen membership, index-vs-discovery, missingness, crawl chronology, canonical conflicts and private CLI');
