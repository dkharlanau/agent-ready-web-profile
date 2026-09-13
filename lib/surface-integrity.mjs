import crypto from 'node:crypto';

export const SURFACE_INTEGRITY_VERSION = '0.1';
export const SURFACE_STATES = Object.freeze([
  'pass',
  'fail',
  'warning',
  'stale',
  'missing',
  'incomplete',
  'intentionally-excepted',
  'not-applicable',
  'not-assessed'
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

export function canonicalSurfaceJson(value) {
  return JSON.stringify(stable(value));
}

export function surfaceSha256(value) {
  const text = typeof value === 'string' ? value : canonicalSurfaceJson(value);
  return `sha256:${crypto.createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function globToRegExp(pattern) {
  const source = String(pattern)
    .replace(/\\/g, '/')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '___DOUBLE_STAR___')
    .replace(/\*/g, '[^/]*')
    .replace(/___DOUBLE_STAR___/g, '.*')
    .replace(/\?/g, '[^/]');
  return new RegExp(`^${source}$`);
}

export function matchesAnyPath(pathname, patterns = []) {
  const normalized = String(pathname).replace(/\\/g, '/').replace(/^\.\//, '');
  return patterns.some(pattern => globToRegExp(pattern).test(normalized));
}

function normalizeObservation(value) {
  if (!value) return null;
  const state = value.state || 'not-assessed';
  if (!['present', 'missing', 'stale', 'incomplete', 'intentionally-excepted', 'not-assessed'].includes(state)) {
    throw new Error(`Unsupported Surface Integrity observation state: ${state}`);
  }
  return {
    state,
    revision: value.revision == null ? null : String(value.revision),
    evidence: Array.isArray(value.evidence) ? value.evidence.map(String) : [],
    note: value.note == null ? null : String(value.note)
  };
}

function resolveOwnership(expectation, repositoryMap) {
  if (!repositoryMap || !expectation.owner) return null;
  const claims = Array.isArray(repositoryMap.ownership) ? repositoryMap.ownership : [];
  let claim = null;
  if (expectation.owner.surfaceKey) {
    claim = claims.find(item => item.surfaceKey === expectation.owner.surfaceKey) || null;
  }
  if (!claim && expectation.owner.routePath && expectation.owner.surfaceType) {
    claim = claims.find(item => item.routePath === expectation.owner.routePath && item.surfaceType === expectation.owner.surfaceType) || null;
  }
  if (!claim) return { state: 'unresolved', ownerPath: null, surfaceKey: expectation.owner.surfaceKey || null, evidence: [] };
  return {
    state: claim.state,
    ownerPath: claim.ownerPath || null,
    surfaceKey: claim.surfaceKey,
    evidence: Array.isArray(claim.evidence) ? claim.evidence : []
  };
}

export function validateSurfaceIntegrityContract(contract) {
  const errors = [];
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) return { valid: false, errors: [{ path: '/', message: 'contract must be an object' }] };
  if (contract.version !== SURFACE_INTEGRITY_VERSION) errors.push({ path: '/version', message: `must equal ${SURFACE_INTEGRITY_VERSION}` });
  if (!Array.isArray(contract.expectations)) errors.push({ path: '/expectations', message: 'must be an array' });
  const ids = new Set();
  for (const [index, item] of (contract.expectations || []).entries()) {
    const base = `/expectations/${index}`;
    for (const field of ['id', 'entityId', 'surface', 'representation']) {
      if (!item?.[field] || typeof item[field] !== 'string') errors.push({ path: `${base}/${field}`, message: 'must be a non-empty string' });
    }
    if (item?.id) {
      if (ids.has(item.id)) errors.push({ path: `${base}/id`, message: `duplicate id ${item.id}` });
      ids.add(item.id);
    }
    if (!['required', 'optional', 'not-applicable'].includes(item?.applicability)) errors.push({ path: `${base}/applicability`, message: 'must be required, optional or not-applicable' });
    if (!['exact', 'semantic', 'adapted', 'market-specific', 'routing-only'].includes(item?.parity)) errors.push({ path: `${base}/parity`, message: 'unsupported parity mode' });
  }
  return { valid: errors.length === 0, errors };
}

export function evaluateSurfaceIntegrity(contract, observations = [], options = {}) {
  const validation = validateSurfaceIntegrityContract(contract);
  if (!validation.valid) throw new Error(`Invalid Surface Integrity contract: ${validation.errors.map(e => `${e.path} ${e.message}`).join('; ')}`);
  const byId = new Map(observations.map(item => [String(item.expectationId || item.id), normalizeObservation(item)]));
  const results = [];
  for (const expectation of contract.expectations) {
    const observation = byId.get(expectation.id) || null;
    let state = 'pass';
    let reason = 'Observed representation satisfies the declared expectation.';
    if (expectation.applicability === 'not-applicable') {
      state = 'not-applicable';
      reason = 'The contract explicitly declares this representation not applicable.';
    } else if (!observation) {
      state = expectation.applicability === 'required' ? 'missing' : 'not-assessed';
      reason = expectation.applicability === 'required'
        ? 'Required representation has no observation.'
        : 'Optional representation has not been assessed.';
    } else if (observation.state === 'missing') {
      state = expectation.applicability === 'required' ? 'missing' : 'not-assessed';
      reason = expectation.applicability === 'required' ? 'Required representation is missing.' : 'Optional representation is not present.';
    } else if (observation.state === 'stale') {
      state = 'stale';
      reason = 'Observed representation is stale.';
    } else if (observation.state === 'incomplete') {
      state = 'incomplete';
      reason = 'Observed representation is incomplete.';
    } else if (observation.state === 'intentionally-excepted') {
      state = 'intentionally-excepted';
      reason = 'The required representation has an explicit bounded exception; the underlying debt remains visible.';
    } else if (observation.state === 'not-assessed') {
      state = 'not-assessed';
      reason = 'The representation has not been assessed.';
    } else if (expectation.sourceRevision && observation.revision && expectation.sourceRevision !== observation.revision) {
      state = 'stale';
      reason = `Observed revision ${observation.revision} does not match required revision ${expectation.sourceRevision}.`;
    }
    const ownership = resolveOwnership(expectation, options.repositoryMap || null);
    if (ownership && expectation.owner?.required && ownership.state !== 'resolved' && !['missing', 'stale'].includes(state)) {
      state = 'not-assessed';
      reason = `Repository Mapper ownership is ${ownership.state}; source ownership is not guessed.`;
    }
    results.push({
      id: expectation.id,
      entityId: expectation.entityId,
      surface: expectation.surface,
      representation: expectation.representation,
      parity: expectation.parity,
      applicability: expectation.applicability,
      sourceRevision: expectation.sourceRevision || null,
      state,
      reason,
      observation,
      ownership,
      checks: Array.isArray(expectation.checks) ? expectation.checks : []
    });
  }
  const summary = Object.fromEntries(SURFACE_STATES.map(state => [state, results.filter(item => item.state === state).length]));
  const blocking = results.filter(item => ['missing', 'stale', 'incomplete', 'fail'].includes(item.state) && item.applicability === 'required');
  const report = {
    version: SURFACE_INTEGRITY_VERSION,
    generatedAt: new Date(options.generatedAt || Date.now()).toISOString(),
    site: contract.site || null,
    contractDigest: surfaceSha256(contract),
    repositoryMapDigest: options.repositoryMap ? surfaceSha256(options.repositoryMap) : null,
    results,
    summary,
    release: blocking.length ? 'BLOCKED' : 'PASS',
    guardrails: {
      repositoryMapperOwnsSourceOwnership: true,
      braidGraphOwnsRelationshipTraversal: true,
      missingEvidenceIsNotPass: true,
      verificationIsNotOutcome: true,
      noRankingOrCitationGuarantee: true
    }
  };
  report.digest = surfaceSha256(report);
  return report;
}

export function impactSurfaceIntegrity(contract, changedPaths = []) {
  const affected = new Set();
  const rules = Array.isArray(contract.impactRules) ? contract.impactRules : [];
  for (const rule of rules) {
    if (changedPaths.some(pathname => matchesAnyPath(pathname, rule.paths || []))) {
      for (const surface of rule.surfaces || []) affected.add(String(surface));
    }
  }
  const expectations = contract.expectations.filter(item => affected.has(item.surface));
  return {
    changedPaths: [...new Set(changedPaths.map(String))].sort(),
    affectedSurfaces: [...affected].sort(),
    expectations: expectations.map(item => item.id).sort(),
    releaseReviewRequired: expectations.some(item => item.applicability === 'required')
  };
}
