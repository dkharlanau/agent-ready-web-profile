#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { buildEntityRemediationManifest, formatEntityRemediationManifest } from '../lib/entity-remediation.mjs';

function usage() {
  return `arwp-entity-remediation — proposal-only remediation for ARWP Entity Graph Gap Reports

Usage:
  node bin/arwp-entity-remediation.mjs <entity-gap-report.json> [--repo-root=PATH] [--json] [--output=FILE] [--max-files=N] [--max-file-bytes=N]

Modes:
  report only       classify each gap into a safe human-review remediation lane;
  + --repo-root     read a bounded local repository and ground candidate values/targets in first-party files.

Safety:
  - never writes the target repository;
  - never applies JSON Patch operations;
  - HTML/Markdown changes are review-only;
  - values are proposed only when already observed in first-party repository evidence;
  - no authors, licenses, prices, events, credentials, ratings, reviews or relationships are invented.

Examples:
  node bin/arwp-entity-remediation.mjs entity-gap-report.json
  node bin/arwp-entity-remediation.mjs entity-gap-report.json --repo-root=. --json
  node bin/arwp-entity-remediation.mjs entity-gap-report.json --repo-root=../site --output=entity-remediation.json
`;
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function writeJson(file, value) {
  const resolved = path.resolve(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return resolved;
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(usage());
    return 0;
  }
  const input = args.find(arg => !arg.startsWith('--'));
  if (!input) throw new Error('An Entity Graph Gap Report JSON file is required.');
  const repoRoot = optionValue(args, 'repo-root');
  const manifest = buildEntityRemediationManifest(readJson(input), {
    ...(repoRoot ? { repoRoot: path.resolve(repoRoot) } : {}),
    maxFiles: positiveInteger(args, 'max-files', 500, 5000),
    maxFileBytes: positiveInteger(args, 'max-file-bytes', 1024 * 1024, 10 * 1024 * 1024)
  });
  const output = optionValue(args, 'output');
  if (output) process.stdout.write(`WROTE ${writeJson(output, manifest)}\n`);
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  else process.stdout.write(`${formatEntityRemediationManifest(manifest)}\n`);
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(`ERROR ${error?.message || String(error)}\n`);
  process.exitCode = 2;
}
