import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileSiteStateGraph } from '../lib/repository-mapper.mjs';
import {
  prepareMappedTransformationSpec,
  validateMappedTransformationPreparation,
  formatMappedTransformationPreparation
} from '../lib/mapped-transform-preparation.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-map-transform-'));
fs.writeFileSync(path.join(tmp, 'index.html'), '<!doctype html><title>Example</title><link rel="canonical" href="https://example.com/">\n', 'utf8');
fs.writeFileSync(path.join(tmp, 'sitemap.xml'), '<?xml version="1.0"?><urlset></urlset>\n', 'utf8');
fs.writeFileSync(path.join(tmp, 'robots.txt'), 'User-agent: *\nAllow: /\n', 'utf8');

const map = compileSiteStateGraph({
  root: tmp,
  repository: {
    fullName: 'example/site',
    baseRef: 'main',
    baseCommitSha: 'a'.repeat(40)
  },
  site: {
    origin: 'https://example.com',
    basePath: '/'
  },
  adapter: 'static-html',
  generatedAt: '2026-09-07T16:00:00.000Z'
});

function recommendation({ id, target, automationClass }) {
  return {
    id,
    title: id,
    priority: 'P1',
    lane: 'search-foundations',
    state: 'recommended',
    knowledgeState: 'current',
    authority: 'documented-platform',
    reason: 'fixture',
    condition: null,
    sources: ['https://example.org/guidance'],
    change: {
      automationClass,
      targets: [target],
      recipe: ['Apply only the mapped and reviewed change.']
    },
    verification: {
      checks: ['re-run mapped surface validation'],
      successState: 'mapped surface remains valid'
    },
    measurement: {
      signals: [],
      ownerDataRequired: false
    },
    dependencies: [],
    addresses: {
      actionIds: [],
      verticalCheckIds: []
    },
    evidence: []
  };
}

const recommendations = [
  recommendation({ id: 'sitemap-maintenance', target: 'sitemap', automationClass: 'grounded-template' }),
  recommendation({ id: 'crawler-policy', target: 'robots.txt crawler policy', automationClass: 'policy-gated' })
];

const upgrade = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/adaptive-upgrade-graph.schema.json',
  version: '0.1',
  generatedAt: '2026-09-07T16:00:00.000Z',
  site: 'https://example.com/',
  context: {
    verticals: ['general'],
    goals: ['search']
  },
  knowledge: {
    registryVersion: 'fixture',
    ruleset: 'fixture',
    reviewedAt: '2026-09-07',
    current: 2,
    reviewDue: 0
  },
  summary: {
    recommended: 2,
    conditional: 0,
    reviewDue: 0,
    byPriority: { P1: 2 },
    byAutomationClass: { 'grounded-template': 1, 'policy-gated': 1 }
  },
  sourceDebt: {
    actionIds: [],
    verticalCheckIds: []
  },
  recommendations,
  waves: [
    {
      priority: 'P1',
      recommendationIds: recommendations.map(item => item.id)
    }
  ],
  guardrails: {
    noRankingGuarantee: true,
    noInventedFacts: true,
    ownerDataSeparate: true,
    productionMutationAuthorized: false,
    staleKnowledgeNeedsReview: true,
    negativeResultsPreserved: true
  }
};

const prepared = prepareMappedTransformationSpec(upgrade, map, {
  generatedAt: '2026-09-07T16:05:00.000Z'
});
const validation = validateMappedTransformationPreparation(prepared);
assert.equal(validation.valid, true, JSON.stringify(validation.errors));
assert.deepEqual(prepared.specSkeleton.allowedPaths, ['sitemap.xml']);
assert.deepEqual(prepared.specSkeleton.operations, []);
assert.equal(prepared.summary.productionBasePinned, true);
assert.equal(prepared.summary.readyCandidates, 1);
assert.equal(prepared.summary.blockedCandidates, 1);
assert.equal(prepared.summary.allowedPaths, 1);

const sitemapCandidate = prepared.candidates.find(item => item.recommendationId === 'sitemap-maintenance');
assert.equal(sitemapCandidate.state, 'ready');
assert.equal(sitemapCandidate.path, 'sitemap.xml');
assert.equal(sitemapCandidate.currentSha256, map.files.find(file => file.path === 'sitemap.xml').sha256);
assert.equal(sitemapCandidate.requiresGrounding, true);
assert.ok(sitemapCandidate.operationChoices.includes('replace-exact'));
assert.deepEqual(sitemapCandidate.verification, ['re-run mapped surface validation']);

const robotsCandidate = prepared.candidates.find(item => item.recommendationId === 'crawler-policy');
assert.equal(robotsCandidate.state, 'blocked');
assert.equal(robotsCandidate.path, null);
assert.ok(robotsCandidate.blockers.includes('automation-class-not-executable'));
assert.ok(robotsCandidate.blockers.includes('no-safe-resolved-owner'));
assert.equal(prepared.specSkeleton.allowedPaths.includes('robots.txt'), false);

const selected = prepareMappedTransformationSpec(upgrade, map, {
  recommendationIds: ['sitemap-maintenance'],
  generatedAt: '2026-09-07T16:05:00.000Z'
});
assert.equal(selected.candidates.length, 1);
assert.deepEqual(selected.specSkeleton.allowedPaths, ['sitemap.xml']);

assert.throws(
  () => prepareMappedTransformationSpec(upgrade, map, { recommendationIds: ['missing-recommendation'] }),
  /Unknown recommendationId/
);
assert.throws(
  () => prepareMappedTransformationSpec({ ...upgrade, site: 'https://other.example/' }, map),
  /does not match Repository Map site/
);

const text = formatMappedTransformationPreparation(prepared);
assert.match(text, /sitemap-maintenance: ready -> sitemap\.xml/);
assert.match(text, /crawler-policy: blocked/);
assert.match(text, /does not authorize mutation|resolves repository ownership only/i);

fs.rmSync(tmp, { recursive: true, force: true });
console.log('Mapped transformation preparation tests passed');
