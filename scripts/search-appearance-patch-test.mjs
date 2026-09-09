import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectSearchAppearance } from '../lib/search-appearance.mjs';
import {
  buildSearchAppearancePatchManifest,
  validateSearchAppearancePatchManifest
} from '../lib/search-appearance-patch.mjs';
import { validateSiteStateGraph } from '../lib/repository-mapper.mjs';

const digest = char => `sha256:${char.repeat(64)}`;
const baseSha = '1'.repeat(40);

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

function graph({ adapter = 'static-html', origin = 'https://example.com', basePath = '/', jsonldOwner = false } = {}) {
  const pagePath = adapter === 'nextjs' ? 'src/app/page.tsx' : 'index.html';
  const files = [{ path: pagePath, sha256: digest('a'), bytes: 100, role: 'page-source', mutationClass: 'editorial', generated: false }];
  const buildPath = [pagePath];
  if (adapter === 'nextjs') {
    files.push({ path: 'src/app/layout.tsx', sha256: digest('b'), bytes: 120, role: 'layout', mutationClass: 'grounded-template', generated: false });
    buildPath.push('src/app/layout.tsx');
  }
  const routes = [{
    id: 'route:/', routePath: '/', url: `${origin}/`, state: 'resolved', ownerPath: pagePath, candidates: [], buildPath,
    evidence: [`${adapter}:root-route`]
  }];
  const ownership = [{
    surfaceKey: 'route:/:document', surfaceType: 'document', routePath: '/', state: 'resolved', ownerPath: pagePath, candidates: [],
    mutationClass: 'editorial', evidenceClass: 'direct-source', value: `${origin}/`, locator: null, evidence: [`${adapter}:root-route`]
  }];
  if (jsonldOwner) ownership.push({
    surfaceKey: 'metadata:/:jsonld', surfaceType: 'jsonld', routePath: '/', state: 'resolved', ownerPath: 'src/app/layout.tsx', candidates: [],
    mutationClass: 'grounded-template', evidenceClass: 'direct-source', value: null, locator: { line: 1, field: 'jsonld' }, evidence: ['explicit-jsonld-owner']
  });
  const facts = [];
  const value = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/site-state-graph.schema.json',
    version: '0.1', generatedAt: '2026-09-09T17:00:00.000Z',
    repository: { fullName: 'owner/site', baseRef: 'main', baseCommitSha: baseSha, siteRoot: '.' },
    site: { origin, basePath },
    adapter: { id: adapter, version: '0.1', detection: [`fixture:${adapter}`], confidence: 'deterministic' },
    files, routes, ownership, facts, warnings: [], summary: summarize(files, routes, ownership, facts),
    guardrails: { noPathGuessing: true, ambiguityPreserved: true, generatedOutputNotPreferred: true, ownershipIsNotAuthorization: true, policyAndEditorialRemainGated: true, symlinksNotFollowed: true, noRankingGuarantee: true }
  };
  assert.equal(validateSiteStateGraph(value).valid, true);
  return value;
}

const page = head => `<!doctype html><html><head>${head || ''}</head><body><h1>Example</h1></body></html>`;
const missing = inspectSearchAppearance({ html: page(''), url: 'https://example.com/' });
assert.ok(missing.actions.some(action => action.id === 'growth:appearance:site-name'));
assert.ok(missing.actions.some(action => action.id === 'growth:appearance:favicon-link'));

{
  const manifest = buildSearchAppearancePatchManifest(missing, graph(), { generatedAt: '2026-09-09T18:00:00Z' });
  assert.equal(validateSearchAppearancePatchManifest(manifest).valid, true);
  assert.equal(manifest.summary.total, 2);
  assert.equal(manifest.summary.mappedReview, 2);
  assert.equal(manifest.summary.manualReview, 0);
  for (const operation of manifest.operations) {
    assert.equal(operation.status, 'mapped-review');
    assert.equal(operation.target.path, 'index.html');
    assert.equal(operation.target.beforeSha256, digest('a'));
    assert.match(operation.preconditions.join(' '), new RegExp(baseSha));
    assert.equal(operation.authority, 'proposal-only');
  }
  assert.equal(manifest.guardrails.writesTargetRepository, false);
  assert.equal(manifest.guardrails.noPathGuessing, true);
}

{
  const manifest = buildSearchAppearancePatchManifest(missing, graph({ adapter: 'nextjs' }), { generatedAt: '2026-09-09T18:00:00Z' });
  assert.equal(manifest.summary.mappedReview, 0);
  assert.equal(manifest.summary.manualReview, 2);
  for (const operation of manifest.operations) {
    assert.equal(operation.target.path, null);
    assert.deepEqual(operation.target.buildPath, ['src/app/page.tsx', 'src/app/layout.tsx']);
    assert.match(operation.changeIntent, /Resolve the exact source owner/);
  }
}

{
  const html = page('<script type="application/ld+json">{"broken":</script>');
  const report = inspectSearchAppearance({ html, url: 'https://example.com/' });
  assert.equal(report.checks.find(item => item.id === 'appearance:site-name')?.status, 'not-assessed');
  assert.equal(report.actions.some(item => item.id === 'growth:appearance:site-name'), false,
    'unknown site-name state must not become a patch request merely because JSON-LD syntax is broken');
  const manifest = buildSearchAppearancePatchManifest(report, graph({ adapter: 'nextjs', jsonldOwner: true }), { generatedAt: '2026-09-09T18:00:00Z' });
  const syntax = manifest.operations.find(item => item.kind === 'repair-jsonld-syntax');
  const siteName = manifest.operations.find(item => item.kind === 'reconcile-site-name');
  const favicon = manifest.operations.find(item => item.kind === 'declare-favicon');
  assert.equal(syntax.status, 'mapped-review');
  assert.equal(syntax.target.path, 'src/app/layout.tsx');
  assert.equal(syntax.target.beforeSha256, digest('b'));
  assert.equal(siteName, undefined, 'not-assessed site-name evidence must remain absent from the patch manifest');
  assert.equal(favicon.status, 'manual-review', 'favicon ownership must not be inferred from a Next.js build path');
}

{
  const manifest = buildSearchAppearancePatchManifest(missing, graph({ origin: 'https://owner.github.io', basePath: '/project/' }), { generatedAt: '2026-09-09T18:00:00Z' });
  assert.equal(manifest.summary.blocked, manifest.summary.total);
  assert.ok(manifest.operations.every(item => item.status === 'blocked'));
  assert.ok(manifest.operations.every(item => item.target.path === null && item.target.beforeSha256 === null));
  assert.equal(manifest.guardrails.hostnameRootOnly, true);
}

{
  const cleanHtml = page('<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Example","url":"https://example.com/"}</script><link rel="icon" href="/icon.png" sizes="64x64">');
  const clean = inspectSearchAppearance({ html: cleanHtml, url: 'https://example.com/' });
  assert.equal(clean.actions.length, 0);
  const manifest = buildSearchAppearancePatchManifest(clean, graph(), { generatedAt: '2026-09-09T18:00:00Z' });
  assert.deepEqual(manifest.summary, { total: 0, mappedReview: 0, manualReview: 0, blocked: 0 });
}

{
  const invalid = graph();
  invalid.routes[0].ownerPath = 'missing.html';
  assert.throws(() => buildSearchAppearancePatchManifest(missing, invalid), /Invalid Site State Graph/);
}

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-search-patch-'));
const cli = fileURLToPath(new URL('../bin/arwp-search-appearance-patch.mjs', import.meta.url));
try {
  const audit = path.join(directory, 'appearance.json');
  const state = path.join(directory, 'site-state.json');
  const out = path.join(directory, 'patch.json');
  fs.writeFileSync(audit, JSON.stringify(missing));
  fs.writeFileSync(state, JSON.stringify(graph()));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  const built = run('build', audit, state, `--output=${out}`);
  assert.equal(built.status, 0, built.stderr);
  const manifest = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(manifest.summary.mappedReview, 2);
  assert.equal(run('validate', out).status, 0);
  assert.equal(run('build', audit, state, `--output=${out}`).status, 2, 'existing output must never be overwritten implicitly');
  const text = run('build', audit, state, '--text');
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /proposal-only ownership evidence/i);
  assert.equal(run('--help').status, 0);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}

console.log('PASS Search Appearance findings map to exact source digests only when repository ownership is proven; unknown evidence stays unknown, and ambiguous framework ownership and hostname-scope mismatches fail closed.');
