#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createTrendSnapshot, diffTrendSnapshots, formatTrendDiff } from '../lib/trend-history.mjs';
import { loadTrendRegistry } from '../lib/trend-radar.mjs';

function usage() {
  return `arwp-trend-history — immutable Trend Radar snapshots and state/source diffs\n\nUsage:\n  arwp-trend-history snapshot [registry.json] [--observed-at=<ISO>] [--tool-version=<version>] [--output=<file>] [--json]\n  arwp-trend-history diff <before.snapshot.json> <after.snapshot.json> [--json]\n\nTrend history tracks registry state. Stage transitions never become effectiveness claims automatically.\n`;
}

function optionValue(args, name) {
  const prefix = `--${name}=`;
  return args.find(arg => arg.startsWith(prefix))?.slice(prefix.length) || null;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(usage());
    return 0;
  }
  const command = args[0];
  const json = args.includes('--json');

  if (command === 'snapshot') {
    const positional = args.slice(1).find(arg => !arg.startsWith('--'));
    const registry = positional ? loadTrendRegistry(path.resolve(positional)) : loadTrendRegistry();
    const snapshot = createTrendSnapshot(registry, {
      observedAt: optionValue(args, 'observed-at'),
      toolVersion: optionValue(args, 'tool-version')
    });
    const output = optionValue(args, 'output');
    if (output) {
      const resolved = path.resolve(output);
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
      if (json) process.stdout.write(`${JSON.stringify({ written: resolved, snapshot }, null, 2)}\n`);
      else process.stdout.write(`WROTE ${resolved}\n${snapshot.snapshotId}\n`);
    } else {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    }
    return 0;
  }

  if (command === 'diff') {
    if (!args[1] || !args[2]) throw new Error('diff requires before and after Trend snapshot files.');
    const diff = diffTrendSnapshots(readJson(args[1]), readJson(args[2]));
    process.stdout.write(json ? `${JSON.stringify(diff, null, 2)}\n` : `${formatTrendDiff(diff)}\n`);
    return 0;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(`ERROR ${error?.message || String(error)}\n`);
  process.exitCode = 2;
}
