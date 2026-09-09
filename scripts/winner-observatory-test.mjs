import assert from 'node:assert/strict';
import {
  diffWinnerObservations,
  summarizeWinnerObservation,
  validateWinnerObservation
} from '../lib/winner-observatory.mjs';

function snapshot(observedAt, changes = {}) {
  const base = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/winner-observation.schema.json',
    version: '0.1',
    cohortId: 'voice-training-search-en',
    observedAt,
    surface: 'google-search',
    locale: 'en-US',
    market: 'US',
    capture: { method: 'manual-public-observation' },
    queries: [
      {
        id: 'voice-exercises',
        text: 'voice exercises',
        intent: 'exercise discovery',
        results: [
          {
            url: 'https://example.com/a',
            rank: 1,
            citationState: 'not-applicable',
            mentionState: 'not-applicable',
            paidAcquisitionStatus: 'unknown',
            role: 'competitor'
          },
          {
            url: 'https://example.org/b',
            rank: 5,
            citationState: 'not-applicable',
            mentionState: 'not-applicable',
            paidAcquisitionStatus: 'unknown',
            role: 'competitor'
          }
        ]
      },
      {
        id: 'vocal-warmup',
        text: 'vocal warm up exercises',
        results: [
          {
            url: 'https://example.net/c',
            rank: 8,
            citationState: 'not-applicable',
            mentionState: 'not-applicable',
            paidAcquisitionStatus: 'unknown',
            role: 'control'
          }
        ]
      }
    ],
    guardrails: {
      noRankingFactorInference: true,
      noCausalityInference: true,
      paidAcquisitionUnknownUnlessVerified: true,
      preserveNegativeResults: true
    }
  };
  return { ...base, ...changes };
}

const before = snapshot('2026-09-01T08:00:00.000Z');
const after = snapshot('2026-09-08T08:00:00.000Z');
after.queries[0].results = [
  {
    url: 'https://example.com/a',
    rank: 3,
    citationState: 'not-applicable',
    mentionState: 'not-applicable',
    paidAcquisitionStatus: 'unknown',
    role: 'competitor'
  },
  {
    url: 'https://new.example/new',
    rank: 4,
    citationState: 'not-applicable',
    mentionState: 'not-applicable',
    paidAcquisitionStatus: 'unknown',
    role: 'competitor'
  }
];

assert.equal(validateWinnerObservation(before).valid, true);
const summary = summarizeWinnerObservation(before);
assert.equal(summary.queryCount, 2);
assert.equal(summary.observedPairCount, 3);
assert.equal(summary.uniqueDomainCount, 3);

const diff = diffWinnerObservations(before, after);
assert.equal(diff.resultPersistence.beforePairs, 3);
assert.equal(diff.resultPersistence.persistedPairs, 2);
assert.equal(diff.resultPersistence.entrants.length, 1);
assert.equal(diff.resultPersistence.drops.length, 1);
assert.equal(diff.top10Persistence.persistedTop10Pairs, 2);
assert.equal(diff.rankMovements.find(item => item.url === 'https://example.com/a')?.delta, -2);

const duplicate = snapshot('2026-09-02T08:00:00.000Z');
duplicate.queries[0].results.push({ ...duplicate.queries[0].results[0] });
assert.equal(validateWinnerObservation(duplicate).valid, false);
assert.ok(validateWinnerObservation(duplicate).semanticErrors.some(error => error.includes('Duplicate result URL')));

const changedCohort = snapshot('2026-09-09T08:00:00.000Z');
changedCohort.queries[0].text = 'different query text';
assert.throws(() => diffWinnerObservations(before, changedCohort), /Query text changed/);

const aiBefore = snapshot('2026-09-01T08:00:00.000Z', { surface: 'chatgpt-search' });
aiBefore.queries = [
  {
    id: 'voice-coach',
    text: 'best voice training exercises',
    results: [
      {
        url: 'https://example.com/guide',
        citationState: 'observed',
        mentionState: 'not-observed',
        paidAcquisitionStatus: 'unknown',
        role: 'competitor'
      }
    ]
  }
];
const aiAfter = structuredClone(aiBefore);
aiAfter.observedAt = '2026-09-08T08:00:00.000Z';
aiAfter.queries[0].results[0].citationState = 'not-observed';
aiAfter.queries[0].results.push({
  url: 'https://new.example/research',
  citationState: 'observed',
  mentionState: 'observed',
  paidAcquisitionStatus: 'none-observed',
  role: 'competitor'
});
const aiDiff = diffWinnerObservations(aiBefore, aiAfter);
assert.equal(aiDiff.citationPersistence.beforeCitations, 1);
assert.equal(aiDiff.citationPersistence.persistedCitations, 0);
assert.equal(aiDiff.citationPersistence.newCitations.length, 1);
assert.equal(validateWinnerObservation(aiAfter).warnings.length, 1);

console.log('PASS winner-observatory-test');
