#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { resolveSite } from '../lib/resolver.mjs';
import { evaluateAssertionContract, validateAssertionContract } from '../lib/assertion-contract.mjs';
import { createEvidenceReceipt } from '../lib/evidence-receipt.mjs';

function usage() {
  return `arwp-assert — read-only agent-surface contract checks

Usage:
  arwp-assert <contract.json> [options]

Options:
  --resolution=FILE              Evaluate a saved Resolver JSON instead of probing the target
  --baseline-receipt=FILE        Compare selected interfaces/protocols/outcomes/conflicts with a verified receipt
  --receipt-output=FILE          Write an Evidence Receipt for the evaluated current resolution
  --observed-at=ISO              Explicit receipt observation time when --receipt-output is used
  --tool-version=VERSION         Receipt tool version; default 0.2.0
  --json                         Emit machine-readable assertion report

Exit codes:
  0  contract passed
  1  invalid contract, input or runtime error
  2  valid contract evaluated but one or more failure-level assertions failed

The live mode performs bounded static Resolver discovery only. It does not invoke MCP tools, call arbitrary APIs, execute A2A tasks, follow ARD registry referrals or grant authorization.
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
    if (key === 'resolution') flags.resolution = value;
    else if (key === 'baseline-receipt') flags.baselineReceipt = value;
    else if (key === 'receipt-output') flags.receiptOutput = value;
    else if (key === 'observed-at') flags.observedAt = value;
    else if (key === 'tool-version') flags.toolVersion = value;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return { positionals, flags };
}

function readJson(file, label = 'JSON') {
  const resolved = path.resolve(file);
  try {
    return { resolved, value: JSON.parse(fs.readFileSync(resolved, 'utf8')) };
  } catch (error) {
    throw new Error(`Unable to read ${label} ${resolved}: ${error.message}`);
  }
}

function writeJson(file, value) {
  const resolved = path.resolve(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`);
  return resolved;
}

function formatReport(report) {
  const lines = [
    `${report.passed ? 'PASS' : 'FAIL'} ARWP assertion contract`,
    `Target: ${report.target}`,
    `Canonical: ${report.canonicalUrl || 'unknown'}`,
    `Checks: ${report.summary?.checks ?? 0}; failures: ${report.summary?.failures ?? 0}; warnings: ${report.summary?.warnings ?? 0}; conflicts: ${report.summary?.conflicts ?? 0}`
  ];
  const failures = report.failures || [];
  const warnings = report.warnings || [];
  if (failures.length) {
    lines.push('', 'Failures:');
    for (const item of failures) lines.push(`- ${item.id}: ${item.message}`);
  }
  if (warnings.length) {
    lines.push('', 'Warnings:');
    for (const item of warnings) lines.push(`- ${item.id}: ${item.message}`);
  }
  lines.push('', report.note || 'Assertion contracts are interface contracts, not readiness scores.');
  return lines.join('\n');
}

async function main() {
  const raw = process.argv.slice(2);
  if (!raw.length || raw[0] === '--help' || raw[0] === '-h' || raw[0] === 'help') {
    process.stdout.write(usage());
    return;
  }
  const { positionals, flags } = parseArgs(raw);
  const contractFile = positionals[0];
  if (!contractFile) throw new Error('A contract JSON file is required.');
  const { value: contract } = readJson(contractFile, 'contract');
  const contractValidation = validateAssertionContract(contract);
  if (!contractValidation.valid) {
    const report = { contractValid: false, passed: false, issues: contractValidation.issues, exitCode: 1 };
    if (flags.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else {
      process.stderr.write('Invalid ARWP assertion contract:\n');
      for (const issue of contractValidation.issues) process.stderr.write(`- ${issue}\n`);
    }
    process.exitCode = 1;
    return;
  }

  let resolution;
  if (flags.resolution) resolution = readJson(flags.resolution, 'resolution').value;
  else resolution = await resolveSite(contract.target);

  let baselineReceipt = null;
  if (flags.baselineReceipt) baselineReceipt = readJson(flags.baselineReceipt, 'baseline receipt').value;
  const report = evaluateAssertionContract(contract, resolution, { baselineReceipt });

  let receipt = null;
  let receiptOutput = null;
  if (flags.receiptOutput) {
    receipt = createEvidenceReceipt(resolution, {
      observedAt: flags.observedAt || null,
      toolVersion: flags.toolVersion || '0.2.0',
      producer: 'ARWP assertion contract'
    });
    receiptOutput = writeJson(flags.receiptOutput, receipt);
  }

  const output = {
    ...report,
    mode: flags.resolution ? 'saved-resolution' : 'live-static-resolution',
    contractFile: path.resolve(contractFile),
    baselineReceiptId: baselineReceipt?.receiptId || null,
    generatedReceipt: receipt ? { receiptId: receipt.receiptId, digest: receipt.digests.payload, output: receiptOutput } : null,
    exitCode: report.passed ? 0 : 2
  };
  if (flags.json) process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  else {
    process.stdout.write(`${formatReport(output)}\n`);
    if (output.generatedReceipt) process.stdout.write(`Receipt: ${output.generatedReceipt.receiptId} → ${output.generatedReceipt.output}\n`);
  }
  if (!report.passed) process.exitCode = 2;
}

main().catch(error => {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exitCode = 1;
});
