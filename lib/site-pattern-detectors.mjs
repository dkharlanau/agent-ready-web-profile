import fs from 'node:fs';
import path from 'node:path';
import { CANONICAL_CATALOGS } from './site-pattern-graph.mjs';

export const SITE_PATTERN_DETECTOR_REGISTRY_VERSION = '0.1';
export const SITE_PATTERN_DETECTOR_REGISTRY_PATH = 'registry/site-pattern-detectors.json';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const array = value => Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const semver = value => typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);

export function loadSitePatternDetectorRegistry(root = process.cwd(), file = SITE_PATTERN_DETECTOR_REGISTRY_PATH) {
  if (file !== SITE_PATTERN_DETECTOR_REGISTRY_PATH) throw new Error(`Detector registry path must be ${SITE_PATTERN_DETECTOR_REGISTRY_PATH}; alternate registries require an explicit future versioning contract.`);
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

function indexes(catalogs) {
  return {
    practices: new Map((catalogs?.discoverability?.tactics ?? []).map(row => [row.id, row])),
    antiPatterns: new Map((catalogs?.antiPatterns?.anti_patterns ?? []).map(row => [row.id, row]))
  };
}

export function validateSitePatternDetectorRegistry(registry, catalogs) {
  const errors = [];
  const warnings = [];
  if (!object(registry)) return { valid: false, errors: ['Detector registry must be an object.'], warnings, summary: { total: 0 } };
  if (registry.version !== SITE_PATTERN_DETECTOR_REGISTRY_VERSION) errors.push(`version must be ${SITE_PATTERN_DETECTOR_REGISTRY_VERSION}.`);
  if (registry.catalogs?.discoverability?.path !== CANONICAL_CATALOGS.discoverability) errors.push(`discoverability catalog path must be ${CANONICAL_CATALOGS.discoverability}.`);
  if (registry.catalogs?.antiPatterns?.path !== CANONICAL_CATALOGS.antiPatterns) errors.push(`antiPatterns catalog path must be ${CANONICAL_CATALOGS.antiPatterns}.`);
  if (registry.catalogs?.discoverability?.version !== catalogs?.discoverability?.version) errors.push('discoverability catalog version must match the loaded catalog.');
  if (registry.catalogs?.antiPatterns?.version !== catalogs?.antiPatterns?.version) errors.push('anti-pattern catalog version must match the loaded catalog.');
  if (!array(registry.detectors) || registry.detectors.length === 0) errors.push('detectors must contain at least one authority contract.');

  const catalog = indexes(catalogs);
  const ids = new Set();
  const allowedModes = new Set(['deterministic', 'heuristic', 'manual-assisted', 'provider-observation']);
  const allowedAuthority = new Set(['candidate', 'verdict']);
  const allowedVerdicts = new Set(['present', 'absent', 'unknown', 'not-applicable']);
  const allowedScopes = new Set(['site', 'route', 'route-prefix', 'route-role', 'template', 'page-type']);
  const allowedEvidence = new Set(['repo-file', 'source-html', 'rendered-dom', 'structured-data', 'http-probe', 'workflow-run', 'provider-report', 'manual-review', 'receipt']);
  const allowedReviewGates = new Set(['none', 'manual', 'owner-data', 'provider-data']);

  const summary = { total: 0, deterministic: 0, heuristic: 0, manualAssisted: 0, providerObservation: 0, candidateOnly: 0, verdictCapable: 0, practice: 0, antiPattern: 0 };

  for (const [index, detector] of (registry.detectors ?? []).entries()) {
    summary.total++;
    if (!object(detector) || !nonempty(detector.id)) {
      errors.push(`detectors[${index}] needs an id.`);
      continue;
    }
    if (ids.has(detector.id)) errors.push(`${detector.id}: duplicate detector id.`);
    ids.add(detector.id);
    if (!['practice', 'anti-pattern'].includes(detector.kind)) errors.push(`${detector.id}: invalid kind.`);
    else if (detector.kind === 'practice') summary.practice++;
    else summary.antiPattern++;
    if (!allowedModes.has(detector.mode)) errors.push(`${detector.id}: invalid mode.`);
    else if (detector.mode === 'deterministic') summary.deterministic++;
    else if (detector.mode === 'heuristic') summary.heuristic++;
    else if (detector.mode === 'manual-assisted') summary.manualAssisted++;
    else summary.providerObservation++;
    if (!allowedAuthority.has(detector.authority)) errors.push(`${detector.id}: invalid authority.`);
    else if (detector.authority === 'candidate') summary.candidateOnly++;
    else summary.verdictCapable++;
    if (!object(detector.pattern) || !nonempty(detector.pattern.id) || !semver(detector.pattern.version)) errors.push(`${detector.id}: pattern requires id and semantic version.`);
    if (!array(detector.allowedVerdicts) || detector.allowedVerdicts.length === 0 || detector.allowedVerdicts.some(value => !allowedVerdicts.has(value))) errors.push(`${detector.id}: invalid allowedVerdicts.`);
    if (!array(detector.targetScopes) || detector.targetScopes.length === 0 || detector.targetScopes.some(value => !allowedScopes.has(value))) errors.push(`${detector.id}: invalid targetScopes.`);
    if (!array(detector.evidenceTypes) || detector.evidenceTypes.length === 0 || detector.evidenceTypes.some(value => !allowedEvidence.has(value))) errors.push(`${detector.id}: invalid evidenceTypes.`);
    if (!allowedReviewGates.has(detector.reviewGate)) errors.push(`${detector.id}: invalid reviewGate.`);
    if (!array(detector.requires) || detector.requires.length === 0 || !detector.requires.every(nonempty)) errors.push(`${detector.id}: requires must explain the detector's prerequisites.`);
    if (!nonempty(detector.falsePositiveBoundary)) errors.push(`${detector.id}: falsePositiveBoundary is required.`);
    if (!array(detector.limitations) || detector.limitations.length === 0 || !detector.limitations.every(nonempty)) errors.push(`${detector.id}: limitations must remain explicit.`);

    const targetCatalog = detector.kind === 'practice' ? catalog.practices : catalog.antiPatterns;
    const pattern = targetCatalog.get(detector.pattern?.id);
    if (!pattern) {
      errors.push(`${detector.id}: unknown ${detector.kind} pattern ${detector.pattern?.id}.`);
      continue;
    }
    const version = detector.kind === 'practice' ? (pattern.pattern_version ?? '1.0.0') : pattern.version;
    if (detector.pattern.version !== version) errors.push(`${detector.id}: pattern version ${detector.pattern.version} does not match catalog version ${version}.`);

    if (detector.mode === 'heuristic') {
      if (detector.authority !== 'candidate') errors.push(`${detector.id}: heuristic detectors must have candidate authority.`);
      if (detector.allowedVerdicts.length !== 1 || detector.allowedVerdicts[0] !== 'unknown') errors.push(`${detector.id}: heuristic detectors may only emit unknown candidates.`);
    }
    if (detector.authority === 'candidate' && (detector.allowedVerdicts.length !== 1 || detector.allowedVerdicts[0] !== 'unknown')) errors.push(`${detector.id}: candidate authority may only emit unknown.`);
    if (detector.authority === 'verdict' && detector.allowedVerdicts.every(value => value === 'unknown')) warnings.push(`${detector.id}: verdict authority currently permits only unknown; candidate authority may be clearer.`);
    if (detector.mode === 'deterministic' && detector.reviewGate === 'manual') warnings.push(`${detector.id}: deterministic mode with a manual gate is unusual; verify that the detector is not actually manual-assisted.`);

    if (detector.kind === 'anti-pattern' && pattern.review_status === 'manual-required') {
      if (detector.authority === 'verdict' && !(detector.mode === 'manual-assisted' && detector.reviewGate === 'manual')) errors.push(`${detector.id}: ${pattern.id} is manual-required; automated/provider detectors may nominate unknown only. A verdict requires manual-assisted mode with a manual gate.`);
      if (detector.mode !== 'manual-assisted' && detector.allowedVerdicts.some(value => value === 'present' || value === 'absent')) errors.push(`${detector.id}: manual-required anti-pattern cannot expose automated present/absent verdicts.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings, summary };
}

export function selectSitePatternDetectors(registry, { patternId = null, kind = null, mode = null, authority = null } = {}) {
  const detectors = (registry?.detectors ?? []).filter(detector => {
    if (patternId && detector.pattern?.id !== patternId) return false;
    if (kind && detector.kind !== kind) return false;
    if (mode && detector.mode !== mode) return false;
    if (authority && detector.authority !== authority) return false;
    return true;
  });
  return {
    version: registry?.version,
    scope: 'Detector selection exposes authority and limitations. Candidate-only detectors do not establish pattern presence or absence.',
    returned: detectors.length,
    detectors
  };
}
