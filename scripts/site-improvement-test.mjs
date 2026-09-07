import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { analyzePageGraphPages, buildSiteImprovementPlanFromEvidence } from '../lib/site-improvement.mjs';

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

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const schema = JSON.parse(fs.readFileSync('schema/site-improvement-plan.schema.json', 'utf8'));
const validate = ajv.compile(schema);
assert.equal(validate(plan), true, JSON.stringify(validate.errors));

assert.throws(() => buildSiteImprovementPlanFromEvidence({ canonicalUrl: 'http://example.com/' }), /HTTPS/);
assert.throws(() => buildSiteImprovementPlanFromEvidence({ canonicalUrl: 'https://example.com/' }, { maxActions: 0 }), /between 1 and 25/);

console.log(`PASS Site Improvement Plan: ${pageGraph.actions.length} page/link observations -> ${plan.summary.selected}/${plan.summary.candidates} selected actions without a universal score`);
