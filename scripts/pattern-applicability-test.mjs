import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildApplicabilityGapReport, buildArchetypePatternPlan, buildPlanFromSitePatternContext, loadApplicabilityRuntime, validatePatternApplicabilityRegistry, validateSitePatternContext } from '../lib/pattern-applicability.mjs';

const runtime = loadApplicabilityRuntime(process.cwd());
const { registry, facetRegistry, blueprint, catalogs } = runtime;
const validation = validatePatternApplicabilityRegistry(registry, blueprint, catalogs, facetRegistry);
assert.equal(validation.valid, true, validation.errors.join('\n'));
assert.equal(registry.profiles.length, Object.keys(blueprint.siteKinds).length, 'every existing blueprint archetype should have one applicability profile');

for (const profile of registry.profiles) {
  const basePlan = buildArchetypePatternPlan({ archetype: profile.id, facets: [], registry, facetRegistry, blueprint, catalogs });
  assert.equal(basePlan.archetype, profile.id);
  assert.ok(basePlan.practices.length > 0, `${profile.id} should select at least universal/applicable practices`);
  assert.ok(Array.isArray(basePlan.surfaces.required));
  assert.ok(Array.isArray(basePlan.antiPatterns));
  assert.equal(Object.hasOwn(basePlan, 'score'), false, 'archetype plan must not collapse into a score');
  assert.match(basePlan.scope, /does not establish/i);
  assert.ok(basePlan.practices.every(row => row.applicabilityMatched.length > 0));
  assert.ok(basePlan.antiPatterns.every(row => row.status === 'manual-review-candidate'));
}

const softwareBase = buildArchetypePatternPlan({ archetype: 'software-product', facets: [], registry, facetRegistry, blueprint, catalogs });
const softwareRich = buildArchetypePatternPlan({ archetype: 'software-product', facets: ['interactive-web','machine-interfaces','static-delivery'], registry, facetRegistry, blueprint, catalogs });
assert.ok(softwareRich.practices.length >= softwareBase.practices.length, 'declared facets may expand the bounded review set');
assert.deepEqual(softwareRich.facets, ['interactive-web','machine-interfaces','static-delivery']);

const gaps = buildApplicabilityGapReport(registry, catalogs, facetRegistry);
assert.ok(Array.isArray(gaps.corpusTags));
assert.ok(Array.isArray(gaps.unmappedCorpusTags));
assert.ok(Array.isArray(gaps.tagCoverage));
assert.match(gaps.scope, /not treated as applicable or not-applicable automatically/i);
assert.equal(gaps.unmappedCorpusTags.length, 0, `all current corpus applicability tags need an archetype, universal or facet owner: ${gaps.unmappedCorpusTags.join(', ')}`);

const context = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/site-pattern-context-v0.1.schema.json',
  version: '0.1',
  siteFocus: { path: '.arwp/site-focus.json', version: '0.3' },
  runtime: { repository: 'dkharlanau/agent-ready-web-profile', commit: '2cc377740e9d2a6500208e2f9ad3c93526b989d8', applicabilityVersion: '0.1' },
  archetype: 'documentation-research',
  facets: ['static-delivery','research-evaluation'],
  basis: 'mixed',
  reviewedAt: '2026-09-09',
  rationale: 'Fixture uses the documentation/research product purpose plus observed static and research surfaces.',
  knownUnknowns: ['The context does not establish that selected practices are implemented or beneficial.']
};
const schema = JSON.parse(fs.readFileSync('schema/site-pattern-context-v0.1.schema.json','utf8'));
const ajv = new Ajv2020({allErrors:true,strict:false});
addFormats(ajv);
const schemaValidate = ajv.compile(schema);
assert.equal(schemaValidate(context), true, JSON.stringify(schemaValidate.errors));
const contextValidation = validateSitePatternContext(context, runtime);
assert.equal(contextValidation.valid, true, contextValidation.errors.join('\n'));
const contextPlan = buildPlanFromSitePatternContext(context, runtime);
assert.equal(contextPlan.context.archetype, 'documentation-research');
assert.ok(contextPlan.plan.practices.length > 0);

const badFacet = structuredClone(context);
badFacet.facets = ['invented-facet'];
assert.equal(validateSitePatternContext(badFacet, runtime).valid, false);

const badSchema = structuredClone(context);
badSchema.runtime.commit = 'main';
assert.equal(schemaValidate(badSchema), false, 'context schema must require an exact runtime SHA');

let failed = false;
try { buildArchetypePatternPlan({ archetype: 'not-a-real-archetype', facets: [], registry, facetRegistry, blueprint, catalogs }); } catch { failed = true; }
assert.equal(failed, true, 'unknown archetypes must fail closed');

console.log('PASS Pattern Applicability v0.1 separates purpose archetypes from capability facets, covers current corpus tags, preserves review-only anti-patterns and validates pinned Site Pattern Context');
