import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileGithubPagesSearchPack, loadGithubPagesSearchPackRegistry } from '../lib/github-pages-search-pack.mjs';

function write(root, name, content = '') {
  const target = path.join(root, ...name.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}
function html(url, title = 'Example', extra = '') {
  return `<!doctype html><html><head><title>${title}</title><meta name="description" content="Useful"><link rel="canonical" href="${url}"><meta property="og:url" content="${url}">${extra}</head><body><h1>${title}</h1></body></html>`;
}
function projectFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-pages-project-'));
  write(root, 'docs/index.md', '# Project');
  const artifact = path.join(root, '_site');
  write(artifact, 'index.html', html('https://owner.github.io/project/', 'Project', '<link rel="alternate" type="application/rss+xml" href="https://owner.github.io/project/feed.xml">'));
  write(artifact, 'feed.xml', '<rss version="2.0"><channel><title>Project</title></channel></rss>');
  write(artifact, 'sitemap.xml', '<urlset><url><loc>https://owner.github.io/project/</loc></url></urlset>');
  write(artifact, 'robots.txt', 'User-agent: *\nAllow: /\nSitemap: https://owner.github.io/project/sitemap.xml\n');
  return { root, artifact };
}
function compileProject(root, artifact = null, overrides = {}) {
  return compileGithubPagesSearchPack({
    root,
    repositoryFullName: 'owner/project',
    siteUrl: 'https://owner.github.io/project/',
    publishingMode: 'branch',
    pagesSource: 'docs',
    artifactRoot: artifact,
    sourceSha: 'a'.repeat(40),
    ...overrides
  });
}

const registry = loadGithubPagesSearchPackRegistry();
assert.equal(registry.version, '0.1');
assert.equal(registry.rules.length, 7);
assert.equal(new Set(registry.rules.map(item => item.id)).size, 7);

const clean = projectFixture();
const report = compileProject(clean.root, clean.artifact);
assert.equal(report.pass, true, JSON.stringify(report.failures));
assert.equal(report.artifactEvidenceComplete, true);
assert.equal(report.identity.kind, 'github-project-subpath');
assert.equal(report.identity.siteScope, 'subdirectory');
assert.equal(report.publication.jekyllBoundary, 'jekyll-default');
assert.equal(report.platform.preferredSources.state, 'not-applicable');
assert.equal(report.artifact.state, 'pass');

const noArtifact = compileProject(clean.root);
assert.equal(noArtifact.pass, true);
assert.equal(noArtifact.artifactEvidenceComplete, false);
assert.ok(noArtifact.watches.some(item => item.code === 'github-pages-final-artifact-not-provided'));

const wrongPath = compileProject(clean.root, clean.artifact, { siteUrl: 'https://owner.github.io/wrong/' });
assert.equal(wrongPath.pass, false);
assert.ok(wrongPath.failures.some(item => item.code === 'github-pages-site-repo-path-mismatch'));

const feedEscape = projectFixture();
write(feedEscape.artifact, 'index.html', html('https://owner.github.io/project/', 'Project', '<link rel="alternate" type="application/rss+xml" href="/feed.xml">'));
const feedEscapeReport = compileProject(feedEscape.root, feedEscape.artifact);
assert.equal(feedEscapeReport.pass, false);
assert.ok(feedEscapeReport.failures.some(item => item.code === 'github-pages-feed-escapes-project'));

const missingFeed = projectFixture();
fs.unlinkSync(path.join(missingFeed.artifact, 'feed.xml'));
const missingFeedReport = compileProject(missingFeed.root, missingFeed.artifact);
assert.equal(missingFeedReport.pass, false);
assert.ok(missingFeedReport.failures.some(item => item.code === 'github-pages-feed-artifact-missing'));

const robotsEscape = projectFixture();
write(robotsEscape.artifact, 'robots.txt', 'Sitemap: https://owner.github.io/sitemap.xml\n');
const robotsEscapeReport = compileProject(robotsEscape.root, robotsEscape.artifact);
assert.equal(robotsEscapeReport.pass, false);
assert.ok(robotsEscapeReport.failures.some(item => item.code === 'github-pages-robots-sitemap-escapes-project'));

const rootRelative = projectFixture();
write(rootRelative.artifact, 'index.html', html('https://owner.github.io/project/', 'Project', '<link rel="stylesheet" href="/shared.css">'));
const rootRelativeReport = compileProject(rootRelative.root, rootRelative.artifact);
assert.equal(rootRelativeReport.pass, true, 'shared host-root assets are review evidence, not an automatic Search failure');
assert.ok(rootRelativeReport.watches.some(item => item.code === 'github-pages-root-relative-reference-escapes-project'));

const customRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-pages-custom-'));
write(customRoot, 'docs/index.html', '<h1>Custom</h1>');
write(customRoot, 'docs/CNAME', 'www.example.com\n');
const customArtifact = path.join(customRoot, '_site');
write(customArtifact, 'index.html', html('https://www.example.com/', 'Custom'));
write(customArtifact, 'sitemap.xml', '<urlset><url><loc>https://www.example.com/</loc></url></urlset>');
write(customArtifact, 'CNAME', 'www.example.com\n');
const custom = compileGithubPagesSearchPack({ root: customRoot, repositoryFullName: 'owner/project', siteUrl: 'https://www.example.com/', publishingMode: 'branch', pagesSource: 'docs', artifactRoot: customArtifact, sourceSha: 'b'.repeat(40) });
assert.equal(custom.pass, true, JSON.stringify(custom.failures));
assert.equal(custom.identity.kind, 'custom-domain-root');
assert.equal(custom.identity.siteScope, 'hostname-root');
assert.equal(custom.platform.preferredSources.state, 'pass');

const cnameMismatchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-pages-cname-'));
write(cnameMismatchRoot, 'docs/index.html', '<h1>Custom</h1>');
write(cnameMismatchRoot, 'docs/CNAME', 'other.example.com\n');
const cnameMismatch = compileGithubPagesSearchPack({ root: cnameMismatchRoot, repositoryFullName: 'owner/project', siteUrl: 'https://www.example.com/', publishingMode: 'branch', pagesSource: 'docs' });
assert.equal(cnameMismatch.pass, false);
assert.ok(cnameMismatch.failures.some(item => item.code === 'github-pages-cname-host-mismatch'));

const customSubpath = compileGithubPagesSearchPack({ root: cnameMismatchRoot, repositoryFullName: 'owner/project', siteUrl: 'https://www.example.com/project/', publishingMode: 'branch', pagesSource: 'docs' });
assert.equal(customSubpath.pass, false);
assert.ok(customSubpath.failures.some(item => item.code === 'github-pages-custom-domain-subpath'));

const hostRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-pages-host-'));
write(hostRoot, 'index.html', '<h1>Owner site</h1>');
const hostReport = compileGithubPagesSearchPack({ root: hostRoot, repositoryFullName: 'owner/owner.github.io', siteUrl: 'https://owner.github.io/', publishingMode: 'branch', pagesSource: '.' });
assert.equal(hostReport.pass, true);
assert.equal(hostReport.identity.kind, 'github-host-root');
assert.equal(hostReport.platform.preferredSources.state, 'pass');

const actionsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-pages-actions-'));
write(actionsRoot, 'site/index.html', '<h1>Site</h1>');
write(actionsRoot, '.github/workflows/pages.yml', `name: Pages\npermissions:\n  pages: write\njobs:\n  deploy:\n    steps:\n      - uses: actions/upload-pages-artifact@v4\n      - uses: actions/deploy-pages@v4\n`);
const actionsArtifact = path.join(actionsRoot, 'artifact');
write(actionsArtifact, 'index.html', html('https://owner.github.io/project/', 'Project'));
write(actionsArtifact, 'sitemap.xml', '<urlset><url><loc>https://owner.github.io/project/</loc></url></urlset>');
const actions = compileGithubPagesSearchPack({ root: actionsRoot, repositoryFullName: 'owner/project', siteUrl: 'https://owner.github.io/project/', publishingMode: 'github-actions', pagesSource: 'site', artifactRoot: actionsArtifact });
assert.equal(actions.pass, true, JSON.stringify(actions.failures));
assert.equal(actions.publication.pagesWorkflowFiles.length, 1);

const unknownMode = compileGithubPagesSearchPack({ root: actionsRoot, repositoryFullName: 'owner/project', siteUrl: 'https://owner.github.io/project/', publishingMode: 'unknown', pagesSource: 'site' });
assert.equal(unknownMode.pass, true);
assert.equal(unknownMode.artifactEvidenceComplete, false);
assert.ok(unknownMode.watches.some(item => item.code === 'github-pages-publication-mode-unknown'));

const badSource = compileGithubPagesSearchPack({ root: actionsRoot, repositoryFullName: 'owner/project', siteUrl: 'https://owner.github.io/project/', publishingMode: 'branch', pagesSource: 'site' });
assert.equal(badSource.pass, false);
assert.ok(badSource.failures.some(item => item.code === 'github-pages-branch-source-invalid'));

const httpSite = compileGithubPagesSearchPack({ root: hostRoot, repositoryFullName: 'owner/owner.github.io', siteUrl: 'http://owner.github.io/', publishingMode: 'branch', pagesSource: '.' });
assert.equal(httpSite.pass, false);
assert.ok(httpSite.failures.some(item => item.code === 'github-pages-non-https-public-root'));

console.log('PASS GitHub Pages Search Pack separates host identity, publication source, CNAME intent, project-subpath Search signals and final artifact evidence without treating optional Preferred Sources or source files as deployment proof.');
