#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  buildWatchImpactBundle,
  validateWatchTargets,
  validateWatchImpactBundle,
  formatWatchImpactBundle
} from '../lib/braid-watch.mjs';

function usage() {
  console.log(`SignalBraid Watch

Usage:
  arwp-watch impact <watch-targets.json> --rule=<rule-id> [--portfolio=<portfolio-sites.json>] [--out=<bundle.json>] [--text]
  arwp-watch impact <watch-targets.json> --source=<https://source> [--portfolio=<portfolio-sites.json>] [--out=<bundle.json>] [--text]
  arwp-watch changed-since <watch-targets.json> --since=<ISO-date-or-time> [--portfolio=<portfolio-sites.json>] [--out=<bundle.json>] [--text]
  arwp-watch validate-targets <watch-targets.json>
  arwp-watch validate-bundle <watch-impact-bundle.json>

Watch consumes existing BraidGraphs. It produces review queues only: impact does not mean breakage and never authorizes production mutation.`);
}

function parse(argv) {
  const positionals = [];
  const flags = {};
  for (const value of argv) {
    if (!value.startsWith('--')) {
      positionals.push(value);
      continue;
    }
    const equal = value.indexOf('=');
    if (equal < 0) flags[value.slice(2)] = true;
    else flags[value.slice(2, equal)] = value.slice(equal + 1);
  }
  return { positionals, flags };
}

function readJson(filename, label) {
  if (!filename || typeof filename !== 'string') throw new Error(`${label} path is required.`);
  return JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8'));
}

function safeGraphPath(manifestFile, value) {
  if (path.isAbsolute(value)) throw new Error(`Watch graph paths must be relative to the manifest: ${value}`);
  const manifestDir = fs.realpathSync(path.dirname(path.resolve(manifestFile)));
  const candidate = path.resolve(manifestDir, value);
  const relative = path.relative(manifestDir, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Watch graph path escapes the manifest directory: ${value}`);
  const real = fs.realpathSync(candidate);
  const realRelative = path.relative(manifestDir, real);
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw new Error(`Watch graph symlink escapes the manifest directory: ${value}`);
  return real;
}

function loadTargets(manifestFile) {
  const manifest = readJson(manifestFile, 'Watch target manifest');
  const validation = validateWatchTargets(manifest);
  if (!validation.valid) throw new Error(`Invalid Watch target manifest: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return manifest.sites.map(site => ({
    id: site.id,
    importance: site.importance,
    enabled: site.enabled,
    portfolioSiteId: site.portfolioSiteId || null,
    note: site.note || null,
    graph: site.enabled ? readJson(safeGraphPath(manifestFile, site.graph), `BraidGraph for ${site.id}`) : null
  }));
}

function write(value, filename = null) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (typeof filename === 'string') fs.writeFileSync(path.resolve(filename), text, 'utf8');
  else process.stdout.write(text);
}

function output(bundle, flags) {
  if (flags.text === true) {
    process.stdout.write(`${formatWatchImpactBundle(bundle)}\n`);
    return;
  }
  write(bundle, flags.out);
}

function main() {
  const { positionals, flags } = parse(process.argv.slice(2));
  const command = positionals[0];
  if (!command || ['help', '-h', '--help'].includes(command)) {
    usage();
    return;
  }

  if (command === 'validate-targets') {
    const manifest = readJson(positionals[1], 'Watch target manifest');
    const validation = validateWatchTargets(manifest);
    write(validation);
    if (!validation.valid) process.exitCode = 1;
    return;
  }

  if (command === 'validate-bundle') {
    const validation = validateWatchImpactBundle(readJson(positionals[1], 'Watch impact bundle'));
    write(validation);
    if (!validation.valid) process.exitCode = 1;
    return;
  }

  if (command === 'impact' || command === 'changed-since') {
    const manifestFile = positionals[1];
    const targets = loadTargets(manifestFile);
    const portfolio = typeof flags.portfolio === 'string' ? readJson(flags.portfolio, 'Portfolio registry') : null;
    let query;
    if (command === 'changed-since') {
      if (typeof flags.since !== 'string') throw new Error('changed-since requires --since=<ISO-date-or-time>.');
      query = { changedSince: flags.since };
    } else {
      const hasRule = typeof flags.rule === 'string';
      const hasSource = typeof flags.source === 'string';
      if (Number(hasRule) + Number(hasSource) !== 1) throw new Error('impact requires exactly one of --rule or --source.');
      query = hasRule ? { rule: flags.rule } : { source: flags.source };
    }
    output(buildWatchImpactBundle(targets, query, { portfolio }), flags);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(`arwp-watch: ${error.message}`);
  process.exitCode = 1;
}
