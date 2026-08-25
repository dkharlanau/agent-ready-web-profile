#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { loadProfile, validateProfile, formatAjvError } from '../lib/validator.mjs';
import { verifyProfileSource } from '../lib/verifier.mjs';
import { formatScanSummary, scanSite } from '../lib/scanner.mjs';
import { formatHealthReport, healthReport } from '../lib/health.mjs';
import { DEFAULT_DIRECTORY_SOURCE, loadDirectory, searchFederated, selectSites } from '../router/federated.mjs';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const toolVersion = packageJson.version;

function usage() {
  console.log(`Agent-Ready Web Profile CLI ${toolVersion}

Usage:
  arwp validate <profile.json> [--json]
  arwp verify <profile.json|https://...> [--json] [--timeout=<ms>] [--concurrency=<n>]
  arwp scan <https://site.example> [--json] [--timeout=<ms>] [--max-bytes=<n>]
  arwp init <https://site.example> [--output=ai/site-profile.json] [--force] [--json]
  arwp health <https://site.example> [--json]
  arwp directory [--capability=<name>] [--json]
  arwp federated-search <query> [--sites=id1,id2] [--limit=<n>] [--json]
  arwp mcp
  arwp mcp-http
  arwp router-mcp

Commands:
  validate           Validate one local ARWP profile against the v0.1 schema and semantic checks.
  verify             Validate a local or remote profile and probe every declared public URL.
  scan               Inspect a public HTTPS website and report bounded, directly observed interoperability evidence.
  init               Scan a website and write a conservative valid ARWP draft without inventing unverified capabilities.
  health             Combine bounded discovery with live verification of an existing ARWP profile.
  directory          List sites from the configured ARWP directory, optionally by declared capability.
  federated-search   Search declared retrieval indexes across directory sites while preserving source identity.
  mcp                Start the generic read-only MCP gateway over stdio (configure with ARWP_PROFILE).
  mcp-http           Start the guarded Streamable HTTP MCP gateway.
  router-mcp         Start the federated directory/search MCP router over stdio.
`);
}

const args = process.argv.slice(2);
const command = args[0];
const source = args[1];
const jsonOutput = args.includes('--json');

function optionValue(name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
}

function numericOption(name, fallback) {
  const raw = optionValue(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid --${name} value: ${raw}`);
  return value;
}

function printValidation(sourceName, result) {
  if (result.valid) {
    console.log(`PASS ${sourceName}`);
    for (const warning of result.warnings) console.warn(`WARN ${warning}`);
    return;
  }
  console.error(`FAIL ${sourceName}`);
  for (const error of result.errors) console.error(`  ${formatAjvError(error)}`);
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
}

function printVerification(result) {
  if (!result.profileValid && result.schemaErrors?.length) {
    console.error(`FAIL ${result.source}`);
    for (const error of result.schemaErrors) console.error(`  ${error}`);
    return;
  }
  console.log(`${result.valid ? 'PASS' : 'FAIL'} ${result.source}`);
  for (const item of result.resources) {
    const suffix = item.issues?.length ? ` — ${item.issues.join('; ')}` : '';
    console.log(`${item.status.toUpperCase().padEnd(4)} ${item.key} ${item.httpStatus ?? ''} ${item.finalUrl ?? item.url}${suffix}`);
  }
  console.log(`Summary: ${result.summary.pass} pass, ${result.summary.warn} warn, ${result.summary.fail} fail`);
  for (const warning of result.warnings ?? []) console.warn(`WARN ${warning}`);
}

async function main() {
  if (!command || command === '--help' || command === '-h') {
    usage();
    return 0;
  }
  if (command === '--version' || command === '-v') {
    console.log(toolVersion);
    return 0;
  }
  if (command === 'mcp') {
    await import('../gateway/server.mjs');
    return null;
  }
  if (command === 'mcp-http') {
    await import('../gateway/http-node.mjs');
    return null;
  }
  if (command === 'router-mcp') {
    await import('../router/server.mjs');
    return null;
  }

  if (command === 'directory') {
    const { directory, sourceUrl } = await loadDirectory(process.env.ARWP_DIRECTORY || DEFAULT_DIRECTORY_SOURCE);
    const sites = selectSites(directory, { capability: optionValue('capability') });
    if (jsonOutput) console.log(JSON.stringify({ directory: sourceUrl, sites }, null, 2));
    else {
      console.log(`Directory: ${sourceUrl}`);
      for (const site of sites) console.log(`${site.id}\t${site.name}\t${site.profileUrl}`);
      console.log(`Sites: ${sites.length}`);
    }
    return 0;
  }

  if (command === 'federated-search') {
    if (!source) throw new Error('A federated search query is required.');
    const siteIds = String(optionValue('sites') || '').split(',').map(value => value.trim()).filter(Boolean);
    const result = await searchFederated(source, {
      directorySource: process.env.ARWP_DIRECTORY || DEFAULT_DIRECTORY_SOURCE,
      siteIds,
      limit: numericOption('limit', 10),
      limitPerSite: numericOption('limit-per-site', 3)
    });
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`Query: ${result.query}`);
      for (const hit of result.results) console.log(`${hit.score}\t${hit.site.name}\t${hit.title}\t${hit.url || hit.id || ''}`);
      for (const failure of result.failures) console.warn(`WARN ${failure.siteName}: ${failure.error}`);
      console.log(`Results: ${result.results.length}; searched sites: ${result.searchedSites.length}`);
    }
    return result.results.length ? 0 : 1;
  }

  if (!['validate', 'verify', 'scan', 'init', 'health'].includes(command) || !source) {
    usage();
    return 2;
  }

  if (command === 'validate') {
    const profile = loadProfile(source);
    const result = validateProfile(profile);
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else printValidation(source, result);
    return result.valid ? 0 : 1;
  }

  if (command === 'verify') {
    const result = await verifyProfileSource(source, {
      timeoutMs: numericOption('timeout', 8000),
      concurrency: numericOption('concurrency', 6)
    });
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else printVerification(result);
    return result.valid ? 0 : 1;
  }

  if (command === 'health') {
    const result = await healthReport(source, {
      timeoutMs: numericOption('timeout', 8000),
      maxBytes: numericOption('max-bytes', 512 * 1024)
    });
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else console.log(formatHealthReport(result));
    return result.profile.status === 'failing' || result.profile.status === 'invalid' ? 1 : 0;
  }

  const scan = await scanSite(source, {
    timeoutMs: numericOption('timeout', 8000),
    maxBytes: numericOption('max-bytes', 512 * 1024)
  });

  if (command === 'scan') {
    if (jsonOutput) console.log(JSON.stringify(scan, null, 2));
    else {
      console.log(formatScanSummary(scan));
      console.log('\nDraft profile (not written):');
      console.log(JSON.stringify(scan.draftProfile, null, 2));
    }
    return 0;
  }

  const output = path.resolve(optionValue('output') || path.join('ai', 'site-profile.json'));
  if (fs.existsSync(output) && !args.includes('--force')) throw new Error(`Refusing to overwrite existing file: ${output}. Use --force to replace it.`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(scan.draftProfile, null, 2)}\n`, 'utf8');

  if (jsonOutput) {
    console.log(JSON.stringify({ written: output, profile: scan.draftProfile, evidence: scan.evidence, warnings: scan.warnings }, null, 2));
  } else {
    console.log(`WROTE ${output}`);
    console.log(`Detected ${scan.evidence.length} evidence item(s).`);
    for (const warning of scan.warnings) console.warn(`WARN ${warning}`);
    console.log(`Next: arwp validate ${output}`);
  }
  return 0;
}

try {
  const exitCode = await main();
  if (Number.isInteger(exitCode)) process.exit(exitCode);
} catch (error) {
  if (jsonOutput) console.log(JSON.stringify({ valid: false, fatal: String(error.message ?? error) }, null, 2));
  else console.error(`ERROR ${error.message ?? error}`);
  process.exit(2);
}
