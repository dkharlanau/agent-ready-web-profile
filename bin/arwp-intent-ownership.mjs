#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  buildIntentOwnershipReport,
  validateIntentOwnershipLedger
} from '../lib/intent-ownership.mjs';
import { evaluateIntentOwnershipGate } from '../lib/intent-ownership-gate.mjs';
import {
  applyIntentOwnershipSurfaceProof,
  probeIntentOwnershipSurface,
  validateIntentOwnershipSurfaceProof
} from '../lib/intent-ownership-surface.mjs';

function help() {
  console.log(`ARWP Intent Ownership

Usage:
  node bin/arwp-intent-ownership.mjs check <intent-ownership.json>
  node bin/arwp-intent-ownership.mjs report <intent-ownership.json>
  node bin/arwp-intent-ownership.mjs gate <intent-ownership.json>
  node bin/arwp-intent-ownership.mjs probe <intent-ownership.json> [--proof-output=FILE] [--ledger-output=FILE]
  node bin/arwp-intent-ownership.mjs apply-proof <intent-ownership.json> <surface-proof.json> [--output=FILE]

Maps reviewed intent families to canonical owner pages and evidence without creating one page per query variant. The probe command records bounded public HTTP technical index eligibility; it does not prove Google indexing, Google-selected canonical, ranking or deployment commit parity. The gate command is deterministic and fails unless every served intent family has exactly one owner whose current ledger state is indexable; declined intents are ignored.`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function flagValue(args, name) {
  const prefix = `--${name}=`;
  return args.find(arg => arg.startsWith(prefix))?.slice(prefix.length) || null;
}

function writeJson(file, value) {
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
}

async function main() {
  const command = process.argv[2];
  if (!command || ['-h', '--help', 'help'].includes(command)) {
    help();
    return;
  }

  const file = process.argv[3];
  if (!file) throw new Error(`${command} requires <intent-ownership.json>`);
  const ledger = readJson(file);

  if (command === 'check') {
    const result = validateIntentOwnershipLedger(ledger);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.valid) process.exitCode = 1;
    return;
  }
  if (command === 'report') {
    process.stdout.write(`${JSON.stringify(buildIntentOwnershipReport(ledger), null, 2)}\n`);
    return;
  }
  if (command === 'gate') {
    const result = evaluateIntentOwnershipGate(ledger);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.valid) process.exitCode = 1;
    return;
  }
  if (command === 'probe') {
    const options = process.argv.slice(4);
    const proofOutput = flagValue(options, 'proof-output');
    const ledgerOutput = flagValue(options, 'ledger-output');
    const proof = await probeIntentOwnershipSurface(ledger);
    const updated = applyIntentOwnershipSurfaceProof(ledger, proof);
    if (proofOutput) writeJson(proofOutput, proof);
    if (ledgerOutput) writeJson(ledgerOutput, updated);
    if (!proofOutput && !ledgerOutput) {
      process.stdout.write(`${JSON.stringify({ proof, ledger: updated }, null, 2)}\n`);
    } else {
      process.stdout.write(`${JSON.stringify({
        valid: true,
        observedAt: proof.observedAt,
        pageCount: proof.pages.length,
        byIndexState: Object.fromEntries(['indexable', 'noindex', 'redirect', 'unknown'].map(state => [state, proof.pages.filter(page => page.derivedIndexState === state).length])),
        proofOutput: proofOutput ? path.resolve(proofOutput) : null,
        ledgerOutput: ledgerOutput ? path.resolve(ledgerOutput) : null
      }, null, 2)}\n`);
    }
    return;
  }
  if (command === 'apply-proof') {
    const proofFile = process.argv[4];
    if (!proofFile || proofFile.startsWith('--')) throw new Error('apply-proof requires <surface-proof.json>');
    const proof = readJson(proofFile);
    const proofValidation = validateIntentOwnershipSurfaceProof(proof, ledger);
    if (!proofValidation.valid) throw new Error(`Invalid Intent Ownership surface proof:\n- ${proofValidation.errors.join('\n- ')}`);
    const updated = applyIntentOwnershipSurfaceProof(ledger, proof);
    const output = flagValue(process.argv.slice(5), 'output');
    if (output) {
      writeJson(output, updated);
      process.stdout.write(`${JSON.stringify({ valid: true, output: path.resolve(output), reviewedAt: updated.reviewedAt }, null, 2)}\n`);
    } else process.stdout.write(`${JSON.stringify(updated, null, 2)}\n`);
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

main().catch(error => {
  console.error(`Intent Ownership error: ${error.message}`);
  process.exitCode = 1;
});
