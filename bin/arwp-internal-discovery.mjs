#!/usr/bin/env node
import fs from 'node:fs';
import { internalDiscovery, formatInternalDiscoveryReport, validateInternalDiscoveryReport } from '../lib/internal-discovery.mjs';

const usage = `Usage:
  arwp-internal-discovery <https://site.example/> [--max-pages=N] [--concurrency=N] [--timeout=N] [--json] [--output=report.json]
  arwp-internal-discovery validate <report.json>

Builds a bounded internal discovery evidence graph from fetched HTML. It separates canonical owners, aliases and link classes and never emits PageRank, authority or SEO scores.`;

function integer(value, name, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  return parsed;
}

function readJson(file) {
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error('Report must be a regular local JSON file.');
  if (stat.size > 20 * 1024 * 1024) throw new Error('Report exceeds the 20 MiB validation limit.');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file)));
}

try {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) {
    console.log(usage);
    process.exit(args.includes('--help') ? 0 : 2);
  }
  if (args[0] === 'validate') {
    if (args.length !== 2) throw new Error(usage);
    const report = readJson(args[1]);
    const validation = validateInternalDiscoveryReport(report);
    if (!validation.valid) {
      console.error(validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('\n'));
      process.exitCode = 1;
    } else console.log(`PASS Internal Discovery v${report.version}: ${report.summary.canonicalOwners} owner(s), ${report.summary.ownerEdges} owner edge(s)`);
  } else {
    const input = args.shift();
    const options = new Map();
    for (const arg of args) {
      if (arg === '--json') {
        if (options.has('json')) throw new Error('Duplicate --json.');
        options.set('json', true);
        continue;
      }
      const match = arg.match(/^--(max-pages|concurrency|timeout|output)=(.+)$/);
      if (!match || options.has(match[1])) throw new Error(`Unknown, empty or duplicate option: ${arg.split('=')[0]}`);
      options.set(match[1], match[2]);
    }
    const report = await internalDiscovery(input, {
      maxPages: options.has('max-pages') ? integer(options.get('max-pages'), 'max-pages', 1, 50) : 20,
      concurrency: options.has('concurrency') ? integer(options.get('concurrency'), 'concurrency', 1, 10) : 4,
      timeoutMs: options.has('timeout') ? integer(options.get('timeout'), 'timeout', 1000, 60000) : 8000
    });
    const body = options.has('json') || options.has('output')
      ? `${JSON.stringify(report, null, 2)}\n`
      : `${formatInternalDiscoveryReport(report)}\n`;
    if (options.has('output')) fs.writeFileSync(options.get('output'), body, { encoding: 'utf8', flag: 'wx' });
    else process.stdout.write(body);
  }
} catch (error) {
  console.error(`arwp-internal-discovery: ${error.message}`);
  process.exitCode = 2;
}
