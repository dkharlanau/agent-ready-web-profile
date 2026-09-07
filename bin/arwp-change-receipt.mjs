#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  createChangeReceipt,
  reviseChangeReceipt,
  validateChangeReceipt,
  verifyChangeReceipt,
  verifyChangeReceiptRevision,
  changeReceiptStatus
} from '../lib/change-receipt.mjs';
import { mergeChangeReceiptIntoBraidGraph, changeReceiptBraidReport } from '../lib/change-receipt-braid.mjs';

function usage() {
  console.log(`SignalBraid Change Receipt

Usage:
  arwp-change-receipt create <transform-bundle.json> <braid.json> [--execution-kind=local|github-pr --execution=<json>] [--evidence-receipt=<json> --evidence-role=<role>] [--verifications=<json>] [--outcomes=<json>] [--deployment=<json>] [--review=<json>] [--out=<json>]
  arwp-change-receipt revise <receipt.json> [--execution-kind=local|github-pr --execution=<json>] [--mutation=<json>] [--braid=<current-braid.json>] [--evidence-receipt=<json> --evidence-role=<role>] [--verifications=<json>] [--outcomes=<json>] [--deployment=<json>] [--review=<json>] [--out=<json>]
  arwp-change-receipt validate <receipt.json>
  arwp-change-receipt verify <receipt.json>
  arwp-change-receipt verify-revision <previous.json> <current.json>
  arwp-change-receipt status <receipt.json>
  arwp-change-receipt braid <braid.json> <receipt.json> [--out=<json>]
  arwp-change-receipt braid-report <braid.json>

Change Receipts are immutable evidence snapshots. New verification/deployment/outcome/re-review evidence creates a new revision; historical receipts are never rewritten.`);
}

function parse(argv) {
  const positionals = [];
  const flags = {};
  for (const value of argv) {
    if (!value.startsWith('--')) {
      positionals.push(value);
      continue;
    }
    const equal = value.indexOf('=');
    if (equal < 0) flags[value.slice(2)] = true;
    else flags[value.slice(2, equal)] = value.slice(equal + 1);
  }
  return { positionals, flags };
}

function readJson(filename, label) {
  if (!filename || typeof filename !== 'string') throw new Error(`${label} path is required.`);
  return JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8'));
}

function optionalJson(filename, label) {
  return typeof filename === 'string' ? readJson(filename, label) : undefined;
}

function listFromFile(filename, label) {
  const value = optionalJson(filename, label);
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function write(value, filename = null) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (typeof filename === 'string') fs.writeFileSync(path.resolve(filename), text, 'utf8');
  else process.stdout.write(text);
}

function executionFromFlags(flags) {
  if (!flags['execution-kind'] && !flags.execution) return undefined;
  if (typeof flags['execution-kind'] !== 'string' || typeof flags.execution !== 'string') throw new Error('--execution-kind and --execution must be supplied together.');
  return {
    kind: flags['execution-kind'],
    receipt: readJson(flags.execution, 'Execution receipt')
  };
}

function evidenceReceiptsFromFlags(flags) {
  if (typeof flags['evidence-receipt'] !== 'string') return [];
  return [{
    receipt: readJson(flags['evidence-receipt'], 'Evidence Receipt'),
    role: typeof flags['evidence-role'] === 'string' ? flags['evidence-role'] : 'supporting-observation'
  }];
}

function commonEvidenceOptions(flags) {
  return {
    execution: executionFromFlags(flags),
    evidenceReceipts: evidenceReceiptsFromFlags(flags),
    verifications: listFromFile(flags.verifications, 'Verification evidence'),
    outcomes: listFromFile(flags.outcomes, 'Outcome evidence'),
    deployment: optionalJson(flags.deployment, 'Deployment evidence'),
    review: optionalJson(flags.review, 'Review decision')
  };
}

function main() {
  const { positionals, flags } = parse(process.argv.slice(2));
  const command = positionals[0];
  if (!command || ['help', '-h', '--help'].includes(command)) {
    usage();
    return;
  }

  if (command === 'create') {
    const bundle = readJson(positionals[1], 'Transformation Bundle');
    const braid = readJson(positionals[2], 'BraidGraph');
    const options = commonEvidenceOptions(flags);
    const receipt = createChangeReceipt(bundle, braid, options);
    write(receipt, flags.out);
    return;
  }

  if (command === 'revise') {
    const previous = readJson(positionals[1], 'Change Receipt');
    const common = commonEvidenceOptions(flags);
    const updates = {
      ...(common.execution ? { execution: common.execution } : {}),
      ...(common.evidenceReceipts.length ? { evidenceReceipts: common.evidenceReceipts } : {}),
      ...(common.verifications.length ? { verifications: common.verifications } : {}),
      ...(common.outcomes.length ? { outcomes: common.outcomes } : {}),
      ...(common.deployment !== undefined ? { deployment: common.deployment } : {}),
      ...(common.review !== undefined ? { review: common.review } : {}),
      ...(typeof flags.mutation === 'string' ? { mutation: readJson(flags.mutation, 'Mutation transition evidence') } : {}),
      ...(typeof flags.braid === 'string' ? { braidGraph: readJson(flags.braid, 'Current BraidGraph') } : {})
    };
    write(reviseChangeReceipt(previous, updates), flags.out);
    return;
  }

  if (command === 'validate') {
    const validation = validateChangeReceipt(readJson(positionals[1], 'Change Receipt'));
    write(validation);
    if (!validation.valid) process.exitCode = 1;
    return;
  }

  if (command === 'verify') {
    const verification = verifyChangeReceipt(readJson(positionals[1], 'Change Receipt'));
    write(verification);
    if (!verification.valid) process.exitCode = 1;
    return;
  }

  if (command === 'verify-revision') {
    const verification = verifyChangeReceiptRevision(
      readJson(positionals[1], 'Previous Change Receipt'),
      readJson(positionals[2], 'Current Change Receipt')
    );
    write(verification);
    if (!verification.valid) process.exitCode = 1;
    return;
  }

  if (command === 'status') {
    write(changeReceiptStatus(readJson(positionals[1], 'Change Receipt')));
    return;
  }

  if (command === 'braid') {
    const braid = readJson(positionals[1], 'BraidGraph');
    const receipt = readJson(positionals[2], 'Change Receipt');
    write(mergeChangeReceiptIntoBraidGraph(braid, receipt), flags.out);
    return;
  }

  if (command === 'braid-report') {
    write(changeReceiptBraidReport(readJson(positionals[1], 'BraidGraph')));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(`arwp-change-receipt: ${error.message}`);
  process.exitCode = 1;
}
