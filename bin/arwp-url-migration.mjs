#!/usr/bin/env node
import fs from 'node:fs';
import {
  formatUrlMigrationIntegrityReport,
  urlMigrationIntegrity,
  validateUrlMigrationIntegrityReport
} from '../lib/url-migration-integrity.mjs';

const MiB = 1024 * 1024;
const usage = `Usage:
  node bin/arwp-url-migration.mjs inspect <migration.json> [--before-state=before.json] [--after-state=after.json] [--after-sitemap=sitemap.xml] [--internal-discovery=internal-discovery.json] [--timeout=8000] [--max-redirects=5] [--concurrency=4] [--output=report.json] [--text]
  node bin/arwp-url-migration.mjs validate <report.json>

migration.json is either an array of {"oldUrl":"https://...","newUrl":"https://..."} objects or {"pairs":[...]}.
inspect performs bounded public HTTPS requests. Optional repository/sitemap/Internal Discovery inputs remain separate evidence and are never treated as live redirect proof.`;

function readText(file, label, maxBytes = 64 * MiB) {
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error(`${label} must be a regular local file.`);
  if (stat.size > maxBytes) throw new Error(`${label} exceeds the ${Math.floor(maxBytes / MiB)} MiB input limit.`);
  return new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file));
}

function readJson(file, label, maxBytes = 64 * MiB) {
  return JSON.parse(readText(file, label, maxBytes));
}

function positiveInteger(value, label, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!/^\d+$/.test(String(value || ''))) throw new Error(`${label} must be an integer.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) throw new Error(`${label} must be between ${min} and ${max}.`);
  return number;
}

function writeExclusive(file, body) {
  fs.writeFileSync(file, body, { encoding: 'utf8', flag: 'wx' });
}

try {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) {
    console.log(usage);
    process.exit(args.includes('--help') ? 0 : 2);
  }
  const command = args.shift();

  if (command === 'validate') {
    if (args.length !== 1 || args[0].startsWith('--')) throw new Error(usage);
    const report = readJson(args[0], 'URL Migration Integrity report');
    const validation = validateUrlMigrationIntegrityReport(report);
    if (!validation.valid) {
      console.error(validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('\n'));
      process.exitCode = 1;
    } else {
      console.log(`PASS URL Migration Integrity v${report.version}: ${report.pairs.length} pair(s)`);
    }
  } else if (command === 'inspect') {
    const positionals = [];
    const options = new Map();
    let text = false;
    for (const arg of args) {
      if (arg === '--text') {
        if (text) throw new Error('Duplicate --text.');
        text = true;
        continue;
      }
      if (arg.startsWith('--')) {
        const match = arg.match(/^--([a-z-]+)=(.+)$/);
        if (!match) throw new Error(`Invalid option: ${arg}`);
        const key = match[1];
        if (!['before-state', 'after-state', 'after-sitemap', 'internal-discovery', 'timeout', 'max-redirects', 'concurrency', 'output'].includes(key)) throw new Error(`Unknown option: --${key}`);
        if (options.has(key)) throw new Error(`Duplicate option: --${key}`);
        options.set(key, match[2]);
      } else {
        positionals.push(arg);
      }
    }
    if (positionals.length !== 1) throw new Error(usage);
    const manifest = readJson(positionals[0], 'Migration manifest', 5 * MiB);
    const beforeState = options.has('before-state') ? readJson(options.get('before-state'), 'Before Site State Graph') : null;
    const afterState = options.has('after-state') ? readJson(options.get('after-state'), 'After Site State Graph') : null;
    const afterSitemapXml = options.has('after-sitemap') ? readText(options.get('after-sitemap'), 'After canonical sitemap', 50 * MiB) : null;
    const internalDiscovery = options.has('internal-discovery') ? readJson(options.get('internal-discovery'), 'Internal Discovery report') : null;
    const timeoutMs = options.has('timeout') ? positiveInteger(options.get('timeout'), '--timeout', { min: 1, max: 120000 }) : 8000;
    const maxRedirects = options.has('max-redirects') ? positiveInteger(options.get('max-redirects'), '--max-redirects', { min: 0, max: 20 }) : 5;
    const concurrency = options.has('concurrency') ? positiveInteger(options.get('concurrency'), '--concurrency', { min: 1, max: 10 }) : 4;
    const report = await urlMigrationIntegrity(manifest, { beforeState, afterState, afterSitemapXml, internalDiscovery, timeoutMs, maxRedirects, concurrency });
    const body = text ? `${formatUrlMigrationIntegrityReport(report)}\n` : `${JSON.stringify(report, null, 2)}\n`;
    if (options.has('output')) writeExclusive(options.get('output'), body);
    else process.stdout.write(body);
  } else {
    throw new Error(usage);
  }
} catch (error) {
  console.error(`arwp-url-migration: ${error.message}`);
  process.exitCode = 2;
}
