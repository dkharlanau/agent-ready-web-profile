#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { analyzeSiteFocusRepository, analyzeSiteFocusSite, formatSiteFocusReport } from '../lib/site-focus-v2.mjs';

function usage() {
  return `arwp-focus — declared ↔ observed Site Focus and Page Contract analysis\n\nUsage:\n  arwp-focus <https://site.example> [--repo-root=PATH] [--focus-profile=FILE] [--max-pages=N] [--timeout=MS] [--max-bytes=N] [--json] [--output=FILE]\n\nModes:\n  live          Without --repo-root, sample the public HTTPS site using bounded homepage + sitemap discovery. Pass --focus-profile to compare owner-declared intent with the observed site.\n  repository    With --repo-root, inspect generated/static HTML in docs/public/dist/build/_site (or the root fallback). The engine auto-discovers .arwp/site-focus.json or site-focus.json unless --focus-profile is supplied.\n\nProduces:\n  - owner-declared thesis/scope/problem lanes when a Site Focus profile exists;\n  - observed homepage thesis and declared ↔ observed drift evidence;\n  - primary navigation contract drift;\n  - route roles: problem-commercial / proof-portfolio / trust-utility / technical-reference / localization-equivalent;\n  - locale-equivalent duplicate suppression;\n  - Page Contract Map with page-job, proof, action and inbound-link evidence;\n  - duplicate-intent, orphan and scope-review candidates;\n  - KEEP / NARROW / MERGE / DEFER review dispositions;\n  - proposal-only handoff candidates for Target Transformation after explicit human acceptance.\n\nNo focus/readiness/ranking score is produced. Route families are not treated as problem territories. REMOVE and SPLIT are never automatic.\n\nExamples:\n  arwp-focus https://example.com\n  arwp-focus https://example.com --focus-profile=.arwp/site-focus.json --max-pages=25 --json\n  arwp-focus https://example.com/project/ --repo-root=. --output=site-focus-report.json\n`;
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
  const focusProfilePath = optionValue(args, 'focus-profile');
  const report = repoRoot
    ? analyzeSiteFocusRepository(target, path.resolve(repoRoot), {
        maxPages,
        focusProfilePath: focusProfilePath ? path.resolve(focusProfilePath) : null
      })
    : await analyzeSiteFocusSite(target, {
        maxPages,
        focusProfilePath: focusProfilePath ? path.resolve(focusProfilePath) : null,
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
