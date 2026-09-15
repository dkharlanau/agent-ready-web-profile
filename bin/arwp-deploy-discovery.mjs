#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { planDeployDiscovery, formatDeployDiscoveryReport } from '../lib/deploy-discovery-loop.mjs';

function usage() {
  console.log(`ARWP Deploy Discovery Loop

Usage:
  arwp-deploy-discovery plan --site=<https://site/> --after-artifact=<dir> [--before-artifact=<dir>] [--live-report=<search-build-live.json>] [--source-sha=<40-char-sha>] [--removed-status=<json>] [--json] [--output=<report.json>] [--indexnow-output=<changed-urls.txt>]

The planner is read-only. It never submits IndexNow, Search Console or Bing requests.
IndexNow-ready URLs are emitted only after verified deployment evidence. Use arwp-indexnow separately with an owner-controlled key.`);
}

function parse(argv) {
  const out = { command: null, json: false };
  for (const arg of argv) {
    if (!out.command && !arg.startsWith('-')) { out.command = arg; continue; }
    if (arg === '--json') { out.json = true; continue; }
    if (arg === '--help' || arg === '-h') { out.help = true; continue; }
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (!match) throw new Error(`Unknown argument: ${arg}`);
    out[match[1]] = match[2];
  }
  return out;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function write(file, content) {
  if (!file) return;
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  console.error(`WROTE ${target}`);
}

try {
  const args = parse(process.argv.slice(2));
  if (args.help || !args.command) { usage(); process.exit(0); }
  if (args.command !== 'plan') throw new Error(`Unknown command: ${args.command}`);
  if (!args.site) throw new Error('--site is required');
  if (!args['after-artifact']) throw new Error('--after-artifact is required');

  const report = planDeployDiscovery({
    site: args.site,
    beforeArtifactRoot: args['before-artifact'] || null,
    afterArtifactRoot: args['after-artifact'],
    liveReport: args['live-report'] ? readJson(args['live-report']) : null,
    sourceSha: args['source-sha'] || null,
    removedStatus: args['removed-status'] ? readJson(args['removed-status']) : null
  });

  const json = `${JSON.stringify(report, null, 2)}\n`;
  write(args.output, json);
  if (args['indexnow-output']) {
    write(args['indexnow-output'], report.indexNow.readyUrls.length ? `${report.indexNow.readyUrls.join('\n')}\n` : '');
  }
  process.stdout.write(args.json ? json : `${formatDeployDiscoveryReport(report)}\n`);
  process.exit(report.pass ? 0 : 1);
} catch (error) {
  console.error(`ERROR ${error?.message || error}`);
  process.exit(2);
}
