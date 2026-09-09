#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateMeasurementGate,
  formatControlledCohortSummary,
  summarizeControlledCohort,
  validateControlledCohort
} from '../lib/controlled-cohort.mjs';

const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith('--') ? args[0] : 'help';
const subject = args[1] && !args[1].startsWith('--') ? args[1] : null;
const jsonOutput = args.includes('--json');

function optionValue(name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function usage() {
  console.log(`Goose Controlled Cohorts\n\nUsage:\n  arwp-cohort validate <cohort.json> [--json]\n  arwp-cohort summarize <cohort.json> [--json]\n  arwp-cohort gate <cohort.json> --production-ref=<40-char-sha> [--json]\n\nA controlled cohort freezes treatment/control assignment and its query panel before outcomes are reviewed. The production gate prevents the observation clock from starting until the live deployment matches the frozen implementation ref.\n`);
}

async function main() {
  if (command === 'help' || args.includes('--help') || args.includes('-h')) {
    usage();
    return 0;
  }
  if (!subject) throw new Error(`${command} requires a controlled cohort JSON file.`);
  const cohort = readJson(subject);

  if (command === 'validate') {
    const result = validateControlledCohort(cohort);
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else {
      if (result.valid) console.log(`PASS Controlled Cohort (${cohort.id})`);
      else {
        for (const error of result.semanticErrors) console.error(`FAIL ${error}`);
        for (const error of result.errors) console.error(`FAIL ${error.instancePath || '/'} ${error.message}`);
      }
      for (const warning of result.warnings) console.error(`WARN ${warning}`);
    }
    return result.valid ? 0 : 1;
  }

  if (command === 'summarize') {
    const summary = summarizeControlledCohort(cohort);
    if (jsonOutput) console.log(JSON.stringify(summary, null, 2));
    else console.log(formatControlledCohortSummary(summary));
    return 0;
  }

  if (command === 'gate') {
    const productionRef = optionValue('production-ref');
    if (!productionRef) throw new Error('gate requires --production-ref=<40-char-sha>.');
    const result = evaluateMeasurementGate(cohort, productionRef);
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`Goose Controlled Cohort gate`);
      console.log(`Cohort: ${result.cohortId}`);
      console.log(`Ready: ${result.ready ? 'yes' : 'no'}`);
      console.log(`Next state: ${result.nextState}`);
      console.log(`Observation clock: ${result.observationClockMayStart ? 'may start after verified deployment time' : 'must remain stopped'}`);
      console.log(result.reason);
    }
    return result.ready ? 0 : 2;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().then(code => {
  if (Number.isInteger(code)) process.exitCode = code;
}).catch(error => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
