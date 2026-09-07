import assert from 'node:assert/strict';
import {
  summarizeTransformationPackCoverage,
  validateTransformationPackCoverageManifest
} from '../lib/transformation-pack-coverage.mjs';

const manifest = {
  version: '0.1',
  observedAt: '2026-09-07T19:30:00Z',
  portfolioId: 'owned-sites-example',
  observations: [
    {
      siteId: 'site-a',
      adapter: 'static-html',
      result: { packId: 'static-html-core-v0.1', recipeId: 'canonical-link', status: 'ready', path: 'index.html' }
    },
    {
      siteId: 'site-a',
      adapter: 'static-html',
      result: { packId: 'static-html-core-v0.1', recipeId: 'machine-surface-replace', status: 'no-op', reason: 'already-correct', path: 'sitemap.xml' }
    },
    {
      siteId: 'site-b',
      adapter: 'nextjs',
      result: { packId: 'nextjs-app-router-v0.1', recipeId: 'machine-surface-replace', status: 'blocked', reason: 'mutation-class-not-allowed' }
    },
    {
      siteId: 'site-b',
      adapter: 'nextjs',
      result: { packId: 'nextjs-app-router-v0.1', recipeId: 'machine-surface-replace', status: 'ready', path: 'src/app/sitemap.ts' }
    },
    {
      siteId: 'site-c',
      adapter: 'astro',
      result: { packId: 'astro-core-v0.1', recipeId: 'canonical-link', status: 'blocked', reason: 'unresolved-route-ownership' }
    },
    {
      siteId: 'site-d',
      adapter: 'docusaurus',
      result: { packId: 'unknown', recipeId: 'unknown', status: 'blocked', reason: 'adapter-not-supported' }
    }
  ]
};

assert.deepEqual(validateTransformationPackCoverageManifest(manifest), { valid: true, errors: [] });
const report = summarizeTransformationPackCoverage(manifest);
assert.deepEqual(report.totals, {
  observations: 6,
  ready: 2,
  noOp: 1,
  blocked: 3,
  covered: 3,
  coverageRate: 0.5
});
assert.equal(report.bySite.find(item => item.id === 'site-a').coverageRate, 1);
assert.equal(report.bySite.find(item => item.id === 'site-b').coverageRate, 0.5);
assert.deepEqual(report.blockerClasses.map(item => [item.class, item.count]), [
  ['ownership', 1],
  ['review-boundary', 1],
  ['unsupported-coverage', 1]
]);
assert.equal(report.boundaries.coveragePredictsRankingOrCitation, false);
assert.equal(report.boundaries.coverageAuthorizesProductionMutation, false);

const invalid = structuredClone(manifest);
invalid.observations[0].result.status = 'success';
assert.equal(validateTransformationPackCoverageManifest(invalid).valid, false);
assert.throws(() => summarizeTransformationPackCoverage(invalid), /ready, no-op or blocked/);

console.log('transformation-pack-coverage-test: ok');
