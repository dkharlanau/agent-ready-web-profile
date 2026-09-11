#!/usr/bin/env node
import fs from 'node:fs';
import { buildIndexWorthinessReport, formatIndexWorthinessReport } from '../lib/index-worthiness.mjs';

function usage() {
  console.log(`Usage:
  node bin/arwp-index-worthiness.mjs <review.json> [--json] [--output=<report.json>]

The review uses schema/index-worthiness-review.schema.json.
This command never mutates sitemap, robots, canonicals or noindex state.`);
}

const args = process.argv.slice(2);
if (!args.length || args.includes('--help') || args.includes('-h')) {
  usage();
  process.exit(0);
}

const file = args.find(arg => !arg.startsWith('--'));
if (!file) {
  usage();
  process.exit(2);
}
const jsonMode = args.includes('--json');
const outputArg = args.find(arg => arg.startsWith('--output='));
const output = outputArg ? outputArg.slice('--output='.length) : null;

try {
  const review = JSON.parse(fs.readFileSync(file, 'utf8'));
  const report = buildIndexWorthinessReport(review);
  if (output) fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(jsonMode ? `${JSON.stringify(report, null, 2)}\n` : `${formatIndexWorthinessReport(report)}\n`);
} catch (error) {
  console.error(`Index Worthiness failed: ${error.message || error}`);
  process.exit(1);
}
