import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  evaluateSearchPlatformEligibility,
  loadSearchPlatformEligibilityRegistry
} from '../lib/search-platform-eligibility.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = loadSearchPlatformEligibilityRegistry();

assert.equal(registry.version, '0.1');
assert.equal(registry.reviewedAt, '2026-09-15');
assert.deepEqual(registry.states, ['pass', 'fail', 'watch', 'not-applicable']);
assert.equal(registry.guardrails.noRankingPromise, true);
assert.equal(registry.guardrails.noIndexingPromise, true);
assert.equal(registry.guardrails.providerScopeMustBeExplicitWhenAmbiguous, true);
assert.equal(registry.guardrails.finalArtifactOutranksSourceDeclaration, true);
assert.equal(registry.guardrails.unsupportedPlatformFeaturesFailClosed, true);
assert.equal(registry.rules.length, 6);
assert.equal(new Set(registry.rules.map(rule => rule.id)).size, registry.rules.length);
for (const rule of registry.rules) {
  assert.match(rule.id, /^SPE-\d{2}-[a-z0-9-]+$/);
  assert.ok(['P0', 'P1', 'P2'].includes(rule.priority));
  assert.ok(Array.isArray(rule.appliesTo) && rule.appliesTo.length > 0);
  assert.ok(rule.claim.length > 30);
  assert.ok(rule.decision.length > 30);
  assert.ok(registry.sources[rule.source], `${rule.id} references missing source ${rule.source}`);
}
for (const source of Object.values(registry.sources)) assert.match(source, /^https:\/\//);

function byId(report, id) {
  const item = report.findings.find(finding => finding.id === id);
  assert.ok(item, `missing finding ${id}`);
  return item;
}

const rootSite = evaluateSearchPlatformEligibility({
  site: 'https://example.com/',
  siteScope: 'hostname-root',
  stack: 'static',
  structuredDataTypes: ['Article']
});
assert.equal(byId(rootSite, 'SPE-01-preferred-sources-scope').state, 'pass');
assert.equal(byId(rootSite, 'SPE-02-google-indexing-api-scope').state, 'not-applicable');
assert.equal(byId(rootSite, 'SPE-03-nextjs-metadata-base').state, 'not-applicable');
assert.equal(rootSite.summary.fail, 0);
assert.match(rootSite.note, /does not prove indexing, ranking, citation/i);

const jobSite = evaluateSearchPlatformEligibility({
  site: 'https://jobs.example.com/',
  siteScope: 'hostname-root',
  structuredDataTypes: ['JobPosting']
});
assert.equal(byId(jobSite, 'SPE-02-google-indexing-api-scope').state, 'pass');
assert.match(byId(jobSite, 'SPE-02-google-indexing-api-scope').message, /does not prove indexing/i);

const livestreamSite = evaluateSearchPlatformEligibility({
  site: 'https://live.example.com/',
  siteScope: 'hostname-root',
  structuredDataTypes: ['VideoObject', 'BroadcastEvent']
});
assert.equal(byId(livestreamSite, 'SPE-02-google-indexing-api-scope').state, 'pass');

const incompleteLivestream = evaluateSearchPlatformEligibility({
  site: 'https://live.example.com/',
  siteScope: 'hostname-root',
  structuredDataTypes: ['BroadcastEvent']
});
assert.equal(byId(incompleteLivestream, 'SPE-02-google-indexing-api-scope').state, 'not-applicable');

const githubProject = evaluateSearchPlatformEligibility({
  site: 'https://owner.github.io/project/',
  siteScope: 'subdirectory',
  stack: 'nextjs',
  nextjs: {
    metadataBase: 'https://owner.github.io/project/',
    basePath: '/project',
    staticExport: true,
    unsupportedFeatures: []
  },
  publishing: {
    mode: 'github-actions',
    finalArtifactVerified: true,
    cnameObserved: false
  }
});
assert.equal(githubProject.provider, 'github-pages');
assert.equal(byId(githubProject, 'SPE-01-preferred-sources-scope').state, 'not-applicable');
assert.equal(byId(githubProject, 'SPE-03-nextjs-metadata-base').state, 'pass');
assert.equal(byId(githubProject, 'SPE-04-nextjs-subpath-basepath').state, 'pass');
assert.equal(byId(githubProject, 'SPE-05-nextjs-static-export-compatibility').state, 'pass');
assert.equal(byId(githubProject, 'SPE-06-github-pages-publication-boundary').state, 'pass');
assert.equal(githubProject.summary.fail, 0);

const wrongMetadataBase = evaluateSearchPlatformEligibility({
  site: 'https://owner.github.io/project/',
  siteScope: 'subdirectory',
  stack: 'nextjs',
  nextjs: { metadataBase: 'https://owner.github.io/', basePath: '/project' }
});
assert.equal(byId(wrongMetadataBase, 'SPE-03-nextjs-metadata-base').state, 'fail');

const wrongBasePath = evaluateSearchPlatformEligibility({
  site: 'https://owner.github.io/project/',
  siteScope: 'subdirectory',
  stack: 'nextjs',
  nextjs: { metadataBase: 'https://owner.github.io/project/', basePath: '' }
});
assert.equal(byId(wrongBasePath, 'SPE-04-nextjs-subpath-basepath').state, 'fail');

const rootWithUnexpectedBasePath = evaluateSearchPlatformEligibility({
  site: 'https://app.example.com/',
  siteScope: 'hostname-root',
  stack: 'nextjs',
  nextjs: { metadataBase: 'https://app.example.com/', basePath: '/unexpected' }
});
assert.equal(byId(rootWithUnexpectedBasePath, 'SPE-04-nextjs-subpath-basepath').state, 'fail');

const incompatibleExport = evaluateSearchPlatformEligibility({
  site: 'https://static.example.com/',
  siteScope: 'hostname-root',
  stack: 'nextjs',
  nextjs: {
    metadataBase: 'https://static.example.com/',
    basePath: '',
    staticExport: true,
    unsupportedFeatures: ['rewrites', 'server-actions']
  }
});
assert.equal(byId(incompatibleExport, 'SPE-05-nextjs-static-export-compatibility').state, 'fail');
assert.match(byId(incompatibleExport, 'SPE-05-nextjs-static-export-compatibility').message, /rewrites, server-actions/);

const incompleteExportInventory = evaluateSearchPlatformEligibility({
  site: 'https://static.example.com/',
  siteScope: 'hostname-root',
  stack: 'nextjs',
  nextjs: { metadataBase: 'https://static.example.com/', basePath: '', staticExport: true }
});
assert.equal(byId(incompleteExportInventory, 'SPE-05-nextjs-static-export-compatibility').state, 'watch');

const failedPagesArtifact = evaluateSearchPlatformEligibility({
  site: 'https://owner.github.io/',
  siteScope: 'hostname-root',
  provider: 'github-pages',
  stack: 'static',
  publishing: { mode: 'github-actions', finalArtifactVerified: false, cnameObserved: true }
});
assert.equal(byId(failedPagesArtifact, 'SPE-06-github-pages-publication-boundary').state, 'fail');

const cnameOnly = evaluateSearchPlatformEligibility({
  site: 'https://owner.github.io/',
  siteScope: 'hostname-root',
  provider: 'github-pages',
  stack: 'static',
  publishing: { mode: 'github-actions', cnameObserved: true }
});
assert.equal(byId(cnameOnly, 'SPE-06-github-pages-publication-boundary').state, 'watch');
assert.match(byId(cnameOnly, 'SPE-06-github-pages-publication-boundary').message, /CNAME file.*not proof/i);

const unknownScope = evaluateSearchPlatformEligibility({ site: 'https://example.com/docs/' });
assert.equal(byId(unknownScope, 'SPE-01-preferred-sources-scope').state, 'watch');
assert.equal(byId(unknownScope, 'SPE-04-nextjs-subpath-basepath').state, 'not-applicable');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-search-platform-'));
try {
  const goodPath = path.join(tmp, 'good.json');
  fs.writeFileSync(goodPath, JSON.stringify({
    site: 'https://owner.github.io/project/',
    siteScope: 'subdirectory',
    stack: 'nextjs',
    nextjs: {
      metadataBase: 'https://owner.github.io/project/',
      basePath: '/project',
      staticExport: true,
      unsupportedFeatures: []
    },
    publishing: { mode: 'github-actions', finalArtifactVerified: true }
  }));
  const good = spawnSync(process.execPath, ['bin/arwp-search-platform.mjs', 'check', goodPath, '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(good.status, 0, good.stderr);
  const goodReport = JSON.parse(good.stdout);
  assert.equal(goodReport.summary.fail, 0);

  const badPath = path.join(tmp, 'bad.json');
  fs.writeFileSync(badPath, JSON.stringify({
    site: 'https://owner.github.io/project/',
    siteScope: 'subdirectory',
    stack: 'nextjs',
    nextjs: { metadataBase: 'https://owner.github.io/', basePath: '' }
  }));
  const bad = spawnSync(process.execPath, ['bin/arwp-search-platform.mjs', 'check', badPath, '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(bad.status, 1, bad.stderr);
  const badReport = JSON.parse(bad.stdout);
  assert.ok(badReport.summary.fail >= 2);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('PASS Search Platform Eligibility rejects inapplicable Preferred Sources/Indexing API tactics and validates bounded GitHub Pages + Next.js deployment contracts without claiming Search outcomes.');
