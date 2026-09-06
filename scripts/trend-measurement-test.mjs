import assert from 'node:assert/strict';
import { loadTrendRegistry } from '../lib/trend-radar.mjs';
import { buildTrendMeasurementEvidence, validateTrendMeasurementEvidence } from '../lib/trend-measurement.mjs';

const hex = char => char.repeat(64);

function experiment({ id, site, outcomeState, decision, seed }) {
  const beforeGrowth = {
    snapshotId: `urn:sha256:${hex(seed)}`,
    digest: `sha256:${hex(seed)}`,
    observedAt: '2026-08-01T00:00:00Z',
    highPriorityDebt: 2
  };
  const afterSeed = seed === 'a' ? 'b' : seed === 'c' ? 'd' : 'f';
  const beforeVisibilitySeed = seed === 'a' ? '1' : '3';
  const afterVisibilitySeed = seed === 'a' ? '2' : '4';
  return {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/growth-experiment.schema.json',
    version: '0.1',
    id,
    site,
    hypothesisId: 'bing-owner-citation-evidence',
    actionIds: ['bing-ai-citation-measurement'],
    createdAt: '2026-08-01T00:00:00Z',
    status: 'reviewed',
    evidence: {
      beforeGrowth,
      afterGrowth: {
        snapshotId: `urn:sha256:${hex(afterSeed)}`,
        digest: `sha256:${hex(afterSeed)}`,
        observedAt: '2026-09-01T00:00:00Z',
        highPriorityDebt: 1
      },
      beforeVisibility: {
        digest: `sha256:${hex(beforeVisibilitySeed)}`,
        capturedAt: '2026-08-02T00:00:00Z',
        period: { start: '2026-07-01', end: '2026-07-31' }
      },
      afterVisibility: {
        digest: `sha256:${hex(afterVisibilitySeed)}`,
        capturedAt: '2026-09-02T00:00:00Z',
        period: { start: '2026-08-01', end: '2026-08-31' }
      }
    },
    evaluation: {
      evaluatedAt: '2026-09-02T00:00:00Z',
      actionResults: [{ id: 'bing-ai-citation-measurement', state: 'resolved' }],
      implementationDiff: { actionsAdded: 0, actionsResolved: 1, actionsChanged: 0, highPriorityDebtDelta: -1 },
      visibility: {
        comparableMetrics: 2,
        positive: outcomeState === 'positive-observation' ? 2 : 0,
        negative: outcomeState === 'negative-observation' ? 2 : 0,
        unchanged: 0
      },
      outcomeState,
      reviewRequired: true,
      interpretation: 'Observed owner-side metric movement only; no causality inferred.'
    },
    review: {
      decision,
      reviewedAt: '2026-09-03T00:00:00Z',
      notes: 'Reviewed result retained regardless of direction.'
    },
    guardrails: {
      noRankingGuarantee: true,
      noCausalityInference: true,
      preserveNegativeResults: true,
      humanReviewBeforePromotion: true
    }
  };
}

const positive = experiment({ id: 'bing-positive-1', site: 'https://one.example/', outcomeState: 'positive-observation', decision: 'keep', seed: 'a' });
const negative = experiment({ id: 'bing-negative-1', site: 'https://two.example/', outcomeState: 'negative-observation', decision: 'revise', seed: 'c' });
const report = buildTrendMeasurementEvidence([positive, negative], loadTrendRegistry(), { generatedAt: '2026-09-06T08:00:00Z' });
assert.equal(validateTrendMeasurementEvidence(report).valid, true);

const bing = report.trends.find(item => item.trendId === 'bing-ai-performance-citations');
assert.ok(bing, 'Bing trend evidence row is required');
assert.equal(bing.currentStage, 'adopt');
assert.equal(bing.totalExperiments, 2);
assert.equal(bing.reviewedExperiments, 2);
assert.equal(bing.ownerEvidenceExperiments, 2);
assert.equal(bing.outcomes.positive, 1);
assert.equal(bing.outcomes.negative, 1, 'negative observations must stay in the denominator');
assert.equal(bing.reviewDecisions.keep, 1);
assert.equal(bing.reviewDecisions.revise, 1);
assert.deepEqual(bing.sites, ['https://one.example/', 'https://two.example/']);
assert.equal(bing.eligibility, 'eligible-for-review');

const proposal = report.proposals.find(item => item.trendId === 'bing-ai-performance-citations');
assert.ok(proposal, 'real reviewed owner evidence should create an ADOPT -> MEASURED review proposal');
assert.equal(proposal.status, 'review-required');
assert.deepEqual(proposal.evidenceExperimentIds, ['bing-negative-1', 'bing-positive-1']);
assert.equal(report.guardrails.noAutomaticMeasuredPromotion, true);
assert.equal(report.guardrails.measuredMeansObservedNotPositive, true);

const webmcp = report.trends.find(item => item.trendId === 'webmcp-origin-trial-evals');
assert.equal(webmcp.eligibility, 'not-adopted', 'WATCH trends cannot jump directly to MEASURED');
assert.equal(loadTrendRegistry().trends.find(item => item.id === 'bing-ai-performance-citations').stage, 'adopt', 'measurement evidence must not mutate trends.json');

console.log('PASS Trend MEASURED gate aggregates reviewed positive and negative owner evidence and proposes review without silent promotion');
