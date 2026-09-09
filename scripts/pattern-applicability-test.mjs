import assert from 'node:assert/strict';
import { buildApplicabilityGapReport, buildArchetypePatternPlan, loadApplicabilityRuntime, validatePatternApplicabilityRegistry } from '../lib/pattern-applicability.mjs';

const { registry, blueprint, catalogs } = loadApplicabilityRuntime(process.cwd());
const validation = validatePatternApplicabilityRegistry(registry, blueprint, catalogs);
assert.equal(validation.valid, true, validation.errors.join('\n'));
assert.equal(registry.profiles.length, Object.keys(blueprint.siteKinds).length, 'every existing blueprint archetype should have one applicability profile');

for (const profile of registry.profiles) {
  const plan = buildArchetypePatternPlan({ archetype: profile.id, registry, blueprint, catalogs });
  assert.equal(plan.archetype, profile.id);
  assert.ok(plan.practices.length > 0, `${profile.id} should select at least universal/applicable practices`);
  assert.ok(Array.isArray(plan.surfaces.required));
  assert.ok(Array.isArray(plan.antiPatterns));
  assert.equal(Object.hasOwn(plan, 'score'), false, 'archetype plan must not collapse into a score');
  assert.match(plan.scope, /does not establish/i);
  assert.ok(plan.practices.every(row => row.applicabilityMatched.length > 0));
  assert.ok(plan.antiPatterns.every(row => row.status === 'manual-review-candidate'));
}

const gaps = buildApplicabilityGapReport(registry, catalogs);
assert.ok(Array.isArray(gaps.corpusTags));
assert.ok(Array.isArray(gaps.unmappedCorpusTags));
assert.ok(Array.isArray(gaps.tagCoverage));
assert.match(gaps.scope, /not treated as applicable or not-applicable automatically/i);

let failed = false;
try { buildArchetypePatternPlan({ archetype: 'not-a-real-archetype', registry, blueprint, catalogs }); } catch { failed = true; }
assert.equal(failed, true, 'unknown archetypes must fail closed');

console.log('PASS Pattern Applicability v0.1 reuses 7 Search Surface archetypes, preserves native tactic applicability, emits gap tags, and keeps anti-patterns review-only');
