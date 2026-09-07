#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { enrichBraidHistory, revisionDigest } from '../lib/braid-history.mjs';

function usage() {
  console.log(`ARWP BraidGraph History

Usage:
  node bin/arwp-braid-history.mjs apply <braid.json> <revisions.json> [--out=<braid-with-history.json>]
  node bin/arwp-braid-history.mjs digest <revisions.json>

Revision records preserve prior source/rule versions and add explicit current -> supersedes -> prior edges. History enrichment does not authorize mutation or infer that an upstream change invalidated a downstream implementation.`);
}

function parse(argv) {
  const positionals = [];
  const flags = {};
  for (const value of argv) {
    if (!value.startsWith('--')) positionals.push(value);
    else {
      const equal = value.indexOf('=');
      if (equal < 0) flags[value.slice(2)] = true;
      else flags[value.slice(2, equal)] = value.slice(equal + 1);
    }
  }
  return { positionals, flags };
}

function readJson(filename, label) {
  if (!filename) throw new Error(`${label} path is required.`);
  return JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8'));
}

function output(value, filename = null) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (filename) fs.writeFileSync(path.resolve(filename), text, 'utf8');
  else process.stdout.write(text);
}

function main() {
  const { positionals, flags } = parse(process.argv.slice(2));
  const command = positionals[0];
  if (!command || ['help', '-h', '--help'].includes(command)) {
    usage();
    return;
  }
  if (command === 'apply') {
    const graph = readJson(positionals[1], 'BraidGraph');
    const revisions = readJson(positionals[2], 'Revision evidence');
    if (!Array.isArray(revisions)) throw new Error('Revision evidence must be a JSON array.');
    output(enrichBraidHistory(graph, revisions), typeof flags.out === 'string' ? flags.out : null);
    return;
  }
  if (command === 'digest') {
    const revisions = readJson(positionals[1], 'Revision evidence');
    if (!Array.isArray(revisions)) throw new Error('Revision evidence must be a JSON array.');
    process.stdout.write(`${revisionDigest(revisions)}\n`);
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(`arwp-braid-history: ${error.message}`);
  process.exitCode = 1;
}
