#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  buildIntentOwnershipReport,
  validateIntentOwnershipLedger
} from '../lib/intent-ownership.mjs';

function help() {
  console.log(`ARWP Intent Ownership

Usage:
  node bin/arwp-intent-ownership.mjs check <intent-ownership.json>
  node bin/arwp-intent-ownership.mjs report <intent-ownership.json>

Maps reviewed intent families to canonical owner pages and evidence without creating one page per query variant. Owner-side observations remain provider-scoped evidence; off-owner landings are review signals, not proof of cannibalization.`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

const command = process.argv[2];
if (!command || ['-h', '--help', 'help'].includes(command)) {
  help();
  process.exit(0);
}

try {
  const file = process.argv[3];
  if (!file) throw new Error(`${command} requires <intent-ownership.json>`);
  const ledger = readJson(file);

  if (command === 'check') {
    const result = validateIntentOwnershipLedger(ledger);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.valid) process.exitCode = 1;
  } else if (command === 'report') {
    process.stdout.write(`${JSON.stringify(buildIntentOwnershipReport(ledger), null, 2)}\n`);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(`Intent Ownership error: ${error.message}`);
  process.exitCode = 1;
}
