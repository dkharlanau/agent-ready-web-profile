#!/usr/bin/env node

import { loadProfile, validateProfile, formatAjvError } from '../lib/validator.mjs';

function usage() {
  console.log(`Agent-Ready Web Profile validator

Usage:
  node bin/arwp.mjs validate <profile.json> [--json]

Commands:
  validate   Validate one ARWP profile against the v0.1 schema and semantic checks.
`);
}

const args = process.argv.slice(2);
const command = args[0];
const file = args[1];
const jsonOutput = args.includes('--json');

if (!command || command === '--help' || command === '-h') {
  usage();
  process.exit(0);
}

if (command !== 'validate' || !file) {
  usage();
  process.exit(2);
}

try {
  const profile = loadProfile(file);
  const result = validateProfile(profile);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.valid) {
    console.log(`PASS ${file}`);
    for (const warning of result.warnings) {
      console.warn(`WARN ${warning}`);
    }
  } else {
    console.error(`FAIL ${file}`);
    for (const error of result.errors) {
      console.error(`  ${formatAjvError(error)}`);
    }
    for (const warning of result.warnings) {
      console.warn(`WARN ${warning}`);
    }
  }

  process.exit(result.valid ? 0 : 1);
} catch (error) {
  if (jsonOutput) {
    console.log(JSON.stringify({ valid: false, fatal: String(error.message ?? error) }, null, 2));
  } else {
    console.error(`ERROR ${error.message ?? error}`);
  }
  process.exit(2);
}
