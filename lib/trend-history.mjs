import { sha256Digest } from './evidence-receipt.mjs';
import { validateTrendRegistry } from './trend-radar.mjs';

function isoInstant(value = null) {
  const date = value == null ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Expected a valid date/time.');
  return date.toISOString();
}

function stableArray(values) {
  return [...new Set((values || []).map(String))].sort();
}

function trendState(trend) {
  const content = {
    title: trend.title,
    change: trend.change,
    whyItMatters: trend.whyItMatters,
    notes: trend.notes || null,
    surfaces: stableArray(trend.surfaces),
    appliesTo: stableArray(trend.appliesTo),
    attentionWindowDays: trend.attentionWindowDays
  };
  return {
    id: trend.id,
    provider: trend.provider,
    stage: trend.stage,
    confidence: trend.confidence,
    maturity: trend.maturity,
    detectedAt: trend.detectedAt,
    source: trend.source,
    sourceReviewedAt: trend.sourceReviewedAt,
    actionRefs: stableArray(trend.actionRefs),
    measurementRefs: stableArray(trend.measurementRefs),
    contentDigest: sha256Digest(content)
  };
}

export function createTrendSnapshot(registry, { observedAt = null, toolVersion = null } = {}) {
  const validation = validateTrendRegistry(registry);
  if (!validation.valid) throw new Error(`Invalid Trend Radar registry:\n- ${validation.errors.join('\n- ')}`);
  const body = {
    snapshotVersion: '0.1',
    registryVersion: registry.version,
    sourceSnapshot: registry.snapshot,
    reviewedAt: registry.reviewedAt,
    observedAt: isoInstant(observedAt),
    ...(toolVersion ? { toolVersion } : {}),
    trends: registry.trends.map(trendState).sort((a, b) => a.id.localeCompare(b.id)),
    guardrails: {
      snapshotTracksTrendStateNotEffectiveness: true,
      stageChangeIsNotOutcomeEvidence: true,
      preserveRemovedTrendsInDiff: true
    }
  };
  const digest = sha256Digest(body);
  return { ...body, digest, snapshotId: `urn:${digest}` };
}

function indexById(snapshot) {
  return new Map((snapshot.trends || []).map(item => [item.id, item]));
}

function transition(before, after) {
  return before.stage === after.stage ? null : `${before.stage}->${after.stage}`;
}

export function diffTrendSnapshots(before, after) {
  if (before?.snapshotVersion !== '0.1' || after?.snapshotVersion !== '0.1') throw new Error('Trend snapshot version 0.1 is required.');
  const beforeMap = indexById(before);
  const afterMap = indexById(after);
  const ids = [...new Set([...beforeMap.keys(), ...afterMap.keys()])].sort();
  const added = [];
  const removed = [];
  const changed = [];

  for (const id of ids) {
    const from = beforeMap.get(id);
    const to = afterMap.get(id);
    if (!from) {
      added.push(to);
      continue;
    }
    if (!to) {
      removed.push(from);
      continue;
    }
    const changes = [];
    if (from.stage !== to.stage) changes.push('stage');
    if (from.source !== to.source) changes.push('source');
    if (from.sourceReviewedAt !== to.sourceReviewedAt) changes.push('sourceReviewedAt');
    if (from.contentDigest !== to.contentDigest) changes.push('content');
    if (from.confidence !== to.confidence) changes.push('confidence');
    if (from.maturity !== to.maturity) changes.push('maturity');
    if (JSON.stringify(from.actionRefs) !== JSON.stringify(to.actionRefs)) changes.push('actionRefs');
    if (JSON.stringify(from.measurementRefs) !== JSON.stringify(to.measurementRefs)) changes.push('measurementRefs');
    if (changes.length) changed.push({ id, provider: to.provider, changes, stageTransition: transition(from, to), before: from, after: to });
  }

  const stageTransitions = changed.filter(item => item.stageTransition).reduce((acc, item) => {
    acc[item.stageTransition] = (acc[item.stageTransition] || 0) + 1;
    return acc;
  }, {});

  return {
    diffVersion: '0.1',
    beforeSnapshotId: before.snapshotId,
    afterSnapshotId: after.snapshotId,
    beforeObservedAt: before.observedAt,
    afterObservedAt: after.observedAt,
    summary: {
      trendsBefore: beforeMap.size,
      trendsAfter: afterMap.size,
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      stageTransitions,
      sourceChanged: changed.filter(item => item.changes.includes('source')).length,
      contentChanged: changed.filter(item => item.changes.includes('content')).length
    },
    added,
    removed,
    changed,
    interpretation: 'This diff reports Trend Radar state and source changes only. A WATCH→ADOPT or ADOPT→MEASURED transition is not evidence that a website gained ranking, citation, recommendation, referral or conversion outcomes.',
    guardrails: {
      noEffectivenessInference: true,
      noSilentPromotion: true,
      preserveHistory: true
    }
  };
}

export function formatTrendDiff(diff) {
  const lines = [
    'ARWP Trend History Diff',
    `Before: ${diff.beforeObservedAt} (${diff.summary.trendsBefore} trends)`,
    `After:  ${diff.afterObservedAt} (${diff.summary.trendsAfter} trends)`,
    `Added: ${diff.summary.added} · Removed: ${diff.summary.removed} · Changed: ${diff.summary.changed}`
  ];
  const transitions = Object.entries(diff.summary.stageTransitions);
  if (transitions.length) lines.push(`Stage transitions: ${transitions.map(([name, count]) => `${name}=${count}`).join(', ')}`);
  for (const item of diff.added) lines.push(`+ ${item.id} [${item.stage}]`);
  for (const item of diff.removed) lines.push(`- ${item.id} [${item.stage}]`);
  for (const item of diff.changed) lines.push(`~ ${item.id}: ${item.changes.join(', ')}${item.stageTransition ? ` (${item.stageTransition})` : ''}`);
  lines.push('', diff.interpretation);
  return lines.join('\n');
}
