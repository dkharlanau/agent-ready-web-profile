import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildSearchMaturityCohort,
  compareTargetToSearchMaturityCohort
} from '../lib/search-maturity.mjs';
import { validateSearchIntervention } from '../lib/search-intervention.mjs';

const intervention = JSON.parse(fs.readFileSync(new URL('./search-intervention/arwp-ai-search-visibility-2026-09-07.json', import.meta.url), 'utf8'));
const before = JSON.parse(fs.readFileSync(new URL('./search-maturity/targets/arwp-ai-search-visibility-before-2026-09-07.json', import.meta.url), 'utf8'));
const after = JSON.parse(fs.readFileSync(new URL('./search-maturity/targets/arwp-ai-search-visibility-after-2026-09-07.json', import.meta.url), 'utf8'));
const corpus = JSON.parse(fs.readFileSync(new URL('./search-maturity/pilot-2026-09-07.json', import.meta.url), 'utf8'));

const validation = validateSearchIntervention(intervention);
assert.equal(validation.valid, true, validation.errors.join('\n'));
assert.equal(intervention.intervention.status, 'source-implemented');
assert.equal(intervention.intervention.verification.state, 'source-implemented');
assert.equal(intervention.intervention.commitSha, after.changeCommit);
assert.equal(intervention.intervention.changedUrls[0], before.url);
assert.equal(after.url, before.url);
assert.deepEqual(intervention.outcomeWindows.map(window => window.days), [7, 14, 28]);
assert.ok(intervention.outcomeWindows.every(window => Date.parse(window.dueAt) > Date.parse(intervention.intervention.implementedAt)));
assert.equal(intervention.observations.length, 0, 'Future outcome windows must start unknown rather than manufacture baseline/outcome zeros');
assert.equal(intervention.disposition, 'inconclusive');
assert.equal(intervention.confidence, 'low');
assert.equal(intervention.guardrails.noCausalityInference, true);
assert.equal(intervention.guardrails.separateOutcomeChannels, true);

const cohort = buildSearchMaturityCohort(corpus, { intentFamily: intervention.intent.family });
const beforeDiff = compareTargetToSearchMaturityCohort(before, cohort);
const afterDiff = compareTargetToSearchMaturityCohort(after, cohort);
const beforeGapDimensions = beforeDiff.gaps.map(gap => gap.dimension).sort();
assert.deepEqual(beforeGapDimensions, [...intervention.intervention.changedDimensions].sort());
assert.equal(afterDiff.gaps.some(gap => intervention.intervention.changedDimensions.includes(gap.dimension)), false, 'The source intervention closed its implementation-profile gaps before any Search outcome is claimed');
assert.equal(after.guardrails.implementationImprovementNotSearchOutcome, true);

const implementationAt = Date.parse(intervention.intervention.implementedAt);
for (const window of intervention.outcomeWindows) {
  const expected = implementationAt + window.days * 24 * 60 * 60 * 1000;
  assert.equal(Date.parse(window.dueAt), expected, `dueAt must be deterministic for ${window.days}-day outcome window`);
}

console.log('PASS ARWP Search Maturity dogfood has a valid source-linked longitudinal intervention with deterministic future windows, exact changed dimensions, unknown outcomes and explicit no-causality guardrails');
