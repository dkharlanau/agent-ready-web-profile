#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  createEvidenceReceipt,
  verifyEvidenceReceipt,
  validateEvidenceReceipt
} from '../lib/evidence-receipt.mjs';

function usage() {
  return `arwp-receipt — durable ARWP Resolver observation receipts

Usage:
  arwp-receipt create <resolution.json> [--observed-at=ISO] [--tool-version=VERSION] [--output=FILE]
  arwp-receipt verify <receipt.json> [--json]

Examples:
  arwp resolve https://example.com --json > resolution.json
  arwp-receipt create resolution.json --output=receipt.json
  arwp-receipt verify receipt.json

Semantics:
  * receiptVersion 0.1 records a specific ARWP Resolver observation
  * canonical SHA-256 covers the receipt payload and detects tampering
  * a receipt is not a publisher manifest, endorsement or trust certificate
  * source-body digests are not claimed unless explicitly captured by future fetch instrumentation
`;
}

function parseArgs(args) {
  const positionals = [];
  const flags = {};
  for (const arg of args) {
    if (!arg.startsWith('--')) { positionals.push(arg); continue; }
    if (arg === '--json') { flags.json = true; continue; }
    const eq = arg.indexOf('=');
    const key = eq >= 0 ? arg.slice(2, eq) : arg.slice(2);
    const value = eq >= 0 ? arg.slice(eq + 1) : null;
    if (key === 'observed-at') flags.observedAt = value;
    else if (key === 'tool-version') flags.toolVersion = value;
    else if (key === 'output') flags.output = value;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return { positionals, flags };
}

function readJson(file) {
  const resolved = path.resolve(file);
  try {
    return { resolved, value: JSON.parse(fs.readFileSync(resolved, 'utf8')) };
  } catch (error) {
    throw new Error(`Unable to read JSON ${resolved}: ${error.message}`);
  }
}

function writeJson(file, value) {
  const resolved = path.resolve(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`);
  return resolved;
}

function runCreate(args) {
  const { positionals, flags } = parseArgs(args);
  const file = positionals[0];
  if (!file) throw new Error('create requires <resolution.json>.');
  const { resolved, value } = readJson(file);
  const receipt = createEvidenceReceipt(value, {
    observedAt: flags.observedAt || null,
    toolVersion: flags.toolVersion || '0.2.0'
  });
  if (flags.output) {
    const output = writeJson(flags.output, receipt);
    process.stdout.write(`PASS evidence receipt ${receipt.receiptId}\nInput: ${resolved}\nOutput: ${output}\nDigest: ${receipt.digests.payload}\n`);
  } else process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

function runVerify(args) {
  const { positionals, flags } = parseArgs(args);
  const file = positionals[0];
  if (!file) throw new Error('verify requires <receipt.json>.');
  const { resolved, value } = readJson(file);
  const shape = validateEvidenceReceipt(value);
  const result = verifyEvidenceReceipt(value);
  const report = {
    file: resolved,
    shapeValid: shape.valid,
    valid: result.valid,
    integrity: result.integrity,
    receiptId: value?.receiptId || null,
    digest: value?.digests?.payload || null,
    expectedDigest: result.expectedDigest,
    issues: [...new Set([...(shape.issues || []), ...(result.issues || [])])],
    boundaries: value?.boundaries || null,
    note: 'A valid digest verifies integrity of this receipt content. It does not establish publisher endorsement, authorization or trustworthiness.'
  };
  if (flags.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    process.stdout.write(`${report.valid ? 'PASS' : 'FAIL'} evidence receipt ${report.receiptId || resolved}\n`);
    process.stdout.write(`Integrity: ${report.integrity ? 'verified' : 'failed'}\n`);
    if (report.digest) process.stdout.write(`Digest: ${report.digest}\n`);
    for (const issue of report.issues) process.stdout.write(`ERROR ${issue}\n`);
    process.stdout.write(`${report.note}\n`);
  }
  if (!report.valid) process.exitCode = 2;
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(usage());
    return;
  }
  if (command === 'create') return runCreate(args);
  if (command === 'verify') return runVerify(args);
  throw new Error(`Unknown command: ${command}\n\n${usage()}`);
}

try { main(); }
catch (error) {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exitCode = 1;
}
