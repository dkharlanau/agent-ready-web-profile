#!/usr/bin/env node
import fs from 'node:fs';
import { evaluateSearchPlatformEligibility, formatSearchPlatformEligibility } from '../lib/search-platform-eligibility.mjs';

function usage() {
  console.log(`Usage:
  node bin/arwp-search-platform.mjs check <input.json> [--json]
  node bin/arwp-search-platform.mjs --help

Input must explicitly describe the public site scope and any stack/provider evidence that is known. The command is read-only and performs no network requests.`);
}

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

const args = process.argv.slice(2);
if (!args.length || args.includes('--help') || args.includes('-h')) {
  usage();
  process.exit(0);
}

const command = args[0];
if (command !== 'check') fail(`Unknown command: ${command}`);
const inputPath = args[1];
if (!inputPath || inputPath.startsWith('--')) fail('check requires an input JSON file');
const json = args.includes('--json');

let input;
try {
  input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
} catch (error) {
  fail(`Unable to read input JSON: ${error.message}`);
}

let report;
try {
  report = evaluateSearchPlatformEligibility(input);
} catch (error) {
  fail(`Search Platform Eligibility failed: ${error.message}`);
}

if (json) console.log(JSON.stringify(report, null, 2));
else console.log(formatSearchPlatformEligibility(report));

process.exit(report.summary.fail > 0 ? 1 : 0);
