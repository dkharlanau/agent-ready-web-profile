import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildTransformationBundle,
  validateTransformationBundle,
  simulateTransformationBundle,
  applyTransformationToDirectory,
  rollbackTransformationReceipt,
  openTransformationPr,
  LOCAL_TRANSFORM_AUTHORIZATION,
  TRANSFORMATION_PR_AUTHORIZATION
} from '../lib/transformation-engine.mjs';

function rec({ id, automationClass, state = 'recommended', knowledgeState = 'current', dependencies = [] }) {
  return {
    id,
    title: id,
    priority: 'P1',
    lane: 'test',
    state,
    knowledgeState,
    authority: 'fixture',
    reason: 'fixture',
    condition: null,
    sources: ['https://example.com/source'],
    change: { automationClass, targets: ['fixture'], recipe: ['fixture change'] },
    verification: { checks: ['fixture verification'], successState: 'fixture verified' },
    measurement: { signals: [], ownerDataRequired: false },
    dependencies,
    addresses: { actionIds: [], verticalCheckIds: [] },
    evidence: []
  };
}

const graph = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/adaptive-upgrade-graph.schema.json',
  version: '0.1',
  generatedAt: '2026-09-07T10:00:00.000Z',
  site: 'https://site.example/',
  context: { verticals: ['documentation'], goals: ['search', 'ai-citations'] },
  knowledge: { registryVersion: '0.1', ruleset: 'fixture', reviewedAt: '2026-09-07', current: 3, reviewDue: 1 },
  summary: { recommended: 3, conditional: 1, reviewDue: 1, byPriority: { P1: 4 }, byAutomationClass: { mechanical: 1, 'grounded-template': 1, 'policy-gated': 1, editorial: 1 } },
  sourceDebt: { actionIds: [], verticalCheckIds: [] },
  recommendations: [
    rec({ id: 'change-evidence-loop', automationClass: 'mechanical' }),
    rec({ id: 'entity-proof-graph', automationClass: 'grounded-template', dependencies: ['change-evidence-loop'] }),
    rec({ id: 'chatgpt-search-policy', automationClass: 'policy-gated' }),
    rec({ id: 'citation-ready-content', automationClass: 'editorial', state: 'conditional', knowledgeState: 'review-due' })
  ],
  waves: [{ priority: 'P1', recommendationIds: ['change-evidence-loop', 'entity-proof-graph', 'chatgpt-search-policy'] }],
  guardrails: { noRankingGuarantee: true, noInventedFacts: true, ownerDataSeparate: true, productionMutationAuthorized: false, staleKnowledgeNeedsReview: true, negativeResultsPreserved: true }
};

const beforeHtml = '<!doctype html><html><head><title>Example</title></head><body>OK</body></html>\n';
const spec = {
  repository: { fullName: 'owner/site', baseRef: 'main', baseCommitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  allowedPaths: ['.arwp/change-evidence.json', 'index.html'],
  operations: [
    {
      recommendationId: 'change-evidence-loop',
      operation: 'create-file',
      path: '.arwp/change-evidence.json',
      content: '{"source":"arwp"}\n',
      verification: ['JSON parses']
    },
    {
      recommendationId: 'entity-proof-graph',
      operation: 'replace-exact',
      path: 'index.html',
      beforeContent: beforeHtml,
      match: '<title>Example</title>',
      replacement: '<title>Example</title><meta name="author" content="Verified Fixture">',
      reviewedGrounding: true,
      groundedEvidence: ['repo:fixtures/verified-author.json'],
      verification: ['rendered author fact matches the grounded fixture']
    }
  ]
};

const bundle = buildTransformationBundle(graph, spec, { generatedAt: '2026-09-07T10:10:00.000Z' });
assert.equal(validateTransformationBundle(bundle).valid, true);
assert.equal(bundle.summary.operations, 2);
assert.equal(bundle.operations[0].recommendationId, 'change-evidence-loop', 'dependency ordering should keep mechanical evidence before dependent identity work');
assert.equal(bundle.operations[1].recommendationId, 'entity-proof-graph');
assert.equal(bundle.operations[1].humanReviewRequired, true);
assert.ok(bundle.gatedRecommendations.some(item => item.recommendationId === 'chatgpt-search-policy' && /policy-gated/.test(item.reason)));
assert.ok(bundle.gatedRecommendations.some(item => item.recommendationId === 'citation-ready-content' && /conditional/.test(item.reason)));

const simulation = simulateTransformationBundle(bundle);
assert.equal(simulation.interpretation.productionFilesWouldChange, true);
assert.equal(simulation.interpretation.rankingOrCitationUpliftPredicted, false);

assert.throws(() => buildTransformationBundle(graph, { ...spec, allowedPaths: [] }), /explicit allowedPaths/i);
assert.throws(() => buildTransformationBundle(graph, {
  ...spec,
  allowedPaths: ['index.html'],
  operations: [{ recommendationId: 'entity-proof-graph', operation: 'replace-file', path: 'index.html', beforeContent: beforeHtml, content: '<html></html>\n' }]
}), /reviewedGrounding=true/);
assert.throws(() => buildTransformationBundle(graph, {
  ...spec,
  allowedPaths: ['robots.txt'],
  operations: [{ recommendationId: 'chatgpt-search-policy', operation: 'create-file', path: 'robots.txt', content: 'User-agent: *\nAllow: /\n' }]
}), /non-executable automation class policy-gated/);
assert.throws(() => buildTransformationBundle(graph, {
  ...spec,
  allowedPaths: ['.github/workflows/deploy.yml'],
  operations: [{ recommendationId: 'change-evidence-loop', operation: 'create-file', path: '.github/workflows/deploy.yml', content: 'name: unsafe\n' }]
}), /blocked by policy/);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-transform-'));
fs.writeFileSync(path.join(tmp, 'index.html'), beforeHtml, 'utf8');
assert.throws(() => applyTransformationToDirectory(bundle, { rootDir: tmp }), /Explicit authorization required/);
const receipt = applyTransformationToDirectory(bundle, { rootDir: tmp, authorization: LOCAL_TRANSFORM_AUTHORIZATION, appliedAt: '2026-09-07T10:11:00.000Z' });
assert.match(fs.readFileSync(path.join(tmp, 'index.html'), 'utf8'), /Verified Fixture/);
assert.equal(fs.existsSync(path.join(tmp, '.arwp/change-evidence.json')), true);
assert.equal(receipt.changes.length, 2);
rollbackTransformationReceipt(receipt, { rootDir: tmp, authorization: LOCAL_TRANSFORM_AUTHORIZATION, rolledBackAt: '2026-09-07T10:12:00.000Z' });
assert.equal(fs.readFileSync(path.join(tmp, 'index.html'), 'utf8'), beforeHtml);
assert.equal(fs.existsSync(path.join(tmp, '.arwp/change-evidence.json')), false);

const driftDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-transform-drift-'));
fs.writeFileSync(path.join(driftDir, 'index.html'), beforeHtml.replace('OK', 'DRIFT'), 'utf8');
assert.throws(() => applyTransformationToDirectory(bundle, { rootDir: driftDir, authorization: LOCAL_TRANSFORM_AUTHORIZATION }), /Precondition digest mismatch/);

await assert.rejects(() => openTransformationPr(bundle, { token: 'fixture' }), /Explicit authorization required/);
await assert.rejects(() => openTransformationPr(bundle, { authorization: TRANSFORMATION_PR_AUTHORIZATION }), /GITHUB_TOKEN is required/);

console.log('PASS transformation engine compiles only explicit grounded/mechanical operations, blocks policy/workflow paths, enforces digests, supports local rollback, and keeps GitHub delivery authorization-gated');
