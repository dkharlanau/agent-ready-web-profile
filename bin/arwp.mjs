#!/usr/bin/env node

import { loadProfile, validateProfile, formatAjvError } from '../lib/validator.mjs';
import { verifyProfileSource } from '../lib/verifier.mjs';

function usage() {
  console.log(`Agent-Ready Web Profile CLI

Usage:
  node bin/arwp.mjs validate <profile.json> [--json]
  node bin/arwp.mjs verify <profile.json|https://...> [--json] [--timeout=<ms>] [--concurrency=<n>]

Commands:
  validate   Validate one local ARWP profile against the v0.1 schema and semantic checks.
  verify     Validate a local or remote profile and probe every declared public URL.
`);
}

const args = process.argv.slice(2);
const command = args[0];
const source = args[1];
const jsonOutput = args.includes('--json');

function numericOption(name, fallback) {
  const prefix = `--${name}=`;
  const raw = args.find(arg => arg.startsWith(prefix))?.slice(prefix.length);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid --${name} value: ${raw}`);
  return value;
}

function printValidation(sourceName, result) {
  if (result.valid) {
    console.log(`PASS ${sourceName}`);
    for (const warning of result.warnings) console.warn(`WARN ${warning}`);
    return;
  }

  console.error(`FAIL ${sourceName}`);
  for (const error of result.errors) console.error(`  ${formatAjvError(error)}`);
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
}

function printVerification(result) {
  if (!result.profileValid && result.schemaErrors?.length) {
    console.error(`FAIL ${result.source}`);
    for (const error of result.schemaErrors) console.error(`  ${error}`);
    return;
  }

  console.log(`${result.valid ? 'PASS' : 'FAIL'} ${result.source}`);
  for (const item of result.resources) {
    const suffix = item.issues?.length ? ` — ${item.issues.join('; ')}` : '';
    console.log(`${item.status.toUpperCase().padEnd(4)} ${item.key} ${item.httpStatus ?? ''} ${item.finalUrl ?? item.url}${suffix}`);
  }
  console.log(`Summary: ${result.summary.pass} pass, ${result.summary.warn} warn, ${result.summary.fail} fail`);
  for (const warning of result.warnings ?? []) console.warn(`WARN ${warning}`);
}

if (!command || command === '--help' || command === '-h') {
  usage();
  process.exit(0);
}

if (!['validate', 'verify'].includes(command) || !source) {
  usage();
  process.exit(2);
}

try {
  if (command === 'validate') {
    const profile = loadProfile(source);
    const result = validateProfile(profile);
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else printValidation(source, result);
    process.exit(result.valid ? 0 : 1);
  }

  const result = await verifyProfileSource(source, {
    timeoutMs: numericOption('timeout', 8000),
    concurrency: numericOption('concurrency', 6)
  });
  if (jsonOutput) console.log(JSON.stringify(result, null, 2));
  else printVerification(result);
  process.exit(result.valid ? 0 : 1);
} catch (error) {
  if (jsonOutput) {
    console.log(JSON.stringify({ valid: false, fatal: String(error.message ?? error) }, null, 2));
  } else {
    console.error(`ERROR ${error.message ?? error}`);
  }
  process.exit(2);
}
