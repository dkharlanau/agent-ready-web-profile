import assert from 'node:assert/strict';
import {
  buildAdaptiveUpgradeGraph,
  compileAdaptiveUpgradeGraph,
  loadAdaptiveUpgradeRegistry,
  simulateAdaptiveUpgrade,
  validateAdaptiveUpgradeGraph
} from '../lib/adaptive-upgrade.mjs';

const plan = {
  profile: '2026-09-07',
  canonicalUrl: 'https://example.test/',
  summary: { totalActions: 6, byPriority: { P0: 1, P1: 5 }, byLane: {} },
  actions: [
    {
      id: 'audit:google-search-technical-eligibility',
      priority: 'P0',
      lane: 'eligibility',
      title: 'Fix search eligibility',
      status: 'warn',
      source: 'https://developers.google.com/search/docs/essentials/technical',
      evidence: ['https://example.test/robots.txt']
    },
    {
      id: 'growth:non-commodity-review',
      priority: 'P1',
      lane: 'content-quality',
      title: 'Review original value',
      status: 'manual',
      source: 'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide'
    },
    {
      id: 'growth:entity-identity',
      priority: 'P1',
      lane: 'entity-identity',
      title: 'Resolve entity identity',
      status: 'recommended',
      evidence: ['https://example.test/about/']
    },
    {
      id: 'audit:openai-oai-searchbot-access',
      priority: 'P1',
      lane: 'ai-access',
      title: 'Allow OAI Search',
      status: 'warn'
    },
    {
      id: 'growth:vertical:research-dataset-citation-license',
      priority: 'P1',
      lane: 'vertical:research-dataset',
      title: 'Publish dataset citation',
      status: 'recommended',
      evidence: ['https://example.test/data/']
    },
    {
      id: 'growth:bing-ai-citation-measurement',
      priority: 'P1',
      lane: 'measurement',
      title: 'Measure Bing citations',
      status: 'external-owner-data'
    }
  ],
  observations: {
    verticalEvidence: {
      vertical: 'research-dataset',
      checks: [
        {
          id: 'research-dataset-citation-license',
          status: 'partial',
          evidence: ['https://example.test/CITATION.cff']
        }
      ]
    }
  }
};

const graph = compileAdaptiveUpgradeGraph(plan, {
  verticals: ['research-dataset'],
  goals: ['search', 'generative-search', 'ai-citations', 'measurement'],
  now: new Date('2026-09-07T12:00:00Z')
});

assert.equal(graph.version, '0.1');
assert.equal(graph.context.verticals[0], 'research-dataset');
assert.equal(validateAdaptiveUpgradeGraph(graph).valid, true);
assert.ok(graph.recommendations.some(item => item.id === 'foundation' && item.state === 'recommended'));
assert.ok(graph.recommendations.some(item => item.id === 'citation-ready-content' && item.state === 'recommended'));
assert.ok(graph.recommendations.some(item => item.id === 'entity-proof-graph' && item.state === 'recommended'));
assert.ok(graph.recommendations.some(item => item.id === 'chatgpt-search-policy' && item.state === 'recommended'));
assert.ok(graph.recommendations.some(item => item.id === 'dataset-publication-pid' && item.state === 'recommended'));
assert.ok(graph.recommendations.some(item => item.id === 'google-genai-measurement-loop'));
assert.ok(graph.recommendations.some(item => item.id === 'bing-citation-intelligence-loop'));
assert.ok(graph.recommendations.some(item => item.id === 'change-evidence-loop' && item.state === 'recommended'));
assert.equal(graph.recommendations.some(item => item.id === 'agent-accessibility'), false, 'research datasets should not receive interactive-agent accessibility by default');
assert.ok(graph.waves.some(wave => wave.priority === 'P0' && wave.recommendationIds.includes('foundation')));
assert.equal(graph.guardrails.productionMutationAuthorized, false);

const dataset = graph.recommendations.find(item => item.id === 'dataset-publication-pid');
assert.ok(dataset.change.targets.includes('Zenodo/DataCite record'));
assert.ok(dataset.verification.checks.includes('external DOI resolution'));
assert.ok(dataset.reason.includes('growth:vertical:research-dataset-citation-license'));

const simulation = simulateAdaptiveUpgrade(graph, ['foundation', 'dataset-publication-pid']);
assert.ok(simulation.addressed.actionIds.includes('audit:google-search-technical-eligibility'));
assert.ok(simulation.addressed.actionIds.includes('growth:vertical:research-dataset-citation-license'));
assert.equal(simulation.interpretation.rankingOrCitationUpliftPredicted, false);
assert.ok(simulation.remaining.actionIds.includes('growth:entity-identity'));

const registry = structuredClone(loadAdaptiveUpgradeRegistry());
registry.packs[0].sourceReviewedAt = '2025-01-01';
registry.packs[0].reviewAfterDays = 1;
const stale = compileAdaptiveUpgradeGraph(plan, {
  registry,
  verticals: ['research-dataset'],
  goals: ['search'],
  now: new Date('2026-09-07T12:00:00Z')
});
assert.equal(stale.recommendations.find(item => item.id === 'foundation').knowledgeState, 'review-due');
assert.ok(stale.summary.reviewDue >= 1);

const built = await buildAdaptiveUpgradeGraph('https://example.test/', {
  plan,
  vertical: 'research-dataset',
  goals: ['search', 'ai-citations'],
  now: new Date('2026-09-07T12:00:00Z')
});
assert.equal(built.site, 'https://example.test/');
assert.ok(built.recommendations.some(item => item.id === 'dataset-publication-pid'));

console.log('PASS adaptive upgrade engine converts current Growth evidence into source-backed target-site changes, keeps stale knowledge visible, models dataset DOI publication and simulates implementation debt without predicting ranking uplift');
