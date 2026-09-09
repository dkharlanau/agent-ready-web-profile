import assert from 'node:assert/strict';
import {
  buildRecommendationReviewQueue,
  loadRecommendationRegistry,
  validateRecommendationReviewEvents
} from '../lib/recommendation-review.mjs';

const registry = loadRecommendationRegistry();
const ruleA = registry.rules.find(rule => rule.id === 'google-non-commodity-content');
const ruleB = registry.rules.find(rule => rule.id === 'openai-oai-searchbot-access');
assert.ok(ruleA && ruleB);

const batch = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/recommendation-review-events.schema.json',
  version: '0.1',
  events: [
    {
      id: 'event-negative-1',
      ruleId: ruleA.id,
      observedAt: '2026-09-08T10:00:00Z',
      kind: 'experiment-negative',
      evidenceUri: 'https://example.com/evidence/negative-1',
      note: 'Owned-site cohort did not reproduce the expected directional signal.'
    },
    {
      id: 'event-contradiction-1',
      ruleId: ruleB.id,
      observedAt: '2026-09-08T11:00:00Z',
      kind: 'provider-contradiction',
      evidenceUri: 'https://example.com/evidence/contradiction-1'
    },
    {
      id: 'event-positive-1',
      ruleId: ruleA.id,
      observedAt: '2026-09-08T12:00:00Z',
      kind: 'experiment-positive',
      evidenceUri: 'https://example.com/evidence/positive-1'
    }
  ]
};

assert.equal(validateRecommendationReviewEvents(batch, registry).valid, true);
const report = buildRecommendationReviewQueue(batch, {
  registry,
  asOf: '2026-09-09T00:00:00Z',
  staleAfterDays: 365
});

const rowA = report.rules.find(row => row.ruleId === ruleA.id);
const rowB = report.rules.find(row => row.ruleId === ruleB.id);
assert.equal(rowA.state, 'challenged');
assert.equal(rowA.supportingEventCount, 1);
assert.equal(rowA.challengingEventCount, 1);
assert.equal(rowA.mutationAllowed, false);
assert.equal(rowB.state, 'contradicted');
assert.equal(report.guardrails.registryMutationAllowed, false);

const staleReport = buildRecommendationReviewQueue({ version: '0.1', events: [] }, {
  registry,
  asOf: '2027-01-15T00:00:00Z',
  staleAfterDays: 90
});
assert.ok(staleReport.summary.reviewDue > 0);
assert.ok(staleReport.attention.some(row => row.reasons.some(reason => reason.kind === 'source-age')));

const retireBatch = {
  version: '0.1',
  events: [
    {
      id: 'manual-retire-1',
      ruleId: ruleA.id,
      observedAt: '2026-09-09T00:00:00Z',
      kind: 'manual-retire-proposal',
      evidenceUri: 'https://example.com/evidence/retire-review'
    }
  ]
};
const retireReport = buildRecommendationReviewQueue(retireBatch, {
  registry,
  asOf: '2026-09-09T00:00:00Z',
  staleAfterDays: 365
});
assert.equal(retireReport.rules.find(row => row.ruleId === ruleA.id).state, 'retire-candidate');

const unknown = structuredClone(batch);
unknown.events[0].ruleId = 'missing-rule';
assert.equal(validateRecommendationReviewEvents(unknown, registry).valid, false);

console.log('PASS recommendation-review-test');
