#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  buildRecommendationReviewQueue,
  formatRecommendationReviewQueue,
  validateRecommendationReviewEvents
} from '../lib/recommendation-review.mjs';

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

function writeJson(value, output) {
  const absolute = path.resolve(output);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return absolute;
}

function usage() {
  console.log(`Goose Recommendation Review\n\nUsage:\n  arwp-recommendation-review validate <events.json> [--json]\n  arwp-recommendation-review queue <events.json> [--as-of=ISO] [--stale-after=90] [--output=queue.json] [--json]\n\nThe queue is read-only. It can mark rules fresh, review-due, challenged, contradicted or retire-candidate, but it never mutates the recommendation registry.\n`);
}

async function main() {
  if (command === 'help' || args.includes('--help') || args.includes('-h')) {
    usage();
    return 0;
  }
  if (!subject) throw new Error(`${command} requires an events JSON file.`);
  const batch = readJson(subject);

  if (command === 'validate') {
    const result = validateRecommendationReviewEvents(batch);
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else if (result.valid) console.log(`PASS Recommendation Review events (${batch.events.length})`);
    else {
      for (const error of result.semanticErrors) console.error(`FAIL ${error}`);
      for (const error of result.errors) console.error(`FAIL ${error.instancePath || '/'} ${error.message}`);
    }
    return result.valid ? 0 : 1;
  }

  if (command === 'queue') {
    const staleAfterRaw = optionValue('stale-after');
    const staleAfterDays = staleAfterRaw == null ? 90 : Number(staleAfterRaw);
    const report = buildRecommendationReviewQueue(batch, {
      asOf: optionValue('as-of') || new Date().toISOString(),
      staleAfterDays
    });
    const output = optionValue('output');
    const written = output ? writeJson(report, output) : null;
    if (jsonOutput) console.log(JSON.stringify({ report, written }, null, 2));
    else {
      if (written) console.log(`WROTE ${written}`);
      console.log(formatRecommendationReviewQueue(report));
    }
    return 0;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().then(code => {
  if (Number.isInteger(code)) process.exitCode = code;
}).catch(error => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
