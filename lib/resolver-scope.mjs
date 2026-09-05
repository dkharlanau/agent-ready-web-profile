export const DISCOVERY_SCOPES = Object.freeze({
  TARGET_OBSERVED: 'target-observed',
  TARGET_LINKED: 'target-linked',
  TARGET_PATH_PROBE: 'target-path-probe',
  ROOT_CONVENTIONAL: 'root-conventional',
  PUBLISHER_POINTER: 'publisher-pointer',
  PUBLISHER_PROFILE_AMBIGUOUS: 'publisher-profile-ambiguous',
  DERIVED_UNSPECIFIED: 'derived-unspecified',
  UNSPECIFIED: 'unspecified'
});

const ROOT_CONVENTIONAL_SOURCE_IDS = new Set([
  'agents-json:0',
  'agents-txt:0',
  'api-catalog:0',
  'oauth-protected-resource:0',
  'a2a-agent-card:0',
  'agent-skills-index:0',
  'ard-catalog:0',
  'ard-catalog-legacy:0'
]);

const TARGET_OBSERVED_SOURCE_IDS = new Set(['homepage-scan', 'http-head:0']);

export function targetScopeOf(resolution) {
  try {
    const url = new URL(resolution?.target || resolution?.canonicalUrl);
    return url.pathname && url.pathname !== '/' ? 'path' : 'root';
  } catch {
    return 'unknown';
  }
}

export function classifyDiscoveryScope(item) {
  if (item?.discoveryScope) return item.discoveryScope;
  const sourceId = String(item?.sourceId || '');
  if (TARGET_OBSERVED_SOURCE_IDS.has(sourceId)) return DISCOVERY_SCOPES.TARGET_OBSERVED;
  if (sourceId === 'path-llms:0') return DISCOVERY_SCOPES.TARGET_PATH_PROBE;
  if (ROOT_CONVENTIONAL_SOURCE_IDS.has(sourceId)) return DISCOVERY_SCOPES.ROOT_CONVENTIONAL;
  if (sourceId.startsWith('api-catalog-link:') || sourceId.startsWith('ard-catalog-link:') || sourceId.startsWith('arwp-profile-link:')) return DISCOVERY_SCOPES.TARGET_LINKED;
  if (sourceId === 'agents-json-pointer:0') return DISCOVERY_SCOPES.PUBLISHER_POINTER;
  if (sourceId === 'arwp-profile:0') return DISCOVERY_SCOPES.PUBLISHER_PROFILE_AMBIGUOUS;
  if (sourceId.startsWith('mcp-server-card-inline:') || sourceId.startsWith('mcp-server-card:') || sourceId.startsWith('mcp-server-card-fallback:')) return DISCOVERY_SCOPES.DERIVED_UNSPECIFIED;
  return DISCOVERY_SCOPES.UNSPECIFIED;
}

export function scopeReason(scope) {
  return {
    [DISCOVERY_SCOPES.TARGET_OBSERVED]: 'Observed directly on the requested target representation or its HTTP metadata.',
    [DISCOVERY_SCOPES.TARGET_LINKED]: 'Explicitly linked from metadata observed for the requested target.',
    [DISCOVERY_SCOPES.TARGET_PATH_PROBE]: 'Discovered through a path-scoped conventional probe derived from the requested target path.',
    [DISCOVERY_SCOPES.ROOT_CONVENTIONAL]: 'Discovered through an origin-root conventional location; presence is site evidence but does not by itself prove applicability to a path-scoped target.',
    [DISCOVERY_SCOPES.PUBLISHER_POINTER]: 'Reached through an explicit publisher pointer; applicability to the requested target depends on the pointer semantics.',
    [DISCOVERY_SCOPES.PUBLISHER_PROFILE_AMBIGUOUS]: 'The primary ARWP profile may have been linked from the target or found at the project convention; current source identity does not preserve that distinction.',
    [DISCOVERY_SCOPES.DERIVED_UNSPECIFIED]: 'Derived from another discovered interface/artifact; parent discovery scope is not yet carried into this item.',
    [DISCOVERY_SCOPES.UNSPECIFIED]: 'Current adapter does not expose enough provenance to classify target applicability.'
  }[scope] || 'Unknown discovery scope.';
}

export function annotateDiscoveryScopes(resolution) {
  for (const [group, items] of Object.entries(resolution?.interfaces || {})) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      item.discoveryScope = classifyDiscoveryScope(item);
      if (!item.discoveryScopeReason) item.discoveryScopeReason = scopeReason(item.discoveryScope);
      if (!item.interfaceGroup) item.interfaceGroup = group;
    }
  }
  return resolution;
}

function compactInterface(group, item) {
  return {
    group,
    url: item?.url || null,
    protocol: item?.protocol || null,
    kind: item?.kind || null,
    sourceId: item?.sourceId || null,
    sourceAuthority: item?.sourceAuthority || null,
    discoveryScope: classifyDiscoveryScope(item)
  };
}

export function buildScopeDiagnostics(resolution) {
  const targetScope = targetScopeOf(resolution);
  const counts = {};
  const byGroup = {};
  const pathRisk = [];
  const ambiguous = [];
  let interfaces = 0;

  for (const [group, items] of Object.entries(resolution?.interfaces || {})) {
    if (!Array.isArray(items)) continue;
    byGroup[group] = {};
    for (const item of items) {
      interfaces += 1;
      const scope = classifyDiscoveryScope(item);
      counts[scope] = (counts[scope] || 0) + 1;
      byGroup[group][scope] = (byGroup[group][scope] || 0) + 1;
      if (targetScope === 'path' && scope === DISCOVERY_SCOPES.ROOT_CONVENTIONAL && ['apis', 'tools', 'agents', 'auth', 'skills'].includes(group)) {
        pathRisk.push(compactInterface(group, item));
      }
      if ([DISCOVERY_SCOPES.PUBLISHER_PROFILE_AMBIGUOUS, DISCOVERY_SCOPES.DERIVED_UNSPECIFIED, DISCOVERY_SCOPES.UNSPECIFIED].includes(scope)) {
        ambiguous.push(compactInterface(group, item));
      }
    }
  }

  return {
    version: '0.1',
    targetScope,
    target: resolution?.target || null,
    canonicalUrl: resolution?.canonicalUrl || null,
    interfaces,
    counts,
    byGroup,
    pathScopedRootConventionalEvidence: pathRisk,
    ambiguousOrDerivedEvidence: ambiguous,
    summary: {
      rootConventional: counts[DISCOVERY_SCOPES.ROOT_CONVENTIONAL] || 0,
      targetLocal: (counts[DISCOVERY_SCOPES.TARGET_OBSERVED] || 0) + (counts[DISCOVERY_SCOPES.TARGET_LINKED] || 0) + (counts[DISCOVERY_SCOPES.TARGET_PATH_PROBE] || 0),
      pathRiskCandidates: pathRisk.length,
      ambiguousOrDerived: ambiguous.length
    },
    policyEffect: 'diagnostic-only',
    note: 'Scope diagnostics expose potential root-to-path capability leakage. v0.1 does not add new eligibility or ranking behavior beyond the existing Resolver policy.'
  };
}
