import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const defaultRegistryPath = path.join(root, 'registry', 'trends.json');
const VALID_STAGES = new Set(['watch', 'adopt', 'measured', 'retired']);
const STAGE_RANK = { measured: 0, adopt: 1, watch: 2, retired: 3 };
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value, field, id) {
  const time = Date.parse(value);
  if (!value || Number.isNaN(time)) throw new Error(`Invalid ${field} for trend ${id || '<unknown>'}: ${value}`);
  return new Date(time);
}

export function loadTrendRegistry(file = defaultRegistryPath) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function validateTrendRegistry(registry) {
  const errors = [];
  if (!registry || typeof registry !== 'object') return { valid: false, errors: ['Registry must be an object.'] };
  if (!Array.isArray(registry.trends)) errors.push('Registry trends must be an array.');
  const ids = new Set();
  for (const trend of registry.trends || []) {
    if (!trend?.id) errors.push('Every trend requires an id.');
    else if (ids.has(trend.id)) errors.push(`Duplicate trend id: ${trend.id}`);
    else ids.add(trend.id);
    if (!VALID_STAGES.has(trend?.stage)) errors.push(`Invalid stage for ${trend?.id || '<unknown>'}: ${trend?.stage}`);
    try { parseDate(trend?.detectedAt, 'detectedAt', trend?.id); } catch (error) { errors.push(error.message); }
    try { parseDate(trend?.sourceReviewedAt, 'sourceReviewedAt', trend?.id); } catch (error) { errors.push(error.message); }
    if (!trend?.provider) errors.push(`Trend ${trend?.id || '<unknown>'} requires provider.`);
    if (!trend?.title) errors.push(`Trend ${trend?.id || '<unknown>'} requires title.`);
    if (!/^https:\/\//i.test(String(trend?.source || ''))) errors.push(`Trend ${trend?.id || '<unknown>'} requires an HTTPS primary source.`);
    if (!Array.isArray(trend?.appliesTo) || !trend.appliesTo.length) errors.push(`Trend ${trend?.id || '<unknown>'} requires appliesTo.`);
    if (!Array.isArray(trend?.surfaces) || !trend.surfaces.length) errors.push(`Trend ${trend?.id || '<unknown>'} requires surfaces.`);
    if (!Array.isArray(trend?.actionRefs)) errors.push(`Trend ${trend?.id || '<unknown>'} requires actionRefs array.`);
    if (!Array.isArray(trend?.measurementRefs)) errors.push(`Trend ${trend?.id || '<unknown>'} requires measurementRefs array.`);
    if (!Number.isInteger(trend?.attentionWindowDays) || trend.attentionWindowDays < 0) errors.push(`Trend ${trend?.id || '<unknown>'} requires non-negative integer attentionWindowDays.`);
  }
  return { valid: errors.length === 0, errors };
}

function daysBetween(now, then) {
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / DAY_MS));
}

export function trendAttentionState(trend, now = new Date()) {
  if (trend.stage === 'retired') return 'retired';
  const ageDays = daysBetween(now, parseDate(trend.detectedAt, 'detectedAt', trend.id));
  const window = Number(trend.attentionWindowDays || 0);
  if (!window) return 'established';
  if (ageDays <= window) return 'early';
  if (ageDays <= window * 2) return 'active';
  return 'established';
}

export function normalizeTrend(trend, now = new Date()) {
  const detected = parseDate(trend.detectedAt, 'detectedAt', trend.id);
  return {
    ...trend,
    daysSinceDetected: daysBetween(now, detected),
    attentionState: trendAttentionState(trend, now)
  };
}

function matchesCsv(value, fieldValues) {
  if (!value) return true;
  const wanted = String(value).split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
  const present = new Set((Array.isArray(fieldValues) ? fieldValues : [fieldValues]).map(item => String(item).toLowerCase()));
  return wanted.some(item => present.has(item));
}

export function buildTrendRadar(registry = loadTrendRegistry(), options = {}) {
  const validation = validateTrendRegistry(registry);
  if (!validation.valid) throw new Error(`Invalid Trend Radar registry:\n- ${validation.errors.join('\n- ')}`);
  const now = options.now ? new Date(options.now) : new Date();
  const sinceDays = options.sinceDays == null ? null : Number(options.sinceDays);
  if (sinceDays != null && (!Number.isFinite(sinceDays) || sinceDays < 0)) throw new Error(`Invalid sinceDays: ${options.sinceDays}`);

  const trends = registry.trends
    .map(item => normalizeTrend(item, now))
    .filter(item => !options.stage || matchesCsv(options.stage, item.stage))
    .filter(item => !options.provider || matchesCsv(options.provider, item.provider))
    .filter(item => !options.vertical || matchesCsv(options.vertical, item.appliesTo))
    .filter(item => !options.surface || matchesCsv(options.surface, item.surfaces))
    .filter(item => sinceDays == null || item.daysSinceDetected <= sinceDays)
    .filter(item => options.includeRetired !== false || item.stage !== 'retired')
    .sort((a, b) => (STAGE_RANK[a.stage] ?? 9) - (STAGE_RANK[b.stage] ?? 9)
      || a.daysSinceDetected - b.daysSinceDetected
      || a.id.localeCompare(b.id));

  const summary = trends.reduce((acc, item) => {
    acc.total += 1;
    acc.byStage[item.stage] = (acc.byStage[item.stage] || 0) + 1;
    acc.byProvider[item.provider] = (acc.byProvider[item.provider] || 0) + 1;
    acc.byAttentionState[item.attentionState] = (acc.byAttentionState[item.attentionState] || 0) + 1;
    return acc;
  }, { total: 0, byStage: {}, byProvider: {}, byAttentionState: {} });

  return {
    trendRadarVersion: registry.version,
    snapshot: registry.snapshot,
    reviewedAt: registry.reviewedAt,
    generatedAt: now.toISOString(),
    goal: registry.goal,
    filters: {
      stage: options.stage || null,
      provider: options.provider || null,
      vertical: options.vertical || null,
      surface: options.surface || null,
      sinceDays,
      includeRetired: options.includeRetired !== false
    },
    summary,
    trends,
    stageDefinitions: registry.stageDefinitions,
    guardrails: registry.guardrails,
    note: 'The ARWP attention window prioritizes review of recent changes. It is not evidence that early adoption improves ranking, citation or recommendation outcomes.'
  };
}

export function findTrend(id, registry = loadTrendRegistry(), { now = new Date() } = {}) {
  const validation = validateTrendRegistry(registry);
  if (!validation.valid) throw new Error(`Invalid Trend Radar registry:\n- ${validation.errors.join('\n- ')}`);
  const trend = registry.trends.find(item => item.id === id);
  return trend ? normalizeTrend(trend, new Date(now)) : null;
}

export function formatTrendRadar(radar) {
  const lines = [
    `ARWP Trend Radar ${radar.snapshot}`,
    `Trends: ${radar.summary.total}`,
    `Stages: ${Object.entries(radar.summary.byStage).map(([key, value]) => `${key}=${value}`).join(', ') || 'none'}`,
    ''
  ];
  for (const trend of radar.trends) {
    lines.push(`${trend.stage.toUpperCase().padEnd(8)} ${trend.attentionState.toUpperCase().padEnd(11)} ${trend.provider.padEnd(10)} ${trend.title}`);
    lines.push(`  ${trend.id} · detected ${trend.detectedAt} · ${trend.daysSinceDetected}d ago`);
    lines.push(`  ${trend.whyItMatters}`);
    if (trend.actionRefs.length) lines.push(`  Actions: ${trend.actionRefs.join(', ')}`);
    if (trend.measurementRefs.length) lines.push(`  Measure: ${trend.measurementRefs.join(', ')}`);
    lines.push(`  Source: ${trend.source}`);
  }
  lines.push('', radar.note);
  return lines.join('\n');
}
