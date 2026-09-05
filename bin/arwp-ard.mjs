#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { searchArdRegistry } from '../lib/ard-registry.mjs';
import { discoverArdSite } from '../lib/ard-site.mjs';
import { normalizeArdEntry, validateArdEntry } from '../lib/ard-v091.mjs';

function usage() {
  return `arwp-ard — explicit ARD v0.91 interoperability tools

Usage:
  arwp-ard discover <site-url> [options]
  arwp-ard search <registry-base-url> <query...> [options]
  arwp-ard validate-entry <file.json> [--json]

Discover options:
  --max-manifests=N                 Bound manifest fetches; default 6, max 12
  --max-entries=N                   Bound normalized entries; default 200, max 1000
  --json                            Emit full JSON evidence

Search options:
  --federation=none|referrals|auto  Default: none
  --page-size=N                     1..100, default 10
  --page-token=TOKEN                Explicit next-page token; never followed automatically
  --type=MEDIA_TYPE                 Adds an ARD type filter; repeatable
  --filter=KEY=VALUE                Adds a scalar filter; repeatable
  --json                            Emit full JSON evidence instead of a compact table

Safety boundaries:
  * public HTTPS targets only
  * site discovery does not recurse nested catalogs or execute resources
  * registry search is one explicit POST /search per invocation
  * redirects, referrals and pagination are never followed automatically
  * registry score means semantic relevance, not trust/security
  * no credentials are inferred from ARD metadata
`;
}

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exitCode = code;
}

function parseFlags(args) {
  const positionals = [];
  const flags = { types: [], filters: [] };
  for (const arg of args) {
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    if (arg === '--json') { flags.json = true; continue; }
    const eq = arg.indexOf('=');
    const key = eq >= 0 ? arg.slice(2, eq) : arg.slice(2);
    const value = eq >= 0 ? arg.slice(eq + 1) : null;
    if (key === 'federation') flags.federation = value;
    else if (key === 'page-size') flags.pageSize = Number(value);
    else if (key === 'page-token') flags.pageToken = value;
    else if (key === 'type') flags.types.push(value);
    else if (key === 'filter') flags.filters.push(value);
    else if (key === 'max-manifests') flags.maxManifests = Number(value);
    else if (key === 'max-entries') flags.maxEntries = Number(value);
    else throw new Error(`Unknown option: ${arg}`);
  }
  return { positionals, flags };
}

function buildFilter(flags) {
  const filter = {};
  if (flags.types.length) filter.type = flags.types;
  for (const expression of flags.filters) {
    const index = String(expression || '').indexOf('=');
    if (index <= 0) throw new Error(`Invalid --filter=${expression}; expected KEY=VALUE.`);
    const key = expression.slice(0, index).trim();
    const value = expression.slice(index + 1).trim();
    if (!key || !value) throw new Error(`Invalid --filter=${expression}; expected non-empty KEY=VALUE.`);
    if (Object.hasOwn(filter, key)) {
      filter[key] = Array.isArray(filter[key]) ? [...filter[key], value] : [filter[key], value];
    } else filter[key] = value;
  }
  return Object.keys(filter).length ? filter : null;
}

function compactSearch(result) {
  const lines = [
    `ARD registry: ${result.url}`,
    `Results: ${result.results.length}`,
    `Federation: ${result.request.federation}`,
    ''
  ];
  if (!result.results.length) lines.push('No results.');
  for (const [index, item] of result.results.entries()) {
    lines.push(`${index + 1}. ${item.displayName || item.identifier}`);
    lines.push(`   identifier: ${item.identifier}`);
    if (item.type) lines.push(`   type: ${item.type}`);
    if (item.url) lines.push(`   artifact: ${item.url}`);
    lines.push(`   relevance: ${item.score}/100 (semantic relevance, not trust)`);
    lines.push(`   source registry: ${item.source}`);
  }
  if (result.referrals.length) {
    lines.push('', `Referrals returned: ${result.referrals.length} (not followed)`);
    for (const item of result.referrals) lines.push(`- ${item.displayName || item.identifier}: ${item.url || 'invalid referral URL'}`);
  }
  if (result.pageToken) lines.push('', `Next page token: ${result.pageToken} (not followed)`);
  lines.push('', result.note);
  return lines.join('\n');
}

function compactDiscovery(result) {
  const lines = [
    `ARD site: ${result.canonicalUrl}`,
    `Sources resolved: ${result.summary.sourcesResolved}/${result.summary.sourcesProcessed}`,
    `Entries: ${result.summary.validEntries} valid, ${result.summary.invalidEntries} invalid, ${result.summary.inlineEntries} inline`,
    `Network: ${result.metrics.requests} request(s), ${result.metrics.bytes} byte(s) in bounded discovery fetches`,
    ''
  ];
  for (const source of result.sources) lines.push(`${source.status.toUpperCase()} ${source.relation}: ${source.url}${source.issue ? ` — ${source.issue}` : ''}`);
  if (result.entries.length) {
    lines.push('', 'Entries:');
    for (const item of result.entries.slice(0, 25)) {
      lines.push(`- ${item.valid ? 'PASS' : 'WARN'} ${item.displayName || item.identifier || 'unnamed'}${item.type ? ` [${item.type}]` : ''}${item.url ? ` → ${item.url}` : ''}`);
    }
    if (result.entries.length > 25) lines.push(`- … ${result.entries.length - 25} more entry/entries omitted from compact output; use --json.`);
  }
  if (result.parseIssues.length) {
    lines.push('', 'Parse issues:');
    for (const issue of result.parseIssues) lines.push(`- ${issue}`);
  }
  lines.push('', result.note);
  return lines.join('\n');
}

async function runDiscover(args) {
  const { positionals, flags } = parseFlags(args);
  const site = positionals[0];
  if (!site) throw new Error('discover requires <site-url>.');
  const result = await discoverArdSite(site, {
    maxManifests: flags.maxManifests,
    maxEntries: flags.maxEntries
  });
  process.stdout.write(flags.json ? `${JSON.stringify(result, null, 2)}\n` : `${compactDiscovery(result)}\n`);
}

async function runSearch(args) {
  const { positionals, flags } = parseFlags(args);
  const registry = positionals.shift();
  const query = positionals.join(' ').trim();
  if (!registry || !query) throw new Error('search requires <registry-base-url> and a query.');
  const result = await searchArdRegistry(registry, {
    text: query,
    federation: flags.federation || 'none',
    pageSize: flags.pageSize,
    pageToken: flags.pageToken,
    filter: buildFilter(flags)
  });
  if (!result.ok) {
    const detail = result.error?.message || result.error?.errorCode || `HTTP ${result.status}`;
    if (flags.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else fail(`ARD registry search failed: ${detail}`);
    if (!process.exitCode) process.exitCode = 2;
    return;
  }
  process.stdout.write(flags.json ? `${JSON.stringify(result, null, 2)}\n` : `${compactSearch(result)}\n`);
}

function readJsonFile(file) {
  const resolved = path.resolve(file);
  let value;
  try { value = JSON.parse(fs.readFileSync(resolved, 'utf8')); }
  catch (error) { throw new Error(`Unable to read JSON ${resolved}: ${error.message}`); }
  return { resolved, value };
}

function runValidate(args) {
  const { positionals, flags } = parseFlags(args);
  const file = positionals[0];
  if (!file) throw new Error('validate-entry requires <file.json>.');
  const { resolved, value } = readJsonFile(file);
  const validation = validateArdEntry(value);
  const normalized = normalizeArdEntry(value, { sourceId: 'local-file', discoveredVia: 'offline-validation' });
  const report = {
    file: resolved,
    valid: validation.valid,
    issues: validation.issues,
    warnings: validation.warnings,
    normalized: validation.valid ? normalized : null,
    note: 'Validation checks ARD discovery-critical entry shape. It does not prove artifact reachability, authorization, runtime conformance or trust.'
  };
  if (flags.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    process.stdout.write(`${report.valid ? 'PASS' : 'FAIL'} ARD entry ${resolved}\n`);
    for (const issue of report.issues) process.stdout.write(`ERROR ${issue}\n`);
    for (const warning of report.warnings) process.stdout.write(`WARN ${warning}\n`);
    process.stdout.write(`${report.note}\n`);
  }
  if (!report.valid) process.exitCode = 2;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(usage());
    return;
  }
  if (command === 'discover') return runDiscover(args);
  if (command === 'search') return runSearch(args);
  if (command === 'validate-entry') return runValidate(args);
  throw new Error(`Unknown command: ${command}\n\n${usage()}`);
}

main().catch(error => fail(error?.message || String(error)));
