#!/usr/bin/env node

import { technicalIntegrity, formatTechnicalIntegrityReport } from '../lib/technical-integrity.mjs';

function printHelp() {
  console.log(`Usage:\n  arwp technical-integrity <https://site.example/> [options]\n  arwp-technical-integrity <https://site.example/> [options]\n\nOptions:\n  --json                 Emit machine-readable JSON\n  --max-pages=N          Bounded priority cohort, 1-50 (default 20)\n  --concurrency=N        Parallel public fetches, 1-10 (default 4)\n  --timeout=N            Per-request timeout in ms (default 8000)\n\nThe command runs a bounded public technical Search/AI integrity audit. It does not produce a readiness score and does not claim indexing, ranking or citation outcomes.`);
}

const raw = process.argv.slice(2);
const offset = raw[0] === 'technical-integrity' ? 1 : 0;
const args = raw.slice(offset);
const source = args.find(value => !value.startsWith('--'));
const json = args.includes('--json');
const help = args.includes('--help') || args.includes('-h');

function optionValue(name) {
  const prefix = `--${name}=`;
  const inline = args.find(value => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
}

function intOption(name, fallback, min, max) {
  const valueRaw = optionValue(name);
  if (valueRaw === null) return fallback;
  const value = Number(valueRaw);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`--${name} must be an integer between ${min} and ${max}.`);
  return value;
}

if (help) {
  printHelp();
  process.exit(0);
}
if (!source) {
  printHelp();
  process.exit(1);
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
