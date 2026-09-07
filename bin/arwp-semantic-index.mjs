#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { buildSemanticIndex, semanticIndexSummary } from '../lib/semantic-index.mjs';

function usage() {
  return `arwp-semantic-index — experimental future-search semantic index\n\nUsage:\n  node bin/arwp-semantic-index.mjs build <page-manifest.json> <entity-catalog.jsonld> [--output=FILE]\n  node bin/arwp-semantic-index.mjs check <semantic-index.jsonld> [--json]\n\nThe aggregate JSON-LD index is optional. Canonical HTML and page-local truthful structured data remain primary; this command makes no ranking/discovery promise.\n`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function optionValue(args, name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : null;
}

function writeJson(file, value) {
  const resolved = path.resolve(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return resolved;
}

function positional(args) {
  const out = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith('--')) {
      if (!arg.includes('=') && args[index + 1] && !args[index + 1].startsWith('--')) index += 1;
      continue;
    }
    out.push(arg);
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(usage());
    return 0;
  }
  const [command, first, second] = positional(args);
  if (command === 'build') {
    if (!first || !second) throw new Error('build requires page manifest and entity catalog files.');
    const index = buildSemanticIndex(readJson(first), readJson(second));
    const output = optionValue(args, 'output');
    if (output) process.stdout.write(`WROTE ${writeJson(output, index)}\n`);
    else process.stdout.write(`${JSON.stringify(index, null, 2)}\n`);
    return 0;
  }
  if (command === 'check') {
    if (!first) throw new Error('check requires a semantic-index JSON-LD file.');
    const summary = semanticIndexSummary(readJson(first));
    if (args.includes('--json')) process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    else process.stdout.write(`${summary.valid ? 'PASS' : 'FAIL'} semantic index: nodes=${summary.counts.nodes}, pages=${summary.counts.pages}, issues=${summary.issues.length}\n${summary.issues.map(issue => `- ${issue}`).join('\n')}${summary.issues.length ? '\n' : ''}`);
    return summary.valid ? 0 : 2;
  }
  throw new Error(`Unknown command: ${command || '<missing>'}`);
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(`ERROR ${error?.message || String(error)}\n`);
  process.exitCode = 2;
}
