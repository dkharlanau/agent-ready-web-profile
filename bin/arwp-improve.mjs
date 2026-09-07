#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { buildSiteImprovementPlan, formatSiteImprovementPlan } from '../lib/site-improvement-vertical.mjs';

function usage() {
  return `arwp-improve — unified evidence-backed Site Improvement Plan\n\nUsage:\n  arwp-improve <https://site.example> [--repo-root=PATH] [--max-actions=N] [--max-pages=N] [--site-kind=KIND] [--vertical=VERTICAL] [--json] [--output=FILE]\n\nCombines:\n  - Search / AI-search Growth actions;\n  - Entity Graph gaps and grounded remediation evidence;\n  - bounded page semantics and internal-link observations;\n  - conditional Search Surface Blueprint checks and page archetypes;\n  - bounded Content Differentiation review triggers for visible unique contribution, quantitative grounding and research/result proof surfaces;\n  - bounded vertical evidence for software, documentation, research, editorial, commerce and local-business contexts.\n\nIf --vertical is omitted, ARWP can infer a conservative vertical from a known --site-kind (for example software-product -> software-product, ecommerce -> commerce). Ambiguous documentation/research sites default to documentation; use --vertical=research-dataset when dataset evidence is the primary target.\n\nPrioritization is deterministic but is not a ranking/readiness/content-quality score. ARWP does not predict traffic or ranking lift.\n\nExamples:\n  arwp-improve https://example.com\n  arwp-improve https://example.com --repo-root=../website --max-actions=8\n  arwp-improve https://example.com --site-kind=software-product --output=site-improvement.json\n  arwp-improve https://example.com/research/ --vertical=research-dataset --json\n`;
}

function optionValue(args, name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
}

function positiveInteger(args, name, fallback, max) {
  const raw = optionValue(args, name);
  if (raw == null) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`--${name} must be an integer between 1 and ${max}.`);
  return value;
}

function positiveNumber(args, name, fallback) {
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
  if (!target) throw new Error('A public HTTPS website URL is required.');
  const repoRoot = optionValue(args, 'repo-root');
  const plan = await buildSiteImprovementPlan(target, {
    repoRoot: repoRoot ? path.resolve(repoRoot) : undefined,
    maxActions: positiveInteger(args, 'max-actions', 8, 25),
    maxPages: positiveInteger(args, 'max-pages', 12, 50),
    maxFiles: positiveInteger(args, 'max-files', 500, 5000),
    maxFileBytes: positiveInteger(args, 'max-file-bytes', 1024 * 1024, 10 * 1024 * 1024),
    timeoutMs: positiveNumber(args, 'timeout', 8000),
    maxBytes: positiveNumber(args, 'max-bytes', 256 * 1024),
    vertical: optionValue(args, 'vertical') || null,
    siteKind: optionValue(args, 'site-kind') || 'auto'
  });
  const output = optionValue(args, 'output');
  if (output) process.stdout.write(`WROTE ${writeJson(output, plan)}\n`);
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  else process.stdout.write(`${formatSiteImprovementPlan(plan)}\n`);
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(`ERROR ${error?.message || String(error)}\n`);
  process.exitCode = 2;
}
