#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { loadProfile, validateProfile, formatAjvError } from '../lib/validator.mjs';
import { verifyProfileSource } from '../lib/verifier.mjs';
import { formatScanSummary, scanSite } from '../lib/scanner.mjs';

function usage() {
  console.log(`Agent-Ready Web Profile CLI

Usage:
  node bin/arwp.mjs validate <profile.json> [--json]
  node bin/arwp.mjs verify <profile.json|https://...> [--json] [--timeout=<ms>] [--concurrency=<n>]
  node bin/arwp.mjs scan <https://site.example> [--json] [--timeout=<ms>] [--max-bytes=<n>]
  node bin/arwp.mjs init <https://site.example> [--output=ai/site-profile.json] [--force] [--json]

Commands:
  validate   Validate one local ARWP profile against the v0.1 schema and semantic checks.
  verify     Validate a local or remote profile and probe every declared public URL.
  scan       Inspect a public HTTPS website and report bounded, directly observed interoperability evidence.
  init       Scan a website and write a conservative valid ARWP draft without inventing unverified capabilities.
`);
}

const args = process.argv.slice(2);
const command = args[0];
const source = args[1];
const jsonOutput = args.includes('--json');

function optionValue(name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
}

function numericOption(name, fallback) {
  const raw = optionValue(name);
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

if (!['validate', 'verify', 'scan', 'init'].includes(command) || !source) {
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

  if (command === 'verify') {
    const result = await verifyProfileSource(source, {
      timeoutMs: numericOption('timeout', 8000),
      concurrency: numericOption('concurrency', 6)
    });
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else printVerification(result);
    process.exit(result.valid ? 0 : 1);
  }

  const scan = await scanSite(source, {
    timeoutMs: numericOption('timeout', 8000),
    maxBytes: numericOption('max-bytes', 512 * 1024)
  });

  if (command === 'scan') {
    if (jsonOutput) {
      console.log(JSON.stringify(scan, null, 2));
    } else {
      console.log(formatScanSummary(scan));
      console.log('\nDraft profile (not written):');
      console.log(JSON.stringify(scan.draftProfile, null, 2));
    }
    process.exit(0);
  }

  const output = path.resolve(optionValue('output') || path.join('ai', 'site-profile.json'));
  if (fs.existsSync(output) && !args.includes('--force')) {
    throw new Error(`Refusing to overwrite existing file: ${output}. Use --force to replace it.`);
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(scan.draftProfile, null, 2)}\n`, 'utf8');

  if (jsonOutput) {
    console.log(JSON.stringify({
      written: output,
      profile: scan.draftProfile,
      evidence: scan.evidence,
      warnings: scan.warnings
    }, null, 2));
  } else {
    console.log(`WROTE ${output}`);
    console.log(`Detected ${scan.evidence.length} evidence item(s).`);
    for (const warning of scan.warnings) console.warn(`WARN ${warning}`);
    console.log(`Next: node bin/arwp.mjs validate ${output}`);
  }
  process.exit(0);
} catch (error) {
  if (jsonOutput) {
    console.log(JSON.stringify({ valid: false, fatal: String(error.message ?? error) }, null, 2));
  } else {
    console.error(`ERROR ${error.message ?? error}`);
  }
  process.exit(2);
}
