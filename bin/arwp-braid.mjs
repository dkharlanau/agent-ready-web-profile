#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  compileBraidGraph,
  validateBraidGraph,
  explainBraidGraph,
  impactBraidGraph,
  missingBraidEvidence
} from '../lib/braid-graph.mjs';

function usage() {
  console.log(`ARWP BraidGraph

Usage:
  arwp-braid compile --upgrade=<adaptive-upgrade.json> [--transform=<transformation-bundle.json>] [--verifications=<array.json>] [--measurements=<array.json>] [--out=<braid.json>]
  arwp-braid validate <braid.json>
  arwp-braid explain <braid.json> (--node=<id> | --path=<repo-path> | --recommendation=<id> | --transform=<operation-id>)
  arwp-braid impact <braid.json> (--source=<url> | --rule=<rule-id>)
  arwp-braid missing-evidence <braid.json>

BraidGraph records provenance and impact relationships. It does not authorize production mutation or predict Search/AI outcomes.`);
}

function parse(argv) {
  const positionals = [];
  const flags = {};
  for (const value of argv) {
    if (!value.startsWith('--')) {
      positionals.push(value);
      continue;
    }
    const equal = value.indexOf('=');
    if (equal < 0) flags[value.slice(2)] = true;
    else flags[value.slice(2, equal)] = value.slice(equal + 1);
  }
  return { positionals, flags };
}

function readJson(filename, label) {
  if (!filename) throw new Error(`${label} path is required.`);
  return JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8'));
}

function write(value, filename = null) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (!filename) process.stdout.write(text);
  else fs.writeFileSync(path.resolve(filename), text, 'utf8');
}

function selector(flags) {
  const supported = ['node', 'path', 'source', 'rule', 'recommendation', 'transform'];
  const chosen = supported.filter(name => typeof flags[name] === 'string' && flags[name]);
  if (chosen.length !== 1) throw new Error(`Exactly one selector is required: ${supported.map(name => `--${name}=...`).join(', ')}`);
  const name = chosen[0];
  if (name === 'node') return { nodeId: flags[name] };
  return { [name]: flags[name] };
}

async function main() {
  const { positionals, flags } = parse(process.argv.slice(2));
  const command = positionals[0];
  if (!command || ['-h', '--help', 'help'].includes(command)) {
    usage();
    return;
  }

  if (command === 'compile') {
    const upgradeGraph = readJson(flags.upgrade, '--upgrade');
    const transformationBundle = flags.transform ? readJson(flags.transform, '--transform') : null;
    const verifications = flags.verifications ? readJson(flags.verifications, '--verifications') : [];
    const measurements = flags.measurements ? readJson(flags.measurements, '--measurements') : [];
    if (!Array.isArray(verifications)) throw new Error('--verifications must contain a JSON array.');
    if (!Array.isArray(measurements)) throw new Error('--measurements must contain a JSON array.');
    const graph = compileBraidGraph({ upgradeGraph, transformationBundle, verifications, measurements });
    write(graph, typeof flags.out === 'string' ? flags.out : null);
    return;
  }

  const graphPath = positionals[1];
  const graph = readJson(graphPath, 'BraidGraph');
  if (command === 'validate') {
    const validation = validateBraidGraph(graph);
    write(validation);
    if (!validation.valid) process.exitCode = 1;
    return;
  }
  if (command === 'explain') {
    write(explainBraidGraph(graph, selector(flags)));
    return;
  }
  if (command === 'impact') {
    const selected = selector(flags);
    if (!selected.source && !selected.rule && !selected.nodeId) throw new Error('impact requires --source, --rule, or a source/rule --node.');
    write(impactBraidGraph(graph, selected));
    return;
  }
  if (command === 'missing-evidence') {
    write(missingBraidEvidence(graph));
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

main().catch(error => {
  console.error(`arwp-braid: ${error.message}`);
  process.exitCode = 1;
});
