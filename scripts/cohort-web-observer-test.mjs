import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCohortPageMapTemplate } from '../lib/cohort-search-observation.mjs';
import { reviewCohortObserverWeb } from '../lib/cohort-web-observer.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r2 = JSON.parse(fs.readFileSync(path.join(root,
  'knowledge/experiments/2026-09-15-ptichi-cohort-refreeze-r2.json'), 'utf8'));
const frozen = structuredClone(r2);
frozen.site = 'https://example.com/';
const pages = createCohortPageMapTemplate(frozen);
for (const member of pages.members) member.url = 'https://example.com/frozen/' + member.id + '/';
const byId = new Map(pages.members.map(member => [member.id, member.url]));
const options = { productionRef: frozen.measurementGate.implementationRef, deploymentDate: '2026-09-13' };
const exactQuery = id => frozen.queryPanel.queries.find(query => query.id === id).text;

const rows = [
  { keys: [byId.get('t01'), exactQuery('q01-explain-clearly')], clicks: 2, impressions: 14 },
  { keys: [byId.get('t02'), exactQuery('q02-explain-technical')], clicks: 0, impressions: 6 },
  { keys: [byId.get('t03'), 'some unrelated search'], clicks: 0, impressions: 4 },
  { keys: [byId.get('c01'), 'some different search'], clicks: 1, impressions: 7 },
  { keys: ['https://example.com/unrelated/', 'outside the frozen pages'], clicks: 0, impressions: 11 }
];

function fakeObserver() {
  return {
    schema_version: 1, retrieved_at: '2026-10-09T15:24:22.222222+00:00',
    timezone: 'America/Los_Angeles',
    search_type: 'web', data_state: 'final', cutoff: '2026-10-06',
    cutoff_basis: 'earliest firstIncompleteDate minus one day',
    partial: false, properties: {
      [frozen.site]: {
        windows: { current28: {
          start: '2026-09-09', end: '2026-10-06',
          totals: {
            available: true,
            response: { rows: [{ clicks: 3, impressions: 52 }], responseAggregationType: 'byProperty' }
          }
        } },
        dimensions: {
          page: { available: true, response: { rows: [
            { keys: [byId.get('t01')], clicks: 2, impressions: 18 }
          ], responseAggregationType: 'byPage' } },
          query: { available: true, response: { rows: [
            { keys: [exactQuery('q01-explain-clearly')], clicks: 2, impressions: 20 }
          ], responseAggregationType: 'byProperty' } },
          page_query: {
            available: true,
            response: { rows, responseAggregationType: 'byPage' },
            row_limit_reached: false
          }
        }
      }
    }
  };
}

const snapshot = fakeObserver();
const review = reviewCohortObserverWeb(frozen, pages, snapshot, options);
assert.equal(review.kind, 'cohort-observer-web-evidence');
assert.equal(review.productionGate, 'ready');
assert.equal(review.reportScope, 'google-search-console-web-page-query');
assert.equal(review.sourceFormat, 'search-observe-v1');
assert.equal(review.sourceOwnerAuthenticatedByGoose, false);
assert.equal(review.reportRetrievedAt, snapshot.retrieved_at);
assert.equal(review.window.name, 'current28');
assert.equal(review.window.startDate, '2026-09-09');
assert.equal(review.window.endDate, '2026-10-06');
assert.equal(review.window.days, 28);
assert.equal(review.window.coincidesWithFrozenWindow, false, 'do not relabel rolling current28 as T28');
assert.equal(review.window.frozenObservationWindowDays, null);
assert.equal(review.status, 'descriptive-rolling-web-observation');
assert.equal(review.propertyTopline.observed, true);
assert.equal(review.propertyTopline.population, 'property-aggregate');
assert.equal(review.propertyTopline.impressions, 52);
assert.equal(review.propertyTopline.clicks, 3);
assert.equal(review.observed.pageQueryRowsReturned, 5);
assert.equal(review.observed.pageQueryRowsMatchedToFrozenCohort, 4);
assert.equal(review.observed.pageQueryRowsOutsideCohort, 1);
assert.equal(review.observed.matchedRowsOutsideFrozenPanel, 2);
assert.equal(review.observed.treatment.frozenMembers, 12);
assert.equal(review.observed.treatment.returnedMembers, 3);
assert.equal(review.observed.treatment.visiblePageQueryImpressions, 24);
assert.equal(review.observed.treatment.visibleFrozenPanelImpressions, 20);
assert.equal(review.observed.treatment.visiblePageQueryClicks, 2);
assert.equal(review.observed.control.frozenMembers, 6);
assert.equal(review.observed.control.returnedMembers, 1);
assert.equal(review.observed.control.visiblePageQueryImpressions, 7);
assert.equal(review.observed.control.visiblePageQueryClicks, 1);
assert.equal(review.observed.control.visibleFrozenPanelImpressions, 0,
  'zero is permissible only within returned control rows; no return remains null');
assert.equal(review.members.find(member => member.id === 'c02').impressions, null);
assert.equal(review.members.find(member => member.id === 'c02').state, 'not-returned-in-owner-export');
assert.deepEqual(review.observed.frozenPanelQueryIdsReturned,
  ['q01-explain-clearly', 'q02-explain-technical']);
assert.equal(review.noOutcomeDecision, true);
assert.equal(review.causalImpactEstablished, false);
const rendered = JSON.stringify(review);
assert.ok(!rendered.includes('https://example.com/frozen/'));
assert.ok(!rendered.includes('some unrelated search'));
assert.ok(!rendered.includes('outside the frozen pages'));
assert.ok(review.limitations.some(text => /date, page and query were NOT jointly returned/i.test(text)));

const mutate = change => { const copy = structuredClone(snapshot); change(copy); return copy; };
assert.equal(reviewCohortObserverWeb(frozen, pages,
  mutate(s => { s.properties[frozen.site].dimensions.page_query.row_limit_reached = true; }), options).status,
  'provider-top-rows-truncated');
const empty = reviewCohortObserverWeb(frozen, pages, mutate(s => {
  s.properties[frozen.site].dimensions.page_query.response.rows = [];
}), options);
assert.equal(empty.status, 'no-page-query-rows-returned');
assert.equal(empty.observed.treatment.visiblePageQueryImpressions, null);
assert.equal(empty.observed.treatment.returnedMembers, 0);

const absentPropertyTotal = reviewCohortObserverWeb(frozen, pages, mutate(s => {
  s.properties[frozen.site].windows.current28.totals.response.rows = [];
}), options);
assert.equal(absentPropertyTotal.propertyTopline.observed, false);
assert.equal(absentPropertyTotal.propertyTopline.impressions, null);
assert.equal(absentPropertyTotal.observed.treatment.visiblePageQueryImpressions, 24);

assert.throws(() => reviewCohortObserverWeb(frozen, pages,
  mutate(s => { s.partial = true; }), options), /partial/);
assert.throws(() => reviewCohortObserverWeb(frozen, pages,
  mutate(s => { s.data_state = 'all'; }), options), /final Web/);
assert.throws(() => reviewCohortObserverWeb(frozen, pages,
  mutate(s => { s.search_type = 'image'; }), options), /final Web/);
assert.throws(() => reviewCohortObserverWeb(frozen, pages,
  mutate(s => { s.timezone = 'UTC'; }), options), /Pacific Time/);
assert.throws(() => reviewCohortObserverWeb(frozen, pages,
  mutate(s => { s.properties = { 'https://not-this-site.example/': {} }; }), options), /exact frozen/);
assert.throws(() => reviewCohortObserverWeb(frozen, pages,
  mutate(s => { s.properties[frozen.site].windows.current28.start = '2026-09-10'; }), options), /exactly 28/);
assert.throws(() => reviewCohortObserverWeb(frozen, pages,
  mutate(s => { s.cutoff = '2026-10-07'; }), options), /final data cutoff/);
assert.throws(() => reviewCohortObserverWeb(frozen, pages,
  mutate(s => { s.properties[frozen.site].dimensions.page_query.available = false; }), options), /unavailable/);
assert.throws(() => reviewCohortObserverWeb(frozen, pages,
  mutate(s => { delete s.properties[frozen.site].dimensions.page_query; }), options), /unavailable/);
assert.throws(() => reviewCohortObserverWeb(frozen, pages,
  mutate(s => { s.properties[frozen.site].dimensions.page_query.response.responseAggregationType = 'byProperty'; }), options), /byPage population/);
assert.throws(() => reviewCohortObserverWeb(frozen, pages,
  mutate(s => { s.properties[frozen.site].dimensions.page_query.response.rows[0].keys = [byId.get('t01')]; }), options), /one page URL and one/);
assert.throws(() => reviewCohortObserverWeb(frozen, pages,
  mutate(s => { s.properties[frozen.site].dimensions.page_query.response.rows[0].clicks = 0.5; }), options), /safe integer count/);
assert.throws(() => reviewCohortObserverWeb(frozen, pages,
  mutate(s => { s.properties[frozen.site].dimensions.page_query.response.rows.push({ ...rows[0] }); }), options), /Duplicate page\/query/);
assert.throws(() => reviewCohortObserverWeb(frozen, pages,
  mutate(s => { s.properties[frozen.site].windows.current28.totals.response.responseAggregationType = 'byPage'; }), options), /not grouped by property/);
assert.throws(() => reviewCohortObserverWeb(frozen, pages,
  mutate(s => { s.properties[frozen.site].windows.current28.totals.available = false; }), options), /unavailable/);

const historic = structuredClone(r2);
historic.site = frozen.site;
historic.status = 'measurement-hold';
historic.measurementGate.state = 'hold';
assert.throws(() => reviewCohortObserverWeb(historic, pages, snapshot, {
  ...options, productionRef: historic.measurementGate.implementationRef
}), /on HOLD/, 'a historical frozen HOLD must not be revived by owner export rows');
assert.throws(() => reviewCohortObserverWeb(frozen, pages, snapshot, {
  ...options, productionRef: '0'.repeat(40)
}), /on HOLD/);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'goose-observer-web-'));
try {
  const cohortPath = path.join(temp, 'cohort.json');
  const pagesPath = path.join(temp, 'pages.json');
  const obsPath = path.join(temp, 'owner-observer.json');
  const reviewPath = path.join(temp, 'owner-web-review.json');
  fs.writeFileSync(cohortPath, JSON.stringify(frozen));
  fs.writeFileSync(pagesPath, JSON.stringify(pages));
  fs.writeFileSync(obsPath, JSON.stringify(snapshot));
  const cli = path.join(root, 'bin/arwp-cohort.mjs');
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], {
    cwd: root, encoding: 'utf8'
  });
  let result = run('review-observer-web', cohortPath, '--production-ref=' +
    options.productionRef, '--deployment-date=' + options.deploymentDate,
    '--page-map=' + pagesPath, '--observer=' + obsPath,
    '--output=' + reviewPath, '--json');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).observed.treatment.visiblePageQueryImpressions, 24);
  assert.equal(JSON.parse(fs.readFileSync(reviewPath, 'utf8')).noOutcomeDecision, true);
  result = run('review-observer-web', cohortPath, '--production-ref=' +
    options.productionRef, '--deployment-date=' + options.deploymentDate,
    '--page-map=' + pagesPath, '--observer=' + obsPath, '--output=' + reviewPath);
  assert.equal(result.status, 1, 'read-only evidence files must not be overwritten');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('PASS native owner Web page-query intake: final PT window, byPage scope, missingness, raw-data privacy and CLI gate');
