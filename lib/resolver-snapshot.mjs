import { planResolvedSite } from './resolver.mjs';

const INTERFACE_GROUPS = ['content', 'data', 'retrieval', 'apis', 'tools', 'skills', 'agents', 'browserTools', 'auth', 'trust'];
const INTENTS = ['read', 'search', 'structured', 'tools', 'agent'];

function pickDefined(object, keys) {
  const output = {};
  for (const key of keys) if (object?.[key] !== undefined && object?.[key] !== null) output[key] = object[key];
  return output;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function interfaceKey(group, item) {
  return [group, item.protocol || '', item.kind || '', item.url || '', item.name || '', item.transport || ''].join('|');
}

function sourceKey(item) {
  return [item.type || '', item.url || '', item.id || ''].join('|');
}

function conflictKey(item) {
  return [item.kind || '', item.capability || '', item.message || ''].join('|');
}

function normalizeInterface(group, item) {
  return {
    group,
    ...pickDefined(item, [
      'sourceId', 'sourceAuthority', 'kind', 'protocol', 'name', 'url', 'mediaType', 'format',
      'transport', 'version', 'description', 'registry', 'documentation', 'readOnly', 'digest',
      'resource', 'authorizationServers', 'scopes', 'jwksUri', 'signed'
    ])
  };
}

function normalizeSource(item) {
  return pickDefined(item, ['id', 'type', 'url', 'status', 'authority', 'httpStatus', 'contentType', 'issue', 'identifier']);
}

function normalizeConflict(item) {
  return pickDefined(item, ['kind', 'severity', 'capability', 'sources', 'values', 'message']);
}

function sortNormalized(items, keyFn) {
  return [...items].sort((a, b) => keyFn(a).localeCompare(keyFn(b)) || stableJson(a).localeCompare(stableJson(b)));
}

export function createResolverSnapshot(resolution, {
  resolverVersion = 'unknown',
  observedAt = new Date().toISOString()
} = {}) {
  if (!resolution?.canonicalUrl) throw new Error('Resolver snapshot requires a resolution with canonicalUrl.');
  const interfaces = [];
  for (const group of INTERFACE_GROUPS) {
    for (const item of resolution.interfaces?.[group] || []) interfaces.push(normalizeInterface(group, item));
  }

  const plans = {};
  for (const intent of INTENTS) {
    const plan = planResolvedSite(resolution, intent);
    plans[intent] = {
      selected: plan.selected ? pickDefined(plan.selected, ['kind', 'protocol', 'url', 'name', 'sourceId', 'sourceAuthority', 'transport']) : null,
      fallbacks: (plan.fallbacks || []).map(item => pickDefined(item, ['kind', 'protocol', 'url', 'name', 'sourceId', 'sourceAuthority', 'transport'])),
      reason: plan.reason
    };
  }

  return {
    snapshotVersion: '0.1',
    resolverVersion,
    observedAt,
    canonicalUrl: resolution.canonicalUrl,
    identity: pickDefined(resolution.identity || {}, ['name', 'description', 'languages']),
    sources: sortNormalized((resolution.sources || []).map(normalizeSource), sourceKey),
    interfaces: sortNormalized(interfaces, item => interfaceKey(item.group, item)),
    conflicts: sortNormalized((resolution.conflicts || []).map(normalizeConflict), conflictKey),
    plans,
    summary: {
      sourcesAttempted: resolution.summary?.sourcesAttempted ?? null,
      sourcesResolved: resolution.summary?.sourcesResolved ?? null,
      interfacesResolved: resolution.summary?.interfacesResolved ?? interfaces.length,
      conflicts: resolution.summary?.conflicts ?? (resolution.conflicts || []).length,
      requests: resolution.summary?.requests ?? resolution.metrics?.requests ?? null,
      bytes: resolution.summary?.bytes ?? resolution.metrics?.bytes ?? null
    }
  };
}

function diffCollection(beforeItems, afterItems, keyFn) {
  const before = new Map((beforeItems || []).map(item => [keyFn(item), item]));
  const after = new Map((afterItems || []).map(item => [keyFn(item), item]));
  const added = [];
  const removed = [];
  const changed = [];

  for (const [key, item] of after) {
    if (!before.has(key)) added.push(item);
    else if (stableJson(before.get(key)) !== stableJson(item)) changed.push({ key, before: before.get(key), after: item });
  }
  for (const [key, item] of before) if (!after.has(key)) removed.push(item);

  return { added, removed, changed };
}

export function diffResolverSnapshots(before, after) {
  if (before?.snapshotVersion !== '0.1' || after?.snapshotVersion !== '0.1') throw new Error('Only resolver snapshotVersion 0.1 is supported.');

  const sources = diffCollection(before.sources, after.sources, sourceKey);
  const interfaces = diffCollection(before.interfaces, after.interfaces, item => interfaceKey(item.group, item));
  const conflicts = diffCollection(before.conflicts, after.conflicts, conflictKey);
  const identityChanged = stableJson({ canonicalUrl: before.canonicalUrl, identity: before.identity }) !== stableJson({ canonicalUrl: after.canonicalUrl, identity: after.identity });
  const planChanges = [];
  for (const intent of INTENTS) {
    if (stableJson(before.plans?.[intent] || null) !== stableJson(after.plans?.[intent] || null)) {
      planChanges.push({ intent, before: before.plans?.[intent] || null, after: after.plans?.[intent] || null });
    }
  }

  const summary = {
    sourcesAdded: sources.added.length,
    sourcesRemoved: sources.removed.length,
    sourcesChanged: sources.changed.length,
    interfacesAdded: interfaces.added.length,
    interfacesRemoved: interfaces.removed.length,
    interfacesChanged: interfaces.changed.length,
    conflictsAdded: conflicts.added.length,
    conflictsRemoved: conflicts.removed.length,
    conflictsChanged: conflicts.changed.length,
    planChanges: planChanges.length,
    identityChanged
  };

  return {
    driftVersion: '0.1',
    before: { observedAt: before.observedAt, canonicalUrl: before.canonicalUrl, resolverVersion: before.resolverVersion },
    after: { observedAt: after.observedAt, canonicalUrl: after.canonicalUrl, resolverVersion: after.resolverVersion },
    hasDrift: Object.entries(summary).some(([key, value]) => key === 'identityChanged' ? value : Number(value) > 0),
    summary,
    identity: identityChanged ? { before: { canonicalUrl: before.canonicalUrl, ...before.identity }, after: { canonicalUrl: after.canonicalUrl, ...after.identity } } : null,
    sources,
    interfaces,
    conflicts,
    plans: planChanges
  };
}
