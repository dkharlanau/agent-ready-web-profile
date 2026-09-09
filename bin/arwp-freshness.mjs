#!/usr/bin/env node
import fs from 'node:fs';
import {
  buildFreshnessSnapshot,
  compareFreshnessSnapshots,
  formatFreshnessComparison,
  validateFreshnessComparison,
  validateFreshnessSnapshot
} from '../lib/freshness-integrity.mjs';

const MiB = 1024 * 1024;
const usage = `Usage:
  node bin/arwp-freshness.mjs snapshot <site-state.json> <leaf-sitemap.xml> [--sitemap-source=<label-or-url>] [--output=snapshot.json]
  node bin/arwp-freshness.mjs compare <before-snapshot.json> <after-snapshot.json> [--output=comparison.json] [--text]
  node bin/arwp-freshness.mjs validate <snapshot-or-comparison.json>

Freshness Integrity compares sitemap <lastmod> with revision-bound Repository Mapper owner/build-input evidence.
It does not infer significant content changes from build timestamps and does not predict crawling, ranking or AI visibility.`;

function readText(file, label, maxBytes) {
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error(`${label} must be a regular local file.`);
  if (stat.size > maxBytes) throw new Error(`${label} exceeds the ${Math.floor(maxBytes / MiB)} MiB input limit.`);
  return new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file));
}

function readJson(file, label, maxBytes = 64 * MiB) {
  return JSON.parse(readText(file, label, maxBytes));
}

function writeExclusive(file, body) {
  fs.writeFileSync(file, body, { encoding: 'utf8', flag: 'wx' });
}

function parseArgs(args, allowed) {
  const positionals = [];
  const options = new Map();
  for (const arg of args) {
    if (arg === '--text') {
      if (!allowed.has('text') || options.has('text')) throw new Error(`Unknown or duplicate option: ${arg}`);
      options.set('text', true);
      continue;
    }
    if (arg.startsWith('--')) {
      const match = arg.match(/^--([a-z-]+)=(.+)$/);
      const key = match?.[1];
      if (!match || !allowed.has(key) || options.has(key)) throw new Error(`Unknown, empty or duplicate option: ${arg.split('=')[0]}`);
      options.set(key, match[2]);
      continue;
    }
    positionals.push(arg);
  }
  return { positionals, options };
}

function validationFor(value) {
  const schema = String(value?.$schema || '');
  if (schema.endsWith('/freshness-snapshot.schema.json')) return { kind: 'snapshot', result: validateFreshnessSnapshot(value) };
  if (schema.endsWith('/freshness-comparison.schema.json')) return { kind: 'comparison', result: validateFreshnessComparison(value) };
  const snapshot = validateFreshnessSnapshot(value);
  if (snapshot.valid) return { kind: 'snapshot', result: snapshot };
  const comparison = validateFreshnessComparison(value);
  if (comparison.valid) return { kind: 'comparison', result: comparison };
  return {
    kind: 'unknown',
    result: {
      valid: false,
      errors: [
        { instancePath: '/$schema', message: 'does not identify a valid Freshness Integrity snapshot or comparison' }
      ]
    }
  };
}

try {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) {
    console.log(usage);
    process.exit(args.includes('--help') ? 0 : 2);
  }

  const command = args.shift();
  if (command === 'snapshot') {
    const { positionals, options } = parseArgs(args, new Set(['output', 'sitemap-source']));
    if (positionals.length !== 2) throw new Error(usage);
    const graph = readJson(positionals[0], 'Site State Graph', 32 * MiB);
    const sitemap = readText(positionals[1], 'Leaf sitemap', 50 * MiB);
    const snapshot = buildFreshnessSnapshot(graph, sitemap, {
      sitemapSource: options.get('sitemap-source') || positionals[1]
    });
    const body = `${JSON.stringify(snapshot, null, 2)}\n`;
    if (options.has('output')) writeExclusive(options.get('output'), body);
    else process.stdout.write(body);
  } else if (command === 'compare') {
    const { positionals, options } = parseArgs(args, new Set(['output', 'text']));
    if (positionals.length !== 2) throw new Error(usage);
    const before = readJson(positionals[0], 'Before freshness snapshot');
    const after = readJson(positionals[1], 'After freshness snapshot');
    const comparison = compareFreshnessSnapshots(before, after);
    const body = options.has('text')
      ? `${formatFreshnessComparison(comparison)}\n`
      : `${JSON.stringify(comparison, null, 2)}\n`;
    if (options.has('output')) writeExclusive(options.get('output'), body);
    else process.stdout.write(body);
  } else if (command === 'validate') {
    const { positionals } = parseArgs(args, new Set());
    if (positionals.length !== 1) throw new Error(usage);
    const value = readJson(positionals[0], 'Freshness evidence file');
    const validation = validationFor(value);
    if (!validation.result.valid) {
      console.error(validation.result.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('\n'));
      process.exitCode = 1;
    } else {
      const count = validation.kind === 'snapshot' ? value.entries.length : value.observations.length;
      console.log(`PASS Freshness Integrity ${validation.kind} v${value.version}: ${count} record(s)`);
    }
  } else {
    throw new Error(usage);
  }
} catch (error) {
  console.error(`arwp-freshness: ${error.message}`);
  process.exitCode = 2;
}
