import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildFreshnessSnapshot,
  compareFreshnessSnapshots,
  parseLeafSitemap,
  validateFreshnessComparison,
  validateFreshnessSnapshot
} from '../lib/freshness-integrity.mjs';
import { validateSiteStateGraph } from '../lib/repository-mapper.mjs';

const digest = char => `sha256:${char.repeat(64)}`;
const root = 'https://example.com/';

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

function graph({ commit = '1'.repeat(40), rootSha = 'a', aSha = 'b', sharedSha = 'c', missingShared = false } = {}) {
  const files = [
    { path: 'index.html', sha256: digest(rootSha), bytes: 100, role: 'page-source', mutationClass: 'editorial', generated: false },
    { path: 'a.html', sha256: digest(aSha), bytes: 100, role: 'page-source', mutationClass: 'editorial', generated: false }
  ];
  if (!missingShared) files.push({ path: 'shared.html', sha256: digest(sharedSha), bytes: 80, role: 'layout', mutationClass: 'grounded-template', generated: false });
  const routes = [
    { id: 'route:/', routePath: '/', url: root, state: 'resolved', ownerPath: 'index.html', candidates: [], buildPath: ['index.html', 'shared.html'], evidence: ['fixture:root'] },
    { id: 'route:/a', routePath: '/a', url: 'https://example.com/a', state: 'resolved', ownerPath: 'a.html', candidates: [], buildPath: ['a.html', 'shared.html'], evidence: ['fixture:a'] }
  ];
  const ownership = routes.map(route => ({
    surfaceKey: `route:${route.routePath}:document`,
    surfaceType: 'document',
    routePath: route.routePath,
    state: 'resolved',
    ownerPath: route.ownerPath,
    candidates: [],
    mutationClass: 'editorial',
    evidenceClass: 'direct-source',
    value: route.url,
    locator: null,
    evidence: ['fixture:document-owner']
  }));
  const facts = [];
  const value = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/site-state-graph.schema.json',
    version: '0.1',
    generatedAt: '2026-09-09T18:00:00.000Z',
    repository: { fullName: 'owner/site', baseRef: 'main', baseCommitSha: commit, siteRoot: '.' },
    site: { origin: 'https://example.com', basePath: '/' },
    adapter: { id: 'static-html', version: '0.1', detection: ['fixture:static-html'], confidence: 'deterministic' },
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
  assert.equal(validateSiteStateGraph(value).valid, true, 'fixture Site State Graph must remain valid');
  return value;
}

function sitemap({ rootLastmod = '2026-09-01', aLastmod = '2026-09-02', includeUnmapped = true } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc><lastmod>${rootLastmod}</lastmod></url>
  <url><loc>https://example.com/a</loc><lastmod>${aLastmod}</lastmod></url>
  ${includeUnmapped ? '<url><loc>https://example.com/unmapped</loc></url>' : ''}
</urlset>`;
}

{
  const snapshot = buildFreshnessSnapshot(graph(), sitemap(), { generatedAt: '2026-09-09T18:00:00Z', sitemapSource: 'fixture:sitemap.xml' });
  assert.equal(validateFreshnessSnapshot(snapshot).valid, true);
  assert.deepEqual(snapshot.summary, {
    sitemapEntries: 3,
    mappedRoutes: 2,
    unmappedRoutes: 1,
    withLastmod: 2,
    withoutLastmod: 1,
    invalidLastmod: 0,
    completeBuildInputs: 2,
    partialBuildInputs: 1
  });
  const rootEntry = snapshot.entries.find(item => item.url === root);
  assert.equal(rootEntry.ownerPath, 'index.html');
  assert.deepEqual(rootEntry.buildInputPaths, ['index.html', 'shared.html']);
  assert.match(rootEntry.buildInputDigestSha256, /^sha256:[a-f0-9]{64}$/);
  const unmapped = snapshot.entries.find(item => item.url.endsWith('/unmapped'));
  assert.equal(unmapped.routeState, 'not-mapped');
  assert.equal(unmapped.buildInputCoverage, 'unavailable');
}

{
  const parsed = parseLeafSitemap(sitemap({ rootLastmod: 'September 1, 2026', includeUnmapped: false }));
  assert.equal(parsed[0].lastmodState, 'invalid', 'lastmod must follow W3C/ISO sitemap date syntax, not merely Date.parse permissiveness');
  assert.throws(() => parseLeafSitemap('<sitemapindex><sitemap><loc>https://example.com/sitemap-a.xml</loc></sitemap></sitemapindex>'), /not a leaf urlset/i);
  assert.throws(() => parseLeafSitemap('<urlset><url><loc>http://example.com/</loc></url></urlset>'), /HTTPS URL/);
  assert.throws(() => parseLeafSitemap('<urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/</loc></url></urlset>'), /Duplicate sitemap loc/);
}

{
  const before = buildFreshnessSnapshot(graph(), sitemap({ includeUnmapped: false }), { generatedAt: '2026-09-09T18:00:00Z' });
  const after = buildFreshnessSnapshot(graph(), sitemap({ rootLastmod: '2026-09-03', includeUnmapped: false }), { generatedAt: '2026-09-09T18:05:00Z' });
  const comparison = compareFreshnessSnapshots(before, after, { generatedAt: '2026-09-09T18:06:00Z' });
  assert.equal(validateFreshnessComparison(comparison).valid, true);
  const rootObservation = comparison.observations.find(item => item.url === root);
  assert.equal(rootObservation.state, 'lastmod-churn-candidate');
  assert.equal(rootObservation.confidence, 'high', 'same repository commit plus byte-identical mapped inputs is the strongest synthetic-lastmod evidence');
  assert.equal(comparison.actions.some(item => item.kind === 'review-synthetic-lastmod' && item.url === root), true);
  assert.equal(comparison.summary.lastmodChurnCandidates, 1);
}

{
  const before = buildFreshnessSnapshot(graph(), sitemap({ includeUnmapped: false }), { generatedAt: '2026-09-09T18:00:00Z' });
  const after = buildFreshnessSnapshot(
    graph({ commit: '2'.repeat(40), aSha: 'd', sharedSha: 'e' }),
    sitemap({ includeUnmapped: false }),
    { generatedAt: '2026-09-09T19:00:00Z' }
  );
  const comparison = compareFreshnessSnapshots(before, after, { generatedAt: '2026-09-09T19:01:00Z' });
  assert.equal(comparison.observations.find(item => item.url === 'https://example.com/a').state, 'stale-lastmod-candidate');
  assert.equal(comparison.observations.find(item => item.url === root).state, 'stale-lastmod-candidate', 'changed mapped shared input must not be mislabeled unchanged merely because the owner file itself stayed byte-identical');
  assert.equal(comparison.summary.staleLastmodCandidates, 2);
  assert.ok(comparison.actions.every(item => item.status === 'review'));
  assert.ok(comparison.actions.every(item => /significant/i.test(item.verification)), 'a changed digest is not proof the visible change was significant enough for lastmod');
}

{
  const before = buildFreshnessSnapshot(graph(), sitemap({ includeUnmapped: false }), { generatedAt: '2026-09-09T18:00:00Z' });
  const after = buildFreshnessSnapshot(
    graph({ commit: '2'.repeat(40), sharedSha: 'e' }),
    sitemap({ rootLastmod: '2026-09-03', aLastmod: '2026-09-04', includeUnmapped: false }),
    { generatedAt: '2026-09-09T19:00:00Z' }
  );
  const comparison = compareFreshnessSnapshots(before, after, { generatedAt: '2026-09-09T19:01:00Z' });
  assert.equal(comparison.summary.alignedChanges, 2);
  assert.equal(comparison.actions.length, 0, 'mechanical alignment is evidence, not a reason to manufacture a repair action');
  assert.equal(comparison.guardrails.digestChangeNotSignificantChangeProof, true);
}

{
  const before = buildFreshnessSnapshot(graph(), sitemap({ rootLastmod: '2026-09-01T00:00:00Z', includeUnmapped: false }), { generatedAt: '2026-09-09T18:00:00Z' });
  const after = buildFreshnessSnapshot(graph(), sitemap({ rootLastmod: '2026-09-01T02:00:00+02:00', includeUnmapped: false }), { generatedAt: '2026-09-09T18:05:00Z' });
  const comparison = compareFreshnessSnapshots(before, after, { generatedAt: '2026-09-09T18:06:00Z' });
  assert.equal(comparison.observations.find(item => item.url === root).state, 'unchanged', 'equivalent instants with different timezone notation must not create synthetic freshness churn');
}

{
  const before = buildFreshnessSnapshot(graph(), sitemap({ includeUnmapped: false }), { generatedAt: '2026-09-09T18:00:00Z' });
  const partial = buildFreshnessSnapshot(graph({ commit: '2'.repeat(40), missingShared: true }), sitemap({ includeUnmapped: false }), { generatedAt: '2026-09-09T19:00:00Z' });
  const comparison = compareFreshnessSnapshots(before, partial, { generatedAt: '2026-09-09T19:01:00Z' });
  assert.equal(comparison.summary.unknown, 2);
  assert.equal(comparison.actions.length, 0, 'partial source ownership must remain unknown instead of generating lastmod repairs');
}

{
  const before = buildFreshnessSnapshot(graph(), sitemap({ includeUnmapped: false }), { generatedAt: '2026-09-09T18:00:00Z' });
  const other = structuredClone(before);
  other.site.origin = 'https://other.example.com';
  assert.throws(() => compareFreshnessSnapshots(before, other), /same site origin and basePath/);
}

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'goose-freshness-'));
const cli = fileURLToPath(new URL('../bin/arwp-freshness.mjs', import.meta.url));
try {
  const stateFile = path.join(directory, 'state.json');
  const sitemapBeforeFile = path.join(directory, 'before.xml');
  const sitemapAfterFile = path.join(directory, 'after.xml');
  const beforeFile = path.join(directory, 'before.json');
  const afterFile = path.join(directory, 'after.json');
  const comparisonFile = path.join(directory, 'comparison.json');
  fs.writeFileSync(stateFile, JSON.stringify(graph()));
  fs.writeFileSync(sitemapBeforeFile, sitemap({ includeUnmapped: false }));
  fs.writeFileSync(sitemapAfterFile, sitemap({ rootLastmod: '2026-09-03', includeUnmapped: false }));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  assert.equal(run('snapshot', stateFile, sitemapBeforeFile, `--output=${beforeFile}`).status, 0);
  assert.equal(run('snapshot', stateFile, sitemapAfterFile, `--output=${afterFile}`).status, 0);
  assert.equal(run('validate', beforeFile).status, 0);
  assert.equal(run('compare', beforeFile, afterFile, `--output=${comparisonFile}`).status, 0);
  assert.equal(run('validate', comparisonFile).status, 0);
  const text = run('compare', beforeFile, afterFile, '--text');
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /No freshness, ranking or recrawl score/);
  assert.equal(run('compare', beforeFile, afterFile, `--output=${comparisonFile}`).status, 2, 'CLI must never overwrite an existing evidence file implicitly');
  assert.equal(run('--help').status, 0);
  assert.equal(run('snapshot').status, 2);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}

console.log('PASS Freshness Integrity keeps sitemap lastmod, revision-bound mapped inputs, significant-change review and Search outcome evidence separate.');
