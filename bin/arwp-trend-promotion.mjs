#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { loadTrendRegistry } from '../lib/trend-radar.mjs';
import { loadTrendWatchConfig } from '../lib/trend-source-watch.mjs';
import {
  buildTrendPromotionProposals,
  formatTrendPromotions,
  loadTrendPromotionBatch,
  reviewTrendPromotion,
  validateTrendPromotionBatch
} from '../lib/trend-promotion.mjs';

function usage() {
  return `arwp-trend-promotion — reviewable WATCH -> ADOPT proposal workflow\n\nUsage:\n  arwp-trend-promotion propose <source-watch.json> [--output=proposals.json] [--json]\n  arwp-trend-promotion validate <proposals.json> [--json]\n  arwp-trend-promotion review <proposals.json> --id=<proposal-id> --decision=<approve|reject|defer> --reviewer=<name> [--note=text] [--output=reviewed.json] [--json]\n\nProposals never mutate registry/trends.json automatically. Approval records human review only.\n`;
}

const args = process.argv.slice(2);
const command = args[0];
const source = args[1];
const jsonOutput = args.includes('--json');

function optionValue(name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
}

function writeJson(value, output) {
  const absolute = path.resolve(output);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return absolute;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function main() {
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(usage());
    return 0;
  }
  if (!source || !['propose', 'validate', 'review'].includes(command)) {
    process.stderr.write(usage());
    return 2;
  }

  if (command === 'propose') {
    const batch = buildTrendPromotionProposals(readJson(source), loadTrendRegistry(), loadTrendWatchConfig());
    const output = optionValue('output');
    const written = output ? writeJson(batch, output) : null;
    if (jsonOutput) process.stdout.write(`${JSON.stringify({ batch, written }, null, 2)}\n`);
    else if (written) process.stdout.write(`WROTE ${written}\n${formatTrendPromotions(batch)}\n`);
    else process.stdout.write(`${formatTrendPromotions(batch)}\n`);
    return 0;
  }

  if (command === 'validate') {
    const batch = loadTrendPromotionBatch(source);
    const result = validateTrendPromotionBatch(batch);
    if (jsonOutput) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else if (result.valid) process.stdout.write(`PASS ${source} (${batch.proposals.length} proposals)\n`);
    else for (const error of result.errors) process.stderr.write(`FAIL ${error.instancePath || '/'} ${error.message}\n`);
    return result.valid ? 0 : 1;
  }

  const id = optionValue('id');
  const decision = optionValue('decision');
  const reviewer = optionValue('reviewer');
  if (!id || !decision || !reviewer) throw new Error('review requires --id, --decision and --reviewer.');
  const reviewed = reviewTrendPromotion(loadTrendPromotionBatch(source), id, decision, {
    reviewer,
    note: optionValue('note')
  });
  const output = optionValue('output');
  const written = output ? writeJson(reviewed, output) : null;
  if (jsonOutput) process.stdout.write(`${JSON.stringify({ batch: reviewed, written }, null, 2)}\n`);
  else if (written) process.stdout.write(`WROTE ${written}\n${formatTrendPromotions(reviewed)}\n`);
  else process.stdout.write(`${JSON.stringify(reviewed, null, 2)}\n`);
  return 0;
}

try { process.exitCode = main(); } catch (error) { process.stderr.write(`ERROR ${error?.message || String(error)}\n`); process.exitCode = 2; }
