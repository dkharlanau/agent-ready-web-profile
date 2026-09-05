#!/usr/bin/env node

import {
  compareVisibilitySnapshots,
  formatVisibilityComparison,
  loadVisibilitySnapshot,
  summarizeVisibilitySnapshot,
  validateVisibilitySnapshot
} from '../lib/visibility-evidence.mjs';

function usage() {
  console.log(`ARWP visibility evidence

Usage:
  arwp-visibility validate <snapshot.json> [--json]
  arwp-visibility show <snapshot.json> [--json]
  arwp-visibility compare <before.json> <after.json> [--json]

Visibility snapshots store aggregate owner-observed evidence. Comparisons report deltas only and never infer ranking or causality from ARWP adoption.`);
}

const args = process.argv.slice(2);
const command = args[0];
const source = args[1];
const second = args[2] && !args[2].startsWith('--') ? args[2] : null;
const jsonOutput = args.includes('--json');

function formatError(error) {
  return `${error.instancePath || '/'} ${error.message}`;
}

function main() {
  if (!command || command === '--help' || command === '-h') {
    usage();
    return 0;
  }
  if (!['validate', 'show', 'compare'].includes(command) || !source) {
    usage();
    return 2;
  }

  if (command === 'compare') {
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
