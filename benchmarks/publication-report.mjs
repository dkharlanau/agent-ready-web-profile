#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SENSITIVE_QUERY_PARAM = /(?:^|[-_.])(?:access[-_.]?token|api[-_.]?key|auth|authorization|code|credential|expires?|key|password|secret|session|sig|signature|token|x-amz-[a-z0-9-]+|x-goog-[a-z0-9-]+)(?:$|[-_.])/i;
const SENSITIVE_KEY = /^(?:accessToken|apiKey|authorization|cookie|credentials?|password|secret|session|signature|token)$/i;
const URL_KEY = /(?:url|uri|href)$/i;
const REDACTED = '[REDACTED]';

export function sanitizePublicationUrl(value) {
  if (typeof value !== 'string') return value;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return value;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return value;
  parsed.username = '';
  parsed.password = '';
  parsed.hash = '';
  for (const key of [...parsed.searchParams.keys()]) {
    if (SENSITIVE_QUERY_PARAM.test(key)) parsed.searchParams.set(key, REDACTED);
  }
  return parsed.toString();
}

function sanitizeKnownValue(key, value) {
  if (SENSITIVE_KEY.test(key)) return REDACTED;
  if (URL_KEY.test(key) && typeof value === 'string') return sanitizePublicationUrl(value);
  return value;
}

function sanitizeCriterion(criterion) {
  if (typeof criterion === 'string') return sanitizePublicationUrl(criterion);
  if (!criterion || typeof criterion !== 'object' || Array.isArray(criterion)) return criterion;
  return Object.fromEntries(Object.entries(criterion).map(([key, value]) => [key, sanitizeKnownValue(key, value)]));
}

function sanitizeSelected(selected) {
  if (!selected) return null;
  const allowed = ['url', 'protocol', 'kind', 'transport', 'sourceId', 'sourceAuthority'];
  return Object.fromEntries(allowed
    .filter(key => Object.prototype.hasOwnProperty.call(selected, key))
    .map(key => [key, sanitizeKnownValue(key, selected[key])]));
}

function sanitizeMetrics(metrics) {
  if (!metrics) return null;
  const allowed = [
    'resolverRequestsAfterScan',
    'resolverBytesAfterScan',
    'networkScope',
    'durationMs',
    'durationScope',
    'sourcesResolved',
    'sourcesAttempted',
    'conflicts'
  ];
  return Object.fromEntries(allowed
    .filter(key => Object.prototype.hasOwnProperty.call(metrics, key))
    .map(key => [key, metrics[key]]));
}

function sanitizeEvidence(evidence) {
  if (!Array.isArray(evidence)) return [];
  return evidence.map(item => ({
    url: sanitizePublicationUrl(item?.url || ''),
    note: String(item?.note || ''),
    ...(item?.sourceType ? { sourceType: String(item.sourceType) } : {})
  }));
}

export function buildPublicBenchmarkReport(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw new TypeError('Benchmark report must be an object.');
  const results = Array.isArray(report.results) ? report.results : [];

  return {
    publicationReportVersion: '0.1',
    benchmarkVersion: report.benchmarkVersion ?? null,
    generatedAt: report.generatedAt ?? null,
    corpus: 'benchmarks/corpus',
    sanitizationPolicy: 'Publication view keeps reviewed ground truth, per-intent selections, classifications and bounded numeric metrics while omitting resolver source diagnostics and free-form runtime errors. URL userinfo is removed and sensitive query parameter values are redacted.',
    evidencePolicy: report.evidencePolicy ?? null,
    metricPolicy: report.metricPolicy ?? null,
    sitesSelected: report.sitesSelected ?? null,
    independentSites: report.independentSites ?? null,
    resolvedIndependentSites: report.resolvedIndependentSites ?? null,
    failedIndependentSites: report.failedIndependentSites ?? null,
    resolutionCoverage: report.resolutionCoverage ?? null,
    aggregate: report.aggregate ?? {},
    resolvedOnlyAggregate: report.resolvedOnlyAggregate ?? {},
    results: results.map(site => {
      const published = {
        id: site.id ?? null,
        url: sanitizePublicationUrl(site.url ?? ''),
        ownership: site.ownership ?? null,
        reviewedAt: site.reviewedAt ?? null,
        evidence: sanitizeEvidence(site.evidence),
        status: site.status ?? null
      };

      if (site.status === 'resolved') {
        published.canonicalUrl = sanitizePublicationUrl(site.canonicalUrl ?? '');
        published.strategyResults = Object.fromEntries(Object.entries(site.strategyResults || {}).map(([strategy, result]) => [strategy, {
          intents: Object.fromEntries(Object.entries(result?.intents || {}).map(([intent, item]) => [intent, {
            selected: sanitizeSelected(item?.selected),
            accepted: Array.isArray(item?.accepted) ? item.accepted.map(sanitizeCriterion) : [],
            correct: Boolean(item?.correct),
            classification: item?.classification ?? null
          }])),
          correct: result?.correct ?? null,
          total: result?.total ?? null,
          metrics: sanitizeMetrics(result?.metrics),
          metricScope: result?.metricScope ?? null
        }]));
      }

      return published;
    })
  };
}

function option(args, name) {
  const prefix = `--${name}=`;
  const value = args.find(arg => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const input = option(args, 'input');
  const output = option(args, 'output');
  if (!input || !output) {
    console.error('Usage: node benchmarks/publication-report.mjs --input=<raw.json> --output=<public.json>');
    process.exit(2);
  }
  const report = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
  const publicReport = buildPublicBenchmarkReport(report);
  const outputPath = path.resolve(output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(publicReport, null, 2)}\n`, 'utf8');
  console.log(`WROTE ${outputPath}`);
}
