#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizePublicationUrl } from './publication-report.mjs';

const DEFAULT_STRATEGY = 'resolver-union';
const INTENTS = ['read', 'search', 'structured', 'tools', 'agent'];

function normalizeClassification(value) {
  if (value === 'missed-interface') return 'discovery-gap';
  if (value === 'wrong-interface') return 'selection-gap';
  if (value === 'false-positive') return 'over-selection';
  return value === 'correct-interface' || value === 'correct-none' ? 'correct' : 'unclassified';
}

function sanitizeCriterion(criterion) {
  if (typeof criterion === 'string') return sanitizePublicationUrl(criterion);
  if (!criterion || typeof criterion !== 'object' || Array.isArray(criterion)) return criterion;
  return Object.fromEntries(Object.entries(criterion).map(([key, value]) => [
    key,
    /(?:url|uri|href)$/i.test(key) && typeof value === 'string' ? sanitizePublicationUrl(value) : value
  ]));
}

function selectedSummary(selected) {
  if (!selected) return null;
  return {
    url: sanitizePublicationUrl(selected.url || ''),
    protocol: selected.protocol || null,
    kind: selected.kind || null,
    transport: selected.transport || null,
    sourceId: selected.sourceId || null,
    sourceAuthority: selected.sourceAuthority || null
  };
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

export function buildSelectionDiagnostics(report, strategy = DEFAULT_STRATEGY) {
  if (!report || !Array.isArray(report.results)) throw new Error('Benchmark report must contain results[].');
  const issues = [];
  const siteRows = [];
  let total = 0;
  let correct = 0;

  const independent = report.results.filter(site => site.ownership === 'independent');
  for (const site of independent) {
    let siteCorrect = 0;
    let siteTotal = 0;
    const siteIssues = [];

    if (site.status !== 'resolved') {
      for (const intent of INTENTS) {
        const issue = {
          siteId: site.id,
          siteUrl: sanitizePublicationUrl(site.url || ''),
          intent,
          category: 'resolution-failure',
          classification: 'resolution-failed',
          selected: null,
          accepted: null
        };
        issues.push(issue);
        siteIssues.push(issue);
        total += 1;
        siteTotal += 1;
      }
    } else {
      const strategyResult = site.strategyResults?.[strategy];
      if (!strategyResult?.intents) throw new Error(`${site.id}: missing strategy result for ${strategy}`);
      for (const intent of INTENTS) {
        const result = strategyResult.intents[intent];
        if (!result) throw new Error(`${site.id}: missing ${strategy}.${intent} result`);
        total += 1;
        siteTotal += 1;
        if (result.correct) {
          correct += 1;
          siteCorrect += 1;
          continue;
        }
        const issue = {
          siteId: site.id,
          siteUrl: sanitizePublicationUrl(site.url || ''),
          intent,
          category: normalizeClassification(result.classification),
          classification: result.classification || 'unclassified',
          selected: selectedSummary(result.selected),
          accepted: Array.isArray(result.accepted) ? result.accepted.map(sanitizeCriterion) : []
        };
        issues.push(issue);
        siteIssues.push(issue);
      }
    }

    siteRows.push({
      id: site.id,
      url: sanitizePublicationUrl(site.url || ''),
      status: site.status,
      correct: siteCorrect,
      total: siteTotal,
      misses: siteTotal - siteCorrect,
      categories: countBy(siteIssues, item => item.category),
      intents: siteIssues.map(item => item.intent)
    });
  }

  const weakSites = siteRows
    .filter(site => site.misses > 0)
    .sort((a, b) => b.misses - a.misses || a.id.localeCompare(b.id));

  return {
    diagnosticsVersion: '0.1',
    benchmarkVersion: report.benchmarkVersion || null,
    benchmarkGeneratedAt: report.generatedAt || null,
    strategy,
    policy: 'Diagnostics classify reviewed benchmark mismatches without changing ground truth. URLs are publication-sanitized; free-form resolver errors are omitted. missed-interface => discovery-gap; wrong-interface => selection-gap; false-positive => over-selection; full-site failures => resolution-failure.',
    summary: {
      independentSites: independent.length,
      resolvedSites: independent.filter(site => site.status === 'resolved').length,
      failedSites: independent.filter(site => site.status !== 'resolved').length,
      total,
      correct,
      incorrect: total - correct,
      byCategory: countBy(issues, item => item.category),
      byIntent: countBy(issues, item => item.intent)
    },
    weakSites,
    issues
  };
}

function option(args, name, fallback = null) {
  const prefix = `--${name}=`;
  const value = args.find(arg => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

async function main() {
  const args = process.argv.slice(2);
  const input = option(args, 'input');
  const output = option(args, 'output');
  const strategy = option(args, 'strategy', DEFAULT_STRATEGY);
  if (!input) throw new Error('Usage: node benchmarks/selection-diagnostics.mjs --input=<external.json> [--output=<diagnostics.json>] [--strategy=resolver-union]');

  const report = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
  const diagnostics = buildSelectionDiagnostics(report, strategy);
  const rendered = `${JSON.stringify(diagnostics, null, 2)}\n`;
  if (output) {
    const target = path.resolve(output);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, rendered, 'utf8');
    console.log(`WROTE ${target}`);
  } else {
    process.stdout.write(rendered);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}
