import { sha256Digest, canonicalJson } from './evidence-receipt.mjs';

export const GROWTH_SNAPSHOT_VERSION = '0.1';

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isoInstant(value) {
  const date = value == null ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('observedAt must be a valid date/time.');
  return date.toISOString();
}

function compactAction(item) {
  return {
    id: String(item.id),
    priority: item.priority || null,
    lane: item.lane || null,
    status: item.status || null,
    title: item.title || null,
    source: item.source || null,
    reasonDigest: item.reason ? sha256Digest(String(item.reason)) : null
  };
}

function stableActions(actions) {
  return [...actions].map(compactAction).sort((a, b) => a.id.localeCompare(b.id));
}

function debt(actions) {
  const byPriority = {};
  const byLane = {};
  for (const item of actions) {
    byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;
    if (item.priority === 'P0' || item.priority === 'P1') byLane[item.lane] = (byLane[item.lane] || 0) + 1;
  }
  return {
    p0: byPriority.P0 || 0,
    p1: byPriority.P1 || 0,
    highPriority: (byPriority.P0 || 0) + (byPriority.P1 || 0),
    byPriority,
    highPriorityByLane: byLane
  };
}

function observationSummary(plan) {
  const observations = plan.observations || {};
  return {
    entity: {
      present: Boolean(observations.entity?.present),
      sameAs: Number(observations.entity?.sameAs || 0),
      types: Array.isArray(observations.entity?.types) ? [...observations.entity.types].sort() : []
    },
    localSitemap: {
      ok: Boolean(observations.localSitemap?.ok),
      validLastmodCount: Number(observations.localSitemap?.validLastmodCount || 0)
    },
    contentSignal: {
      observed: Boolean(observations.contentSignal?.observed),
      values: object(observations.contentSignal?.values) ? observations.contentSignal.values : {}
    },
    article: {
      count: Number(observations.article?.count || 0),
      missingAuthor: Number(observations.article?.missingAuthor || 0),
      missingDateModified: Number(observations.article?.missingDateModified || 0)
    },
    media: {
      images: Number(observations.media?.images || 0),
      videos: Number(observations.media?.videos || 0),
      openGraphImage: Boolean(observations.media?.openGraphImage)
    }
  };
}

export function createGrowthSnapshot(plan, { observedAt = null, toolVersion = '0.2.0' } = {}) {
  if (!object(plan) || !Array.isArray(plan.actions) || !plan.canonicalUrl) throw new Error('A Growth Profile plan is required.');
  const actions = stableActions(plan.actions);
  const payload = {
    snapshotVersion: GROWTH_SNAPSHOT_VERSION,
    growthProfile: plan.profile || null,
    canonicalUrl: plan.canonicalUrl,
    observedAt: isoInstant(observedAt),
    toolVersion,
    actions,
    debt: debt(actions),
    observations: observationSummary(plan),
    guardrails: {
      snapshotTracksImplementationStateNotRanking: true,
      resolvedActionDoesNotProveOutcome: true,
      ownerMetricsAreSeparateEvidence: true
    }
  };
  const digest = sha256Digest(payload);
  return {
    ...payload,
    snapshotId: `urn:sha256:${digest.slice('sha256:'.length)}`,
    digest
  };
}

function indexById(snapshot) {
  return new Map((snapshot.actions || []).map(item => [item.id, item]));
}

function highPriority(item) {
  return item?.priority === 'P0' || item?.priority === 'P1';
}

function observationChanges(before, after) {
  const paths = [
    ['entity.present'], ['entity.sameAs'], ['localSitemap.ok'], ['localSitemap.validLastmodCount'],
    ['contentSignal.observed'], ['contentSignal.values'], ['article.count'], ['article.missingAuthor'],
    ['article.missingDateModified'], ['media.images'], ['media.videos'], ['media.openGraphImage']
  ].flat();
  const get = (obj, path) => path.split('.').reduce((value, key) => value?.[key], obj);
  const out = [];
  for (const path of paths) {
    const left = get(before.observations || {}, path);
    const right = get(after.observations || {}, path);
    if (canonicalJson(left) !== canonicalJson(right)) out.push({ path, before: left ?? null, after: right ?? null });
  }
  return out;
}

export function diffGrowthSnapshots(before, after) {
  if (before?.snapshotVersion !== GROWTH_SNAPSHOT_VERSION || after?.snapshotVersion !== GROWTH_SNAPSHOT_VERSION) throw new Error(`Growth snapshots must use version ${GROWTH_SNAPSHOT_VERSION}.`);
  if (before.canonicalUrl !== after.canonicalUrl) throw new Error('Cannot diff Growth snapshots from different canonical URLs.');
  const left = indexById(before);
  const right = indexById(after);
  const added = [];
  const resolved = [];
  const changed = [];
  for (const [id, item] of right) if (!left.has(id)) added.push(item);
  for (const [id, item] of left) if (!right.has(id)) resolved.push(item);
  for (const [id, afterItem] of right) {
    const beforeItem = left.get(id);
    if (!beforeItem) continue;
    const fields = ['priority', 'lane', 'status', 'source', 'reasonDigest'];
    const changes = {};
    for (const field of fields) if (canonicalJson(beforeItem[field]) !== canonicalJson(afterItem[field])) changes[field] = { before: beforeItem[field] ?? null, after: afterItem[field] ?? null };
    if (Object.keys(changes).length) changed.push({ id, title: afterItem.title || beforeItem.title, changes });
  }
  const observations = observationChanges(before, after);
  const beforeDebt = before.debt || debt(before.actions || []);
  const afterDebt = after.debt || debt(after.actions || []);
  return {
    diffVersion: '0.1',
    canonicalUrl: after.canonicalUrl,
    before: { snapshotId: before.snapshotId, observedAt: before.observedAt, debt: beforeDebt },
    after: { snapshotId: after.snapshotId, observedAt: after.observedAt, debt: afterDebt },
    summary: {
      actionsAdded: added.length,
      actionsResolved: resolved.length,
      actionsChanged: changed.length,
      observationChanges: observations.length,
      p0Delta: afterDebt.p0 - beforeDebt.p0,
      p1Delta: afterDebt.p1 - beforeDebt.p1,
      highPriorityDebtDelta: afterDebt.highPriority - beforeDebt.highPriority,
      highPriorityResolved: resolved.filter(highPriority).length,
      highPriorityAdded: added.filter(highPriority).length
    },
    added,
    resolved,
    changed,
    observationChanges: observations,
    interpretation: {
      implementationStateImproved: (afterDebt.highPriority < beforeDebt.highPriority),
      note: 'A reduced Growth backlog means fewer currently observed implementation actions. It does not prove better rankings, citations, recommendations, traffic or conversion.'
    }
  };
}

export function formatGrowthDiff(diff) {
  const s = diff.summary;
  const lines = [
    `ARWP Growth diff`,
    `Target: ${diff.canonicalUrl}`,
    `High-priority debt: ${diff.before.debt.highPriority} → ${diff.after.debt.highPriority} (${s.highPriorityDebtDelta >= 0 ? '+' : ''}${s.highPriorityDebtDelta})`,
    `Added: ${s.actionsAdded}; resolved: ${s.actionsResolved}; changed: ${s.actionsChanged}; observations changed: ${s.observationChanges}`,
    ''
  ];
  if (diff.resolved.length) {
    lines.push('Resolved actions:');
    for (const item of diff.resolved) lines.push(`- ${item.priority} ${item.title || item.id}`);
    lines.push('');
  }
  if (diff.added.length) {
    lines.push('New actions:');
    for (const item of diff.added) lines.push(`- ${item.priority} ${item.title || item.id}`);
    lines.push('');
  }
  if (diff.changed.length) {
    lines.push('Changed actions:');
    for (const item of diff.changed) lines.push(`- ${item.id}: ${Object.keys(item.changes).join(', ')}`);
    lines.push('');
  }
  lines.push(diff.interpretation.note);
  return lines.join('\n');
}
