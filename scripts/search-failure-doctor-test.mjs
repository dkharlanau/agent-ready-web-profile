import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { diagnoseSearchFailure, formatSearchFailureDiagnosis, assessRepairReceipt, assessPublicationPolicy } from '../lib/search-failure-doctor.mjs';

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
assert.equal(blocker.primary.evidenceClass, 'supplied-technical-report');
assert.equal(blocker.sourceState.technical, 'supplied-unverified-technical');
const liveAudit = diagnoseSearchFailure({ site, technical: technical([fail('P0')]), technicalOrigin: 'live' });
assert.equal(liveAudit.primary.evidenceClass, 'live-bounded-public-audit');
assert.equal(liveAudit.sourceState.technical, 'live-bounded-public-audit');
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

const crossingWindow = diagnoseSearchFailure({ site, owner: owner({
  deployment: { expectedRef: 'a123', liveRef: 'a123', deployedOn: '2026-09-15' },
  search: search({ startDate: '2026-09-01', endDate: '2026-09-28', impressions: 200, clicks: 0 })
}) });
assert.equal(crossingWindow.stages.exposure, 'mixed-deployment-window');
assert.equal(crossingWindow.stages.visitsFromSearch, 'unknown');
assert.equal(crossingWindow.primary.code, 'establish-evidence');
assert.equal(crossingWindow.sourceState.googleSearchPeriod, null);

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

const repairNow='2026-01-03T12:00:00Z';
const check=(id,exitCode,completedAt)=>({id,exitCode,signal:null,completedAt,logSha256:'b'.repeat(64),commandSha256:'f'.repeat(64)});
const receipt={version:'0.1',sourceRef:'a'.repeat(40),requiredChecks:[{id:'verify',commandSha256:'f'.repeat(64)},{id:'links',commandSha256:'f'.repeat(64)}],baseline:{sourceRef:'a'.repeat(40),sourceDirty:false,check:check('verify',1,'2026-01-03T10:00:00Z')},
  candidate:{baseRef:'a'.repeat(40),patchSha256:'c'.repeat(64),checks:[check('verify',0,'2026-01-03T11:00:00Z'),check('links',0,'2026-01-03T11:10:00Z')]}};
assert.equal(assessRepairReceipt(receipt,{now:repairNow}).state,'reported_local_candidate');
assert.equal(assessRepairReceipt(receipt,{now:repairNow}).evaluatedAt,repairNow);
assert.equal(assessRepairReceipt(receipt,{now:repairNow}).baselineAt,receipt.baseline.check.completedAt);
const candidate=diagnoseSearchFailure({site,owner:owner({repair:receipt,search:search({impressions:10})}),now:repairNow});
assert.equal(candidate.primary.code,'review-local-repair');assert.equal(candidate.repair.searchEffect,'not_measured');assert.equal(candidate.repair.automaticPublication,false);
assert.match(candidate.unknowns.join(' '),/does not authenticate or execute/);
assert.equal(diagnoseSearchFailure({site,technical:technical([fail()]),owner:owner({repair:receipt}),now:repairNow}).primary.code,'review-technical-blocker','a local receipt cannot override public P0 evidence');
assert.equal(diagnoseSearchFailure({site,owner:owner({repair:receipt,deployment:{expectedRef:'d'.repeat(40),liveRef:'e'.repeat(40)}}),now:repairNow}).primary.code,'verify-live-revision');
assert.equal(diagnoseSearchFailure({site,owner:owner({repair:receipt,dataStatus:'synthetic'}),now:repairNow}).repair,null);
for(const [state,edit] of [
  ['failure_not_reproduced',r=>r.baseline.check.exitCode=0],
  ['interrupted_baseline',r=>r.baseline.check.signal='SIGTERM'],
  ['interrupted_baseline',r=>r.baseline.check.exitCode=null],
  ['unmatched_or_dirty_baseline',r=>r.baseline.sourceDirty=true],
  ['unmatched_or_dirty_baseline',r=>r.baseline.sourceRef='d'.repeat(40)],
  ['unmatched_candidate',r=>r.candidate.baseRef='d'.repeat(40)],
  ['unmatched_check_contract',r=>r.candidate.checks[0].commandSha256='e'.repeat(64)],
  ['unmatched_check_contract',r=>r.baseline.check.commandSha256='e'.repeat(64)],
  ['incomplete_candidate_checks',r=>r.candidate.checks.pop()],
  ['failed_or_interrupted_candidate',r=>r.candidate.checks[0].exitCode=1],
  ['failed_or_interrupted_candidate',r=>r.candidate.checks[0].signal='SIGTERM'],
  ['candidate_predates_baseline',r=>r.candidate.checks[0].completedAt='2026-01-03T09:00:00Z'],
  ['future_check_date',r=>r.candidate.checks[0].completedAt='2027-01-03T10:00:00Z'],
  ['reported_failed_baseline',r=>delete r.candidate]
]){const changed=structuredClone(receipt);edit(changed);assert.equal(assessRepairReceipt(changed,{now:repairNow}).state,state);}
assert.equal(assessRepairReceipt(receipt,{now:'2026-01-20T12:00:00Z'}).state,'stale_baseline');
assert.equal(assessRepairReceipt(receipt,{now:repairNow,expectedRef:'d'.repeat(40)}).state,'unmatched_or_dirty_baseline');
for(const edit of [r=>r.requiredChecks.push(r.requiredChecks[0]),r=>r.candidate.checks.push(r.candidate.checks[0]),r=>r.baseline.check.completedAt='2026-02-30T00:00:00Z',r=>r.baseline.check.logSha256='not-a-digest',r=>r.candidate.checks[0].id='unregistered']){
 const changed=structuredClone(receipt);edit(changed);assert.throws(()=>assessRepairReceipt(changed,{now:repairNow}));
}
const hidden=structuredClone(receipt);hidden.candidate.privateComment='PRIVATE_OWNER_NOTE';
assert.doesNotMatch(JSON.stringify(diagnoseSearchFailure({site,owner:owner({repair:hidden}),now:repairNow})),/PRIVATE_OWNER_NOTE/);

// Explicit synthetic publication exclusions remain review context, never PASS.
const excludedUrl=site+'archive/retained',otherUrl=site+'public';
const publicationPolicy={version:'0.1',sourceRef:'a'.repeat(40),observedAt:'2026-01-03T10:00:00Z',
  pages:[{url:excludedUrl,indexing:'excluded',basis:'archive',privateNote:'PRIVATE_POLICY_NOTE'}]};
const excludedAudit={...technical([{...fail(),evidence:[excludedUrl]}]),pages:[{url:excludedUrl,requestedUrl:excludedUrl,ok:true,status:200,noindex:true,redirected:false}]};
const excludedBefore=structuredClone(excludedAudit);
const policyResult=diagnoseSearchFailure({site,technical:excludedAudit,owner:owner({publicationPolicy}),now:repairNow});
assert.equal(policyResult.primary.code,'review-publication-policy');assert.equal(policyResult.publicationPolicy.state,'unbound_revision_context');
assert.equal(policyResult.stages.publicEligibility,'bounded-failure');assert.equal(policyResult.publicationPolicy.automaticExemption,false);
assert.equal(policyResult.guardrails.noAutomaticSiteMutation,true);assert.deepEqual(excludedAudit,excludedBefore);
assert.doesNotMatch(JSON.stringify(policyResult),/PRIVATE_POLICY_NOTE/);
assert.match(policyResult.primary.hold,/not an audit PASS/);
assert.equal(assessPublicationPolicy(publicationPolicy,{site,technical:excludedAudit,expectedRef:'a'.repeat(40),now:repairNow}).state,'exact_url_context');
assert.equal(assessPublicationPolicy(publicationPolicy,{site,technical:excludedAudit,expectedRef:'b'.repeat(40),now:repairNow}).state,'source_mismatch');
assert.equal(assessPublicationPolicy(publicationPolicy,{site,technical:excludedAudit,now:'2026-01-20T12:00:00Z'}).state,'stale_policy');
assert.equal(assessPublicationPolicy({...publicationPolicy,observedAt:'2027-01-03T10:00:00Z'},{site,technical:excludedAudit,now:repairNow}).state,'future_policy');
for(const edit of [
 t=>t.checks.push({...fail(),id:'robots-path-access'}),
 t=>t.checks.push({...fail(),evidence:[excludedUrl]}),
 t=>t.checks[0].evidence=[],
 t=>t.checks[0].evidence.push(otherUrl),
 t=>t.pages[0].status=403,
 t=>t.pages[0].redirected=true,
 t=>t.pages[0].noindex=false,
 t=>t.pages[0].ok=false,
 t=>t.pages.push({...t.pages[0],url:otherUrl}),
 t=>t.pages.push({...t.pages[0]}),
 t=>delete t.pages
]){
 const changed=structuredClone(excludedAudit);edit(changed);
 assert.equal(diagnoseSearchFailure({site,technical:changed,owner:owner({publicationPolicy}),now:repairNow}).primary.code,'review-technical-blocker');
}
for(const edit of [p=>p.pages.push(p.pages[0]),p=>p.pages[0].url='https://elsewhere.example.test/archive',
 p=>p.pages[0].url='https://example.com/project-elsewhere/archive',p=>p.pages[0].url=excludedUrl+'?secret=x',
 p=>p.pages[0].url=excludedUrl+'#fragment',p=>p.pages[0].indexing='indexable',p=>p.pages[0].basis='arbitrary',
 p=>p.observedAt='2026-02-30T00:00:00Z',p=>p.sourceRef='not-a-ref']){
 const changed=structuredClone(publicationPolicy);edit(changed);
 assert.throws(()=>diagnoseSearchFailure({site,technical:excludedAudit,owner:owner({publicationPolicy:changed}),now:repairNow}));
}
assert.equal(diagnoseSearchFailure({site,technical:excludedAudit,owner:owner({publicationPolicy,dataStatus:'synthetic'}),now:repairNow}).publicationPolicy,null);
assert.equal(diagnoseSearchFailure({site,technical:excludedAudit,owner:owner({publicationPolicy,deployment:{expectedRef:'a'.repeat(40),liveRef:'b'.repeat(40)}}),now:repairNow}).primary.code,'verify-live-revision');

for (const input of [
  { site: 'http://example.com/' },
  { site: 'https://example.com/?credential=secret' },
  { site, technical: { canonicalUrl:'https://elsewhere.com/', checks:[] } },
  { site, owner: owner({site:'https://example.com/other/'}) },
  { site, owner: owner({search: search({impressions:-1})}) },
  { site, owner: owner({search: search({clicks:1})}) },
  { site, owner: owner({search: search({dataState:'unknown'})}) },
  { site, owner: owner({search: search({scope:'page-query'})}) },
  { site, owner: owner({search: search({property:'sc-domain:other.com'})}) },
  { site, owner: owner({search: search({property:'https://example.com/unrelated/'})}) },
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
