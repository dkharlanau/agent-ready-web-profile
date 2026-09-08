#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { analyzeSiteFocusRepository, analyzeSiteFocusSite, formatSiteFocusReport } from '../lib/site-focus.mjs';

function usage() {
  return `arwp-focus — transparent problem/scope/page-contract analysis\n\nUsage:\n  arwp-focus <https://site.example> [--repo-root=PATH] [--max-pages=N] [--timeout=MS] [--max-bytes=N] [--json] [--output=FILE]\n\nModes:\n  live          Without --repo-root, sample the public HTTPS site using bounded homepage + sitemap discovery.\n  repository    With --repo-root, inspect generated/static HTML in docs/public/dist/build/_site (or the root fallback).\n\nProduces:\n  - observed homepage thesis;\n  - primary navigation breadth and technology-led navigation candidates;\n  - sampled route territories and audience signals;\n  - Page Contract Map with page-job, proof, action and inbound-link evidence;\n  - duplicate-intent, orphan and out-of-scope candidates;\n  - KEEP / NARROW / MERGE / DEFER review dispositions.\n\nNo focus/readiness/ranking score is produced. REMOVE and SPLIT are never automatic.\n\nExamples:\n  arwp-focus https://example.com\n  arwp-focus https://example.com --max-pages=25 --json\n  arwp-focus https://example.com/project/ --repo-root=. --output=site-focus.json\n`;
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
  const maxPages = positiveInteger(args, 'max-pages', 30, 100);
  const repoRoot = optionValue(args, 'repo-root');
  const report = repoRoot
    ? analyzeSiteFocusRepository(target, path.resolve(repoRoot), { maxPages })
    : await analyzeSiteFocusSite(target, {
        maxPages,
        timeoutMs: positiveNumber(args, 'timeout', 8000),
        maxBytes: positiveNumber(args, 'max-bytes', 512 * 1024)
      });
  const output = optionValue(args, 'output');
  if (output) process.stdout.write(`WROTE ${writeJson(output, report)}\n`);
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else process.stdout.write(`${formatSiteFocusReport(report)}\n`);
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(`ERROR ${error?.message || String(error)}\n`);
  process.exitCode = 2;
}