#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { resolveSite, planResolvedSite } from '../lib/resolver.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function option(name, fallback = null) {
  const prefix = `--${name}=`;
  const value = args.find(arg => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const corpusDir = path.resolve(option('corpus', path.join(root, 'benchmarks', 'corpus')));
const outputPath = option('output') ? path.resolve(option('output')) : null;
const includeNonIndependent = args.includes('--include-non-independent');
const schema = JSON.parse(fs.readFileSync(path.join(corpusDir, 'fixture.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const intents = ['read', 'search', 'structured', 'tools', 'agent'];

function normalizeUrl(value) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    return parsed.href.replace(/\/$/, '');
  } catch {
    return String(value);
  }
}

function criterionMatches(item, criterion) {
  if (!item) return false;
  if (typeof criterion === 'string') return normalizeUrl(item.url) === normalizeUrl(criterion);
  for (const [key, expected] of Object.entries(criterion)) {
    const actual = key === 'url' ? normalizeUrl(item.url) : item[key];
    const normalizedExpected = key === 'url' ? normalizeUrl(expected) : expected;
    if (actual !== normalizedExpected) return false;
  }
  return true;
}

function scoreSelection(selected, accepted) {
  if (!accepted.length) return { correct: !selected, classification: selected ? 'false-positive' : 'correct-none' };
  if (!selected) return { correct: false, classification: 'missed-interface' };
  const correct = accepted.some(criterion => criterionMatches(selected, criterion));
  return { correct, classification: correct ? 'correct-interface' : 'wrong-interface' };
}

function emptyResolutionLike(resolution) {
  return {
    canonicalUrl: resolution.canonicalUrl,
    identity: resolution.identity,
    sources: resolution.sources,
    conflicts: resolution.conflicts,
    summary: resolution.summary,
    interfaces: Object.fromEntries(Object.keys(resolution.interfaces).map(key => [key, []]))
  };
}

function filteredResolution(resolution, strategy) {
  if (strategy === 'resolver-union') return resolution;
  const copy = emptyResolutionLike(resolution);
  function include(item) {
    const id = String(item.sourceId || '');
    const authority = String(item.sourceAuthority || '');
    if (strategy === 'ordinary-web') return authority === 'observed-web' && item.protocol !== 'llms.txt';
    if (strategy === 'llms-aware') return authority === 'observed-web';
    if (strategy === 'agents-aware') return /^agents-(?:txt|json)/.test(id);
    if (strategy === 'arwp-profile-only') return id.startsWith('arwp-profile:');
    if (strategy === 'protocol-native') {
      return ['ietf-standard', 'upstream-standard', 'upstream-convention', 'experimental-upstream'].includes(authority);
    }
    return false;
  }
  for (const [group, items] of Object.entries(resolution.interfaces)) copy.interfaces[group] = items.filter(include);
  return copy;
}

function benchmarkObservation(resolution) {
  return {
    summary: resolution.summary,
    metrics: resolution.metrics,
    sources: (resolution.sources || []).map(source => ({
      id: source.id || null,
      type: source.type || null,
      url: source.url || null,
      status: source.status || null,
      authority: source.authority || null,
      httpStatus: source.httpStatus ?? null,
      contentType: source.contentType || null,
      issue: source.issue || null
    })),
    conflicts: (resolution.conflicts || []).map(conflict => ({
      kind: conflict.kind || null,
      severity: conflict.severity || null,
      capability: conflict.capability || null,
      message: conflict.message || null
    }))
  };
}

const fixtureFiles = fs.readdirSync(corpusDir)
  .filter(name => name.endsWith('.json') && name !== 'fixture.schema.json')
  .sort();
const fixtures = fixtureFiles.map(file => {
  const payload = JSON.parse(fs.readFileSync(path.join(corpusDir, file), 'utf8'));
  if (!validate(payload)) throw new Error(`${file}: ${JSON.stringify(validate.errors, null, 2)}`);
  return { file, ...payload };
}).filter(fixture => includeNonIndependent || fixture.ownership === 'independent');

if (!fixtures.length) {
  console.error('No benchmark fixtures selected. Add reviewed ownership=independent fixtures or pass --include-non-independent for engineering-only runs.');
  process.exit(2);
}

const strategies = ['ordinary-web', 'llms-aware', 'agents-aware', 'protocol-native', 'arwp-profile-only', 'resolver-union'];
const rawResults = [];

for (const fixture of fixtures) {
  const startedAt = Date.now();
  let resolution;
  try {
    resolution = await resolveSite(fixture.url);
  } catch (error) {
    rawResults.push({ id: fixture.id, url: fixture.url, ownership: fixture.ownership, status: 'failed', durationMs: Date.now() - startedAt, error: String(error?.message || error) });
    continue;
  }

  const strategyResults = {};
  for (const strategy of strategies) {
    const view = filteredResolution(resolution, strategy);
    const intentResults = {};
    for (const intent of intents) {
      const plan = planResolvedSite(view, intent);
      intentResults[intent] = {
        selected: plan.selected ? {
          url: plan.selected.url || null,
          protocol: plan.selected.protocol || null,
          kind: plan.selected.kind || null,
          transport: plan.selected.transport || null,
          sourceId: plan.selected.sourceId || null,
          sourceAuthority: plan.selected.sourceAuthority || null
        } : null,
        accepted: fixture.accepted[intent],
        ...scoreSelection(plan.selected, fixture.accepted[intent])
      };
    }
    strategyResults[strategy] = {
      intents: intentResults,
      correct: Object.values(intentResults).filter(item => item.correct).length,
      total: intents.length,
      metrics: strategy === 'resolver-union' ? {
        resolverRequestsAfterScan: resolution.metrics?.resolverRequests ?? null,
        resolverBytesAfterScan: resolution.metrics?.resolverBytes ?? null,
        networkScope: 'post-scan-resolver-discovery-only',
        durationMs: Date.now() - startedAt,
        durationScope: 'complete-resolveSite-call-including-bounded-base-scan',
        sourcesResolved: resolution.summary?.sourcesResolved ?? null,
        sourcesAttempted: resolution.summary?.sourcesAttempted ?? null,
        conflicts: resolution.conflicts?.length ?? 0
      } : null,
      metricScope: strategy === 'resolver-union'
        ? 'resolverRequestsAfterScan/resolverBytesAfterScan are measured resolver discovery fetches after the bounded base-site scan; durationMs covers the complete resolveSite call including that scan'
        : 'selection-only view of the same resolver observation; no independent request/byte claim'
    };
  }

  rawResults.push({
    id: fixture.id,
    url: fixture.url,
    ownership: fixture.ownership,
    reviewedAt: fixture.reviewedAt,
    evidence: fixture.evidence,
    status: 'resolved',
    canonicalUrl: resolution.canonicalUrl,
    resolverObservation: benchmarkObservation(resolution),
    strategyResults
  });
  console.log(`RESOLVED ${fixture.id}`);
}

const independentResults = rawResults.filter(item => item.ownership === 'independent');
const aggregate = {};
const resolvedOnlyAggregate = {};
for (const strategy of strategies) {
  let correct = 0;
  let total = 0;
  let resolvedCorrect = 0;
  let resolvedTotal = 0;
  for (const site of independentResults) {
    // A full-site resolver failure is an end-to-end failure for every scored intent.
    // Keep it in the denominator so the benchmark cannot improve by failing on hard sites.
    total += intents.length;
    if (site.status !== 'resolved') continue;
    const result = site.strategyResults[strategy];
    correct += result.correct;
    resolvedCorrect += result.correct;
    resolvedTotal += result.total;
  }
  aggregate[strategy] = { correct, total, accuracy: total ? correct / total : null };
  resolvedOnlyAggregate[strategy] = {
    correct: resolvedCorrect,
    total: resolvedTotal,
    accuracy: resolvedTotal ? resolvedCorrect / resolvedTotal : null
  };
}

const resolvedIndependentSites = independentResults.filter(item => item.status === 'resolved').length;
const failedIndependentSites = independentResults.filter(item => item.status === 'failed').length;
const report = {
  benchmarkVersion: '0.2',
  generatedAt: new Date().toISOString(),
  corpus: corpusDir,
  evidencePolicy: 'Only ownership=independent fixtures count toward aggregate results. Ground truth is manually reviewed public evidence and is never derived from Resolver output. A site-level resolution failure counts as incorrect for every scored intent in the primary aggregate; resolvedOnlyAggregate is diagnostic only.',
  metricPolicy: 'Only resolver-union exposes measured network counters, and those counters cover resolver discovery after the bounded base-site scan rather than the complete scan+resolver network total. Sub-strategy comparisons are selection-only projections over the same observed resolution.',
  diagnosticPolicy: 'Raw artifacts retain bounded resolver source/status/content-type diagnostics so benchmark mismatches can be audited without treating Resolver output as ground truth.',
  sitesSelected: fixtures.length,
  independentSites: independentResults.length,
  resolvedIndependentSites,
  failedIndependentSites,
  resolutionCoverage: independentResults.length ? resolvedIndependentSites / independentResults.length : null,
  aggregate,
  resolvedOnlyAggregate,
  results: rawResults
};

if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`WROTE ${outputPath}`);
} else {
  console.log(JSON.stringify(report, null, 2));
}
