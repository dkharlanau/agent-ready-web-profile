#!/usr/bin/env node
import fs from 'node:fs';
import { formatEarnedDiscovery, planEarnedDiscovery } from '../lib/earned-discovery.mjs';

function usage() {
  console.log(`Usage:
  node bin/arwp-earned-discovery.mjs plan <input.json> [--json]
  node bin/arwp-earned-discovery.mjs --help

Build a read-only, evidence-backed distribution plan around one useful public asset. The command does not post messages, create links, contact communities or submit anything to Search providers.`);
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
if (args[0] !== 'plan') fail(`Unknown command: ${args[0]}`);
const inputPath = args[1];
if (!inputPath || inputPath.startsWith('--')) fail('plan requires an input JSON file');

let input;
try { input = JSON.parse(fs.readFileSync(inputPath, 'utf8')); }
catch (error) { fail(`Unable to read input JSON: ${error.message}`); }

let report;
try { report = planEarnedDiscovery(input); }
catch (error) { fail(`Earned Discovery planning failed: ${error.message}`); }

if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
else console.log(formatEarnedDiscovery(report));
process.exit(report.summary.fail > 0 ? 1 : 0);
