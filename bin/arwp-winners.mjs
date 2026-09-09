#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  diffWinnerObservations,
  formatWinnerDiff,
  formatWinnerSummary,
  summarizeWinnerObservation,
  validateWinnerObservation
} from '../lib/winner-observatory.mjs';

const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith('--') ? args[0] : 'help';
const subject = args[1] && !args[1].startsWith('--') ? args[1] : null;
const second = args[2] && !args[2].startsWith('--') ? args[2] : null;
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
  console.log(`Goose Winner Observatory\n\nUsage:\n  arwp-winners validate <snapshot.json> [--json]\n  arwp-winners summarize <snapshot.json> [--json]\n  arwp-winners diff <before.json> <after.json> [--output=diff.json] [--json]\n\nA snapshot is a fixed Search/AI query cohort observation. Diff reports entrants, drops, rank movement, result persistence, top-10 persistence and citation persistence. It never infers hidden ranking factors, causality or zero paid acquisition.\n`);
}

async function main() {
  if (command === 'help' || args.includes('--help') || args.includes('-h')) {
    usage();
    return 0;
  }
  if (!subject) throw new Error(`${command} requires a snapshot JSON file.`);

  if (command === 'validate') {
    const snapshot = readJson(subject);
    const result = validateWinnerObservation(snapshot);
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else {
      if (result.valid) console.log(`PASS Winner Observatory snapshot (${snapshot.cohortId}, ${snapshot.queries.length} queries)`);
      else {
        for (const error of result.semanticErrors) console.error(`FAIL ${error}`);
        for (const error of result.errors) console.error(`FAIL ${error.instancePath || '/'} ${error.message}`);
      }
      for (const warning of result.warnings) console.error(`WARN ${warning}`);
    }
    return result.valid ? 0 : 1;
  }

  if (command === 'summarize') {
    const summary = summarizeWinnerObservation(readJson(subject));
    if (jsonOutput) console.log(JSON.stringify(summary, null, 2));
    else console.log(formatWinnerSummary(summary));
    return 0;
  }

  if (command === 'diff') {
    if (!second) throw new Error('diff requires before and after snapshot JSON files.');
    const diff = diffWinnerObservations(readJson(subject), readJson(second));
    const output = optionValue('output');
    const written = output ? writeJson(diff, output) : null;
    if (jsonOutput) console.log(JSON.stringify({ diff, written }, null, 2));
    else {
      if (written) console.log(`WROTE ${written}`);
      console.log(formatWinnerDiff(diff));
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
