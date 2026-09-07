#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { buildGrowthPlan, formatGrowthPlan } from '../lib/growth-plan-vertical.mjs';
import { compileAdaptiveUpgradeGraph, formatAdaptiveUpgradeGraph } from '../lib/adaptive-upgrade.mjs';

function usage() {
  return `arwp-growth — prioritized Search / AI-search / citation improvement planner

Usage:
  arwp-growth <https://site.example> [--vertical=general|documentation|editorial|software-product|commerce|local-business|research-dataset] [--upgrade] [--goals=search,generative-search,ai-citations,measurement] [--json] [--output=FILE] [--upgrade-output=FILE] [--timeout=MS] [--max-bytes=N]

Examples:
  arwp-growth https://example.com
  arwp-growth https://example.com --vertical=editorial --json
  arwp-growth https://example.com --vertical=research-dataset --upgrade --goals=search,generative-search,ai-citations,measurement
  arwp-growth https://example.com --upgrade --output=arwp-growth.json

The Growth Profile includes applicable ADOPT/MEASURED Trend Radar changes plus bounded vertical evidence. With --upgrade it also compiles the current evidence into an Adaptive Site Upgrade Graph: exact target surfaces, change recipes, verification contracts, measurement signals and knowledge-freshness state. Neither mode outputs a universal readiness score or guarantees ranking, AI citation or recommendation outcomes.
`;
}

function optionValue(args, name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

function csv(args, name) {
  const raw = optionValue(args, name);
  return raw ? raw.split(',').map(item => item.trim()).filter(Boolean) : [];
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

function derivedUpgradeOutput(output) {
  const parsed = path.parse(output);
  return path.join(parsed.dir, `${parsed.name}.upgrade.json`);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(usage());
    return 0;
  }
  const target = args.find(arg => !arg.startsWith('--'));
  if (!target) throw new Error('A public website URL is required.');
  const vertical = optionValue(args, 'vertical') || 'general';
  const plan = await buildGrowthPlan(target, {
    timeoutMs: numeric(args, 'timeout', 8000),
    maxBytes: numeric(args, 'max-bytes', 512 * 1024),
    vertical
  });

  const wantsUpgrade = args.includes('--upgrade');
  const goals = csv(args, 'goals');
  const upgrade = wantsUpgrade
    ? compileAdaptiveUpgradeGraph(plan, {
      verticals: [vertical],
      ...(goals.length ? { goals } : {})
    })
    : null;

  const output = optionValue(args, 'output');
  if (output) {
    const written = writeJson(output, plan);
    const lines = [`WROTE ${written}`];
    if (upgrade) {
      const upgradeFile = optionValue(args, 'upgrade-output') || derivedUpgradeOutput(output);
      lines.push(`WROTE ${writeJson(upgradeFile, upgrade)}`);
    }
    lines.push(formatGrowthPlan(plan));
    if (upgrade) lines.push('', formatAdaptiveUpgradeGraph(upgrade));
    process.stdout.write(`${lines.join('\n')}\n`);
  } else if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(upgrade ? { growthPlan: plan, adaptiveUpgrade: upgrade } : plan, null, 2)}\n`);
  } else {
    const body = [formatGrowthPlan(plan)];
    if (upgrade) body.push('', formatAdaptiveUpgradeGraph(upgrade));
    process.stdout.write(`${body.join('\n')}\n`);
  }
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(`ERROR ${error?.message || String(error)}\n`);
  process.exitCode = 2;
}
