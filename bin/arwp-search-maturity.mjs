#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  buildSearchMaturityCohort,
  compareTargetToSearchMaturityCohort,
  searchMaturityDiffToReviewActions,
  validateSearchMaturityCorpus
} from '../lib/search-maturity.mjs';

function help() {
  console.log(`ARWP Search Maturity Benchmark

Usage:
  node bin/arwp-search-maturity.mjs check <corpus.json>
  node bin/arwp-search-maturity.mjs cohort <corpus.json> [--intent=<family>] [--output=<file>]
  node bin/arwp-search-maturity.mjs diff <corpus.json> <target-profile.json> [--intent=<family>] [--output=<file>]

The benchmark compares observable reference-cohort patterns. It does not expose a universal maturity score and does not treat cohort features as ranking factors.
Visibility observations must be timestamped. A numeric rank is accepted only when the corpus carries explicit rank evidence.`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function option(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

function positional() {
  return process.argv.slice(3).filter((arg) => !arg.startsWith('--'));
}

function emit(value) {
  const output = option('output');
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (output) {
    const resolved = path.resolve(output);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, text);
    console.error(`Wrote ${resolved}`);
  } else {
    process.stdout.write(text);
  }
}

const command = process.argv[2];
if (!command || ['-h', '--help', 'help'].includes(command)) {
  help();
  process.exit(0);
}

try {
  if (command === 'check') {
    const [corpusPath] = positional();
    if (!corpusPath) throw new Error('check requires <corpus.json>');
    const result = validateSearchMaturityCorpus(readJson(corpusPath));
    emit(result);
    if (!result.valid) process.exitCode = 1;
  } else if (command === 'cohort') {
    const [corpusPath] = positional();
    if (!corpusPath) throw new Error('cohort requires <corpus.json>');
    emit(buildSearchMaturityCohort(readJson(corpusPath), { intentFamily: option('intent') || undefined }));
  } else if (command === 'diff') {
    const [corpusPath, targetPath] = positional();
    if (!corpusPath || !targetPath) throw new Error('diff requires <corpus.json> <target-profile.json>');
    const cohort = buildSearchMaturityCohort(readJson(corpusPath), { intentFamily: option('intent') || undefined });
    const diff = compareTargetToSearchMaturityCohort(readJson(targetPath), cohort);
    emit({ ...diff, reviewActions: searchMaturityDiffToReviewActions(diff) });
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(`Search Maturity error: ${error.message}`);
  process.exitCode = 1;
}
