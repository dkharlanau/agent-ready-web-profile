#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runResolverMonitor } from '../lib/resolver-monitor.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const args = process.argv.slice(2);

function option(name, fallback = null) {
  const prefix = `--${name}=`;
  const value = args.find(arg => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const configPath = path.resolve(option('config', 'arwp-resolver-monitor.json'));
const snapshotDir = path.resolve(option('snapshot-dir', '.arwp-resolver/snapshots'));
const reportPath = path.resolve(option('report', '.arwp-resolver/report.json'));
const concurrency = Number(option('concurrency', 4));
const writeSnapshots = !args.includes('--no-write');
const jsonOutput = args.includes('--json');

if (!fs.existsSync(configPath)) throw new Error(`Resolver monitor config not found: ${configPath}`);
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const failOnOverride = option('fail-on');
if (failOnOverride !== null) config.failOn = failOnOverride.split(',').map(value => value.trim()).filter(Boolean);

const report = await runResolverMonitor(config, {
  snapshotDir,
  resolverVersion: packageJson.version,
  concurrency,
  writeSnapshots
});

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (jsonOutput) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`Resolver monitor: ${report.summary.sites} site(s)`);
  console.log(`Baseline ${report.summary.baselineCreated}; stable ${report.summary.stable}; drift ${report.summary.drifted}; failed ${report.summary.resolutionFailed}`);
  for (const site of report.sites) {
    const suffix = site.classes?.length ? ` [${site.classes.join(', ')}]` : '';
    console.log(`${site.status.toUpperCase()} ${site.id}${suffix}${site.error ? ` — ${site.error}` : ''}`);
  }
  console.log(`Report: ${reportPath}`);
  if (report.triggered.length) console.error(`Fail-on triggered: ${report.triggered.join(', ')}`);
}

process.exit(report.shouldFail ? 1 : 0);
