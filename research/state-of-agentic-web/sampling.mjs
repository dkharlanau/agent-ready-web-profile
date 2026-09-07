import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultPlanPath = path.join(here, 'sampling-plan.json');
const FORBIDDEN_FRAME_FIELDS = new Set([
  'resolverOutcome',
  'resolverCorrect',
  'protocolOutcome',
  'protocolObservations',
  'decisionQuality',
  'readinessScore',
  'adoptionScore',
  'rankingOutcome'
]);

export function loadSamplingPlan(file = defaultPlanPath) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function canonicalHost(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
}

function pushDuplicateErrors(values, label, errors) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) errors.push(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

export function validateSamplingPlan(plan = loadSamplingPlan()) {
  const errors = [];
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return { valid: false, errors: ['Sampling plan must be an object.'] };
  if (plan.version !== '0.1') errors.push(`Unsupported sampling plan version: ${plan.version}`);
  if (plan.representativeOfPublicWeb !== false) errors.push('representativeOfPublicWeb must remain false.');
  if (!Array.isArray(plan.strata) || plan.strata.length < 2) errors.push('At least two sampling strata are required.');
  if (!Array.isArray(plan.assignmentPolicy?.priority) || !plan.assignmentPolicy.priority.length) errors.push('assignmentPolicy.priority is required.');
  if (plan.assignmentPolicy?.ownerControlledExcludedFromIndependentAggregate !== true) errors.push('Owner-controlled sites must be excluded from the independent aggregate.');
  if (plan.selectionPolicy?.frameFrozenBeforeOutcomeReview !== true) errors.push('Candidate frame must be frozen before outcome review.');
  if (plan.selectionPolicy?.deterministicSelection !== 'sha256-release-seed-canonical-host') errors.push('Deterministic selection contract must be sha256-release-seed-canonical-host.');
  if (plan.selectionPolicy?.selectedFailuresAreNotSilentlyReplaced !== true) errors.push('Selected failures must not be silently replaced.');
  if (plan.selectionPolicy?.selectionUsesResolverOutput !== false || plan.selectionPolicy?.selectionUsesProtocolOutcome !== false) errors.push('Selection must not use Resolver or protocol outcomes.');
  if (!positiveInteger(plan.targetDesign?.targetSitesPerStratum)) errors.push('targetDesign.targetSitesPerStratum must be a positive integer.');
  if (!positiveInteger(plan.targetDesign?.intentsPerSite)) errors.push('targetDesign.intentsPerSite must be a positive integer.');

  const strata = Array.isArray(plan.strata) ? plan.strata : [];
  const ids = strata.map(item => item?.id).filter(Boolean);
  pushDuplicateErrors(ids, 'stratum id', errors);
  const knownIds = new Set(ids);
  for (const stratum of strata) {
    if (!stratum?.id || !stratum?.title || !stratum?.definition) errors.push(`Stratum missing identity/definition: ${stratum?.id || '<unknown>'}`);
    if (!stratum?.samplingFrame || !stratum?.selectionRule) errors.push(`Stratum missing samplingFrame/selectionRule: ${stratum?.id || '<unknown>'}`);
    if (!Array.isArray(stratum?.knownBias) || !stratum.knownBias.length) errors.push(`Stratum must preserve knownBias: ${stratum?.id || '<unknown>'}`);
  }

  for (const id of plan.assignmentPolicy?.priority || []) {
    if (!knownIds.has(id)) errors.push(`Unknown priority stratum: ${id}`);
  }
  for (const id of knownIds) {
    if (!plan.assignmentPolicy?.priority?.includes(id)) errors.push(`Stratum missing from assignment priority: ${id}`);
  }

  if (positiveInteger(plan.targetDesign?.targetSitesPerStratum) && strata.length) {
    const derivedSites = plan.targetDesign.targetSitesPerStratum * strata.length;
    if (plan.targetDesign.targetIndependentSites !== derivedSites) errors.push(`targetIndependentSites must equal strata * targetSitesPerStratum (${derivedSites}).`);
    const derivedCases = derivedSites * plan.targetDesign.intentsPerSite;
    if (plan.targetDesign.targetDecisionCases !== derivedCases) errors.push(`targetDecisionCases must equal targetIndependentSites * intentsPerSite (${derivedCases}).`);
  }

  if (plan.guardrails?.noReadinessScore !== true) errors.push('noReadinessScore guardrail must remain true.');
  if (plan.guardrails?.noGeneralWebAdoptionInference !== true) errors.push('noGeneralWebAdoptionInference guardrail must remain true.');
  if (plan.guardrails?.noGroundTruthFromResolverOutput !== true) errors.push('Ground truth must not come from Resolver output.');
  return { valid: errors.length === 0, errors };
}

export function validateCandidateManifest(manifest, plan = loadSamplingPlan()) {
  const planValidation = validateSamplingPlan(plan);
  const errors = [...planValidation.errors];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return { valid: false, errors: [...errors, 'Candidate manifest must be an object.'] };
  if (!manifest.snapshotId) errors.push('snapshotId is required.');
  if (!manifest.evidenceDate || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.evidenceDate)) errors.push('evidenceDate must be YYYY-MM-DD.');
  if (!manifest.releaseSeed || String(manifest.releaseSeed).length < 8) errors.push('releaseSeed of at least 8 characters is required.');
  if (!Array.isArray(manifest.candidates)) errors.push('candidates must be an array.');

  const knownStrata = new Set((plan.strata || []).map(item => item.id));
  const candidates = Array.isArray(manifest.candidates) ? manifest.candidates : [];
  pushDuplicateErrors(candidates.map(item => item?.id).filter(Boolean), 'candidate id', errors);

  for (const candidate of candidates) {
    const id = candidate?.id || '<unknown>';
    if (!candidate?.id) errors.push('Candidate id is required.');
    if (!canonicalHost(candidate?.canonicalUrl)) errors.push(`Candidate ${id} has invalid canonicalUrl.`);
    if (typeof candidate?.ownerControlled !== 'boolean') errors.push(`Candidate ${id} must declare ownerControlled.`);
    if (!candidate?.discoverySource?.url || !canonicalHost(candidate.discoverySource.url)) errors.push(`Candidate ${id} requires a public discoverySource.url.`);
    if (!candidate?.discoverySource?.observedAt || !/^\d{4}-\d{2}-\d{2}$/.test(candidate.discoverySource.observedAt)) errors.push(`Candidate ${id} requires discoverySource.observedAt YYYY-MM-DD.`);
    if (!Array.isArray(candidate?.eligibleStrata) || !candidate.eligibleStrata.length) errors.push(`Candidate ${id} requires reviewed eligibleStrata.`);
    for (const stratum of candidate?.eligibleStrata || []) {
      if (!knownStrata.has(stratum)) errors.push(`Candidate ${id} references unknown stratum: ${stratum}`);
    }
    if (!candidate?.eligibilityRationale || String(candidate.eligibilityRationale).trim().length < 12) errors.push(`Candidate ${id} requires a recorded eligibilityRationale.`);
    if (candidate?.preflightState && !['unknown', 'reachable', 'unreachable'].includes(candidate.preflightState)) errors.push(`Candidate ${id} has invalid preflightState.`);
    for (const field of Object.keys(candidate || {})) {
      if (FORBIDDEN_FRAME_FIELDS.has(field)) errors.push(`Candidate ${id} contains forbidden outcome field before sample freeze: ${field}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function assignedStratum(candidate, plan) {
  const eligible = new Set(candidate.eligibleStrata || []);
  return (plan.assignmentPolicy.priority || []).find(id => eligible.has(id)) || null;
}

function selectionKey(seed, host) {
  return createHash('sha256').update(`${seed}\0${host}`).digest('hex');
}

export function selectStratifiedSample(manifest, plan = loadSamplingPlan()) {
  const validation = validateCandidateManifest(manifest, plan);
  if (!validation.valid) throw new Error(`Invalid stratified candidate manifest:\n- ${validation.errors.join('\n- ')}`);

  const sorted = [...manifest.candidates].sort((a, b) => {
    const hostDelta = canonicalHost(a.canonicalUrl).localeCompare(canonicalHost(b.canonicalUrl));
    return hostDelta || a.id.localeCompare(b.id);
  });
  const firstByHost = new Map();
  const duplicateHosts = [];
  for (const candidate of sorted) {
    const host = canonicalHost(candidate.canonicalUrl);
    if (firstByHost.has(host)) {
      duplicateHosts.push({
        canonicalHost: host,
        keptCandidateId: firstByHost.get(host).id,
        duplicateCandidateId: candidate.id,
        reason: 'canonical-host-deduplication'
      });
      continue;
    }
    firstByHost.set(host, candidate);
  }

  const ownerControlledExcluded = [];
  const unassigned = [];
  const eligibleByStratum = new Map((plan.strata || []).map(item => [item.id, []]));

  for (const candidate of firstByHost.values()) {
    const stratum = assignedStratum(candidate, plan);
    if (!stratum) {
      unassigned.push({ candidateId: candidate.id, canonicalUrl: candidate.canonicalUrl, reason: 'no-assigned-stratum' });
      continue;
    }
    if (candidate.ownerControlled) {
      ownerControlledExcluded.push({ candidateId: candidate.id, canonicalUrl: candidate.canonicalUrl, assignedStratum: stratum, reason: 'owner-controlled-excluded' });
      continue;
    }
    const host = canonicalHost(candidate.canonicalUrl);
    eligibleByStratum.get(stratum).push({
      candidateId: candidate.id,
      canonicalUrl: candidate.canonicalUrl,
      canonicalHost: host,
      assignedStratum: stratum,
      eligibleStrata: [...candidate.eligibleStrata],
      eligibilityRationale: candidate.eligibilityRationale,
      discoverySource: { ...candidate.discoverySource },
      preflightState: candidate.preflightState || 'unknown',
      selectionKey: selectionKey(manifest.releaseSeed, host)
    });
  }

  const strata = [];
  const selected = [];
  const target = plan.targetDesign.targetSitesPerStratum;
  for (const definition of plan.strata) {
    const eligible = eligibleByStratum.get(definition.id)
      .sort((a, b) => a.selectionKey.localeCompare(b.selectionKey) || a.candidateId.localeCompare(b.candidateId));
    const chosen = eligible.slice(0, target).map((item, index) => ({ ...item, selectionRank: index + 1 }));
    selected.push(...chosen);
    strata.push({
      id: definition.id,
      title: definition.title,
      targetSites: target,
      independentEligibleDenominator: eligible.length,
      selectedSites: chosen.length,
      shortfall: Math.max(0, target - chosen.length),
      selectedCandidateIds: chosen.map(item => item.candidateId)
    });
  }

  return {
    version: '0.1',
    snapshotId: manifest.snapshotId,
    evidenceDate: manifest.evidenceDate,
    releaseSeed: manifest.releaseSeed,
    representativeOfPublicWeb: false,
    targetDesign: { ...plan.targetDesign },
    summary: {
      rawCandidateRecords: manifest.candidates.length,
      canonicalHostsAfterDeduplication: firstByHost.size,
      duplicateHostRecordsRetainedAsExclusions: duplicateHosts.length,
      ownerControlledExcluded: ownerControlledExcluded.length,
      unassigned: unassigned.length,
      independentEligible: [...eligibleByStratum.values()].reduce((sum, items) => sum + items.length, 0),
      selectedIndependentSites: selected.length,
      totalShortfall: strata.reduce((sum, item) => sum + item.shortfall, 0)
    },
    strata,
    selected,
    exclusions: {
      duplicateHosts,
      ownerControlled: ownerControlledExcluded,
      unassigned
    },
    guardrails: {
      frameFrozenBeforeOutcomeReview: true,
      selectionUsesResolverOutput: false,
      selectionUsesProtocolOutcome: false,
      selectedFailuresAreNotSilentlyReplaced: true,
      ownerControlledExcludedFromIndependentAggregate: true,
      noReadinessScore: true,
      noGeneralWebAdoptionInference: true
    },
    note: 'This output freezes who is selected for evidence collection. It does not contain protocol outcomes, Resolver ground truth, adoption estimates or ranking claims.'
  };
}
