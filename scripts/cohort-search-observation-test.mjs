import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createCohortPageMapTemplate,
  parseGscWebCsv,
  planCohortSearchObservation,
  reviewCohortGscWebExport,
  validateCohortPageMap
} from '../lib/cohort-search-observation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cohortPath = path.join(root, 'knowledge/experiments/2026-09-15-ptichi-cohort-refreeze-r2.json');
const historicalPath = path.join(root, 'knowledge/experiments/2026-09-09-ptichi-cohort-freeze.json');
const r2 = JSON.parse(fs.readFileSync(cohortPath, 'utf8'));
const historical = JSON.parse(fs.readFileSync(historicalPath, 'utf8'));
const ref = r2.measurementGate.implementationRef;
const dates = { productionRef: ref, deploymentDate: '2026-09-13', asOf: '2026-10-10', finalDataThrough: '2026-10-08' };

const plan = planCohortSearchObservation(r2, dates);
assert.equal(plan.productionGate, 'ready');
assert.equal(plan.deploymentDateVerifiedByThisTool, false);
assert.equal(plan.treatmentCount, 12);
assert.equal(plan.controlCount, 6);
assert.equal(plan.frozenQueryCount, 12);
assert.equal(plan.provider, 'google-search-console-web');
assert.deepEqual(plan.windows.map(window => [window.days, window.startDate, window.endDate, window.state]), [
  [14, '2026-09-14', '2026-09-27', 'eligible-for-evidence-review'],
  [28, '2026-09-14', '2026-10-11', 'window-open'],
  [56, '2026-09-14', '2026-11-08', 'window-open']
]);
assert.ok(plan.windows.every(window => window.ownerExportReviewed === false));
assert.ok(plan.limitations.some(message => /missing rows/i.test(message)));

const withoutFinality = planCohortSearchObservation(r2, { ...dates, finalDataThrough: null });
assert.equal(withoutFinality.windows[0].state, 'provider-finality-unconfirmed');
assert.equal(planCohortSearchObservation(r2, { ...dates, asOf: '2026-10-12', finalDataThrough: '2026-10-11' }).windows[1].state, 'eligible-for-evidence-review');
assert.equal(planCohortSearchObservation(r2, { ...dates, asOf: '2026-09-27', finalDataThrough: '2026-09-26' }).windows[0].state, 'window-open', 'last calendar day is incomplete as of that day');

const heldHistorical = planCohortSearchObservation(historical, {
  ...dates, productionRef: historical.measurementGate.implementationRef
});
assert.equal(heldHistorical.productionGate, 'hold', 'a new SHA assertion must not silently promote an old historical HOLD');
assert.ok(heldHistorical.windows.every(window => window.state === 'production-hold'));
const mismatch = planCohortSearchObservation(r2, { ...dates, productionRef: '0'.repeat(40) });
assert.equal(mismatch.productionGate, 'hold');
assert.throws(() => planCohortSearchObservation(r2, { ...dates, deploymentDate: '2026-02-30' }), /real calendar date/);
assert.throws(() => planCohortSearchObservation(r2, { ...dates, asOf: '2026-09-12' }), /asOf must not precede/);
assert.throws(() => planCohortSearchObservation(r2, { ...dates, finalDataThrough: '2026-10-12' }), /cannot be later/);
assert.throws(() => planCohortSearchObservation(r2, { ...dates, productionRef: 'main' }), /full, lowercase/);

const synthetic = structuredClone(r2);
synthetic.site = 'https://example.com/';
const template = createCohortPageMapTemplate(synthetic);
assert.equal(template.members.length, 18);
assert.ok(template.members.every(member => member.url === null));
const pageMap = structuredClone(template);
for (const member of pageMap.members) member.url = 'https://example.com/fixture/' + member.id + '/';
const validated = validateCohortPageMap(synthetic, pageMap);
assert.equal(validated.members.length, 18);
assert.equal(validated.byUrl.get('https://example.com/fixture/t01/').group, 'treatment');
assert.throws(() => validateCohortPageMap(synthetic, template), /explicit canonical HTTPS/);
let bad = structuredClone(pageMap);
bad.members[1].url = bad.members[0].url;
assert.throws(() => validateCohortPageMap(synthetic, bad), /same canonical/);
bad = structuredClone(pageMap);
bad.members[0].url = 'https://elsewhere.example/fixture/t01/';
assert.throws(() => validateCohortPageMap(synthetic, bad), /frozen cohort site/);
bad = structuredClone(pageMap);
bad.members[0].url += '?tracking=1';
assert.throws(() => validateCohortPageMap(synthetic, bad), /without userinfo/);
bad = structuredClone(pageMap);
bad.members[0].entity = 'invented-entity';
assert.throws(() => validateCohortPageMap(synthetic, bad), /frozen member/);
bad = structuredClone(pageMap);
bad.members.pop();
assert.throws(() => validateCohortPageMap(synthetic, bad), /every frozen member/);

const csv = [
  'Date,Page,Query,Clicks,Impressions',
  '2026-09-16,https://example.com/fixture/t01/,how to explain something clearly at work,2,9',
  '2026-09-17,https://example.com/fixture/t02/,some other query,0,4',
  '2026-09-18,https://example.com/fixture/c01/,how to explain something clearly at work,1,3',
  '2026-09-19,https://example.com/unrelated/,unrelated query,4,10'
].join('\n') + '\n';
const parsed = parseGscWebCsv(csv);
assert.equal(parsed.length, 4);
assert.deepEqual(parsed[0], { date: '2026-09-16', page: 'https://example.com/fixture/t01/', query: 'how to explain something clearly at work', clicks: 2, impressions: 9 });
assert.equal(parseGscWebCsv('\uFEFFDate,Page,Query,Clicks,Impressions\r\n2026-09-16,https://example.com/fixture/t01/,"quoted, ""query""",1,2\r\n')[0].query, 'quoted, "query"');
assert.throws(() => parseGscWebCsv('Date,Page,Clicks,Impressions\n'), /Query/);
assert.throws(() => parseGscWebCsv('Date,Page,Query,Clicks,Clicks,Impressions\n'), /Duplicate CSV/);
assert.throws(() => parseGscWebCsv('Date,Page,Query,Clicks,Impressions\n2026-09-16,http://example.com/,x,-1,2'), /non-negative integer/);
assert.throws(() => parseGscWebCsv('Date,Page,Query,Clicks,Impressions\n2026-09-16,http://example.com/,x,1.5,2'), /non-negative integer/);
assert.throws(() => parseGscWebCsv('Date,Page,Query,Clicks,Impressions\n2026-09-16,https://example.com/,"unterminated,1,2'), /Unterminated CSV/);

const options = {
  ...dates, reportScope: 'web', windowDays: '14',
  exportStart: '2026-09-14', exportEnd: '2026-09-27'
};
const review = reviewCohortGscWebExport(synthetic, pageMap, csv, options);
assert.equal(review.kind, 'cohort-gsc-web-observation');
assert.equal(review.status, 'descriptive-export-review-only');
assert.equal(review.reportScopeVerifiedFromCsv, false);
assert.equal(review.noOutcomeDecision, true);
assert.equal(review.observed.csvRows, 4);
assert.equal(review.observed.matchedCohortRows, 3);
assert.equal(review.observed.outsideCohortRows, 1);
assert.equal(review.observed.treatment.frozenMembers, 12);
assert.equal(review.observed.treatment.observedMembers, 2);
assert.equal(review.observed.treatment.observedImpressions, 13);
assert.equal(review.observed.treatment.observedClicks, 2);
assert.equal(review.observed.treatment.observedFrozenPanelImpressions, 9);
assert.equal(review.observed.control.observedImpressions, 3);
assert.equal(review.observed.treatment.notObservedMemberIds.length, 10);
assert.ok(review.observed.frozenPanelQueriesSeenIds.includes('q01-explain-clearly'));
assert.equal(review.members.find(member => member.id === 't03').state, 'not-observed-in-export');
assert.equal(review.members.find(member => member.id === 't03').impressions, null, 'missing page is unknown, not zero');
assert.ok(!JSON.stringify(review).includes('some other query'), 'private raw query must not leak in aggregate output');
assert.ok(!JSON.stringify(review).includes('https://example.com/fixture/'), 'private page map must not leak in aggregate output');

assert.equal(reviewCohortGscWebExport(synthetic, pageMap, csv, { ...options, finalDataThrough: null }).status, 'provider-finality-unconfirmed');
assert.equal(reviewCohortGscWebExport(synthetic, pageMap, 'Date,Page,Query,Clicks,Impressions\n', options).status, 'no-rows-in-export');
assert.throws(() => reviewCohortGscWebExport(historical, pageMap, csv, options), /production HOLD|Page map/, 'historical cohort must not acquire outcome evidence');
assert.throws(() => reviewCohortGscWebExport(synthetic, pageMap, csv, { ...options, reportScope: 'generative-ai' }), /report-scope=web/);
assert.throws(() => reviewCohortGscWebExport(synthetic, pageMap, csv, { ...options, exportEnd: '2026-09-28' }), /must equal the entire frozen/);
assert.throws(() => reviewCohortGscWebExport(synthetic, pageMap, csv + '2026-09-28,https://example.com/fixture/t01/,x,1,1\n', options), /outside the explicitly requested/);
assert.throws(() => reviewCohortGscWebExport(synthetic, pageMap, csv + '2026-09-16,https://example.com/fixture/t01/,how to explain something clearly at work,2,9\n', options), /Duplicate date/);
assert.throws(() => reviewCohortGscWebExport(synthetic, pageMap, csv, { ...options, productionRef: '0'.repeat(40) }), /production HOLD/);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'goose-observation-'));
try {
  const mapPath = path.join(tmp, 'map.json'), csvPath = path.join(tmp, 'web.csv');
  const cohortFixture = path.join(tmp, 'cohort.json'), outPath = path.join(tmp, 'review.json');
  fs.writeFileSync(mapPath, JSON.stringify(pageMap));
  fs.writeFileSync(csvPath, csv);
  fs.writeFileSync(cohortFixture, JSON.stringify(synthetic));
  const cli = path.join(root, 'bin/arwp-cohort.mjs');
  const run = (...argv) => spawnSync(process.execPath, [cli, ...argv], { cwd: root, encoding: 'utf8' });
  let result = run('plan', cohortPath, '--production-ref=' + ref, '--deployment-date=2026-09-13', '--as-of=2026-10-10', '--final-through=2026-10-08', '--json');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).windows[0].state, 'eligible-for-evidence-review');

  result = run('plan', historicalPath, '--production-ref=' + historical.measurementGate.implementationRef, '--deployment-date=2026-09-13', '--as-of=2026-10-10', '--json');
  assert.equal(result.status, 2, 'historical HOLD must block automation');

  result = run('page-map', cohortFixture, '--json');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).members.length, 18);

  result = run('check-gsc', cohortFixture,
    '--production-ref=' + ref, '--deployment-date=2026-09-13', '--as-of=2026-10-10',
    '--final-through=2026-10-08', '--window-days=14', '--report-scope=web',
    '--export-start=2026-09-14', '--export-end=2026-09-27',
    '--page-map=' + mapPath, '--export=' + csvPath, '--output=' + outPath, '--json');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).observed.treatment.observedImpressions, 13);
  assert.equal(JSON.parse(fs.readFileSync(outPath, 'utf8')).noOutcomeDecision, true);
  result = run('check-gsc', cohortFixture, '--production-ref=' + ref);
  assert.equal(result.status, 1, 'missing required owner provenance must fail closed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('PASS bounded Search observation planning, GSC Web CSV review, frozen page mapping, no-zero semantics and CLI gates');
