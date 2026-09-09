import fs from 'node:fs';
import path from 'node:path';
import { loadSitePatternCatalogs } from './site-pattern-graph.mjs';

export const PATTERN_APPLICABILITY_VERSION = '0.1';
export const PATTERN_APPLICABILITY_REGISTRY = 'registry/pattern-applicability-profiles.json';
export const PATTERN_FACET_REGISTRY = 'registry/pattern-applicability-facets.json';
export const SEARCH_SURFACE_BLUEPRINT = 'registry/search-surface-blueprint.json';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const array = value => Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

export function loadPatternApplicabilityRegistry(root = process.cwd()) {
  return readJson(path.join(root, PATTERN_APPLICABILITY_REGISTRY));
}

export function loadPatternFacetRegistry(root = process.cwd()) {
  return readJson(path.join(root, PATTERN_FACET_REGISTRY));
}

export function loadSearchSurfaceBlueprint(root = process.cwd()) {
  return readJson(path.join(root, SEARCH_SURFACE_BLUEPRINT));
}

export function collectCorpusApplicabilityTags(corpus) {
  return [...new Set((corpus?.tactics ?? []).flatMap(row => Array.isArray(row.applicability) ? row.applicability : []))].sort();
}

export function validatePatternFacetRegistry(facetRegistry, catalogs) {
  const errors = [];
  const warnings = [];
  if (!object(facetRegistry) || facetRegistry.version !== '0.1') return { valid: false, errors: ['Facet registry version must be 0.1.'], warnings };
  if (!array(facetRegistry.universalTags) || facetRegistry.universalTags.length === 0 || !facetRegistry.universalTags.every(nonempty)) errors.push('universalTags must be non-empty strings.');
  if (!array(facetRegistry.facets) || facetRegistry.facets.length === 0) errors.push('facets must be non-empty.');
  const ids = new Set();
  const tags = new Map();
  for (const [index, facet] of (facetRegistry.facets ?? []).entries()) {
    if (!object(facet) || !nonempty(facet.id) || !nonempty(facet.label) || !array(facet.tags) || facet.tags.length === 0 || !facet.tags.every(nonempty)) {
      errors.push(`facets[${index}] requires id, label and non-empty tags.`);
      continue;
    }
    if (ids.has(facet.id)) errors.push(`${facet.id}: duplicate facet id.`);
    ids.add(facet.id);
    for (const tag of facet.tags) {
      if (!tags.has(tag)) tags.set(tag, []);
      tags.get(tag).push(facet.id);
    }
  }
  for (const [tag, owners] of tags) if (owners.length > 1) warnings.push(`${tag}: represented by multiple facets (${owners.join(', ')}); review whether the overlap is intentional.`);
  const corpusTags = collectCorpusApplicabilityTags(catalogs?.discoverability);
  for (const tag of facetRegistry.universalTags ?? []) if (!corpusTags.includes(tag)) warnings.push(`${tag}: universal tag is not currently used by the corpus.`);
  return { valid: errors.length === 0, errors, warnings };
}

export function validatePatternApplicabilityRegistry(registry, blueprint, catalogs, facetRegistry = null) {
  const errors = [];
  const warnings = [];
  if (!object(registry)) return { valid: false, errors: ['Applicability registry must be an object.'], warnings };
  if (registry.version !== PATTERN_APPLICABILITY_VERSION) errors.push(`version must be ${PATTERN_APPLICABILITY_VERSION}.`);
  if (registry.blueprint?.path !== SEARCH_SURFACE_BLUEPRINT || registry.blueprint?.version !== blueprint?.version) errors.push('blueprint reference must point to the loaded Search Surface Blueprint version.');
  if (registry.catalogs?.discoverability?.version !== catalogs?.discoverability?.version) errors.push('discoverability catalog version must match.');
  if (registry.catalogs?.antiPatterns?.version !== catalogs?.antiPatterns?.version) errors.push('anti-pattern catalog version must match.');
  if (!array(registry.profiles) || registry.profiles.length === 0) errors.push('profiles must be non-empty.');

  const categories = new Set((catalogs?.discoverability?.categories ?? []).map(row => row.id));
  const antiCategories = new Set((catalogs?.antiPatterns?.anti_patterns ?? []).map(row => row.category));
  const ids = new Set();
  for (const [index, profile] of (registry.profiles ?? []).entries()) {
    if (!object(profile) || !nonempty(profile.id)) { errors.push(`profiles[${index}] needs an id.`); continue; }
    if (ids.has(profile.id)) errors.push(`${profile.id}: duplicate profile id.`);
    ids.add(profile.id);
    if (!blueprint?.siteKinds?.[profile.blueprintKind]) errors.push(`${profile.id}: blueprintKind ${profile.blueprintKind} does not exist.`);
    if (!array(profile.matchTags) || profile.matchTags.length === 0 || !profile.matchTags.every(nonempty)) errors.push(`${profile.id}: matchTags must be non-empty strings.`);
    for (const field of ['coreCategories', 'supportingCategories']) {
      if (!array(profile[field]) || !profile[field].every(value => categories.has(value))) errors.push(`${profile.id}: ${field} contains an unknown discoverability category.`);
    }
    if (!array(profile.antiPatternCategories) || !profile.antiPatternCategories.every(value => antiCategories.has(value))) errors.push(`${profile.id}: antiPatternCategories contains an unknown anti-pattern category.`);
  }
  for (const kind of Object.keys(blueprint?.siteKinds ?? {})) if (!ids.has(kind)) warnings.push(`No applicability profile exists for blueprint archetype ${kind}.`);
  if (facetRegistry) {
    const facets = validatePatternFacetRegistry(facetRegistry, catalogs);
    errors.push(...facets.errors);
    warnings.push(...facets.warnings);
  }
  return { valid: errors.length === 0, errors, warnings };
}

function tier(profile, category) {
  if (profile.coreCategories.includes(category)) return 'core-review';
  if (profile.supportingCategories.includes(category)) return 'supporting-review';
  return 'contextual-review';
}

function selectedTagSet(profile, facetRegistry, selectedFacets = []) {
  const tags = new Set([...(facetRegistry?.universalTags ?? ['all']), ...profile.matchTags]);
  const facetIndex = new Map((facetRegistry?.facets ?? []).map(row => [row.id, row]));
  for (const facetId of selectedFacets) {
    const facet = facetIndex.get(facetId);
    if (!facet) throw new Error(`Unknown applicability facet ${facetId}.`);
    for (const tag of facet.tags) tags.add(tag);
  }
  return tags;
}

export function buildArchetypePatternPlan({ archetype, facets = [], registry, facetRegistry, blueprint, catalogs }) {
  const profile = registry.profiles.find(row => row.id === archetype);
  if (!profile) throw new Error(`Unknown archetype ${archetype}.`);
  const surfacePlan = blueprint.siteKinds[profile.blueprintKind];
  const tags = selectedTagSet(profile, facetRegistry, facets);
  const practices = (catalogs.discoverability?.tactics ?? [])
    .filter(row => (row.lifecycle?.status ?? 'active') === 'active')
    .filter(row => (row.applicability ?? []).some(value => tags.has(value)))
    .map(row => ({
      id: row.id,
      version: row.pattern_version ?? '1.0.0',
      category: row.category,
      tier: tier(profile, row.category),
      evidenceLevel: row.evidence_level,
      applicabilityMatched: (row.applicability ?? []).filter(value => tags.has(value)),
      problem: row.problem,
      measurement: row.measurement
    }))
    .sort((a, b) => ['core-review','supporting-review','contextual-review'].indexOf(a.tier) - ['core-review','supporting-review','contextual-review'].indexOf(b.tier) || a.id.localeCompare(b.id));

  const antiPatterns = (catalogs.antiPatterns?.anti_patterns ?? [])
    .filter(row => profile.antiPatternCategories.includes(row.category))
    .map(row => ({ id: row.id, version: row.version, category: row.category, status: 'manual-review-candidate', falsePositiveBoundary: row.false_positive_boundary, replacement: row.replacement }));

  const observedTags = collectCorpusApplicabilityTags(catalogs.discoverability);
  const coveredTags = new Set([...(facetRegistry?.universalTags ?? []), ...registry.profiles.flatMap(row => row.matchTags), ...(facetRegistry?.facets ?? []).flatMap(row => row.tags)]);
  const unmappedCorpusTags = observedTags.filter(tag => !coveredTags.has(tag));
  return {
    version: PATTERN_APPLICABILITY_VERSION,
    archetype,
    facets: [...facets].sort(),
    label: surfacePlan.label,
    scope: 'Archetype-and-facet-aware review selection only. It does not establish that a pattern is present, absent, beneficial, or causally related to Search/AI outcomes.',
    surfaces: { required: surfacePlan.required, recommended: surfacePlan.recommended, opportunity: surfacePlan.opportunity },
    practices,
    antiPatterns,
    gaps: { unmappedCorpusTags }
  };
}

export function buildApplicabilityGapReport(registry, catalogs, facetRegistry = null) {
  const observedTags = collectCorpusApplicabilityTags(catalogs.discoverability);
  const covered = new Map();
  const add = (tag, owner) => {
    if (!covered.has(tag)) covered.set(tag, []);
    covered.get(tag).push(owner);
  };
  for (const tag of facetRegistry?.universalTags ?? []) add(tag, 'universal');
  for (const profile of registry.profiles) for (const tag of profile.matchTags) add(tag, `archetype:${profile.id}`);
  for (const facet of facetRegistry?.facets ?? []) for (const tag of facet.tags) add(tag, `facet:${facet.id}`);
  return {
    version: PATTERN_APPLICABILITY_VERSION,
    scope: 'Coverage gaps in the archetype/facet-to-pattern tag crosswalk. An unmapped tag is not treated as applicable or not-applicable automatically.',
    corpusTags: observedTags,
    unmappedCorpusTags: observedTags.filter(tag => !covered.has(tag)),
    tagCoverage: observedTags.map(tag => ({ tag, owners: covered.get(tag) ?? [] }))
  };
}

export function validateSitePatternContext(context, { registry, facetRegistry }) {
  const errors = [];
  const warnings = [];
  if (!object(context)) return { valid: false, errors: ['Site Pattern Context must be an object.'], warnings };
  if (context.version !== '0.1') errors.push('context.version must be 0.1.');
  if (context.siteFocus?.path !== '.arwp/site-focus.json' || context.siteFocus?.version !== '0.3') errors.push('context must bind Site Focus v0.3 at .arwp/site-focus.json.');
  if (context.runtime?.repository !== 'dkharlanau/agent-ready-web-profile' || !/^[a-f0-9]{40}$/.test(context.runtime?.commit ?? '') || context.runtime?.applicabilityVersion !== PATTERN_APPLICABILITY_VERSION) errors.push('runtime must pin the ARWP repository, exact commit and current applicability version.');
  if (!registry.profiles.some(row => row.id === context.archetype)) errors.push(`unknown archetype ${context.archetype}.`);
  const facetIds = new Set((facetRegistry?.facets ?? []).map(row => row.id));
  if (!array(context.facets) || !context.facets.every(value => facetIds.has(value))) errors.push('facets must reference known facet IDs.');
  if (!['manual-reviewed','repository-observed','mixed'].includes(context.basis)) errors.push('basis must be manual-reviewed, repository-observed or mixed.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(context.reviewedAt ?? '')) errors.push('reviewedAt must be YYYY-MM-DD.');
  if (!nonempty(context.rationale)) errors.push('rationale is required.');
  if (!array(context.knownUnknowns) || context.knownUnknowns.length === 0 || !context.knownUnknowns.every(nonempty)) errors.push('knownUnknowns must be non-empty.');
  if (context.facets?.length === 0) warnings.push('No facets declared; only universal and archetype tags will be selected.');
  return { valid: errors.length === 0, errors, warnings };
}

export function buildPlanFromSitePatternContext(context, runtime) {
  const validation = validateSitePatternContext(context, runtime);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  return {
    context: { archetype: context.archetype, facets: context.facets, basis: context.basis, reviewedAt: context.reviewedAt, rationale: context.rationale, runtimeCommit: context.runtime.commit },
    plan: buildArchetypePatternPlan({ archetype: context.archetype, facets: context.facets, ...runtime }),
    knownUnknowns: context.knownUnknowns
  };
}

export function loadApplicabilityRuntime(root = process.cwd()) {
  const catalogs = loadSitePatternCatalogs(root);
  return { registry: loadPatternApplicabilityRegistry(root), facetRegistry: loadPatternFacetRegistry(root), blueprint: loadSearchSurfaceBlueprint(root), catalogs };
}
