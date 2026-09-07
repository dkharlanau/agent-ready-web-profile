import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  compileSiteStateGraph,
  validateSiteStateGraph,
  resolveMappedSurface,
  resolveUpgradeOwnership
} from '../lib/repository-mapper.mjs';
import { mergeRepositoryMapIntoBraidGraph, repositoryMapBraidReport } from '../lib/repository-map-braid.mjs';
import { validateBraidGraph } from '../lib/braid-graph.mjs';

function write(root, relative, content) {
  const target = path.join(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function temporaryRepository(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `arwp-${name}-`));
}

const staticRoot = temporaryRepository('static-map');
write(staticRoot, 'docs/index.html', `<!doctype html>
<html><head>
<title>Mapped Home</title>
<meta content="A mapped static page" name="description">
<link href="https://example.test/project/" rel="canonical">
<script type="application/ld+json">{"@context":"https://schema.org"}</script>
</head><body>Home</body></html>`);
write(staticRoot, 'docs/guide/index.html', '<!doctype html><html><head><title>Guide</title></head><body>Guide</body></html>');
write(staticRoot, 'docs/robots.txt', 'User-agent: *\nAllow: /\n');
write(staticRoot, 'docs/sitemap.xml', '<urlset></urlset>');
write(staticRoot, 'docs/llms.txt', '# Example\n');
write(staticRoot, 'docs/_site/index.html', '<title>Generated output must not own the route</title>');
write(staticRoot, 'outside.html', '<title>Outside site root</title>');
let symlinkCreated = false;
try {
  fs.symlinkSync(path.join(staticRoot, 'outside.html'), path.join(staticRoot, 'docs', 'leak.html'));
  symlinkCreated = true;
} catch {
  // Symlink creation can be restricted on some platforms. The mapper remains fail-closed either way.
}

const staticMap = compileSiteStateGraph({
  root: staticRoot,
  siteRoot: 'docs',
  repository: {
    fullName: 'example/static-site',
    baseRef: 'main',
    baseCommitSha: 'a'.repeat(40)
  },
  site: {
    origin: 'https://example.test',
    basePath: '/project/'
  },
  generatedAt: '2026-09-07T12:00:00Z'
});

assert.equal(validateSiteStateGraph(staticMap).valid, true);
assert.equal(staticMap.adapter.id, 'static-html');
assert.equal(staticMap.repository.siteRoot, 'docs');
assert.equal(staticMap.routes.find(route => route.routePath === '/')?.ownerPath, 'docs/index.html');
assert.equal(staticMap.routes.find(route => route.routePath === '/')?.url, 'https://example.test/project/');
assert.equal(staticMap.routes.find(route => route.routePath === '/guide/')?.ownerPath, 'docs/guide/index.html');
assert.ok(!staticMap.files.some(file => file.path.includes('_site/')), 'generated output must not be treated as source ownership');
assert.ok(!staticMap.files.some(file => file.path === 'outside.html'), 'files outside site/build evidence must not be pulled into the map');
assert.ok(staticMap.ownership.some(item => item.surfaceKey === 'metadata:/:canonical' && item.ownerPath === 'docs/index.html'));
assert.ok(staticMap.ownership.some(item => item.surfaceType === 'robots-file' && item.mutationClass === 'policy-gated'));
assert.ok(staticMap.ownership.some(item => item.surfaceType === 'sitemap' && item.ownerPath === 'docs/sitemap.xml'));
if (symlinkCreated) assert.ok(staticMap.warnings.some(item => item.code === 'symlink-skipped' && item.path === 'docs/leak.html'));
assert.ok(staticMap.warnings.some(item => item.code === 'generated-output-skipped'));

const staticCanonical = resolveMappedSurface(staticMap, { routePath: '/', surfaceType: 'canonical' });
assert.equal(staticCanonical.state, 'resolved');
assert.equal(staticCanonical.ownerPath, 'docs/index.html');
const missingSurface = resolveMappedSurface(staticMap, { surfaceKey: 'metadata:/missing/:canonical' });
assert.equal(missingSurface.state, 'unresolved');
assert.equal(missingSurface.ownerPath, null);

const jekyllRoot = temporaryRepository('jekyll-map');
write(jekyllRoot, '_config.yml', 'title: Example\n');
write(jekyllRoot, '_layouts/default.html', `---
---
<html><head>{% include head.html %}</head><body>{{ content }}</body></html>`);
write(jekyllRoot, '_includes/head.html', '<meta charset="utf-8">');
write(jekyllRoot, 'index.md', `---
layout: default
permalink: /
title: Jekyll Home
description: First-party description
canonical: https://example.test/project/
product_name: Signal Test
---
Home`);
write(jekyllRoot, 'about.md', `---
layout: default
permalink: /about/
title: About one
---
About`);
write(jekyllRoot, 'about-copy.md', `---
layout: default
permalink: /about/
title: About two
---
Duplicate route intentionally proves ambiguity`);
write(jekyllRoot, '_posts/2026-09-07-unresolved.md', `---
layout: default
title: Post without explicit permalink
---
Post`);
write(jekyllRoot, 'robots.txt', 'User-agent: *\nAllow: /\n');

const jekyllMap = compileSiteStateGraph({
  root: jekyllRoot,
  repository: {
    fullName: 'example/jekyll-site',
    baseRef: 'main',
    baseCommitSha: 'b'.repeat(40)
  },
  site: {
    origin: 'https://example.test',
    basePath: '/project/'
  },
  generatedAt: '2026-09-07T12:10:00Z'
});

const jekyllValidation = validateSiteStateGraph(jekyllMap);
assert.equal(jekyllValidation.valid, true, JSON.stringify(jekyllValidation.errors));
assert.equal(jekyllMap.adapter.id, 'jekyll');
assert.equal(jekyllMap.routes.find(route => route.routePath === '/')?.ownerPath, 'index.md');
assert.deepEqual(
  jekyllMap.routes.find(route => route.routePath === '/')?.buildPath,
  ['index.md', '_layouts/default.html', '_includes/head.html', '_config.yml']
);
const ambiguousAbout = jekyllMap.routes.find(route => route.routePath === '/about/');
assert.equal(ambiguousAbout?.state, 'ambiguous');
assert.equal(ambiguousAbout?.ownerPath, null);
assert.equal(ambiguousAbout?.candidates.length, 2);
assert.ok(jekyllMap.ownership.some(item => item.surfaceKey === 'route:/about/:document' && item.state === 'ambiguous' && item.ownerPath === null));
assert.ok(jekyllMap.routes.some(route => route.state === 'unresolved' && route.candidates.some(candidate => candidate.path.includes('_posts/'))));
assert.ok(jekyllMap.warnings.some(item => item.code === 'jekyll-route-unresolved'));
assert.ok(jekyllMap.facts.some(fact => fact.key === 'product_name' && fact.value === 'Signal Test' && fact.sourcePath === 'index.md'));
assert.ok(jekyllMap.ownership.some(item => item.surfaceKey === 'metadata:/:canonical' && item.ownerPath === 'index.md'));

const upgrade = {
  site: 'https://example.test/project/',
  recommendations: [
    {
      id: 'canonical-test',
      change: { automationClass: 'grounded-template', targets: ['canonical link'] }
    },
    {
      id: 'title-test',
      change: { automationClass: 'grounded-template', targets: ['page title'] }
    },
    {
      id: 'robots-test',
      change: { automationClass: 'policy-gated', targets: ['robots.txt policy'] }
    },
    {
      id: 'unknown-test',
      change: { automationClass: 'mechanical', targets: ['custom proprietary widget'] }
    }
  ]
};
const hints = resolveUpgradeOwnership(upgrade, jekyllMap);
const canonicalHint = hints.recommendations.find(item => item.recommendationId === 'canonical-test');
assert.equal(canonicalHint.targets[0].state, 'resolved');
assert.equal(canonicalHint.targets[0].ownerPath, 'index.md');
assert.deepEqual(canonicalHint.safeCandidatePaths, ['index.md']);
const titleHint = hints.recommendations.find(item => item.recommendationId === 'title-test');
assert.equal(titleHint.targets[0].state, 'ambiguous');
assert.deepEqual(titleHint.safeCandidatePaths, []);
assert.deepEqual(hints.recommendations.find(item => item.recommendationId === 'robots-test').safeCandidatePaths, []);
assert.equal(hints.recommendations.find(item => item.recommendationId === 'unknown-test').targets[0].state, 'unresolved');
assert.deepEqual(hints.allowedPathHints, ['index.md']);

const baseBraid = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/braid-graph.schema.json',
  version: '0.1',
  generatedAt: '2026-09-07T12:00:00.000Z',
  site: 'https://example.test/project/',
  repository: null,
  inputs: {
    adaptiveUpgrade: {
      kind: 'adaptive-upgrade-graph',
      version: '0.1',
      generatedAt: '2026-09-07T12:00:00.000Z',
      digest: `sha256:${'c'.repeat(64)}`
    }
  },
  nodes: [
    {
      id: 'site:example-project',
      type: 'site',
      versionKey: 'https://example.test/project/',
      state: 'target',
      data: { canonicalUrl: 'https://example.test/project/' },
      provenance: [{ artifact: 'adaptive-upgrade-graph', ref: `sha256:${'c'.repeat(64)}` }]
    }
  ],
  edges: [],
  summary: {
    nodes: 1,
    edges: 0,
    byNodeType: { site: 1 },
    byEdgeType: {},
    reviewDueRules: 0,
    transforms: 0,
    verifiedTransforms: 0,
    measuredTransforms: 0
  },
  guardrails: {
    graphIsIndexNotAuthority: true,
    recommendationIsNotAuthorization: true,
    verificationIsNotOutcome: true,
    measurementIsNotCausality: true,
    historyIsVersioned: true,
    ownerEvidenceMayRemainPrivate: true,
    noRankingGuarantee: true
  }
};
assert.equal(validateBraidGraph(baseBraid).valid, true);
const mappedBraid = mergeRepositoryMapIntoBraidGraph(baseBraid, jekyllMap);
const mappedBraidValidation = validateBraidGraph(mappedBraid);
assert.equal(mappedBraidValidation.valid, true, JSON.stringify(mappedBraidValidation.errors));
assert.equal(mappedBraid.inputs.repositoryMap.kind, 'site-state-graph');
assert.equal(mappedBraid.repository.fullName, 'example/jekyll-site');
const canonicalSurface = mappedBraid.nodes.find(node => node.type === 'surface' && node.data?.surfaceKey === 'metadata:/:canonical');
assert.ok(canonicalSurface);
const canonicalOwner = mappedBraid.nodes.find(node => node.type === 'repo-file' && node.data?.path === 'index.md');
assert.ok(canonicalOwner);
assert.ok(mappedBraid.edges.some(edge => edge.type === 'renders' && edge.from === canonicalOwner.id && edge.to === canonicalSurface.id));
const ambiguousSurface = mappedBraid.nodes.find(node => node.type === 'surface' && node.data?.surfaceKey === 'route:/about/:document');
assert.ok(ambiguousSurface);
assert.equal(ambiguousSurface.data.ownershipState, 'ambiguous');
assert.ok(!mappedBraid.edges.some(edge => edge.type === 'renders' && edge.to === ambiguousSurface.id), 'ambiguous ownership must never create a renders edge');
const braidReport = repositoryMapBraidReport(mappedBraid);
assert.ok(braidReport.resolvedRenderedOwnership > 0);
assert.ok(braidReport.ambiguousOrUnresolvedSurfaces.includes('route:/about/:document'));

const mismatchedBraid = structuredClone(baseBraid);
mismatchedBraid.site = 'https://other.example/';
mismatchedBraid.nodes[0].data.canonicalUrl = 'https://other.example/';
assert.throws(() => mergeRepositoryMapIntoBraidGraph(mismatchedBraid, jekyllMap), /does not match BraidGraph site/);

fs.rmSync(staticRoot, { recursive: true, force: true });
fs.rmSync(jekyllRoot, { recursive: true, force: true });
console.log('Repository Mapper tests passed');
