#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  buildGrowthPrDeliveryBundle,
  formatGrowthPrDeliveryBundle,
  openGrowthProposalPr,
  validateGrowthPrDeliveryBundle,
  GROWTH_PR_AUTHORIZATION
} from '../lib/growth-pr-delivery.mjs';

function usage() {
  return `arwp-growth-pr — review-only target repository delivery for Growth remediation\n\nUsage:\n  arwp-growth-pr prepare <growth-remediation.json> --repository=owner/repo [--base=main] [--output=bundle.json] [--json]\n  arwp-growth-pr validate <growth-pr-bundle.json>\n  arwp-growth-pr open-pr <growth-remediation.json> --repository=owner/repo --authorize=${GROWTH_PR_AUTHORIZATION} [--base=main] [--json]\n\nSafety boundary:\n  - prepare and validate never mutate GitHub;\n  - open-pr requires the exact authorization flag and GITHUB_TOKEN;\n  - the PR may commit review artifacts only under .arwp/proposals/;\n  - production robots, structured data, editorial content and authenticated owner controls are never applied by this command;\n  - there is no production apply/autofix command in v0.1.\n`;
}

function optionValue(args, name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
}

function readJson(file) {
  const resolved = path.resolve(file);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function writeJson(file, value) {
  const resolved = path.resolve(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  if (fs.existsSync(resolved)) throw new Error(`Refusing to overwrite existing output: ${resolved}`);
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return resolved;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(usage());
    return 0;
  }
  const command = args[0];
  const input = args[1] && !args[1].startsWith('--') ? args[1] : null;
  if (!input) throw new Error(`${command} requires an input JSON file.`);

  if (command === 'validate') {
    const bundle = readJson(input);
    const validation = validateGrowthPrDeliveryBundle(bundle);
    if (!validation.valid) {
      process.stderr.write(`${JSON.stringify(validation.errors, null, 2)}\n`);
      return 1;
    }
    process.stdout.write(`PASS review-only Growth PR delivery bundle ${bundle.repository} ${bundle.branch?.name || ''}\n`);
    return 0;
  }

  if (!['prepare', 'open-pr'].includes(command)) throw new Error(`Unknown command: ${command}`);
  const repository = optionValue(args, 'repository');
  if (!repository) throw new Error('--repository=owner/repo is required.');
  const remediation = readJson(input);
  const bundle = buildGrowthPrDeliveryBundle(remediation, {
    repository,
    base: optionValue(args, 'base') || null
  });

  if (command === 'prepare') {
    const output = optionValue(args, 'output');
    if (output) process.stdout.write(`WROTE ${writeJson(output, bundle)}\n`);
    if (args.includes('--json')) process.stdout.write(`${JSON.stringify(bundle, null, 2)}\n`);
    else process.stdout.write(`${formatGrowthPrDeliveryBundle(bundle)}\n`);
    return 0;
  }

  const authorization = optionValue(args, 'authorize');
  const result = await openGrowthProposalPr(bundle, {
    authorization,
    token: process.env.GITHUB_TOKEN
  });
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    process.stdout.write(`OPENED review-only ARWP Growth proposal PR\nRepository: ${result.repository}\nBase: ${result.base}\nBranch: ${result.branch}\nCommit: ${result.commitSha}\nPR: ${result.prNumber ?? 'unknown'}${result.url ? `\nURL: ${result.url}` : ''}\n`);
  }
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(`ERROR ${error?.message || String(error)}\n`);
  process.exitCode = 2;
}
