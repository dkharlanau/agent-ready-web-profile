import assert from 'node:assert/strict';
import {
  listTransformationPacks,
  loadTransformationPackRegistry,
  prepareTransformationPackOperation,
  validateTransformationPackRegistry
} from '../lib/transformation-pack.mjs';
import { buildTransformationBundle, validateTransformationBundle, sha256 } from '../lib/transformation-engine.mjs';

const baseCommitSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const staticBefore = '<!doctype html><html><head><title>Fixture</title></head><body>OK</body></html>\n';

function siteGraph({ adapter = 'static-html', before = staticBefore, mutationClass = 'mechanical', routeState = 'resolved' } = {}) {
  const resolved = routeState === 'resolved';
  return {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/site-state-graph.schema.json',
    version: '0.1',
    generatedAt: '2026-09-07T17:00:00.000Z',
    repository: { fullName: 'owner/site', baseRef: 'main', baseCommitSha, siteRoot: '.' },
    site: { origin: 'https://site.example', basePath: '/' },
    adapter: {
      id: adapter,
      version: '0.1',
      detection: [adapter === 'jekyll' ? 'explicit-jekyll-fixture' : 'direct-static-html-fixture'],
      confidence: adapter === 'jekyll' ? 'explicit-config' : 'deterministic'
    },
    files: [{ path: 'index.html', sha256: sha256(before), bytes: Buffer.byteLength(before), role: 'page-source', mutationClass, generated: false }],
    routes: [{
      id: 'route:root',
      routePath: '/',
      url: 'https://site.example/',
      state: routeState,
      ownerPath: resolved ? 'index.html' : null,
      candidates: resolved ? [{ path: 'index.html', evidenceClass: 'direct-static-path', confidence: 'deterministic', evidence: ['fixture'] }] : [
        { path: 'index.html', evidenceClass: 'direct-static-path', confidence: 'ambiguous', evidence: ['fixture-ambiguous'] }
      ],
      buildPath: resolved ? ['index.html'] : [],
      evidence: [resolved ? 'direct-static-path:index.html' : 'ambiguous-fixture']
    }],
    ownership: [],
    facts: [],
    warnings: [],
    summary: {
      files: 1,
      routes: 1,
      resolvedRoutes: resolved ? 1 : 0,
      ambiguousRoutes: routeState === 'ambiguous' ? 1 : 0,
      unresolvedRoutes: routeState === 'unresolved' ? 1 : 0,
      ownershipClaims: 0,
      resolvedOwnership: 0,
      ambiguousOwnership: 0,
      unresolvedOwnership: 0,
      facts: 0
    },
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
}

function machineGraph({ adapter = 'jekyll', before = '# fixture\n' } = {}) {
  return {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/site-state-graph.schema.json',
    version: '0.1',
    generatedAt: '2026-09-07T17:00:00.000Z',
    repository: { fullName: 'owner/site', baseRef: 'main', baseCommitSha, siteRoot: '.' },
    site: { origin: 'https://site.example', basePath: '/' },
    adapter: { id: adapter, version: '0.1', detection: ['explicit-jekyll-fixture'], confidence: adapter === 'jekyll' ? 'explicit-config' : 'deterministic' },
    files: [{ path: 'llms.txt', sha256: sha256(before), bytes: Buffer.byteLength(before), role: 'machine-surface', mutationClass: 'grounded-template', generated: false }],
    routes: [],
    ownership: [{
      surfaceKey: 'machine:/llms.txt',
      surfaceType: 'llms',
      routePath: '/llms.txt',
      state: 'resolved',
      ownerPath: 'llms.txt',
      candidates: [{ path: 'llms.txt', evidenceClass: 'machine-file-path', confidence: 'deterministic', evidence: ['machine-file:llms.txt'] }],
      mutationClass: 'grounded-template',
      evidenceClass: 'machine-file-path',
      value: null,
      locator: null,
      evidence: ['machine-file:llms.txt']
    }],
    facts: [],
    warnings: [],
    summary: { files: 1, routes: 0, resolvedRoutes: 0, ambiguousRoutes: 0, unresolvedRoutes: 0, ownershipClaims: 1, resolvedOwnership: 1, ambiguousOwnership: 0, unresolvedOwnership: 0, facts: 0 },
    guardrails: { noPathGuessing: true, ambiguityPreserved: true, generatedOutputNotPreferred: true, ownershipIsNotAuthorization: true, policyAndEditorialRemainGated: true, symlinksNotFollowed: true, noRankingGuarantee: true }
  };
}

function rec(id, automationClass) {
  return {
    id,
    title: id,
    priority: 'P1',
    lane: 'fixture',
    state: 'recommended',
    knowledgeState: 'current',
    authority: 'fixture',
    reason: 'fixture',
    condition: null,
    sources: ['https://example.com/source'],
    change: { automationClass, targets: ['fixture'], recipe: ['fixture'] },
    verification: { checks: ['fixture verification'], successState: 'verified' },
    measurement: { signals: [], ownerDataRequired: false },
    dependencies: [],
    addresses: { actionIds: [], verticalCheckIds: [] },
    evidence: []
  };
}

function upgradeGraph(recommendation) {
  return {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/adaptive-upgrade-graph.schema.json',
    version: '0.1',
    generatedAt: '2026-09-07T17:01:00.000Z',
    site: 'https://site.example/',
    context: { verticals: ['documentation'], goals: ['search'] },
    knowledge: { registryVersion: '0.1', ruleset: 'fixture', reviewedAt: '2026-09-07', current: 1, reviewDue: 0 },
    summary: { recommended: 1, conditional: 0, reviewDue: 0, byPriority: { P1: 1 }, byAutomationClass: { [recommendation.change.automationClass]: 1 } },
    sourceDebt: { actionIds: [], verticalCheckIds: [] },
    recommendations: [recommendation],
    waves: [{ priority: 'P1', recommendationIds: [recommendation.id] }],
    guardrails: { noRankingGuarantee: true, noInventedFacts: true, ownerDataSeparate: true, productionMutationAuthorized: false, staleKnowledgeNeedsReview: true, negativeResultsPreserved: true }
  };
}

const registry = loadTransformationPackRegistry();
assert.equal(validateTransformationPackRegistry(registry).valid, true);
assert.equal(listTransformationPacks({ adapter: 'static-html' }).length, 1);
assert.equal(listTransformationPacks({ adapter: 'jekyll' }).length, 1);

const staticGraph = siteGraph();
const canonical = prepareTransformationPackOperation(staticGraph, {
  packId: 'static-html-core-v0.1',
  recipeId: 'canonical-link',
  recommendationId: 'canonical-discovery',
  routePath: '/',
  beforeContent: staticBefore,
  inputs: { canonicalUrl: 'https://site.example/' }
});
assert.equal(canonical.status, 'ready');
assert.equal(canonical.operationSpec.operation, 'insert-before-exact');
assert.equal(canonical.operationSpec.path, 'index.html');
assert.equal(canonical.boundaries.productionMutationPerformed, false);
const canonicalBundle = buildTransformationBundle(upgradeGraph(rec('canonical-discovery', 'mechanical')), {
  repository: { fullName: 'owner/site', baseRef: 'main', baseCommitSha },
  allowedPaths: ['index.html'],
  operations: [canonical.operationSpec]
}, { generatedAt: '2026-09-07T17:02:00.000Z' });
assert.equal(validateTransformationBundle(canonicalBundle).valid, true, 'prepared canonical operation must compile through the existing Transformation Engine');
assert.match(canonicalBundle.operations[0].after.content, /rel="canonical"/);

const alreadyCanonical = '<!doctype html><html><head><link rel="alternate canonical" href="https://site.example/"><title>Fixture</title></head><body>OK</body></html>\n';
const canonicalNoop = prepareTransformationPackOperation(siteGraph({ before: alreadyCanonical }), {
  packId: 'static-html-core-v0.1', recipeId: 'canonical-link', recommendationId: 'canonical-discovery', routePath: '/', beforeContent: alreadyCanonical, inputs: { canonicalUrl: 'https://site.example/' }
});
assert.equal(canonicalNoop.status, 'no-op');
assert.equal(canonicalNoop.reason, 'already-correct');

const conflictingCanonical = '<!doctype html><html><head><link rel="canonical alternate" href="https://site.example/other"><title>Fixture</title></head><body>OK</body></html>\n';
const conflict = prepareTransformationPackOperation(siteGraph({ before: conflictingCanonical }), {
  packId: 'static-html-core-v0.1', recipeId: 'canonical-link', recommendationId: 'canonical-discovery', routePath: '/', beforeContent: conflictingCanonical, inputs: { canonicalUrl: 'https://site.example/' }
});
assert.equal(conflict.status, 'blocked');
assert.equal(conflict.reason, 'existing-canonical-needs-review');

const drift = prepareTransformationPackOperation(staticGraph, {
  packId: 'static-html-core-v0.1', recipeId: 'canonical-link', recommendationId: 'canonical-discovery', routePath: '/', beforeContent: staticBefore.replace('OK', 'DRIFT'), inputs: { canonicalUrl: 'https://site.example/' }
});
assert.equal(drift.status, 'blocked');
assert.equal(drift.reason, 'source-digest-drift');

const ambiguous = prepareTransformationPackOperation(siteGraph({ routeState: 'ambiguous' }), {
  packId: 'static-html-core-v0.1', recipeId: 'canonical-link', recommendationId: 'canonical-discovery', routePath: '/', beforeContent: staticBefore, inputs: { canonicalUrl: 'https://site.example/' }
});
assert.equal(ambiguous.status, 'blocked');
assert.equal(ambiguous.reason, 'ambiguous-route-ownership');

const editorial = prepareTransformationPackOperation(siteGraph({ mutationClass: 'editorial' }), {
  packId: 'static-html-core-v0.1', recipeId: 'canonical-link', recommendationId: 'canonical-discovery', routePath: '/', beforeContent: staticBefore, inputs: { canonicalUrl: 'https://site.example/' }
});
assert.equal(editorial.status, 'blocked');
assert.equal(editorial.reason, 'mutation-class-not-allowed');

const ungroundedJsonLd = prepareTransformationPackOperation(staticGraph, {
  packId: 'static-html-core-v0.1', recipeId: 'source-backed-jsonld', recommendationId: 'entity-proof', routePath: '/', beforeContent: staticBefore, inputs: { jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', url: 'https://site.example/' } }
});
assert.equal(ungroundedJsonLd.status, 'blocked');
assert.equal(ungroundedJsonLd.reason, 'reviewed-grounding-required');

const jsonld = prepareTransformationPackOperation(staticGraph, {
  packId: 'static-html-core-v0.1',
  recipeId: 'source-backed-jsonld',
  recommendationId: 'entity-proof',
  routePath: '/',
  beforeContent: staticBefore,
  inputs: { jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', url: 'https://site.example/' } },
  reviewedGrounding: true,
  groundedEvidence: ['repo:fixtures/site-identity.json']
});
assert.equal(jsonld.status, 'ready');
const jsonldBundle = buildTransformationBundle(upgradeGraph(rec('entity-proof', 'grounded-template')), {
  repository: { fullName: 'owner/site', baseRef: 'main', baseCommitSha },
  allowedPaths: ['index.html'],
  operations: [jsonld.operationSpec]
}, { generatedAt: '2026-09-07T17:03:00.000Z' });
assert.equal(validateTransformationBundle(jsonldBundle).valid, true);
assert.equal(jsonldBundle.operations[0].humanReviewRequired, true);

const llmsBefore = '# fixture\n';
const jekyllGraph = machineGraph({ before: llmsBefore });
const machine = prepareTransformationPackOperation(jekyllGraph, {
  packId: 'jekyll-core-v0.1',
  recipeId: 'machine-surface-replace',
  recommendationId: 'machine-discovery',
  surfaceKey: 'machine:/llms.txt',
  beforeContent: llmsBefore,
  inputs: { content: '# Fixture\n\nCanonical: https://site.example/\n' },
  reviewedGrounding: true,
  groundedEvidence: ['repo:README.md']
});
assert.equal(machine.status, 'ready');
assert.equal(machine.operationSpec.operation, 'replace-file');
const machineBundle = buildTransformationBundle(upgradeGraph(rec('machine-discovery', 'grounded-template')), {
  repository: { fullName: 'owner/site', baseRef: 'main', baseCommitSha },
  allowedPaths: ['llms.txt'],
  operations: [machine.operationSpec]
}, { generatedAt: '2026-09-07T17:04:00.000Z' });
assert.equal(validateTransformationBundle(machineBundle).valid, true, 'Jekyll machine-surface pack must hand off cleanly to Transformation Engine');

const machineNoop = prepareTransformationPackOperation(jekyllGraph, {
  packId: 'jekyll-core-v0.1', recipeId: 'machine-surface-replace', recommendationId: 'machine-discovery', surfaceKey: 'machine:/llms.txt', beforeContent: llmsBefore, inputs: { content: llmsBefore }, reviewedGrounding: true, groundedEvidence: ['repo:README.md']
});
assert.equal(machineNoop.status, 'no-op');

const wrongAdapter = prepareTransformationPackOperation(jekyllGraph, {
  packId: 'static-html-core-v0.1', recipeId: 'source-backed-jsonld', recommendationId: 'entity-proof', routePath: '/', beforeContent: llmsBefore, inputs: { jsonld: {} }, reviewedGrounding: true, groundedEvidence: ['fixture']
});
assert.equal(wrongAdapter.status, 'blocked');
assert.equal(wrongAdapter.reason, 'adapter-not-supported');

console.log('PASS transformation packs validate exact stack ownership, fail closed on ambiguity/drift/conflicts/gated classes, preserve grounding, no-op deterministically, and hand ready specs to the existing Transformation Engine');
