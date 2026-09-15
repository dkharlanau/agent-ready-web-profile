#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { compileSearchArtifact, formatSearchBuildReport, verifySearchArtifactLive } from '../lib/search-build-gate.mjs';

function usage() {
  console.log(`Usage:
  node bin/arwp-search-build.mjs check --root=<artifact> --site=<https://site/> [--source-sha=<sha>] [--json] [--output=<file>]
  node bin/arwp-search-build.mjs live --root=<artifact> --site=<https://site/> [--source-sha=<sha>] [--deployed-sha=<sha>] [--max-live-pages=N] [--parity=search-surface|exact] [--json] [--output=<file>]
  node bin/arwp-search-build.mjs --help

The command inspects an already-produced publish artifact. It never runs the target build.`);
}
function value(args, name) {
  const prefix = `--${name}=`;
  return args.find(arg => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}
function integer(args, name, fallback) {
  const raw = value(args, name);
  if (raw == null) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`--${name} must be a positive integer`);
  return parsed;
}
function write(file, payload) {
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return target;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) { usage(); return 0; }
  const command = args[0];
  if (!['check', 'live'].includes(command)) throw new Error(`unknown command: ${command}`);
  const artifactRoot = value(args, 'root');
  const site = value(args, 'site');
  if (!artifactRoot || !site) throw new Error('--root and --site are required');
  const manifest = compileSearchArtifact({ artifactRoot, site, sourceSha: value(args, 'source-sha') });
  const report = command === 'live'
    ? await verifySearchArtifactLive(manifest, {
      deployedSha: value(args, 'deployed-sha'),
      maxLivePages: integer(args, 'max-live-pages', 24),
      parityMode: value(args, 'parity') || 'search-surface'
    })
    : manifest;
  const output = value(args, 'output');
  if (output) console.log(`WROTE ${write(output, report)}`);
  if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else console.log(formatSearchBuildReport(report));
  return report.pass ? 0 : 1;
}

try { process.exitCode = await main(); }
catch (error) { console.error(`ERROR ${error?.message || error}`); process.exitCode = 2; }
