#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { buildGrowthPlan, formatGrowthPlan } from '../lib/growth-plan.mjs';

function usage() {
  return `arwp-growth — prioritized Search / AI-search / citation improvement planner

Usage:
  arwp-growth <https://site.example> [--json] [--output=FILE] [--timeout=MS] [--max-bytes=N]

Examples:
  arwp-growth https://example.com
  arwp-growth https://example.com --json
  arwp-growth https://example.com --output=arwp-growth.json

The Growth Profile does not output a universal quality/readiness score and does not guarantee ranking, AI citation or recommendation outcomes.
`;
}

function optionValue(args, name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

function numeric(args, name, fallback) {
  const raw = optionValue(args, name);
  if (raw == null) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid --${name}: ${raw}`);
  return value;
}

function writeJson(file, value) {
  const resolved = path.resolve(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return resolved;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(usage());
    return 0;
  }
  const target = args.find(arg => !arg.startsWith('--'));
  if (!target) throw new Error('A public website URL is required.');
  const plan = await buildGrowthPlan(target, {
    timeoutMs: numeric(args, 'timeout', 8000),
    maxBytes: numeric(args, 'max-bytes', 512 * 1024)
  });
  const output = optionValue(args, 'output');
  if (output) {
    const written = writeJson(output, plan);
    process.stdout.write(`WROTE ${written}\n${formatGrowthPlan(plan)}\n`);
  } else if (args.includes('--json')) process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  else process.stdout.write(`${formatGrowthPlan(plan)}\n`);
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(`ERROR ${error?.message || String(error)}\n`);
  process.exitCode = 2;
}
