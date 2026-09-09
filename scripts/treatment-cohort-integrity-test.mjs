import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  compareTreatmentCohortIntegrity,
  validateTreatmentCohortIntegrityReport
} from '../lib/treatment-cohort-integrity.mjs';
import { validateSiteStateGraph } from '../lib/repository-mapper.mjs';

const digest = char => `sha256:${char.repeat(64)}`;
const origin = 'https://example.com';

function summarize(files, routes, ownership, facts = []) {
  return {
    files: files.length,
    routes: routes.length,
    resolvedRoutes: routes.filter(item => item.state === 'resolved').length,
    ambiguousRoutes: routes.filter(item => item.state === 'ambiguous').length,
    unresolvedRoutes: routes.filter(item => item.state === 'unresolved').length,
    ownershipClaims: ownership.length,
    resolvedOwnership: ownership.filter(item => item.state === 'resolved').length,
    ambiguousOwnership: ownership.filter(item => item.state === 'ambiguous').length,
    unresolvedOwnership: ownership.filter(item => item.state === 'unresolved').length,
    facts: facts.length
  };
}

function route(routePath, ownerPath, buildPath = [ownerPath]) {
  return {
    id: `route:${routePath}`,
    routePath,
    url: routePath === '/' ? `${origin}/` : `${origin}${routePath}`,
    state: 'resolved',
    ownerPath,
    candidates: [],
    buildPath,
    evidence: ['fixture:route']
  };
}

function claim(routePath, ownerPath, surfaceType = 'document') {
  return {
    surfaceKey: `route:${routePath}:${surfaceType}`,
    surfaceType,
    routePath,
    state: 'resolved',
    ownerPath,
    candidates: [],
    mutationClass: surfaceType === 'document' ? 'editorial' : 'grounded-template',
    evidenceClass: 'direct-source',
    value: null,
    locator: null,
    evidence: ['fixture:ownership']
  };
}

function graph({
  commit = '1'.repeat(40),
  sharedSha = 'f',
  titlesSha = '7',
  phase = 'before',
  adapter = 'static-html',
  siteRoot = '.',
  cUnknownOwnership = false
} = {}) {
  const fileDefs = [
    ['index.html', 'a', 'page-source'],
    ['a.html', 'b', 'page-source'],
    ['b.html', 'c', 'page-source'],
    ['c.html', 'd', 'page-source'],
    ['shared.html', sharedSha, 'layout'],
    ['titles.json', titlesSha, 'data']
  ];
  if (phase === 'before') fileDefs.push(['old.html', 'e', 'page-source']);
  else fileDefs.push(['new.html', '9', 'page-source']);
  const files = fileDefs.map(([pathname, sha, role]) => ({
    path: pathname,
    sha256: digest(sha),
    bytes: 100,
    role,
    mutationClass: role === 'page-source' ? 'editorial' : 'grounded-template',
    generated: false
  }));

  const routes = [
    route('/', 'index.html', ['index.html', 'shared.html']),
    route('/a', 'a.html', ['a.html', 'shared.html']),
    route('/b', 'b.html', ['b.html']),
    route('/c', 'c.html', ['c.html']),
    phase === 'before' ? route('/old', 'old.html') : route('/new', 'new.html')
  ];
  const ownership = routes.map(item => claim(item.routePath, item.ownerPath));
  ownership.push(claim('/b', 'titles.json', 'title'));
  if (cUnknownOwnership) {
    ownership.push({
      surfaceKey: 'route:/c:description',
      surfaceType: 'description',
      routePath: '/c',
      state: 'unresolved',
      ownerPath: null,
      candidates: [],
      mutationClass: 'blocked',
      evidenceClass: 'unresolved',
      value: null,
      locator: null,
      evidence: ['fixture:unknown-description-owner']
    });
  }
  const facts = [];
  const value = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/site-state-graph.schema.json',
    version: '0.1',
    generatedAt: phase === 'before' ? '2026-09-09T18:00:00.000Z' : '2026-09-09T19:00:00.000Z',
    repository: { fullName: 'owner/site', baseRef: phase, baseCommitSha: commit, siteRoot },
    site: { origin, basePath: '/' },
    adapter: { id: adapter, version: '0.1', detection: [`fixture:${adapter}`], confidence: 'deterministic' },
    files,
    routes,
    ownership,
    facts,
    warnings: [],
    summary: summarize(files, routes, ownership, facts),
    guardrails: {
      noPathGuessing: true,
      ambiguityPreserved: true,
      generatedOutputNotPreferred: true,
      ownershipIsNotAuthorization: true,
      policyAndEditorialRemainGated: true,
      symlinksNotFollowed: true,
      noRankingGuarantee: true
    }
  };
  const validation = validateSiteStateGraph(value);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  return value;
}

const before = graph();
const after = graph({
  phase: 'after',
  commit: '2'.repeat(40),
  sharedSha: '1',
  titlesSha: '2'
});
const treatment = [
  'https://example.com/a',
  'https://example.com/c',
  'https://example.com/missing'
];
const report = compareTreatmentCohortIntegrity(before, after, {
  treatmentUrls: treatment,
  generatedAt: '2026-09-09T19:05:00Z'
});
assert.equal(validateTreatmentCohortIntegrityReport(report).valid, true);
assert.equal(report.mappingBasis.state, 'same');
assert.equal(report.summary.urls, 7);
assert.equal(report.summary.changed, 3, 'root and /a change through shared layout; /b changes through a route-scoped title owner');
assert.equal(report.summary.unchanged, 1);
assert.equal(report.summary.added, 1);
assert.equal(report.summary.removed, 1);
assert.equal(report.summary.unknown, 1);
assert.equal(report.summary.actualChangedCohort, 5);
assert.equal(report.summary.declared, 3);
assert.equal(report.summary.declaredChanged, 1);
assert.equal(report.summary.declaredUnchanged, 1);
assert.equal(report.summary.declaredUnknown, 1);
assert.equal(report.summary.changedOutsideTreatment, 4);
assert.deepEqual(report.findings.declaredChangedUrls, ['https://example.com/a']);
assert.deepEqual(report.findings.declaredUnchangedUrls, ['https://example.com/c']);
assert.deepEqual(report.findings.declaredUnknownUrls, ['https://example.com/missing']);
assert.deepEqual(report.findings.changedOutsideTreatmentUrls, [
  'https://example.com/',
  'https://example.com/b',
  'https://example.com/new',
  'https://example.com/old'
]);
assert.ok(report.actions.some(item => item.kind === 'declared-treatment-unchanged' && item.count === 1));
assert.ok(report.actions.some(item => item.kind === 'declared-treatment-unknown' && item.count === 1));
assert.ok(report.actions.some(item => item.kind === 'changed-outside-treatment' && item.count === 4));
assert.equal(report.guardrails.noCausalityInference, true);
assert.equal(report.guardrails.sharedInputsCanExpandCohort, true);

const rootRoute = report.routes.find(item => item.url === 'https://example.com/');
assert.equal(rootRoute.state, 'changed');
assert.deepEqual(rootRoute.changedInputPreview, ['shared.html']);
const bRoute = report.routes.find(item => item.url === 'https://example.com/b');
assert.equal(bRoute.state, 'changed');
assert.deepEqual(bRoute.changedInputPreview, ['titles.json'], 'route-scoped metadata ownership must contribute to implementation scope even when route.buildPath itself is unchanged');
const cRoute = report.routes.find(item => item.url === 'https://example.com/c');
assert.equal(cRoute.state, 'unchanged');
assert.equal(cRoute.declaredTreatment, true);

{
  const discovered = compareTreatmentCohortIntegrity(before, after, { generatedAt: '2026-09-09T19:05:00Z' });
  assert.equal(discovered.treatment.state, 'not-declared');
  assert.equal(discovered.summary.actualChangedCohort, 5);
  assert.deepEqual(discovered.findings.changedOutsideTreatmentUrls, [], 'without a declared treatment the report should expose actual implementation scope without inventing contamination');
  assert.equal(discovered.actions.some(item => item.kind === 'changed-outside-treatment'), false);
}

{
  const uncertainAfter = graph({ phase: 'after', commit: '2'.repeat(40), cUnknownOwnership: true });
  const uncertain = compareTreatmentCohortIntegrity(before, uncertainAfter, {
    treatmentUrls: ['https://example.com/c'],
    generatedAt: '2026-09-09T19:05:00Z'
  });
  assert.equal(uncertain.routes.find(item => item.url.endsWith('/c')).state, 'unknown');
  assert.deepEqual(uncertain.findings.declaredUnknownUrls, ['https://example.com/c']);
  assert.equal(uncertain.actions.some(item => item.kind === 'declared-treatment-unknown'), true);
}

{
  const migrated = compareTreatmentCohortIntegrity(before, graph({ phase: 'after', commit: '2'.repeat(40), adapter: 'nextjs', siteRoot: 'src' }), {
    treatmentUrls: ['https://example.com/a'],
    generatedAt: '2026-09-09T19:05:00Z'
  });
  assert.equal(migrated.mappingBasis.state, 'changed');
  assert.ok(migrated.routes.every(item => item.state === 'unknown'));
  assert.equal(migrated.actions.some(item => item.kind === 'mapping-basis-changed'), true);
  assert.deepEqual(migrated.findings.actualChangedUrls, []);
}

{
  const sameCommitAfter = graph({ phase: 'after', commit: '1'.repeat(40), sharedSha: '1', titlesSha: '2' });
  const dirty = compareTreatmentCohortIntegrity(before, sameCommitAfter, {
    treatmentUrls: ['https://example.com/a'],
    generatedAt: '2026-09-09T19:05:00Z'
  });
  assert.equal(dirty.summary.actualChangedCohort, 0, 'different inputs under the same immutable commit must not become revision-bound treatment evidence');
  assert.equal(dirty.summary.declaredUnknown, 1);
  assert.ok(dirty.routes.filter(item => item.url !== 'https://example.com/c').every(item => item.state === 'unknown'));
  assert.equal(dirty.actions.some(item => item.kind === 'same-commit-drift'), true);
  assert.equal(dirty.actions.some(item => item.kind === 'changed-outside-treatment'), false);
}

{
  assert.throws(() => compareTreatmentCohortIntegrity(before, after, { treatmentUrls: ['https://other.example.com/a'] }), /outside the Site State Graph scope/);
  const other = structuredClone(after);
  other.site.origin = 'https://other.example.com';
  assert.throws(() => compareTreatmentCohortIntegrity(before, other), /same site origin and basePath/);
}

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'goose-treatment-cohort-'));
const cli = fileURLToPath(new URL('../bin/arwp-treatment-cohort.mjs', import.meta.url));
try {
  const beforeFile = path.join(directory, 'before.json');
  const afterFile = path.join(directory, 'after.json');
  const treatmentFile = path.join(directory, 'treatment.json');
  const outputFile = path.join(directory, 'report.json');
  fs.writeFileSync(beforeFile, JSON.stringify(before));
  fs.writeFileSync(afterFile, JSON.stringify(after));
  fs.writeFileSync(treatmentFile, JSON.stringify(treatment));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  const built = run('compare', beforeFile, afterFile, `--treatment=${treatmentFile}`, `--output=${outputFile}`);
  assert.equal(built.status, 0, built.stderr);
  assert.equal(run('validate', outputFile).status, 0);
  const text = run('compare', beforeFile, afterFile, '--treatment-url=https://example.com/a', '--text');
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /no treatment, SEO, ranking or causality score/i);
  assert.equal(run('compare', beforeFile, afterFile, `--output=${outputFile}`).status, 2, 'existing report must not be overwritten implicitly');
  assert.equal(run('--help').status, 0);
  assert.equal(run('compare').status, 2);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}

console.log('PASS Treatment Cohort Integrity maps shared and route-scoped source changes into actual canonical-route scope, rejects dirty same-commit drift, preserves unknown ownership, and exposes declared-treatment contamination without causal claims.');
