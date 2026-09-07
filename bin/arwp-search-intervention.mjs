#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  searchMaturityDiffToInterventionCandidates,
  validateSearchIntervention
} from '../lib/search-intervention.mjs';

function help() {
  console.log(`ARWP Search Intervention Ledger

Usage:
  node bin/arwp-search-intervention.mjs check <record.json>
  node bin/arwp-search-intervention.mjs candidates <search-maturity-diff.json> --site=https://example.com/ --site-class=technical-b2b [--locale=en]

The ledger separates implementation proof from crawl/index, classic Search, AI retrieval, citation, answer absorption, referral, useful-action, product-continuation and conversion observations.`);
}

function option(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find(arg => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
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
  if (command === 'check') {
    const file = process.argv[3];
    if (!file) throw new Error('check requires <record.json>');
    const result = validateSearchIntervention(readJson(file));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.valid) process.exitCode = 1;
  } else if (command === 'candidates') {
    const file = process.argv[3];
    if (!file) throw new Error('candidates requires <search-maturity-diff.json>');
    const siteUrl = option('site');
    const siteClass = option('site-class');
    if (!siteUrl || !siteClass) throw new Error('candidates requires --site and --site-class');
    const candidates = searchMaturityDiffToInterventionCandidates(readJson(file), {
      siteUrl,
      siteClass,
      locale: option('locale') || 'en'
    });
    process.stdout.write(`${JSON.stringify(candidates, null, 2)}\n`);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(`Search Intervention error: ${error.message}`);
  process.exitCode = 1;
}
