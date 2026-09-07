import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SEARCH_MATURITY_DIMENSIONS,
  buildSearchMaturityCohort,
  compareTargetToSearchMaturityCohort,
  searchMaturityDiffToReviewActions,
  validateSearchMaturityCorpus
} from '../lib/search-maturity.mjs';

const corpus = JSON.parse(fs.readFileSync(new URL('./search-maturity/pilot-2026-09-07.json', import.meta.url), 'utf8'));
const validation = validateSearchMaturityCorpus(corpus);
assert.equal(validation.valid, true, validation.errors.join('\n'));

const cohort = buildSearchMaturityCohort(corpus, { intentFamily: 'ai-search-optimization' });
assert.equal(cohort.sampleSize, 5);
assert.equal(Object.keys(cohort.dimensions).length, SEARCH_MATURITY_DIMENSIONS.length);
assert.equal(cohort.guardrails.noSingleMaturityScore, true);
assert.equal(cohort.retrievalAgeAtObservation.known, 5);
assert.ok(cohort.retrievalAgeAtObservation.medianDays >= 0);
assert.ok(['consistent', 'differentiator'].includes(cohort.dimensions.answerFirst.pattern));
assert.ok(['consistent', 'differentiator'].includes(cohort.dimensions.authorEntityIdentity.pattern));

const weakFeatures = Object.fromEntries(
  SEARCH_MATURITY_DIMENSIONS
    .filter((dimension) => dimension !== 'multimodalEvidence')
    .map((dimension) => [dimension, { state: 'weak' }])
);
const diff = compareTargetToSearchMaturityCohort({ site: 'https://target.example/', features: weakFeatures }, cohort);
assert.ok(diff.gaps.some((gap) => gap.dimension === 'answerFirst'));
assert.ok(diff.gaps.some((gap) => gap.dimension === 'authorEntityIdentity'));
assert.ok(diff.unknown.some((gap) => gap.dimension === 'multimodalEvidence'));
assert.equal(diff.guardrails.differencesAreNotRankingFactors, true);

const actions = searchMaturityDiffToReviewActions(diff);
assert.equal(actions.length, diff.gaps.length);
assert.ok(actions.every((action) => action.status === 'manual-review' && action.proposal === null));
assert.ok(actions.every((action) => action.verificationRequired && action.outcomeMeasurementRequired));

const invalid = structuredClone(corpus);
invalid.observations[0].observationSurface.rank = 1;
delete invalid.observations[0].observationSurface.rankEvidence;
const invalidResult = validateSearchMaturityCorpus(invalid);
assert.equal(invalidResult.valid, false);
assert.ok(invalidResult.errors.some((error) => error.includes('rank requires rankEvidence')));

console.log('PASS search maturity benchmark', {
  observations: corpus.observations.length,
  dimensions: SEARCH_MATURITY_DIMENSIONS.length,
  gaps: diff.gaps.length
});
