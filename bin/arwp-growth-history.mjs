#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createGrowthSnapshot, diffGrowthSnapshots, formatGrowthDiff } from '../lib/growth-history.mjs';

function usage() {
  return `arwp-growth-history — immutable Growth Profile snapshots and implementation-state diffs

Usage:
  arwp-growth-history snapshot <growth-plan.json> [--observed-at=ISO] [--output=FILE]
  arwp-growth-history diff <before.snapshot.json> <after.snapshot.json> [--json]

A reduced Growth backlog indicates fewer observed implementation actions; it does not prove ranking/citation outcomes.
`;
}

function read(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function option(args, name) {
  const prefix = `--${name}=`;
  const item = args.find(arg => arg.startsWith(prefix));
  return item ? item.slice(prefix.length) : null;
}

function write(file, value) {
  const resolved = path.resolve(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return resolved;
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(usage());
    return 0;
  }
  const files = args.filter(arg => !arg.startsWith('--'));
  if (command === 'snapshot') {
    if (!files[0]) throw new Error('snapshot requires <growth-plan.json>.');
    const snapshot = createGrowthSnapshot(read(files[0]), { observedAt: option(args, 'observed-at') || null });
    const output = option(args, 'output');
    if (output) process.stdout.write(`WROTE ${write(output, snapshot)}\n${snapshot.snapshotId}\n`);
    else process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return 0;
  }
  if (command === 'diff') {
    if (!files[0] || !files[1]) throw new Error('diff requires before and after snapshots.');
    const diff = diffGrowthSnapshots(read(files[0]), read(files[1]));
    if (args.includes('--json')) process.stdout.write(`${JSON.stringify(diff, null, 2)}\n`);
    else process.stdout.write(`${formatGrowthDiff(diff)}\n`);
    return diff.summary.highPriorityAdded > 0 || diff.summary.p0Delta > 0 ? 2 : 0;
  }
  throw new Error(`Unknown command: ${command}`);
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(`ERROR ${error?.message || String(error)}\n`);
  process.exitCode = 1;
}
