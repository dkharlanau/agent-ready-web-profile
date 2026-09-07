import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { analyzePageGraphPages, buildSiteImprovementPlanFromEvidence } from '../lib/site-improvement.mjs';
import { analyzeContentDifferentiationPages } from '../lib/content-differentiation.mjs';
import { analyzeAgentAccessibilityPages } from '../lib/agent-accessibility.mjs';
import { mergeSearchSurfacePlan } from '../lib/site-improvement-deep.mjs';

const pages = [
  {
    url: 'https://example.com/',
    html: '<!doctype html><html lang="en"><head><title>Example</title><link rel="canonical" href="https://example.com/"></head><body><h1>Example</h1><a href="/guide/">Learn more</a></body></html>'
  },
  {
    url: 'https://example.com/guide/',
    html: '<!doctype html><html><head><title>Shared title</title></head><body><p>Guide body</p></body></html>'
  },
  {
    url: 'https://example.com/orphan/',
    html: '<!doctype html><html lang="en"><head><title>Shared title</title><link rel="canonical" href="https://example.com/orphan/"></head><body><h1>Orphan</h1></body></html>'
  }
];

const pageGraph = analyzePageGraphPages(pages, { canonicalUrl: 'https://example.com/' });
assert.equal(pageGraph.scope, 'bounded-page-content-and-internal-link-observations');
assert.ok(pageGraph.actions.some(action => action.id === 'page:canonical:https://example.com/guide/'));
assert.ok(pageGraph.actions.some(action => action.id === 'page:h1:https://example.com/guide/'));
assert.ok(pageGraph.actions.some(action => action.id === 'page:lang:https://example.com/guide/'));
assert.ok(pageGraph.actions.some(action => action.id === 'link:inbound:https://example.com/orphan/'));
assert.ok(pageGraph.actions.some(action => action.id === 'link:anchor:https://example.com/guide/'));
assert.equal(pageGraph.actions.filter(action => action.id.startsWith('page:duplicate-title:')).length, 2);

const filler = 'A useful but generic explanatory sentence for the reader with enough detail to form a substantive informational page. '.repeat(18);
const differentiation = analyzeContentDifferentiationPages([
  {
    url: 'https://example.com/guide/deep/',
    html: `<html><head><title>Deep guide</title></head><body><main><h1>Deep guide</h1><h2>Context</h2><p>${filler}</p><h2>Approach</h2><p>${filler}</p><p>${filler}</p></main></body></html>`
  },
  {
    url: 'https://example.com/analysis/',
    html: `<html><head><title>Analysis results</title></head><body><main><h1>Analysis</h1><h2>Method</h2><p>${filler} 25% improved.</p><h2>Results</h2><p>${filler} 40% improved.</p><p>${filler}</p></main></body></html>`
  },
  {
    url: 'https://example.com/benchmark/',
    html: `<html><head><title>Benchmark results</title></head><body><main><h1>Benchmark</h1><h2>Method</h2><p>${filler}</p><h2>Results</h2><p>${filler}</p><p>${filler}</p><table><tr><td>A</td><td>42</td></tr></table><a href="https://source.example/report">Source</a></main></body></html>`
  }
]);
assert.equal(differentiation.scope, 'bounded-observable-content-differentiation-signals-not-quality-score');
assert.equal(differentiation.guardrails.noContentQualityScore, true);
assert.equal(differentiation.guardrails.queryFanOutIsNotAPageFactory, true);
assert.ok(differentiation.actions.some(action => action.id === 'content:unique-contribution:https://example.com/guide/deep/'));
assert.ok(differentiation.actions.some(action => action.id === 'content:quantitative-grounding:https://example.com/analysis/'));
assert.ok(differentiation.actions.some(action => action.id === 'content:proof-surface:https://example.com/analysis/'));
assert.equal(differentiation.actions.some(action => action.id === 'content:proof-surface:https://example.com/benchmark/'), false, 'visible proof assets should suppress the research proof-surface review trigger');
for (const action of differentiation.actions) {
  assert.equal(action.evidenceClass, 'manual-review');
  assert.equal(action.proposal, null);
  assert.match(action.sourceCheck, /developers\.google\.com\/search\/docs\/fundamentals\/ai-optimization-guide/);
}

const agentAccessibility = analyzeAgentAccessibilityPages([
  {
    url: 'https://example.com/app/',
    html: '<html><body><main><button><svg></svg></button><input id="query"><div role="switch" aria-label="Mode"></div><span onclick="toggle()">Toggle</span></main></body></html>'
  },
  {
    url: 'https://example.com/good-app/',
    html: '<html><body><main><button aria-label="Search"><svg></svg></button><label for="query-good">Query</label><input id="query-good"><div role="switch" aria-label="Mode" aria-checked="false"></div><a href="/docs/">Documentation</a></main></body></html>'
  }
]);
assert.equal(agentAccessibility.scope, 'bounded-static-interactive-semantics-review-not-wcag-or-agent-runtime-certification');
assert.equal(agentAccessibility.guardrails.noWcagComplianceClaim, true);
assert.equal(agentAccessibility.guardrails.noSearchRankingSignalClaim, true);
assert.ok(agentAccessibility.actions.some(action => action.id === 'agent-accessibility:control-names:https://example.com/app/'));
assert.ok(agentAccessibility.actions.some(action => action.id === 'agent-accessibility:role-state:https://example.com/app/'));
assert.ok(agentAccessibility.actions.some(action => action.id === 'agent-accessibility:click-targets:https://example.com/app/'));
assert.equal(agentAccessibility.actions.some(action => action.id.includes('https://example.com/good-app/')), false, 'named native controls and a stateful role with rendered state should not trigger the bounded heuristics');
for (const action of agentAccessibility.actions) {
  assert.equal(action.evidenceClass, 'manual-review');
  assert.equal(action.proposal, null);
  assert.match(action.sourceCheck, /help\.openai\.com\/en\/articles\/12627856-publishers-and-developers-faq/);
}

const growthPlan = {
  canonicalUrl: 'https://example.com/',
  actions: [
    {
      id: 'audit:search-access', priority: 'P1', lane: 'search-access', title: 'Preserve crawl/index eligibility',
      reason: 'Synthetic source-backed Growth action.', evidence: ['https://example.com/robots.txt'],
      implementation: { url: 'https://example.com/' }
    },
    {
      id: 'growth:manual-content', priority: 'P2', lane: 'content', title: 'Review content usefulness',
      reason: 'Manual quality review.', status: 'manual', implementation: { surface: 'content' }
    }
  ]
};

const entityRemediation = {
  items: [
    {
      gapId: 'property:dataset:license:https://example.com/#data', priority: 'P1', family: 'Dataset',
      entityId: 'https://example.com/#data', entityName: 'Example Dataset', problem: 'Dataset has no explicit license.',
      recommendation: 'Add license only when grounded.', disposition: 'grounded-json-patch-proposal',
      evidence: [{ file: 'data/facts.jsonld', property: 'license', value: 'https://creativecommons.org/licenses/by/4.0/' }],
      target: { file: 'public/data.jsonld', pointer: '/@graph/0' },
      proposal: { type: 'json-patch', operations: [{ op: 'add', path: '/@graph/0/license', value: 'https://creativecommons.org/licenses/by/4.0/' }] }
    }
  ]
};

const plan = buildSiteImprovementPlanFromEvidence({ canonicalUrl: 'https://example.com/', growthPlan, entityRemediation, pageGraph }, {
  maxActions: 5,
  generatedAt: '2026-09-07T05:30:00Z'
});

assert.equal(plan.version, '0.1');
assert.equal(plan.scope, 'bounded-prioritized-improvement-plan-not-ranking-score');
assert.equal(plan.summary.selected, 5);
assert.ok(plan.summary.candidates > plan.summary.selected);
assert.equal(plan.actions[0].sourceKind, 'entity-remediation', 'grounded first-party P1 evidence should lead source-backed/direct P1 candidates');
assert.equal(plan.actions[0].evidenceClass, 'grounded-first-party');
assert.ok(new Set(plan.actions.filter(action => action.priority === 'P1').map(action => action.lane)).size >= 3, 'P1 selection should preserve lane diversity before filling duplicates');
for (const action of plan.actions) {
  assert.ok(action.verification.length > 0);
  assert.ok(action.measurement.length > 0);
}
assert.equal(plan.prioritization.universalNumericScore, false);
assert.equal(plan.guardrails.noRankingPromise, true);
assert.equal(plan.guardrails.noAutomaticRepositoryMutation, true);
assert.doesNotMatch(JSON.stringify(plan), /"(?:seoScore|readinessScore|rankingScore|universalScore)"/i);

const syntheticSurfaces = {
  actions: [],
  registrySummary: { checks: 0 },
  summary: { surfacesObserved: [], pagesObserved: 0, actions: 0 },
  ruleset: 'test',
  siteKind: { kind: 'general' },
  guardrails: {}
};
const deepPlan = mergeSearchSurfacePlan(plan, syntheticSurfaces, {
  maxActions: 25,
  contentDifferentiation: differentiation,
  agentAccessibility
});
assert.ok(deepPlan.actions.some(action => action.id.startsWith('content:')));
assert.ok(deepPlan.actions.some(action => action.id.startsWith('agent-accessibility:')));
assert.equal(deepPlan.sourceSummary.contentDifferentiationActions, differentiation.actions.length);
assert.equal(deepPlan.sourceSummary.agentAccessibilityActions, agentAccessibility.actions.length);
assert.equal(deepPlan.guardrails.contentDifferentiationIsReviewSignalNotQualityScore, true);
assert.equal(deepPlan.guardrails.agentAccessibilityIsRuntimeReviewNotRankingSignal, true);

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const schema = JSON.parse(fs.readFileSync('schema/site-improvement-plan.schema.json', 'utf8'));
const validate = ajv.compile(schema);
assert.equal(validate(plan), true, JSON.stringify(validate.errors));
assert.equal(validate(deepPlan), true, JSON.stringify(validate.errors));

assert.throws(() => buildSiteImprovementPlanFromEvidence({ canonicalUrl: 'http://example.com/' }), /HTTPS/);
assert.throws(() => buildSiteImprovementPlanFromEvidence({ canonicalUrl: 'https://example.com/' }, { maxActions: 0 }), /between 1 and 25/);

console.log(`PASS Site Improvement Plan: ${pageGraph.actions.length} page/link observations, ${differentiation.actions.length} content-differentiation reviews, ${agentAccessibility.actions.length} agent-accessibility reviews -> deep plan ${deepPlan.summary.selected}/${deepPlan.summary.candidates} selected without a universal score`);
