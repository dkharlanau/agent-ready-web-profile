import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SEARCH_OUTCOME_CHANNELS,
  appendSearchOutcomeObservation,
  createSearchInterventionDraft,
  searchMaturityDiffToInterventionCandidates,
  validateSearchIntervention
} from '../lib/search-intervention.mjs';

const fixture = JSON.parse(
  fs.readFileSync(new URL('./search-intervention/example-public-safe.json', import.meta.url), 'utf8')
);
const validation = validateSearchIntervention(fixture);
assert.equal(validation.valid, true, validation.errors.join('\n'));
assert.ok(SEARCH_OUTCOME_CHANNELS.includes('ai-citation'));
assert.ok(SEARCH_OUTCOME_CHANNELS.includes('answer-absorption'));
assert.notEqual(
  SEARCH_OUTCOME_CHANNELS.indexOf('ai-citation'),
  SEARCH_OUTCOME_CHANNELS.indexOf('answer-absorption')
);

const draft = createSearchInterventionDraft({
  id: 'fixture.draft.utility',
  siteUrl: 'https://example.org/',
  siteClass: 'learning-tool',
  intentFamily: 'study-plan',
  hypothesis:
    'A bounded planning tool on the existing canonical page creates more standalone utility than another generic article.',
  baseline: {
    capturedAt: '2026-09-07T00:00:00.000Z',
    surfaces: [
      {
        name: 'synthetic baseline',
        provenanceClass: 'synthetic-fixture',
        evidenceRefs: [
          'urn:sha256:2222222222222222222222222222222222222222222222222222222222222222'
        ]
      }
    ]
  },
  changedDimensions: ['utilitySurface'],
  changedUrls: ['https://example.org/study-plan/'],
  confounders: ['New domain.']
});
assert.equal(draft.intervention.status, 'planned');
assert.deepEqual(
  draft.outcomeWindows.map(item => item.days),
  [7, 14, 28]
);
assert.equal(validateSearchIntervention(draft).valid, true);

const withOutcome = appendSearchOutcomeObservation(draft, {
  phase: 'follow-up',
  channel: 'ai-citation',
  observedAt: '2026-09-14T00:00:00.000Z',
  windowDays: 7,
  state: 'neutral',
  evidenceRefs: [
    'urn:sha256:3333333333333333333333333333333333333333333333333333333333333333'
  ],
  notes: 'Synthetic neutral observation.'
});
assert.equal(withOutcome.observations.length, 1);

const leaked = structuredClone(fixture);
leaked.disclosure.containsLiveCorpus = true;
assert.equal(validateSearchIntervention(leaked).valid, false);

const badDimension = structuredClone(fixture);
badDimension.intervention.changedDimensions = ['magicRankingSignal'];
assert.equal(validateSearchIntervention(badDimension).valid, false);

const unsupported = structuredClone(fixture);
unsupported.disposition = 'support';
unsupported.confidence = 'medium';
assert.equal(validateSearchIntervention(unsupported).valid, false);

const candidates = searchMaturityDiffToInterventionCandidates(
  {
    kind: 'search-maturity-diff',
    referenceIntentFamily: 'study-plan',
    gaps: [
      {
        dimension: 'utilitySurface',
        targetState: 'weak',
        benchmarkState: 'strong',
        evidenceClass: 'observed-correlation',
        pattern: 'differentiator'
      }
    ]
  },
  { siteUrl: 'https://example.org/', siteClass: 'learning-tool' }
);
assert.equal(candidates.length, 1);
assert.equal(candidates[0].status, 'manual-review');
assert.equal(candidates[0].changedUrls.length, 0);
assert.ok(candidates[0].outcomeChannels.includes('ai-citation'));
assert.ok(candidates[0].outcomeChannels.includes('answer-absorption'));

console.log('PASS search intervention ledger', {
  channels: SEARCH_OUTCOME_CHANNELS.length,
  publicFixture: validation.valid,
  disclosureLeakBlocked: true,
  unsupportedLearningBlocked: true,
  diffCandidates: candidates.length
});
