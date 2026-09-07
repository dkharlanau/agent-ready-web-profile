import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildSiteImprovementPlan, mergeVerticalEvidencePlan } from '../lib/site-improvement-vertical.mjs';
import { analyzeVerticalEvidence } from '../lib/growth-vertical-evidence.mjs';

function basePlan(site = 'https://software.example/') {
  return {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/site-improvement-plan.schema.json',
    version: '0.1',
    generatedAt: '2026-09-07T08:20:00.000Z',
    site,
    scope: 'bounded-prioritized-improvement-plan-not-ranking-score',
    summary: { candidates: 2, selected: 2, suppressed: 0, byPriority: { P1: 1, P2: 1 }, byLane: { 'technical-search': 1, 'internal-links': 1 } },
    actions: [
      {
        order: 1, id: 'growth:base-search', sourceKind: 'growth', priority: 'P1', lane: 'technical-search', title: 'Preserve crawl eligibility', reason: 'fixture', evidenceClass: 'source-backed', evidence: [], target: { url: site }, proposal: null, verification: ['verify'], measurement: ['measure'], dependencies: []
      },
      {
        order: 2, id: 'page:base-link', sourceKind: 'page-graph', priority: 'P2', lane: 'internal-links', title: 'Improve internal path', reason: 'fixture', evidenceClass: 'direct-observation', evidence: [site], target: { url: `${site}docs/` }, proposal: null, verification: ['verify'], measurement: ['measure'], dependencies: []
      }
    ],
    sourceSummary: { growthActions: 1, pageGraphActions: 1, searchSurfaceActions: 0 },
    searchSurface: { siteKind: { kind: 'software-product' }, surfacesObserved: ['home'], actions: 0, guardrails: {} },
    prioritization: {
      method: 'priority-then-evidence-then-actionability-with-lane-diversity-across-growth-entities-pages-and-search-surfaces',
      universalNumericScore: false,
      priorityOrder: ['P0', 'P1', 'P2', 'P3'],
      evidenceOrder: ['grounded-first-party', 'direct-observation', 'source-backed', 'manual-review', 'advisory'],
      maxActions: 25
    },
    guardrails: {
      noRankingPromise: true,
      noUniversalReadinessScore: true,
      noAutomaticRepositoryMutation: true,
      noInventedFacts: true,
      measurementDoesNotProveCausality: true
    }
  };
}

const weakHtml = '<!doctype html><html><body><h1>Product</h1><a href="/docs/">Docs</a></body></html>';
const report = analyzeVerticalEvidence({ vertical: 'software-product', canonicalUrl: 'https://software.example/', html: weakHtml });
const merged = mergeVerticalEvidencePlan(basePlan(), report, { maxActions: 5 });
assert.equal(merged.verticalEvidence.vertical, 'software-product');
assert.equal(merged.sourceSummary.verticalEvidenceVersion, '0.1');
assert.equal(merged.sourceSummary.verticalEvidenceRegistryVersion, '0.3');
assert.equal(merged.sourceSummary.verticalEvidenceChecks, 4);
assert.ok(merged.sourceSummary.verticalEvidenceActions >= 3);
assert.ok(merged.actions.some(item => item.id === 'vertical:growth:vertical:software-product-identity'));
assert.ok(merged.actions.some(item => item.lane === 'vertical:software-product'));
assert.equal(merged.actions.some(item => item.id.includes('software-product-agent-interfaces')), false, 'agent-interface absence must not become an implementation requirement');
const verticalAction = merged.actions.find(item => item.id === 'vertical:growth:vertical:software-product-identity');
assert.equal(verticalAction.sourceKind, 'growth');
assert.equal(verticalAction.evidenceClass, 'direct-observation');
assert.ok(verticalAction.evidence.includes('https://software.example/'));
assert.ok(verticalAction.dependencies.includes('verify-canonical-surface-before-edit'));
assert.equal(merged.guardrails.verticalEntryPageNotWholeSiteProof, true);
assert.equal(merged.guardrails.absentAgentInterfaceDoesNotCreateRequirement, true);
assert.equal(merged.prioritization.universalNumericScore, false);

const built = await buildSiteImprovementPlan('https://software.example/', {
  siteKind: 'software-product',
  maxActions: 5,
  baseBuildImpl: async () => basePlan(),
  entryPage: { ok: true, url: 'https://software.example/', text: weakHtml }
});
assert.equal(built.verticalEvidence.vertical, 'software-product', 'site-kind should conservatively infer the matching Growth vertical when --vertical is omitted');
assert.ok(built.actions.some(item => item.id.startsWith('vertical:growth:vertical:software-product-')));

const explicitResearchBase = basePlan('https://research.example/');
explicitResearchBase.searchSurface.siteKind.kind = 'documentation-research';
const researchHtml = `<!doctype html><html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Dataset","name":"Corpus","url":"https://research.example/data/","license":"https://creativecommons.org/licenses/by/4.0/","version":"1.0"}</script></head><body><p>Methodology and limitations.</p><a href="/methodology/">Methodology</a><a href="/citation/">Citation</a><a href="/versions/">Version history</a><a href="/data/corpus.csv">Download CSV</a></body></html>`;
const research = await buildSiteImprovementPlan('https://research.example/', {
  vertical: 'research-dataset',
  siteKind: 'documentation-research',
  maxActions: 5,
  baseBuildImpl: async () => explicitResearchBase,
  entryPage: { ok: true, url: 'https://research.example/', text: researchHtml }
});
assert.equal(research.verticalEvidence.vertical, 'research-dataset', 'explicit vertical must outrank site-kind inference');
assert.equal(research.verticalEvidence.checks.find(item => item.id === 'research-dataset-identity').status, 'observed');

const unavailable = await buildSiteImprovementPlan('https://software.example/', {
  siteKind: 'software-product',
  maxActions: 5,
  baseBuildImpl: async () => basePlan(),
  entryPage: { ok: false, url: 'https://software.example/', text: null, issue: 'fixture unavailable' }
});
assert.equal(unavailable.verticalEvidence.coverage, 'unavailable');
assert.equal(unavailable.sourceSummary.verticalEvidenceActions, 0);
assert.equal(unavailable.actions.some(item => item.id.startsWith('vertical:')), false);

const schema = JSON.parse(fs.readFileSync('schema/site-improvement-plan.schema.json', 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
assert.equal(validate(merged), true, JSON.stringify(validate.errors));
assert.equal(validate(built), true, JSON.stringify(validate.errors));
assert.doesNotMatch(JSON.stringify(built), /"(?:seoScore|readinessScore|rankingScore|universalScore)"/i);

console.log('PASS unified Site Improvement Plan merges bounded vertical evidence, infers safe verticals from site-kind, preserves schema compatibility, and never converts unavailable or absent agent-interface evidence into false requirements');
