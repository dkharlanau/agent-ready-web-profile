import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { diagnoseSearchFailure, formatSearchFailureDiagnosis } from '../lib/search-failure-doctor.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = 'https://example.com/project/';
const owner = (patch = {}) => ({
  version: '0.1',
  site,
  dataStatus: 'owner-supplied',
  ...patch
});
const search = (patch = {}) => ({
  provider: 'google-search-console',
  property: 'sc-domain:example.com',
  scope: 'property',
  searchType: 'web',
  dataState: 'final',
  startDate: '2026-09-01',
  endDate: '2026-09-28',
  impressions: 0,
  clicks: 0,
  ...patch
});
const technical = (checks = []) => ({ canonicalUrl: site, checks });
const fail = (priority = 'P0') => ({
  id: 'search-indexability', priority, status: 'fail',
  message: 'Synthetic final HTTP noindex finding', evidence: [], source: 'fixture'
});

const empty = diagnoseSearchFailure({ site });
assert.equal(empty.primary.code, 'establish-evidence');
assert.equal(empty.stages.exposure, 'unknown');
assert.equal(empty.stages.indexing, 'unknown');
assert.match(formatSearchFailureDiagnosis(empty), /Start here:/);
assert.doesNotMatch(formatSearchFailureDiagnosis(empty), /Google Analytics|SEO score: 100/i);
assert.equal(empty.guardrails.noCompositeScore, true);
assert.equal(empty.sourceState.owner, 'not-provided');

const audit = diagnoseSearchFailure({ site, technical: technical([{
  id: 'robots-watch', priority: 'P0', status: 'watch'
}]) });
assert.equal(audit.primary.code, 'establish-evidence', 'WATCH is not an observed failure');
assert.equal(audit.stages.publicEligibility, 'bounded-review');

const blocker = diagnoseSearchFailure({
  site, technical: technical([fail('P0')]),
  owner: owner({ indexing: { inspectedApprovedUrls: 4, indexedApprovedUrls: 0 }, search: search() })
});
assert.equal(blocker.primary.code, 'review-technical-blocker');
assert.equal(blocker.primary.checkId, 'search-indexability');
assert.match(blocker.primary.hold, /not proof of Google deindexing/);

const mismatch = diagnoseSearchFailure({
  site, technical: technical([fail()]),
  owner: owner({ deployment: {expectedRef:'ab12', liveRef:'cd34'} })
});
assert.equal(mismatch.primary.code, 'verify-live-revision', 'deployment discrepancy takes precedence');
assert.equal(mismatch.stages.publicEligibility, 'bounded-failure');

const partial = diagnoseSearchFailure({
  site, owner: owner({
    indexing: { inspectedApprovedUrls: 3, indexedApprovedUrls: 1 },
    search: search({ impressions: 0 })
  })
});
assert.equal(partial.primary.code, 'review-indexing-sample');
assert.match(partial.primary.hold, /not the sitewide/);

const noImpressionsNoIndex = diagnoseSearchFailure({ site, owner: owner({ search: search() }) });
assert.equal(noImpressionsNoIndex.primary.code, 'collect-indexing-evidence');
assert.equal(noImpressionsNoIndex.stages.exposure, 'zero-reported-property-impressions');

const zeroIndexedSample = diagnoseSearchFailure({ site, owner: owner({
  indexing: { inspectedApprovedUrls: 2, indexedApprovedUrls: 2 }, search: search()
}) });
assert.equal(zeroIndexedSample.primary.code, 'review-query-fit');
assert.match(zeroIndexedSample.primary.hold, /Do not manufacture keyword demand/);

const impressionsNoClicks = diagnoseSearchFailure({
  site, owner: owner({ search: search({ impressions: 127, clicks: 0 }) })
});
assert.equal(impressionsNoClicks.primary.code, 'review-selection-evidence');
assert.match(impressionsNoClicks.primary.action, /joint query-and-page/);
assert.equal(impressionsNoClicks.stages.visitsFromSearch, 'zero-reported-property-clicks');

const visits = diagnoseSearchFailure({ site, owner: owner({ search: search({ impressions: 140, clicks: 12 }) }) });
assert.equal(visits.primary.code, 'define-useful-outcome');

const preliminary = diagnoseSearchFailure({ site, owner: owner({
  search: search({ dataState: 'preliminary', impressions: 0, clicks: 0 })
}) });
assert.equal(preliminary.primary.code, 'establish-evidence');
assert.equal(preliminary.stages.exposure, 'preliminary-unknown');
assert.equal(preliminary.stages.visitsFromSearch, 'unknown');

const oldWindow = diagnoseSearchFailure({ site, owner: owner({
  deployment: { expectedRef: 'a123', liveRef: 'a123', deployedOn: '2026-09-30' },
  search: search({ startDate: '2026-09-01', endDate: '2026-09-28' })
}) });
assert.equal(oldWindow.primary.code, 'establish-evidence');
assert.equal(oldWindow.stages.exposure, 'predeployment-evidence');
assert.equal(oldWindow.sourceState.googleSearchPeriod, null);

const synthetic = diagnoseSearchFailure({ site, owner: owner({
  dataStatus: 'synthetic',
  indexing: { inspectedApprovedUrls: 10, indexedApprovedUrls: 0 },
  search: search({ impressions: 200, clicks: 0 })
}) });
assert.equal(synthetic.primary.code, 'establish-evidence');
assert.equal(synthetic.sourceState.owner, 'synthetic-excluded');
assert.equal(synthetic.stages.exposure, 'unknown');

const privateInput = owner({ site, internalQuery: 'CONFIDENTIAL_QUERY',
  search: { ...search({ impressions: 10, clicks: 0 }), query: 'CONFIDENTIAL_QUERY' }
});
assert.doesNotMatch(JSON.stringify(diagnoseSearchFailure({ site, owner: privateInput })), /CONFIDENTIAL_QUERY/);

for (const input of [
  { site: 'http://example.com/' },
  { site: 'https://example.com/?credential=secret' },
  { site, technical: { canonicalUrl:'https://elsewhere.com/', checks:[] } },
  { site, owner: owner({site:'https://example.com/other/'}) },
  { site, owner: owner({search: search({impressions:-1})}) },
  { site, owner: owner({search: search({clicks:1})}) },
  { site, owner: owner({search: search({dataState:'unknown'})}) },
  { site, owner: owner({search: search({scope:'page-query'})}) },
  { site, owner: owner({search: search({endDate:'2026-02-30'})}) },
  { site, owner: owner({indexing:{inspectedApprovedUrls:1,indexedApprovedUrls:2}}) }
]) assert.throws(() => diagnoseSearchFailure(input), Error, 'invalid or cross-scope evidence must fail closed');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-doctor-test-'));
try {
  const auditPath = path.join(dir, 'technical.json');
  const ownerPath = path.join(dir, 'owner.json');
  fs.writeFileSync(auditPath, JSON.stringify(technical([])));
  fs.writeFileSync(ownerPath, JSON.stringify(owner({search:search({impressions:100,clicks:0})})));
  const cli = path.join(root, 'bin/arwp-search-doctor.mjs');
  const run = (args) => spawnSync(process.execPath, args, {
    cwd: root, encoding: 'utf8', timeout: 20000
  });
  const first = run([cli, '--technical=' + auditPath, '--owner=' + ownerPath, '--json']);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(JSON.parse(first.stdout).primary.code, 'review-selection-evidence');
  const routed = run([path.join(root, 'bin/arwp.mjs'), 'search-doctor', site, '--technical=' + auditPath]);
  assert.equal(routed.status, 0, routed.stderr);
  assert.match(routed.stdout, /Start here:/);
  assert.equal(run([cli, '--help']).status, 0);
  const unsupported = run([cli, site, '--scan', '--technical=' + auditPath]);
  assert.equal(unsupported.status, 1);
  assert.match(unsupported.stderr, /Choose --scan or --technical/);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(pkg.bin['arwp-search-doctor'], 'bin/arwp-search-doctor.mjs');
assert.match(pkg.scripts['test:search-doctor'], /search-failure-doctor-test/);
assert.ok(pkg.files.includes('docs/SEARCH-FAILURE-TRIAGE.md'));
console.log('PASS Search Failure Doctor: scoped evidence, unknowns, precedence, confidentiality, CLI and package.');
