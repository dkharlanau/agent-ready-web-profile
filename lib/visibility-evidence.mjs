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

function samePeriod(left, right) {
  return left?.start === right?.start && left?.end === right?.end;
}

function latestInstant(values) {
  const valid = values.map(value => new Date(value)).filter(value => !Number.isNaN(value.getTime()));
  if (!valid.length) return new Date().toISOString();
  return new Date(Math.max(...valid.map(value => value.getTime()))).toISOString();
}

export function summarizeVisibilitySnapshot(snapshot) {
  const validation = validateVisibilitySnapshot(snapshot);
  if (!validation.valid) return { ...validation, site: snapshot?.site ?? null, metrics: {} };
  return {
    ...validation,
    site: snapshot.site,
    period: snapshot.period,
    capturedAt: snapshot.capturedAt,
    version: snapshot.version,
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

export function mergeVisibilitySnapshots(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length < 2) return { valid: false, errors: ['merge requires at least two visibility snapshots.'] };
  const validationErrors = [];
  snapshots.forEach((snapshot, index) => {
    const validation = validateVisibilitySnapshot(snapshot);
    if (!validation.valid) validationErrors.push({ snapshot: index, errors: validation.errors, warnings: validation.warnings });
  });
  if (validationErrors.length) return { valid: false, errors: validationErrors };
  const first = snapshots[0];
  if (snapshots.some(snapshot => snapshot.site !== first.site)) return { valid: false, errors: ['all snapshots must describe the same site.'] };
  if (snapshots.some(snapshot => !samePeriod(snapshot.period, first.period))) return { valid: false, errors: ['all snapshots must use the same observation period before they can be merged.'] };
  const sources = [];
  const seen = new Set();
  for (const snapshot of snapshots) {
    for (const source of snapshot.sources || []) {
      if (seen.has(source.provider)) return { valid: false, errors: [`duplicate provider during merge: ${source.provider}. Merge provider exports before normalization or choose one evidence snapshot for that provider.`] };
      seen.add(source.provider);
      sources.push(structuredClone(source));
    }
  }
  const notes = [...new Set([
    ...snapshots.flatMap(snapshot => snapshot.notes || []),
    `Merged ${snapshots.length} provider snapshot(s) without combining provider-specific denominators.`
  ])];
  const snapshot = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/visibility-snapshot.schema.json',
    version: '0.2',
    site: first.site,
    capturedAt: latestInstant(snapshots.map(item => item.capturedAt)),
    period: structuredClone(first.period),
    sources,
    notes,
    guardrails: { noRankingInference: true, noCausalityInference: true, aggregateDataOnly: true }
  };
  const validation = validateVisibilitySnapshot(snapshot);
  return validation.valid ? { valid: true, snapshot, warnings: validation.warnings } : { valid: false, errors: validation.errors, warnings: validation.warnings };
}

function stage(id, label) {
  return { id, label, observations: [], derived: [] };
}

function addObservation(target, provider, metrics, metric, label) {
  const value = metrics?.[metric];
  if (typeof value === 'number' && Number.isFinite(value)) target.observations.push({ provider, metric, label, value });
}

function addRatio(target, provider, metric, numerator, denominator, label, formula, unit = 'rate') {
  if (typeof numerator !== 'number' || typeof denominator !== 'number' || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return;
  target.derived.push({ provider, metric, label, value: numerator / denominator, unit, formula });
}

export function buildVisibilityFunnel(snapshot) {
  const validation = validateVisibilitySnapshot(snapshot);
  if (!validation.valid) return { valid: false, errors: validation.errors, warnings: validation.warnings, stages: [] };
  const metrics = metricMap(snapshot);
  const access = stage('access', 'Access');
  const exposure = stage('exposure', 'Exposure');
  const citation = stage('citation', 'Citation');
  const visit = stage('visit', 'Visit');
  const task = stage('task', 'Task');

  const cloudflare = metrics['cloudflare-ai-crawl-control'] || {};
  addObservation(access, 'cloudflare-ai-crawl-control', cloudflare, 'aiCrawlerRequests', 'AI crawler requests');
  addObservation(access, 'cloudflare-ai-crawl-control', cloudflare, 'aiCrawlerAllowedRequests', 'Allowed AI crawler requests');
  addObservation(access, 'cloudflare-ai-crawl-control', cloudflare, 'aiCrawlerSuccessfulRequests', 'Successful AI crawler responses');
  addObservation(access, 'cloudflare-ai-crawl-control', cloudflare, 'aiCrawlerUnsuccessfulRequests', 'Unsuccessful AI crawler responses');
  addObservation(access, 'cloudflare-ai-crawl-control', cloudflare, 'bytesTransferred', 'Bytes transferred to AI crawlers');
  addRatio(access, 'cloudflare-ai-crawl-control', 'crawlerAllowRate', cloudflare.aiCrawlerAllowedRequests, cloudflare.aiCrawlerRequests, 'Crawler allow rate', 'aiCrawlerAllowedRequests / aiCrawlerRequests');
  addRatio(access, 'cloudflare-ai-crawl-control', 'crawlerSuccessRate', cloudflare.aiCrawlerSuccessfulRequests, cloudflare.aiCrawlerRequests, 'Crawler success rate', 'aiCrawlerSuccessfulRequests / aiCrawlerRequests');

  const google = metrics['google-search-console-generative-ai'] || {};
  addObservation(exposure, 'google-search-console-generative-ai', google, 'aiImpressions', 'Generative AI impressions');
  addObservation(exposure, 'google-search-console-generative-ai', google, 'aiVisiblePages', 'Pages observed in generative AI features');
  addObservation(exposure, 'google-search-console-generative-ai', google, 'aiVisibleCountries', 'Countries observed in generative AI features');
  addObservation(exposure, 'google-search-console-generative-ai', google, 'aiVisibleDevices', 'Device classes observed in generative AI features');
  addRatio(exposure, 'google-search-console-generative-ai', 'impressionsPerVisiblePage', google.aiImpressions, google.aiVisiblePages, 'Impressions per visible page', 'aiImpressions / aiVisiblePages', 'per-page');

  const bing = metrics['bing-webmaster-ai-performance'] || {};
  addObservation(citation, 'bing-webmaster-ai-performance', bing, 'totalCitations', 'AI citations');
  addObservation(citation, 'bing-webmaster-ai-performance', bing, 'citedPages', 'Unique cited pages');
  addObservation(citation, 'bing-webmaster-ai-performance', bing, 'groundingQueriesSampled', 'Sampled grounding queries');
  addObservation(citation, 'bing-webmaster-ai-performance', bing, 'averageCitedPages', 'Average cited pages');
  addRatio(citation, 'bing-webmaster-ai-performance', 'citationsPerCitedPage', bing.totalCitations, bing.citedPages, 'Citations per cited page', 'totalCitations / citedPages', 'per-page');

  const referrals = metrics['referral-analytics'] || {};
  addObservation(visit, 'referral-analytics', referrals, 'referrals', 'AI referral visits/sessions');
  addObservation(visit, 'referral-analytics', referrals, 'engagedVisits', 'Engaged AI referral visits/sessions');
  addObservation(visit, 'cloudflare-ai-crawl-control', cloudflare, 'aiCrawlerReferrals', 'AI-origin referrals observed by Cloudflare');
  addRatio(visit, 'referral-analytics', 'engagedReferralRate', referrals.engagedVisits, referrals.referrals, 'Engaged referral rate', 'engagedVisits / referrals');

  addObservation(task, 'referral-analytics', referrals, 'taskCompletions', 'Observed task completions/conversions from matched AI referrals');
  addRatio(task, 'referral-analytics', 'taskCompletionPerReferral', referrals.taskCompletions, referrals.referrals, 'Task completions per referral', 'taskCompletions / referrals', 'per-referral');

  const stages = [access, exposure, citation, visit, task];
  return {
    valid: true,
    site: snapshot.site,
    period: snapshot.period,
    capturedAt: snapshot.capturedAt,
    observedStages: stages.filter(item => item.observations.length || item.derived.length).map(item => item.id),
    stages,
    interpretation: 'This is a stage-separated observability view. Provider populations and denominators differ, so ARWP does not create cross-provider conversion rates or a single AI visibility score.',
    guardrails: {
      noRankingInference: true,
      noCausalityInference: true,
      noCrossProviderConversionRate: true,
      noSingleVisibilityScore: true,
      preserveMissingData: true
    }
  };
}

export function formatVisibilityFunnel(result) {
  if (!result.valid) return `Invalid visibility funnel (${result.errors?.length || 0} issue(s)).`;
  const lines = [
    `Search/AI observation funnel — ${result.site}`,
    `Period: ${result.period.start}..${result.period.end}`
  ];
  for (const stageItem of result.stages) {
    lines.push('', stageItem.label.toUpperCase());
    if (!stageItem.observations.length && !stageItem.derived.length) {
      lines.push('  no observed metric');
      continue;
    }
    for (const item of stageItem.observations) lines.push(`  ${item.provider} ${item.metric}: ${item.value}`);
    for (const item of stageItem.derived) {
      const value = item.unit === 'rate' ? `${(item.value * 100).toFixed(1)}%` : item.value.toFixed(2);
      lines.push(`  ${item.provider} ${item.metric}: ${value} (${item.formula})`);
    }
  }
  lines.push('', result.interpretation);
  return lines.join('\n');
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
