#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  buildVisibilityFunnel,
  compareVisibilitySnapshots,
  formatVisibilityComparison,
  formatVisibilityFunnel,
  loadVisibilitySnapshot,
  mergeVisibilitySnapshots,
  summarizeVisibilitySnapshot,
  validateVisibilitySnapshot
} from '../lib/visibility-evidence.mjs';
import { importVisibilityExport } from '../lib/visibility-import.mjs';

function usage() {
  console.log(`ARWP visibility evidence

Usage:
  arwp-visibility validate <snapshot.json> [--json]
  arwp-visibility show <snapshot.json> [--json]
  arwp-visibility compare <before.json> <after.json> [--json]
  arwp-visibility merge <snapshot.json> <snapshot.json> [...] [--output=snapshot.json] [--json]
  arwp-visibility funnel <snapshot.json> [--json]
  arwp-visibility import <export.csv|export.json> --provider=<google|bing|cloudflare|referrals> --site=https://... --start=YYYY-MM-DD --end=YYYY-MM-DD [--report-scope=generative-ai] [--captured-at=ISO] [--evidence=URI] [--match=chatgpt.com,openai.com] [--output=snapshot.json] [--json]

Visibility snapshots store aggregate owner-observed evidence. Import adapters normalize only metrics actually present in owner exports. Google exports with generic Impressions require --report-scope=generative-ai and must come from the dedicated generative AI report; ordinary Web Search exports are unsupported. Explicit AI impression columns do not require this option. Merge requires the same site and exact observation period and rejects duplicate providers. Funnel keeps access, exposure, citation, visit and task signals separate: provider populations differ, so it never creates cross-provider conversion rates or a single AI visibility score.`);
}

const args = process.argv.slice(2);
const command = args[0];
const jsonOutput = args.includes('--json');

function optionValue(name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
}

function positionalArgs() {
  const optionsWithValues = new Set(['provider', 'site', 'start', 'end', 'report-scope', 'captured-at', 'evidence', 'match', 'output']);
  const out = [];
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      out.push(arg);
      continue;
    }
    if (arg.includes('=')) continue;
    const option = arg.slice(2);
    if (optionsWithValues.has(option) && args[index + 1] && !args[index + 1].startsWith('--')) index += 1;
  }
  return out;
}

function formatError(error) {
  return typeof error === 'string' ? error : `${error.instancePath || '/'} ${error.message || JSON.stringify(error)}`;
}

function writeSnapshot(snapshot, output) {
  const absolute = path.resolve(output);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return absolute;
}

function main() {
  if (!command || command === '--help' || command === '-h') {
    usage();
    return 0;
  }
  const positionals = positionalArgs();
  const source = positionals[0];
  if (!['validate', 'show', 'compare', 'merge', 'funnel', 'import'].includes(command)) {
    usage();
    return 2;
  }

  if (command === 'import') {
    if (!source) throw new Error('import requires an export file.');
    const provider = optionValue('provider');
    const site = optionValue('site');
    const start = optionValue('start');
    const end = optionValue('end');
    if (!provider || !site || !start || !end) throw new Error('import requires --provider, --site, --start and --end.');
    const result = importVisibilityExport(provider, source, {
      site,
      start,
      end,
      reportScope: optionValue('report-scope'),
      capturedAt: optionValue('captured-at'),
      evidence: optionValue('evidence'),
      match: optionValue('match')
    });
    const output = optionValue('output');
    const written = output ? writeSnapshot(result.snapshot, output) : null;
    if (jsonOutput) console.log(JSON.stringify({ ...result, written }, null, 2));
    else if (written) console.log(`WROTE ${written}\nProvider: ${result.snapshot.sources[0].provider}\nStatus: ${result.snapshot.sources[0].status}\nMetrics: ${JSON.stringify(result.snapshot.sources[0].metrics)}`);
    else console.log(JSON.stringify(result.snapshot, null, 2));
    return 0;
  }

  if (command === 'merge') {
    if (positionals.length < 2) throw new Error('merge requires at least two visibility snapshots.');
    const result = mergeVisibilitySnapshots(positionals.map(loadVisibilitySnapshot));
    if (!result.valid) {
      if (jsonOutput) console.log(JSON.stringify(result, null, 2));
      else for (const error of result.errors || []) console.error(`FAIL ${formatError(error)}`);
      return 1;
    }
    const output = optionValue('output');
    const written = output ? writeSnapshot(result.snapshot, output) : null;
    if (jsonOutput) console.log(JSON.stringify({ ...result, written }, null, 2));
    else if (written) console.log(`WROTE ${written}\nProviders: ${result.snapshot.sources.map(item => item.provider).join(', ')}`);
    else console.log(JSON.stringify(result.snapshot, null, 2));
    return 0;
  }

  if (!source) {
    usage();
    return 2;
  }

  if (command === 'funnel') {
    const result = buildVisibilityFunnel(loadVisibilitySnapshot(source));
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else console.log(formatVisibilityFunnel(result));
    return result.valid ? 0 : 1;
  }

  if (command === 'compare') {
    const second = positionals[1];
    if (!second) throw new Error('compare requires before.json and after.json.');
    const result = compareVisibilitySnapshots(loadVisibilitySnapshot(source), loadVisibilitySnapshot(second));
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else console.log(formatVisibilityComparison(result));
    return result.valid ? 0 : 1;
  }

  const snapshot = loadVisibilitySnapshot(source);
  const validation = validateVisibilitySnapshot(snapshot);
  if (command === 'validate') {
    if (jsonOutput) console.log(JSON.stringify(validation, null, 2));
    else if (validation.valid) {
      console.log(`PASS ${source}`);
      for (const warning of validation.warnings) console.warn(`WARN ${warning}`);
    } else {
      console.error(`FAIL ${source}`);
      for (const error of validation.errors) console.error(`  ${formatError(error)}`);
      for (const warning of validation.warnings) console.warn(`WARN ${warning}`);
    }
    return validation.valid ? 0 : 1;
  }

  const summary = summarizeVisibilitySnapshot(snapshot);
  if (jsonOutput) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`${summary.site} — ${summary.period.start}..${summary.period.end}`);
    for (const provider of summary.providers || []) console.log(`${provider.status.toUpperCase()} ${provider.provider} ${JSON.stringify(provider.metrics)}`);
    for (const warning of summary.warnings || []) console.warn(`WARN ${warning}`);
  }
  return summary.valid ? 0 : 1;
}

try {
  process.exit(main());
} catch (error) {
  if (jsonOutput) console.log(JSON.stringify({ valid: false, fatal: String(error.message ?? error) }, null, 2));
  else console.error(`ERROR ${error.message ?? error}`);
  process.exit(2);
}
