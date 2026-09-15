import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileSearchArtifact, loadSearchBuildGateRegistry, verifySearchArtifactLive } from '../lib/search-build-gate.mjs';

const registry = loadSearchBuildGateRegistry();
assert.equal(registry.version, '0.1');
assert.equal(registry.reviewedAt, '2026-09-15');
assert.equal(registry.guardrails.noRankingClaim, true);
assert.equal(registry.guardrails.noBuildExecution, true);
assert.equal(registry.rules.length, 6);
assert.equal(new Set(registry.rules.map(rule => rule.id)).size, 6);
for (const rule of registry.rules) {
  assert.match(rule.id, /^SBG-\d{2}-/);
  assert.ok(['P0', 'P1'].includes(rule.priority));
  assert.ok(rule.sources.every(source => registry.sources[source]), `${rule.id} has unknown source`);
}

function page(url, title = 'Example', extra = '') {
  return `<!doctype html><html><head><title>${title}</title><meta name="description" content="Useful description"><link rel="canonical" href="${url}"><meta property="og:url" content="${url}"><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","url":"${url}"}</script>${extra}</head><body><h1>${title}</h1></body></html>`;
}
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-search-build-'));
  fs.mkdirSync(path.join(root, 'guide'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), page('https://example.com/'));
  fs.writeFileSync(path.join(root, 'guide', 'index.html'), page('https://example.com/guide/', 'Guide'));
  fs.writeFileSync(path.join(root, '404.html'), '<!doctype html><html><head><title>Not found</title><meta name="robots" content="noindex"></head><body>404</body></html>');
  fs.writeFileSync(path.join(root, 'demo.html'), '<!doctype html><html><head><title>Demo only</title></head><body>Not in sitemap.</body></html>');
  fs.writeFileSync(path.join(root, 'sitemap.xml'), '<urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/guide/</loc></url></urlset>');
  return root;
}

const root = fixture();
const sourceSha = 'a'.repeat(40);
const manifest = compileSearchArtifact({ artifactRoot: root, site: 'https://example.com/', sourceSha });
assert.equal(manifest.pass, true, JSON.stringify(manifest.failures));
assert.equal(manifest.coverage, 'sitemap-cohort');
assert.equal(manifest.inventory.indexCohort, 2);
assert.equal(manifest.inventory.errorPages, 1);
assert.equal(manifest.watches.length, 0);
assert.equal(manifest.pages.some(item => item.file === 'demo.html'), true, 'non-sitemap HTML remains inventoried');
assert.equal(manifest.pageFindings.some(item => item.url.endsWith('/demo.html')), false, 'non-sitemap demo page must not become an index-candidate defect');

const bodies = new Map([
  ['https://example.com/', page('https://example.com/')],
  ['https://example.com/guide/', page('https://example.com/guide/', 'Guide')]
]);
const fetchImpl = async input => {
  const url = String(input);
  const body = bodies.get(url);
  return new Response(body || 'missing', { status: body ? 200 : 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
};
const resolveImpl = async () => [{ address: '93.184.216.34', family: 4 }];
const live = await verifySearchArtifactLive(manifest, { deployedSha: sourceSha, fetchImpl, resolveImpl });
assert.equal(live.pass, true, JSON.stringify(live));
assert.equal(live.coverage, 'complete-index-cohort');
assert.equal(live.revision.state, 'pass');
assert.ok(live.pages.every(item => item.state === 'pass'));

const driftBodies = new Map(bodies);
driftBodies.set('https://example.com/guide/', page('https://example.com/guide/', 'Old deployed title'));
const drift = await verifySearchArtifactLive(manifest, {
  deployedSha: sourceSha,
  resolveImpl,
  fetchImpl: async input => new Response(driftBodies.get(String(input)), { status: 200, headers: { 'content-type': 'text/html' } })
});
assert.equal(drift.pass, false);
assert.ok(drift.pages.find(item => item.url.endsWith('/guide/')).issues.includes('search-surface-drift'));

const revisionDrift = await verifySearchArtifactLive(manifest, { deployedSha: 'b'.repeat(40), fetchImpl, resolveImpl });
assert.equal(revisionDrift.pass, false);
assert.equal(revisionDrift.revision.state, 'fail');

const bounded = await verifySearchArtifactLive(manifest, { deployedSha: sourceSha, fetchImpl, resolveImpl, maxLivePages: 1 });
assert.equal(bounded.coverage, 'bounded-index-cohort');
assert.equal(bounded.pass, false, 'bounded live cohort must not become a full pass');

const nextRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-next-export-'));
fs.writeFileSync(path.join(nextRoot, 'index.html'), page('https://next.example/'));
fs.writeFileSync(path.join(nextRoot, 'about.html'), page('https://next.example/about', 'About'));
fs.writeFileSync(path.join(nextRoot, 'sitemap.xml'), '<urlset><url><loc>https://next.example/</loc></url><url><loc>https://next.example/about</loc></url></urlset>');
const nextManifest = compileSearchArtifact({ artifactRoot: nextRoot, site: 'https://next.example/' });
assert.equal(nextManifest.pass, true, JSON.stringify(nextManifest.failures));
assert.equal(nextManifest.pageFindings.some(item => item.url === 'https://next.example/about'), true, 'canonical identity must support Next.js-style extensionless static-export routes');

const badRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-search-build-bad-'));
fs.writeFileSync(path.join(badRoot, 'index.html'), page('https://wrong.example/'));
fs.writeFileSync(path.join(badRoot, 'sitemap.xml'), '<urlset><url><loc>https://example.com/</loc></url></urlset>');
const bad = compileSearchArtifact({ artifactRoot: badRoot, site: 'https://example.com/' });
assert.equal(bad.pass, false);
assert.ok(bad.failures.some(item => item.startsWith('sitemap-url-missing-artifact:')));

const noIndexRoot = fixture();
fs.writeFileSync(path.join(noIndexRoot, 'guide', 'index.html'), page('https://example.com/guide/', 'Guide', '<meta name="robots" content="noindex">'));
const noIndex = compileSearchArtifact({ artifactRoot: noIndexRoot, site: 'https://example.com/' });
assert.equal(noIndex.pass, false);
assert.ok(noIndex.failures.some(item => item.includes('unexpected-noindex')));

const errorCanonicalRoot = fixture();
fs.writeFileSync(path.join(errorCanonicalRoot, '404.html'), page('https://example.com/404.html', 'Not found', '<meta name="robots" content="noindex">'));
const errorCanonical = compileSearchArtifact({ artifactRoot: errorCanonicalRoot, site: 'https://example.com/' });
assert.equal(errorCanonical.pass, false);
assert.ok(errorCanonical.failures.some(item => item.includes('error-page-canonical-present')));

console.log('PASS Production Search Build Gate keeps final artifact, sitemap index cohort, live Search-surface parity and explicit revision evidence separate while supporting GitHub Pages and Next.js-style static exports.');
