import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'visibility-snapshot.schema.json');

export function loadVisibilitySnapshotSchema() {
  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
}

export function createVisibilitySnapshotValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(loadVisibilitySnapshotSchema());
}

export function validateVisibilitySnapshot(snapshot) {
  const validate = createVisibilitySnapshotValidator();
  const schemaValid = Boolean(validate(snapshot));
  const warnings = [];
  const periodOrderInvalid = Boolean(snapshot?.period?.start && snapshot?.period?.end && snapshot.period.start > snapshot.period.end);
  if (periodOrderInvalid) warnings.push('period.start is after period.end.');
  if (snapshot?.sources?.every(source => source.status === 'unavailable')) warnings.push('all measurement sources are unavailable; the snapshot contains no observed visibility evidence.');
  return { valid: schemaValid && !periodOrderInvalid, errors: validate.errors ?? [], warnings };
}

export function loadVisibilitySnapshot(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function metricMap(snapshot) {
  const out = {};
  for (const source of snapshot.sources || []) {
    out[source.provider] ??= {};
    for (const [metric, value] of Object.entries(source.metrics || {})) {
      if (typeof value === 'number' && Number.isFinite(value)) out[source.provider][metric] = value;
    }
  }
  return out;
}

function evidenceSummary(snapshot) {
  return (snapshot.sources || []).map(source => ({
    provider: source.provider,
    status: source.status,
    evidence: source.evidence ?? null,
    notes: source.notes ?? null
  }));
}

function periodsAreOrdered(before, after) {
  if (!before?.period?.end || !after?.period?.start) return true;
  return after.period.start > before.period.end;
}

function periodDays(period) {
  if (!period?.start || !period?.end) return null;
  const start = Date.parse(`${period.start}T00:00:00Z`);
  const end = Date.parse(`${period.end}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.floor((end - start) / 86400000) + 1;
}

export function summarizeVisibilitySnapshot(snapshot) {
  const validation = validateVisibilitySnapshot(snapshot);
  if (!validation.valid) return { ...validation, site: snapshot?.site ?? null, metrics: {} };
  return {
    ...validation,
    site: snapshot.site,
    period: snapshot.period,
    capturedAt: snapshot.capturedAt,
    providers: snapshot.sources.map(source => ({
      provider: source.provider,
      status: source.status,
      metrics: source.metrics,
      evidence: source.evidence ?? null,
      notes: source.notes ?? null
    })),
    metrics: metricMap(snapshot),
    guardrails: snapshot.guardrails
  };
}

export function compareVisibilitySnapshots(before, after) {
  const beforeValidation = validateVisibilitySnapshot(before);
  const afterValidation = validateVisibilitySnapshot(after);
  const errors = [];
  if (!beforeValidation.valid) errors.push({ snapshot: 'before', errors: beforeValidation.errors, warnings: beforeValidation.warnings });
  if (!afterValidation.valid) errors.push({ snapshot: 'after', errors: afterValidation.errors, warnings: afterValidation.warnings });
  if (before?.site && after?.site && before.site !== after.site) errors.push({ snapshot: 'comparison', errors: [`site mismatch: ${before.site} != ${after.site}`] });
  if (beforeValidation.valid && afterValidation.valid && !periodsAreOrdered(before, after)) {
    errors.push({ snapshot: 'comparison', errors: [`incompatible before/after periods: after period must start after before period ends (${before.period.start}..${before.period.end} vs ${after.period.start}..${after.period.end})`] });
  }
  if (errors.length) return { valid: false, errors, changes: [] };

  const beforeMetrics = metricMap(before);
  const afterMetrics = metricMap(after);
  const providers = [...new Set([...Object.keys(beforeMetrics), ...Object.keys(afterMetrics)])].sort();
  const changes = [];
  for (const provider of providers) {
    const metrics = [...new Set([...Object.keys(beforeMetrics[provider] || {}), ...Object.keys(afterMetrics[provider] || {})])].sort();
    for (const metric of metrics) {
      const from = beforeMetrics[provider]?.[metric];
      const to = afterMetrics[provider]?.[metric];
      if (typeof from !== 'number' || typeof to !== 'number') {
        changes.push({ provider, metric, before: from ?? null, after: to ?? null, delta: null, comparable: false });
        continue;
      }
      changes.push({
        provider,
        metric,
        before: from,
        after: to,
        delta: to - from,
        percentChange: from === 0 ? null : ((to - from) / from) * 100,
        comparable: true
      });
    }
  }

  const beforeDays = periodDays(before.period);
  const afterDays = periodDays(after.period);
  return {
    valid: true,
    site: before.site,
    beforePeriod: before.period,
    afterPeriod: after.period,
    periodCompatibility: {
      orderedNonOverlapping: true,
      beforeDays,
      afterDays,
      sameLength: beforeDays != null && afterDays != null ? beforeDays === afterDays : null,
      note: beforeDays === afterDays
        ? 'Observation windows have equal duration.'
        : 'Observation windows have different durations; absolute deltas remain observable but rate-normalized interpretation may be more appropriate.'
    },
    sourceEvidence: {
      before: evidenceSummary(before),
      after: evidenceSummary(after)
    },
    changes,
    interpretation: 'Deltas are observations only. They do not prove that ARWP or any single site change caused a search, citation or referral movement.',
    guardrails: {
      noRankingInference: true,
      noCausalityInference: true,
      preserveNegativeResults: true
    }
  };
}

export function formatVisibilityComparison(result) {
  if (!result.valid) return `Invalid visibility comparison (${result.errors.length} issue group(s)).`;
  const lines = [
    `Visibility evidence comparison — ${result.site}`,
    `Before: ${result.beforePeriod.start}..${result.beforePeriod.end}`,
    `After:  ${result.afterPeriod.start}..${result.afterPeriod.end}`,
    result.periodCompatibility?.note || '',
    ''
  ];
  for (const item of result.changes) {
    if (!item.comparable) lines.push(`N/A  ${item.provider} ${item.metric}: ${item.before ?? 'missing'} -> ${item.after ?? 'missing'}`);
    else lines.push(`${item.delta >= 0 ? '+' : ''}${item.delta}  ${item.provider} ${item.metric}: ${item.before} -> ${item.after}${item.percentChange == null ? '' : ` (${item.percentChange >= 0 ? '+' : ''}${item.percentChange.toFixed(1)}%)`}`);
  }
  const evidence = [...(result.sourceEvidence?.before || []), ...(result.sourceEvidence?.after || [])]
    .filter(item => item.evidence)
    .map(item => `${item.provider}: ${item.evidence}`);
  if (evidence.length) lines.push('', 'Evidence:', ...[...new Set(evidence)].map(item => `- ${item}`));
  lines.push('', result.interpretation);
  return lines.filter((line, index, array) => line !== '' || index === 0 || array[index - 1] !== '').join('\n');
}
