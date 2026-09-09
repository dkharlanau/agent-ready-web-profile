import fs from 'node:fs';
import path from 'node:path';
import { loadSitePatternCatalogs } from './site-pattern-graph.mjs';

export const PATTERN_APPLICABILITY_VERSION = '0.1';
export const PATTERN_APPLICABILITY_REGISTRY = 'registry/pattern-applicability-profiles.json';
export const SEARCH_SURFACE_BLUEPRINT = 'registry/search-surface-blueprint.json';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const array = value => Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

export function loadPatternApplicabilityRegistry(root = process.cwd()) {
  return readJson(path.join(root, PATTERN_APPLICABILITY_REGISTRY));
}

export function loadSearchSurfaceBlueprint(root = process.cwd()) {
  return readJson(path.join(root, SEARCH_SURFACE_BLUEPRINT));
}

export function collectCorpusApplicabilityTags(corpus) {
  return [...new Set((corpus?.tactics ?? []).flatMap(row => Array.isArray(row.applicability) ? row.applicability : []))].sort();
}

export function validatePatternApplicabilityRegistry(registry, blueprint, catalogs) {
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
    if (!profile.matchTags?.includes('all')) warnings.push(`${profile.id}: profile does not include the universal 'all' tag.`);
    for (const field of ['coreCategories', 'supportingCategories']) {
      if (!array(profile[field]) || !profile[field].every(value => categories.has(value))) errors.push(`${profile.id}: ${field} contains an unknown discoverability category.`);
    }
    if (!array(profile.antiPatternCategories) || !profile.antiPatternCategories.every(value => antiCategories.has(value))) errors.push(`${profile.id}: antiPatternCategories contains an unknown anti-pattern category.`);
  }
  for (const kind of Object.keys(blueprint?.siteKinds ?? {})) if (!ids.has(kind)) warnings.push(`No applicability profile exists for blueprint archetype ${kind}.`);
  return { valid: errors.length === 0, errors, warnings };
}

function tier(profile, category) {
  if (profile.coreCategories.includes(category)) return 'core-review';
  if (profile.supportingCategories.includes(category)) return 'supporting-review';
  return 'contextual-review';
}

export function buildArchetypePatternPlan({ archetype, registry, blueprint, catalogs }) {
  const profile = registry.profiles.find(row => row.id === archetype);
  if (!profile) throw new Error(`Unknown archetype ${archetype}.`);
  const surfacePlan = blueprint.siteKinds[profile.blueprintKind];
  const tags = new Set(profile.matchTags);
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
  const coveredTags = new Set(registry.profiles.flatMap(row => row.matchTags));
  const unmappedCorpusTags = observedTags.filter(tag => !coveredTags.has(tag));
  return {
    version: PATTERN_APPLICABILITY_VERSION,
    archetype,
    label: surfacePlan.label,
    scope: 'Archetype-aware review selection only. It does not establish that a pattern is present, absent, beneficial, or causally related to Search/AI outcomes.',
    surfaces: { required: surfacePlan.required, recommended: surfacePlan.recommended, opportunity: surfacePlan.opportunity },
    practices,
    antiPatterns,
    gaps: { unmappedCorpusTags }
  };
}

export function buildApplicabilityGapReport(registry, catalogs) {
  const observedTags = collectCorpusApplicabilityTags(catalogs.discoverability);
  const covered = new Map();
  for (const profile of registry.profiles) for (const tag of profile.matchTags) {
    if (!covered.has(tag)) covered.set(tag, []);
    covered.get(tag).push(profile.id);
  }
  return {
    version: PATTERN_APPLICABILITY_VERSION,
    scope: 'Coverage gaps in the archetype-to-pattern tag crosswalk. An unmapped tag is not treated as applicable or not-applicable automatically.',
    corpusTags: observedTags,
    unmappedCorpusTags: observedTags.filter(tag => !covered.has(tag)),
    tagCoverage: observedTags.map(tag => ({ tag, profiles: covered.get(tag) ?? [] }))
  };
}

export function loadApplicabilityRuntime(root = process.cwd()) {
  const catalogs = loadSitePatternCatalogs(root);
  return { registry: loadPatternApplicabilityRegistry(root), blueprint: loadSearchSurfaceBlueprint(root), catalogs };
}
