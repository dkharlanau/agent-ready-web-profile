#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  buildPortfolioRollout,
  formatPortfolioRollout,
  loadPortfolioRegistry,
  validatePortfolioRegistry
} from '../lib/portfolio-rollout.mjs';

function usage() {
  return `arwp-portfolio — map reviewed Trend Radar changes to owner-controlled sites without generic production mutation\n\nUsage:\n  arwp-portfolio check [--json]\n  arwp-portfolio list [--json]\n  arwp-portfolio rollout [--site=<id|owner/repo>] [--trend=<id>] [--provider=<id>] [--stage=<adopt,measured>] [--include-watch] [--output=<file>] [--json]\n\nDefault rollout includes ADOPT and MEASURED only. WATCH requires --include-watch and remains watch-only. Every candidate still requires target-site audit/owner review before any production change.\n`;
}

function optionValue(args, name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
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

function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(usage());
    return 0;
  }
  const command = args[0];
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
    const result = buildPortfolioRollout(portfolio, undefined, {
      site: optionValue(args, 'site'),
      trend: optionValue(args, 'trend'),
      provider: optionValue(args, 'provider'),
      stage: optionValue(args, 'stage'),
      includeWatch: args.includes('--include-watch')
    });
    write(result, args, formatPortfolioRollout(result));
    return 0;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(`ERROR ${error?.message || String(error)}\n`);
  process.exitCode = 2;
}
