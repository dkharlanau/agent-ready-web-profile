#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { siteGate, formatSiteGateReport } from '../lib/site-gate.mjs';

function usage() {
  console.log(`ARWP Site Readiness Gate

Usage:
  arwp site-gate <https://site.example/> [--max-pages=30] [--concurrency=4] [--site-type=auto|general|data-site|research-dataset|large-knowledge-site] [--timeout=8000] [--max-bytes=524288] [--output=<report.json>] [--json]

The command creates a bounded public readiness report and experiment seed.
It does not produce a composite readiness/AI score and does not invent owner-only analytics.`);
}

const raw = process.argv.slice(2);
const offset = raw[0] === 'site-gate' ? 1 : 0;
const args = raw.slice(offset);
const source = args[0];
const jsonOutput = args.includes('--json');

function optionValue(name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
}

function intOption(name, fallback, min, max) {
  const rawValue = optionValue(name);
  if (!rawValue) return fallback;
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`--${name} must be an integer between ${min} and ${max}.`);
  return value;
}

function numberOption(name, fallback, min) {
  const rawValue = optionValue(name);
  if (!rawValue) return fallback;
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < min) throw new Error(`--${name} must be >= ${min}.`);
  return value;
}

function writeJson(value, target) {
  const resolved = path.resolve(target);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return resolved;
}

async function main() {
  if (!source || source === '--help' || source === '-h') {
    usage();
    return source ? 0 : 2;
  }
  const allowedSiteTypes = new Set(['auto', 'general', 'data-site', 'research-dataset', 'large-knowledge-site']);
  const siteType = optionValue('site-type') || 'auto';
  if (!allowedSiteTypes.has(siteType)) throw new Error(`Unsupported --site-type=${siteType}.`);

  const report = await siteGate(source, {
    maxPages: intOption('max-pages', 30, 1, 50),
    concurrency: intOption('concurrency', 4, 1, 10),
    timeoutMs: numberOption('timeout', 8000, 1),
    maxBytes: numberOption('max-bytes', 512 * 1024, 1024),
    siteType
  });

  const output = optionValue('output');
  const written = output ? writeJson(report, output) : null;
  if (jsonOutput) console.log(JSON.stringify(written ? { written, report } : report, null, 2));
  else {
    console.log(formatSiteGateReport(report));
    if (written) console.log(`\nWROTE ${written}`);
  }
  return report.summary.p0Failures > 0 ? 1 : 0;
}

try {
  const exitCode = await main();
  process.exit(exitCode);
} catch (error) {
  if (jsonOutput) console.log(JSON.stringify({ valid: false, fatal: String(error.message ?? error) }, null, 2));
  else console.error(`ERROR ${error.message ?? error}`);
  process.exit(2);
}
