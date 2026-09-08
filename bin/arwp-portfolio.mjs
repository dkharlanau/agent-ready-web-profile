#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  buildPortfolioRollout,
  formatPortfolioRollout,
  loadPortfolioRegistry,
  validatePortfolioRegistry
} from '../lib/portfolio-rollout.mjs';
import {
  buildPortfolioProposals,
  formatPortfolioProposals
} from '../lib/portfolio-proposals.mjs';
import {
  formatPortfolioWorkspace,
  inspectPortfolioWorkspace,
  loadPortfolioWorkspace,
  validatePortfolioWorkspace,
  verifyPortfolioLive,
  verifyPortfolioWorkspace,
  workspaceFromInventory
} from '../lib/portfolio-workspace.mjs';

function usage() {
  return `arwp-portfolio — inspect, verify and prioritize an owner-controlled website portfolio\n\nUsage:\n  arwp-portfolio check [--json]\n  arwp-portfolio list [--json]\n  arwp-portfolio rollout [--site=<id|owner/repo>] [--trend=<id>] [--provider=<id>] [--stage=<adopt,measured>] [--include-watch] [--output=<file>] [--json]\n  arwp-portfolio propose [--site=<id|owner/repo>] [--trend=<id>] [--provider=<id>] [--stage=<adopt,measured>] [--include-watch] [--output=<file>] [--json]\n  arwp-portfolio fleet-init <inventory.json> --output=<workspace.json> [--name=<name>] [--force]\n  arwp-portfolio fleet-check <workspace.json> [--json]\n  arwp-portfolio fleet-inspect <workspace.json> [--site=<id,id>] [--concurrency=<1..8>] [--output=<file>] [--json]\n  arwp-portfolio fleet-verify <workspace.json> [--site=<id,id>] [--concurrency=<1..4>] [--timeout=<ms>] [--allow-dirty] [--output=<file>] [--json]\n  arwp-portfolio fleet-live <workspace.json> [--site=<id,id>] [--concurrency=<1..5>] [--timeout=<ms>] [--max-bytes=<n>] [--output=<file>] [--json]\n\nFleet inspect is read-only. Fleet verify executes only manifest argv arrays, skips dirty worktrees by default and stores output hashes instead of command output. Fleet live uses bounded public HTTPS reads. None of these commands commits, pushes, deploys or establishes Search/AI outcomes.\n`;
}

function optionValue(args, name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
}

function rolloutOptions(args) {
  return {
    site: optionValue(args, 'site'),
    trend: optionValue(args, 'trend'),
    provider: optionValue(args, 'provider'),
    stage: optionValue(args, 'stage'),
    includeWatch: args.includes('--include-watch')
  };
}

function write(value, args, text = null) {
  const output = optionValue(args, 'output');
  const json = args.includes('--json');
  const body = json ? `${JSON.stringify(value, null, 2)}\n` : `${text ?? JSON.stringify(value, null, 2)}\n`;
  if (!output) {
    process.stdout.write(body);
    return;
  }
  const resolved = path.resolve(output);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, body, 'utf8');
  process.stdout.write(`WROTE ${resolved}\n`);
}

function numericOption(args, name, fallback, minimum, maximum) {
  const raw = optionValue(args, name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`--${name} must be an integer between ${minimum} and ${maximum}.`);
  return value;
}

function siteIds(args) {
  return String(optionValue(args, 'site') || '').split(',').map(value => value.trim()).filter(Boolean);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(usage());
    return 0;
  }
  const command = args[0];
  const workspaceSource = args[1] && !args[1].startsWith('--') ? args[1] : null;

  if (command === 'fleet-init') {
    if (!workspaceSource) throw new Error('fleet-init requires an inventory JSON file.');
    const output = optionValue(args, 'output');
    if (!output) throw new Error('fleet-init requires --output=<workspace.json>.');
    const resolved = path.resolve(output);
    if (fs.existsSync(resolved) && !args.includes('--force')) throw new Error('Output exists; choose another path or use --force.');
    const inventory = JSON.parse(fs.readFileSync(path.resolve(workspaceSource), 'utf8'));
    const workspace = workspaceFromInventory(inventory, optionValue(args, 'name') || 'Imported website portfolio');
    const validation = validatePortfolioWorkspace(workspace);
    if (!validation.valid) throw new Error(`Generated workspace is invalid: ${JSON.stringify(validation)}`);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, `${JSON.stringify(workspace, null, 2)}\n`, 'utf8');
    process.stdout.write(`WROTE ${resolved}\nSites: ${workspace.sites.length}; checks are intentionally empty until reviewed.\n`);
    return 0;
  }

  if (command.startsWith('fleet-')) {
    if (!workspaceSource) throw new Error(`${command} requires a portfolio workspace JSON file.`);
    const loaded = loadPortfolioWorkspace(workspaceSource);
    if (command === 'fleet-check') {
      const result = validatePortfolioWorkspace(loaded.workspace);
      if (args.includes('--json')) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      else process.stdout.write(`${result.valid ? 'PASS' : 'FAIL'} portfolio workspace (${loaded.workspace.sites?.length || 0} sites)\n`);
      return result.valid ? 0 : 2;
    }
    const common = { siteIds: siteIds(args), timeoutMs: numericOption(args, 'timeout', 120000, 1000, 900000) };
    let result;
    if (command === 'fleet-inspect') result = await inspectPortfolioWorkspace(loaded, { ...common, concurrency: numericOption(args, 'concurrency', 4, 1, 8) });
    else if (command === 'fleet-verify') result = await verifyPortfolioWorkspace(loaded, { ...common, concurrency: numericOption(args, 'concurrency', 2, 1, 4), allowDirty: args.includes('--allow-dirty') });
    else if (command === 'fleet-live') result = await verifyPortfolioLive(loaded, { ...common, concurrency: numericOption(args, 'concurrency', 3, 1, 5), maxBytes: numericOption(args, 'max-bytes', 524288, 1024, 5242880) });
    else throw new Error(`Unknown command: ${command}`);
    write(result, args, formatPortfolioWorkspace(result));
    return result.summary.failed ? 1 : 0;
  }

  const portfolio = loadPortfolioRegistry();

  if (command === 'check') {
    const result = validatePortfolioRegistry(portfolio);
    if (args.includes('--json')) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else if (result.valid) process.stdout.write(`PASS owner portfolio (${portfolio.sites.length} sites)\n`);
    else {
      for (const error of result.semanticErrors) process.stderr.write(`FAIL ${error}\n`);
      for (const error of result.errors) process.stderr.write(`FAIL ${error.instancePath || '/'} ${error.message}\n`);
    }
    return result.valid ? 0 : 2;
  }

  if (command === 'list') {
    if (args.includes('--json')) process.stdout.write(`${JSON.stringify(portfolio, null, 2)}\n`);
    else {
      for (const site of portfolio.sites) {
        process.stdout.write(`${site.rollout.enabled ? 'ON ' : 'OFF'} ${site.id}  ${site.repository}  [${site.rollout.mode}]  ${site.verticals.join(',')}\n`);
      }
    }
    return 0;
  }

  if (command === 'rollout') {
    const result = buildPortfolioRollout(portfolio, undefined, rolloutOptions(args));
    write(result, args, formatPortfolioRollout(result));
    return 0;
  }

  if (command === 'propose') {
    const result = buildPortfolioProposals(portfolio, undefined, rolloutOptions(args));
    write(result, args, formatPortfolioProposals(result));
    return 0;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(`ERROR ${error?.message || String(error)}\n`);
  process.exitCode = 2;
}
