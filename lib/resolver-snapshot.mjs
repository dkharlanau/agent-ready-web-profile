import { planResolvedSite } from './resolver.mjs';

const INTERFACE_GROUPS = ['content', 'data', 'retrieval', 'apis', 'tools', 'skills', 'agents', 'browserTools', 'auth', 'trust'];
const INTENTS = ['read', 'search', 'structured', 'tools', 'agent'];
const FIXED_ROOT_DISCOVERY_TYPES = new Set([
  'agents-json',
  'agents-txt',
  'api-catalog',
  'oauth-protected-resource',
  'a2a-agent-card',
  'agent-skills-index',
  'ai-catalog'
]);

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

function interfaceSlotKey(item) {
  return [
    item.group || '', item.sourceId || '', item.sourceAuthority || '', item.protocol || '', item.kind || '',
    item.name || '', item.transport || ''
  ].join('|');
}

function sourceKey(item) {
  return [item.type || '', item.url || '', item.id || ''].join('|');
}

function sourceSlotKey(item) {
  return [item.type || '', item.id || ''].join('|');
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

function classifySourceMigrations(before, after, sources) {
  if (before.canonicalUrl !== after.canonicalUrl) return [];
  const addedBySlot = new Map((sources.added || []).map(item => [sourceSlotKey(item), item]));
  const migrations = [];

  for (const oldSource of sources.removed || []) {
    if (!FIXED_ROOT_DISCOVERY_TYPES.has(oldSource.type) || oldSource.status !== 'resolved') continue;
    const newSource = addedBySlot.get(sourceSlotKey(oldSource));
    if (!newSource || newSource.status !== 'resolved' || newSource.url === oldSource.url) continue;
    migrations.push({
      kind: 'redirect-target-migration',
      sourceId: oldSource.id,
      sourceType: oldSource.type,
      beforeUrl: oldSource.url,
      afterUrl: newSource.url,
      evidence: 'fixed-root-discovery-slot-remained-resolved'
    });
  }

  return migrations.sort((a, b) => sourceSlotKey(a).localeCompare(sourceSlotKey(b)) || a.beforeUrl.localeCompare(b.beforeUrl));
}

function withoutInterfaceUrl(item) {
  const { url, ...rest } = item;
  return rest;
}

function classifyInterfaceMigrations(before, after, interfaces) {
  if (before.canonicalUrl !== after.canonicalUrl) return { migrations: [], beforeKeys: new Set(), afterKeys: new Set() };

  const removedBySlot = new Map();
  const addedBySlot = new Map();
  for (const item of interfaces.removed || []) {
    const slot = interfaceSlotKey(item);
    if (!removedBySlot.has(slot)) removedBySlot.set(slot, []);
    removedBySlot.get(slot).push(item);
  }
  for (const item of interfaces.added || []) {
    const slot = interfaceSlotKey(item);
    if (!addedBySlot.has(slot)) addedBySlot.set(slot, []);
    addedBySlot.get(slot).push(item);
  }

  const migrations = [];
  const beforeKeys = new Set();
  const afterKeys = new Set();
  for (const [slot, removed] of removedBySlot) {
    const added = addedBySlot.get(slot) || [];
    if (removed.length !== 1 || added.length !== 1) continue;
    const oldInterface = removed[0];
    const newInterface = added[0];
    if (!oldInterface.url || !newInterface.url || oldInterface.url === newInterface.url) continue;
    if (stableJson(withoutInterfaceUrl(oldInterface)) !== stableJson(withoutInterfaceUrl(newInterface))) continue;

    beforeKeys.add(interfaceKey(oldInterface.group, oldInterface));
    afterKeys.add(interfaceKey(newInterface.group, newInterface));
    migrations.push({
      kind: 'interface-url-migration',
      group: oldInterface.group,
      sourceId: oldInterface.sourceId || null,
      sourceAuthority: oldInterface.sourceAuthority || null,
      protocol: oldInterface.protocol || null,
      interfaceKind: oldInterface.kind || null,
      name: oldInterface.name || null,
      transport: oldInterface.transport || null,
      beforeUrl: oldInterface.url,
      afterUrl: newInterface.url,
      evidence: 'same-canonical-site-and-interface-metadata-url-only-change'
    });
  }

  migrations.sort((a, b) => [a.group, a.sourceId || '', a.protocol || '', a.interfaceKind || '', a.beforeUrl].join('|').localeCompare(
    [b.group, b.sourceId || '', b.protocol || '', b.interfaceKind || '', b.beforeUrl].join('|')
  ));
  return { migrations, beforeKeys, afterKeys };
}

export function diffResolverSnapshots(before, after) {
  if (before?.snapshotVersion !== '0.1' || after?.snapshotVersion !== '0.1') throw new Error('Only resolver snapshotVersion 0.1 is supported.');

  const sources = diffCollection(before.sources, after.sources, sourceKey);
  const interfaces = diffCollection(before.interfaces, after.interfaces, item => interfaceKey(item.group, item));
  const conflicts = diffCollection(before.conflicts, after.conflicts, conflictKey);
  const sourceMigrations = classifySourceMigrations(before, after, sources);
  const interfaceMigrationResult = classifyInterfaceMigrations(before, after, interfaces);
  const interfaceMigrations = interfaceMigrationResult.migrations;
  const migratedSlots = new Set(sourceMigrations.map(item => [item.sourceType, item.sourceId].join('|')));
  const hardSourcesRemoved = sources.removed.filter(item => !migratedSlots.has(sourceSlotKey(item))).length;
  const hardSourcesAdded = sources.added.filter(item => !migratedSlots.has(sourceSlotKey(item))).length;
  const hardInterfacesRemoved = interfaces.removed.filter(item => !interfaceMigrationResult.beforeKeys.has(interfaceKey(item.group, item))).length;
  const hardInterfacesAdded = interfaces.added.filter(item => !interfaceMigrationResult.afterKeys.has(interfaceKey(item.group, item))).length;
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
    sourceMigrations: sourceMigrations.length,
    hardSourcesAdded,
    hardSourcesRemoved,
    interfacesAdded: interfaces.added.length,
    interfacesRemoved: interfaces.removed.length,
    interfacesChanged: interfaces.changed.length,
    interfaceMigrations: interfaceMigrations.length,
    hardInterfacesAdded,
    hardInterfacesRemoved,
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
    sourceMigrations,
    interfaceMigrations,
    sources,
    interfaces,
    conflicts,
    plans: planChanges
  };
}
