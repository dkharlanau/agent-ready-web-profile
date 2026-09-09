#!/usr/bin/env node

import { technicalIntegrity, formatTechnicalIntegrityReport } from '../lib/technical-integrity.mjs';

function optionValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find(value => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function intOption(name, fallback, min, max) {
  const raw = optionValue(name);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`--${name} must be an integer between ${min} and ${max}.`);
  return value;
}

const args = process.argv.slice(2).filter(value => !value.startsWith('--'));
const source = args[0];
const json = process.argv.includes('--json');

if (!source || process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Usage: arwp-technical-integrity <https://site.example/> [options]\n\nOptions:\n  --json                 Emit machine-readable JSON\n  --max-pages=N          Bounded priority cohort, 1-50 (default 20)\n  --concurrency=N        Parallel public fetches, 1-10 (default 4)\n  --timeout=N            Per-request timeout in ms (default 8000)\n\nThe command runs a bounded public technical Search/AI integrity audit. It does not produce a readiness score and does not claim indexing, ranking or citation outcomes.`);
  process.exit(source ? 0 : 1);
}

try {
  const report = await technicalIntegrity(source, {
    maxPages: intOption('max-pages', 20, 1, 50),
    concurrency: intOption('concurrency', 4, 1, 10),
    timeoutMs: intOption('timeout', 8000, 1, 120000)
  });
  process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : `${formatTechnicalIntegrityReport(report)}\n`);
  process.exitCode = report.summary.p0Failures > 0 ? 2 : 0;
} catch (error) {
  console.error(`Technical Integrity failed: ${error?.message ?? error}`);
  process.exitCode = 1;
}
