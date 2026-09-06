#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { buildGrowthRemediationManifest, formatGrowthRemediationManifest } from '../lib/growth-remediation.mjs';

const args = process.argv.slice(2);
const input = args.find(arg => !arg.startsWith('--')) || null;
const jsonOutput = args.includes('--json');

function optionValue(name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
}

function usage() {
  console.log('arwp-growth-remediation — create a proposal-only remediation manifest from an ARWP Growth plan\n\nUsage:\n  arwp-growth-remediation <growth-plan.json> [--output=remediation.json] [--json]\n\nThe command never edits the target repository. Robots policy, structured data, editorial content and authenticated owner controls remain human-reviewed.');
}

function writeJson(value, output) {
  const absolute = path.resolve(output);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return absolute;
}

try {
  if (args.includes('--help') || args.includes('-h')) {
    usage();
  } else {
    if (!input) throw new Error('A Growth plan JSON file is required. Use --help for usage.');
    const plan = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
    const manifest = buildGrowthRemediationManifest(plan);
    const output = optionValue('output');
    const written = output ? writeJson(manifest, output) : null;
    if (jsonOutput) process.stdout.write(`${JSON.stringify({ manifest, written }, null, 2)}\n`);
    else {
      if (written) console.log(`WROTE ${written}`);
      console.log(formatGrowthRemediationManifest(manifest));
    }
  }
} catch (error) {
  console.error(`arwp-growth-remediation: ${error?.message || String(error)}`);
  process.exitCode = 1;
}
