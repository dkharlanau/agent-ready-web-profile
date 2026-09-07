export const TRANSFORMATION_PACK_COVERAGE_VERSION = '0.1';

const STATUSES = new Set(['ready', 'no-op', 'blocked']);

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function optionalText(value, label) {
  if (value == null) return null;
  return text(value, label);
}

function blockerClass(reason) {
  const value = String(reason || 'unknown');
  if (value.includes('ownership') || value === 'route-not-mapped' || value === 'surface-not-mapped' || value === 'owner-file-not-mapped') return 'ownership';
  if (value.includes('mutation-class') || value.includes('policy') || value.includes('owner-review')) return 'review-boundary';
  if (value.includes('grounding')) return 'grounding';
  if (value.includes('digest-drift')) return 'drift';
  if (value.includes('input') || value.includes('before-content')) return 'input-evidence';
  if (value.includes('adapter-not-supported') || value.includes('unsupported')) return 'unsupported-coverage';
  return 'other';
}

function hintForBlockerClass(blockerClassName) {
  const hints = {
    ownership: 'Improve Repository Mapper ownership evidence before expanding mutation coverage.',
    'review-boundary': 'Keep this behind explicit owner/policy/editorial review; pack coverage is not authorization.',
    grounding: 'Collect reviewed source evidence before preparing a grounded transformation.',
    drift: 'Re-map and re-read the source before preparing another operation.',
    'input-evidence': 'Complete the observation inputs; do not count missing preparation evidence as a site defect.',
    'unsupported-coverage': 'Use observed portfolio demand to decide whether another adapter/pack is worth building.',
    other: 'Inspect the exact blocked reason before changing pack or mapper policy.'
  };
  return hints[blockerClassName] || hints.other;
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function sortedCounts(map, keyName) {
  return [...map.entries()]
    .map(([key, count]) => ({ [keyName]: key, count }))
    .sort((a, b) => b.count - a.count || String(a[keyName]).localeCompare(String(b[keyName])));
}

function makeBucket(id) {
  return {
    id,
    total: 0,
    ready: 0,
    noOp: 0,
    blocked: 0,
    covered: 0
  };
}

function addToBucket(bucket, status) {
  bucket.total += 1;
  if (status === 'ready') bucket.ready += 1;
  else if (status === 'no-op') bucket.noOp += 1;
  else bucket.blocked += 1;
  bucket.covered = bucket.ready + bucket.noOp;
}

function sortedBuckets(map) {
  return [...map.values()]
    .map(bucket => ({
      ...bucket,
      coverageRate: bucket.total ? Number((bucket.covered / bucket.total).toFixed(4)) : null
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeObservation(raw, index) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`observations[${index}] must be an object.`);
  const siteId = text(raw.siteId, `observations[${index}].siteId`);
  const result = raw.result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(`observations[${index}].result must be a Transformation Pack result object.`);
  const status = text(result.status, `observations[${index}].result.status`);
  if (!STATUSES.has(status)) throw new Error(`observations[${index}].result.status must be ready, no-op or blocked.`);
  const adapter = optionalText(raw.adapter ?? result?.evidence?.adapter, `observations[${index}].adapter`) || 'unknown';
  const packId = optionalText(result.packId, `observations[${index}].result.packId`) || 'unknown';
  const recipeId = optionalText(result.recipeId, `observations[${index}].result.recipeId`) || 'unknown';
  const reason = status === 'blocked' ? optionalText(result.reason, `observations[${index}].result.reason`) || 'unknown' : null;
  return {
    siteId,
    canonicalUrl: optionalText(raw.canonicalUrl, `observations[${index}].canonicalUrl`),
    repository: optionalText(raw.repository, `observations[${index}].repository`),
    adapter,
    packId,
    recipeId,
    status,
    reason,
    path: optionalText(result.path, `observations[${index}].result.path`),
    evidenceRef: optionalText(raw.evidenceRef, `observations[${index}].evidenceRef`)
  };
}

export function validateTransformationPackCoverageManifest(manifest) {
  const errors = [];
  try {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Coverage manifest must be an object.');
    if (manifest.version !== TRANSFORMATION_PACK_COVERAGE_VERSION) throw new Error(`Coverage manifest version must be ${TRANSFORMATION_PACK_COVERAGE_VERSION}.`);
    if (!Array.isArray(manifest.observations) || manifest.observations.length === 0) throw new Error('Coverage manifest requires a non-empty observations array.');
    manifest.observations.forEach((observation, index) => normalizeObservation(observation, index));
  } catch (error) {
    errors.push(error.message);
  }
  return { valid: errors.length === 0, errors };
}

export function summarizeTransformationPackCoverage(manifest) {
  const validation = validateTransformationPackCoverageManifest(manifest);
  if (!validation.valid) throw new Error(`Invalid Transformation Pack coverage manifest: ${validation.errors.join('; ')}`);

  const observations = manifest.observations.map(normalizeObservation);
  const statusCounts = { ready: 0, noOp: 0, blocked: 0 };
  const adapterBuckets = new Map();
  const packBuckets = new Map();
  const recipeBuckets = new Map();
  const siteBuckets = new Map();
  const reasonCounts = new Map();
  const classCounts = new Map();

  for (const observation of observations) {
    if (observation.status === 'ready') statusCounts.ready += 1;
    else if (observation.status === 'no-op') statusCounts.noOp += 1;
    else statusCounts.blocked += 1;

    for (const [map, id] of [
      [adapterBuckets, observation.adapter],
      [packBuckets, observation.packId],
      [recipeBuckets, `${observation.packId}/${observation.recipeId}`],
      [siteBuckets, observation.siteId]
    ]) {
      if (!map.has(id)) map.set(id, makeBucket(id));
      addToBucket(map.get(id), observation.status);
    }

    if (observation.status === 'blocked') {
      increment(reasonCounts, observation.reason);
      increment(classCounts, blockerClass(observation.reason));
    }
  }

  const total = observations.length;
  const covered = statusCounts.ready + statusCounts.noOp;
  const blockers = sortedCounts(reasonCounts, 'reason').map(item => ({
    ...item,
    class: blockerClass(item.reason)
  }));
  const blockerClasses = sortedCounts(classCounts, 'class').map(item => ({
    ...item,
    nextStep: hintForBlockerClass(item.class)
  }));

  return {
    version: TRANSFORMATION_PACK_COVERAGE_VERSION,
    evidenceClass: 'portfolio-transformation-preparation',
    observedAt: optionalText(manifest.observedAt, 'observedAt'),
    portfolioId: optionalText(manifest.portfolioId, 'portfolioId'),
    totals: {
      observations: total,
      ready: statusCounts.ready,
      noOp: statusCounts.noOp,
      blocked: statusCounts.blocked,
      covered,
      coverageRate: Number((covered / total).toFixed(4))
    },
    byAdapter: sortedBuckets(adapterBuckets),
    byPack: sortedBuckets(packBuckets),
    byRecipe: sortedBuckets(recipeBuckets),
    bySite: sortedBuckets(siteBuckets),
    blockedReasons: blockers,
    blockerClasses,
    observations,
    boundaries: {
      coverageIsReadinessScore: false,
      coveragePredictsRankingOrCitation: false,
      coverageAuthorizesProductionMutation: false,
      noOpMeansNoChangeRequiredForObservedPreparation: true,
      blockedMeansPreparationNeedsEvidenceReviewOrCapability: true,
      missingObservationsAreNotCountedAsFailures: true
    }
  };
}
