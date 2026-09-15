import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileSearchArtifact } from '../lib/search-build-gate.mjs';
import { planDeployDiscovery, visibleTextDigest, loadDeployDiscoveryLoopRegistry } from '../lib/deploy-discovery-loop.mjs';

const registry = loadDeployDiscoveryLoopRegistry();
assert.equal(registry.version, '0.1');
assert.equal(registry.reviewedAt, '2026-09-15');
assert.equal(registry.rules.length, 5);
assert.equal(new Set(registry.rules.map(rule => rule.id)).size, 5);

function page(url, title, body, extraHead = '') {
  return `<!doctype html><html><head><title>${title}</title><meta name="description" content="${title} description"><link rel="canonical" href="${url}"><meta property="og:url" content="${url}"><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","url":"${url}"}</script>${extraHead}</head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
}

function artifact(kind) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `arwp-ddl-${kind}-`));
  fs.mkdirSync(path.join(root, 'guide'), { recursive: true });
  fs.mkdirSync(path.join(root, 'old'), { recursive: true });
  fs.mkdirSync(path.join(root, 'new'), { recursive: true });
  if (kind === 'before') {
    fs.writeFileSync(path.join(root, 'index.html'), page('https://example.com/', 'Home', 'Stable home text.'));
    fs.writeFileSync(path.join(root, 'guide', 'index.html'), page('https://example.com/guide/', 'Guide', 'Old guide content.'));
    fs.writeFileSync(path.join(root, 'old', 'index.html'), page('https://example.com/old/', 'Old', 'Old page.'));
    fs.writeFileSync(path.join(root, 'sitemap.xml'), '<urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/guide/</loc></url><url><loc>https://example.com/old/</loc></url></urlset>');
  } else {
    fs.writeFileSync(path.join(root, 'index.html'), page('https://example.com/', 'Home', 'Stable home text.', '<link rel="alternate" type="application/rss+xml" href="/feed.xml">'));
    fs.writeFileSync(path.join(root, 'guide', 'index.html'), page('https://example.com/guide/', 'Guide', 'New guide content with materially changed visible text.'));
    fs.writeFileSync(path.join(root, 'new', 'index.html'), page('https://example.com/new/', 'New', 'New canonical page.'));
    fs.writeFileSync(path.join(root, 'feed.xml'), '<?xml version="1.0"?><rss version="2.0"><channel><title>Example</title></channel></rss>');
    fs.writeFileSync(path.join(root, 'sitemap.xml'), '<urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/guide/</loc></url><url><loc>https://example.com/new/</loc></url></urlset>');
  }
  return root;
}

const before = artifact('before');
const after = artifact('after');
const sha = 'a'.repeat(40);
const afterManifest = compileSearchArtifact({ artifactRoot: after, site: 'https://example.com/', sourceSha: sha });
assert.equal(afterManifest.pass, true, JSON.stringify(afterManifest.failures));
const live = {
  version: '0.1',
  site: 'https://example.com/',
  parityMode: 'search-surface',
  coverage: 'complete-index-cohort',
  expectedPages: 3,
  checkedPages: 3,
  revision: { state: 'pass', message: 'source and deployed revision match', sourceSha: sha, deployedSha: sha },
  pages: afterManifest.pageFindings.map(item => {
    const pageInfo = afterManifest.pages.find(pageItem => pageItem.publicUrl === item.url);
    return { url: item.url, state: 'pass', issues: [], localSha256: pageInfo.sha256, liveSha256: pageInfo.sha256 };
  }),
  pass: true,
  failures: 0,
  watches: 0
};

const report = planDeployDiscovery({
  site: 'https://example.com/',
  beforeArtifactRoot: before,
  afterArtifactRoot: after,
  liveReport: live,
  sourceSha: sha,
  removedStatus: { 'https://example.com/old/': 410 }
});
assert.equal(report.pass, true, JSON.stringify(report.failures));
assert.equal(report.deployment.state, 'pass');
assert.equal(report.changedLiveEvidence.state, 'pass');
assert.deepEqual(report.diff.added.map(item => item.url), ['https://example.com/new/']);
assert.deepEqual(report.diff.updated.map(item => item.url), ['https://example.com/guide/']);
assert.equal(report.diff.updated[0].reason, 'visible-content-updated');
assert.deepEqual(report.diff.artifactOnlyChanged.map(item => item.url), ['https://example.com/']);
assert.deepEqual(report.diff.removed.map(item => [item.url, item.status, item.verifiedGone]), [['https://example.com/old/', 410, true]]);
assert.deepEqual(report.indexNow.readyUrls, ['https://example.com/guide/', 'https://example.com/new/', 'https://example.com/old/']);
assert.deepEqual(report.indexNow.watchUrls, ['https://example.com/']);
assert.equal(report.indexNow.blockedCandidates.length, 0);
assert.equal(report.feed.state, 'pass');
assert.equal(report.feed.feeds[0].url, 'https://example.com/feed.xml');
assert.equal(report.feed.feeds[0].artifactPresent, true);
assert.equal(report.sitemap.state, 'pass');
assert.equal(report.ownerEvidenceQueue.find(item => item.id === 'owner:bing-indexnow-receipt').state, 'action-ready');

const noRemovedEvidence = planDeployDiscovery({
  site: 'https://example.com/',
  beforeArtifactRoot: before,
  afterArtifactRoot: after,
  liveReport: live,
  sourceSha: sha
});
assert.equal(noRemovedEvidence.pass, true, 'unverified removed URL should remain watch, not corrupt the verified release');
assert.equal(noRemovedEvidence.indexNow.readyUrls.includes('https://example.com/old/'), false);
assert.ok(noRemovedEvidence.indexNow.watchUrls.includes('https://example.com/old/'));

const blocked = planDeployDiscovery({
  site: 'https://example.com/',
  beforeArtifactRoot: before,
  afterArtifactRoot: after,
  sourceSha: sha,
  removedStatus: { 'https://example.com/old/': 410 }
});
assert.equal(blocked.pass, false);
assert.equal(blocked.deployment.state, 'watch');
assert.equal(blocked.indexNow.state, 'blocked');
assert.equal(blocked.indexNow.readyUrls.length, 0);
assert.deepEqual(blocked.indexNow.blockedCandidates, ['https://example.com/guide/', 'https://example.com/new/', 'https://example.com/old/']);

const wrongRevision = structuredClone(live);
wrongRevision.revision = { state: 'fail', message: 'source and deployed revision differ', sourceSha: sha, deployedSha: 'b'.repeat(40) };
wrongRevision.pass = false;
const wrong = planDeployDiscovery({
  site: 'https://example.com/',
  beforeArtifactRoot: before,
  afterArtifactRoot: after,
  liveReport: wrongRevision,
  sourceSha: sha
});
assert.equal(wrong.pass, false);
assert.equal(wrong.deployment.state, 'fail');
assert.equal(wrong.indexNow.readyUrls.length, 0);

const staleBodyLive = structuredClone(live);
const staleGuide = staleBodyLive.pages.find(item => item.url === 'https://example.com/guide/');
staleGuide.liveSha256 = 'c'.repeat(64);
const stale = planDeployDiscovery({
  site: 'https://example.com/',
  beforeArtifactRoot: before,
  afterArtifactRoot: after,
  liveReport: staleBodyLive,
  sourceSha: sha,
  removedStatus: { 'https://example.com/old/': 410 }
});
assert.equal(stale.pass, false, 'changed URL byte drift must block a complete discovery pass');
assert.equal(stale.changedLiveEvidence.state, 'fail');
assert.ok(stale.failures.some(item => item.includes('changed-url-live-byte-drift')));
assert.equal(stale.indexNow.readyUrls.includes('https://example.com/guide/'), false, 'stale changed URL must not enter IndexNow-ready handoff');
assert.ok(stale.indexNow.blockedCandidates.includes('https://example.com/guide/'));
assert.ok(stale.indexNow.readyUrls.includes('https://example.com/new/'), 'independently exact-live new URL may remain ready');
assert.ok(stale.indexNow.readyUrls.includes('https://example.com/old/'), 'verified 410 removal may remain ready');
assert.equal(stale.indexNow.state, 'partial');

assert.equal(visibleTextDigest('<html><body><h1>Hello</h1><script>noise()</script><p> world </p></body></html>'), visibleTextDigest('<body><h1>Hello</h1><p>world</p></body>'));

console.log('PASS Deploy Discovery Loop gates URL-level discovery on exact verified deployment evidence, separates visible/Search changes from byte-only rebuild churn, verifies removals, preserves sitemap/feed coverage, and emits provider-native owner follow-ups without claiming indexing or ranking.');
