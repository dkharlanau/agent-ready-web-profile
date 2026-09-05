#!/usr/bin/env node

import {
  formatAgentEvalSummary,
  loadAgentEvalReceipt,
  summarizeAgentEvalReceipt,
  validateAgentEvalReceipt
} from '../lib/agent-eval.mjs';

function usage() {
  console.log(`ARWP browser agent evaluation receipts

Usage:
  arwp-agent-eval validate <receipt.json> [--json]
  arwp-agent-eval show <receipt.json> [--json]

The receipt compares explicitly tested UI and browser-tool paths for the same task definition. It does not turn documentation or static metadata into runtime conformance.`);
}

const args = process.argv.slice(2);
const command = args[0];
const source = args[1];
const jsonOutput = args.includes('--json');

function formatError(error) {
  return `${error.instancePath || '/'} ${error.message}`;
}

function main() {
  if (!command || command === '--help' || command === '-h') {
    usage();
    return 0;
  }
  if (!['validate', 'show'].includes(command) || !source) {
    usage();
    return 2;
  }

  const receipt = loadAgentEvalReceipt(source);
  if (command === 'validate') {
    const result = validateAgentEvalReceipt(receipt);
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else if (result.valid) {
      console.log(`PASS ${source}`);
      for (const warning of result.warnings) console.warn(`WARN ${warning}`);
    } else {
      console.error(`FAIL ${source}`);
      for (const error of result.errors) console.error(`  ${formatError(error)}`);
      for (const warning of result.warnings) console.warn(`WARN ${warning}`);
    }
    return result.valid ? 0 : 1;
  }

  const result = summarizeAgentEvalReceipt(receipt);
  if (jsonOutput) console.log(JSON.stringify(result, null, 2));
  else console.log(formatAgentEvalSummary(result));
  return result.valid ? 0 : 1;
}

try {
  process.exit(main());
} catch (error) {
  if (jsonOutput) console.log(JSON.stringify({ valid: false, fatal: String(error.message ?? error) }, null, 2));
  else console.error(`ERROR ${error.message ?? error}`);
  process.exit(2);
}
