#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { loadProfile, validateProfile, formatAjvError } from '../lib/validator.mjs';
import { verifyProfileSource } from '../lib/verifier.mjs';
import { formatScanSummary, scanSite } from '../lib/scanner.mjs';
import { formatHealthReport, healthReport } from '../lib/health.mjs';
import { checkProtocolArtifacts } from '../lib/protocol-checks.mjs';
import { resolveSite, explainResolvedSite, planResolvedSite } from '../lib/resolver.mjs';
import { resolveMany } from '../lib/resolver-batch.mjs';
import { createResolverSnapshot, diffResolverSnapshots } from '../lib/resolver-snapshot.mjs';
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
  arwp resolve <https://site.example> [--json]
  arwp resolve-many <targets.json|targets.txt> [--concurrency=<n>] [--json]
  arwp explain <https://site.example> [--json]
  arwp plan <https://site.example> --intent=<read|search|structured|tools|agent> [--json]
  arwp snapshot <https://site.example> [--output=<snapshot.json>] [--json]
  arwp drift <before.snapshot.json> <after.snapshot.json> [--json]
  arwp protocol-checks <profile.json|https://...> [--json] [--timeout=<ms>]
  arwp directory [--capability=<name>] [--json]
  arwp federated-search <query> [--sites=id1,id2] [--limit=<n>] [--json]
  arwp resolver-mcp
  arwp mcp
  arwp mcp-http
  arwp router-mcp

Commands:
  validate           Validate one local ARWP profile against the v0.1 schema and semantic checks.
  verify             Validate a local or remote profile and probe every declared public URL.
  scan               Inspect a public HTTPS website and report bounded, directly observed interoperability evidence.
  init               Scan a website and write a conservative valid ARWP draft without inventing unverified capabilities.
  health             Combine bounded discovery with live verification of an existing ARWP profile.
  resolve            Normalize ARWP and upstream/community discovery surfaces into one evidence-backed service map.
  resolve-many       Resolve a bounded file-backed batch; failures are isolated and same-origin work is serialized.
  explain            Explain a resolved site in human-readable terms, including conflicts and preferred interfaces.
  plan               Select the best resolved interface for a concrete intent without hiding fallbacks or evidence source.
  snapshot           Resolve a site and emit a bounded reproducible snapshot suitable for later drift comparison.
  drift              Compare two resolver snapshots and report identity/source/interface/conflict/plan changes.
  protocol-checks    Inspect declared Agent Skill, MCP Registry and A2A artifacts without pretending URL checks prove runtime conformance.
  directory          List sites from the configured ARWP directory, optionally by declared capability.
  federated-search   Search declared retrieval indexes across directory sites while preserving source identity.
  resolver-mcp       Start the site Resolver MCP server over stdio; no ARWP profile is required.
  mcp                Start the generic read-only ARWP-profile gateway over stdio (configure with ARWP_PROFILE).
  mcp-http           Start the guarded Streamable HTTP ARWP-profile gateway.
  router-mcp         Start the federated directory/search MCP router over stdio.
`);
}

const args = process.argv.slice(2);
const command = args[0];
const source = args[1];
const secondSource = args[2] && !args[2].startsWith('--') ? args[2] : null;
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

function printProtocolChecks(result) {
  console.log(`${result.valid ? 'PASS' : 'FAIL'} ${result.source}`);
  console.log(result.scope);
  for (const check of result.checks) {
    const issues = [check.issue, ...(check.issues ?? [])].filter(Boolean);
    console.log(`${check.status.toUpperCase().padEnd(12)} ${check.kind} ${check.name}${check.url ? ` ${check.url}` : ''}${issues.length ? ` — ${issues.join('; ')}` : ''}`);
  }
  console.log(`Summary: ${result.summary.pass} pass, ${result.summary.warning} warning, ${result.summary.fail} fail, ${result.summary['not-assessed']} not assessed`);
}

function printResolution(result) {
  console.log(`${result.identity.name || result.canonicalUrl}`);
  console.log(`Canonical: ${result.canonicalUrl}`);
  console.log(`Sources: ${result.summary.sourcesResolved}/${result.summary.sourcesAttempted} resolved; interfaces: ${result.summary.interfacesResolved}; conflicts: ${result.summary.conflicts}`);
  for (const sourceItem of result.sources.filter(item => item.status === 'resolved')) console.log(`SOURCE ${sourceItem.type} ${sourceItem.url} [${sourceItem.authority || 'unknown'}]`);
  for (const [group, items] of Object.entries(result.interfaces)) {
    for (const item of items) console.log(`${group.toUpperCase()} ${item.protocol || item.kind || ''} ${item.url || item.name || ''} [${item.sourceAuthority || 'unknown'}]`);
  }
  for (const conflict of result.conflicts) console.warn(`WARN ${conflict.message}`);
}

function readJsonFile(file) {
  const resolved = path.resolve(file);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function readBatchTargets(file) {
  const resolved = path.resolve(file);
  const text = fs.readFileSync(resolved, 'utf8').trim();
  if (!text) throw new Error(`Target file is empty: ${resolved}`);
  if (text.startsWith('[') || text.startsWith('{')) {
    const payload = JSON.parse(text);
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.targets)) return payload.targets;
    throw new Error('JSON target file must be an array or an object with a targets array.');
  }
  return text.split(/\r?\n/).map(value => value.trim()).filter(value => value && !value.startsWith('#'));
}

function writeJsonOutput(value, output) {
  const resolved = path.resolve(output);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return resolved;
}

async function resolveCommandSite() {
  return resolveSite(source, {
    timeoutMs: numericOption('timeout', 8000),
    maxBytes: numericOption('max-bytes', 512 * 1024)
  });
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
  if (command === 'resolver-mcp') {
    await import('../resolver/server.mjs');
    return null;
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

  if (command === 'resolve-many') {
    if (!source) throw new Error('resolve-many requires a JSON or newline-delimited target file.');
    const result = await resolveMany(readBatchTargets(source), {
      concurrency: Math.min(10, Math.max(1, Math.trunc(numericOption('concurrency', 4)))),
      resolveOptions: { timeoutMs: numericOption('timeout', 8000), maxBytes: numericOption('max-bytes', 512 * 1024) }
    });
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else {
      for (const item of result.results) console.log(`${item.status.toUpperCase()} ${item.id} ${item.inputUrl}${item.error ? ` — ${item.error}` : ''}`);
      console.log(`Summary: ${result.summary.resolved} resolved, ${result.summary.failed} failed, ${result.summary.conflicts} conflict(s), ${result.summary.interfacesResolved} interface(s)`);
    }
    return result.summary.failed ? 1 : 0;
  }

  if (command === 'drift') {
    if (!source || !secondSource) throw new Error('drift requires before.snapshot.json and after.snapshot.json.');
    const drift = diffResolverSnapshots(readJsonFile(source), readJsonFile(secondSource));
    if (jsonOutput) console.log(JSON.stringify(drift, null, 2));
    else {
      console.log(`${drift.hasDrift ? 'DRIFT' : 'NO-DRIFT'} ${drift.after.canonicalUrl}`);
      console.log(`Sources +${drift.summary.sourcesAdded}/-${drift.summary.sourcesRemoved}/~${drift.summary.sourcesChanged}; interfaces +${drift.summary.interfacesAdded}/-${drift.summary.interfacesRemoved}/~${drift.summary.interfacesChanged}; conflicts +${drift.summary.conflictsAdded}/-${drift.summary.conflictsRemoved}; plans ${drift.summary.planChanges}; identity ${drift.summary.identityChanged ? 'changed' : 'stable'}`);
    }
    return drift.hasDrift ? 1 : 0;
  }

  if (['resolve', 'explain', 'plan', 'snapshot'].includes(command)) {
    if (!source) throw new Error(`A website URL is required for ${command}.`);
    const result = await resolveCommandSite();
    if (command === 'resolve') {
      if (jsonOutput) console.log(JSON.stringify(result, null, 2));
      else printResolution(result);
      return 0;
    }
    if (command === 'explain') {
      const explanation = explainResolvedSite(result);
      if (jsonOutput) console.log(JSON.stringify({ resolution: result, explanation }, null, 2));
      else console.log(explanation);
      return 0;
    }
    if (command === 'snapshot') {
      const snapshot = createResolverSnapshot(result, { resolverVersion: toolVersion });
      const output = optionValue('output');
      if (output) {
        const written = writeJsonOutput(snapshot, output);
        if (jsonOutput) console.log(JSON.stringify({ written, snapshot }, null, 2));
        else console.log(`WROTE ${written}`);
      } else console.log(JSON.stringify(snapshot, null, 2));
      return 0;
    }
    const intent = optionValue('intent');
    if (!intent) throw new Error('plan requires --intent=read|search|structured|tools|agent.');
    const plan = planResolvedSite(result, intent);
    if (jsonOutput) console.log(JSON.stringify({ canonicalUrl: result.canonicalUrl, plan, conflicts: result.conflicts }, null, 2));
    else {
      console.log(`Intent: ${plan.intent}`);
      console.log(`Selected: ${plan.selected?.url || 'none'}`);
      console.log(`Reason: ${plan.reason}`);
      for (const fallback of plan.fallbacks) console.log(`Fallback: ${fallback.url} (${fallback.protocol || fallback.kind})`);
      for (const conflict of result.conflicts) console.warn(`WARN ${conflict.message}`);
    }
    return plan.selected ? 0 : 1;
  }

  if (!['validate', 'verify', 'scan', 'init', 'health', 'protocol-checks'].includes(command) || !source) {
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

  if (command === 'protocol-checks') {
    const result = await checkProtocolArtifacts(source, { timeoutMs: numericOption('timeout', 8000) });
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else printProtocolChecks(result);
    return result.valid ? 0 : 1;
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
