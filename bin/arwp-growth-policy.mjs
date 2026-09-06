#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { compileGrowthPolicy, formatImplementationManifest, validateGrowthPolicy } from '../lib/growth-policy.mjs';

function usage() {
  return `arwp-growth-policy — compile an ARWP Growth plan against owner-declared goals

Usage:
  arwp-growth-policy validate <policy.json> [--json]
  arwp-growth-policy compile <growth-plan.json> <policy.json> [--json] [--output=FILE]

The policy declares goals and rights preferences; it does not create ranking or AI recommendation guarantees.
`;
}

function readJson(file) {
  const resolved = path.resolve(file);
  return { resolved, value: JSON.parse(fs.readFileSync(resolved, 'utf8')) };
}

function option(args, name) {
  const prefix = `--${name}=`;
  const value = args.find(arg => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

function write(file, value) {
  const resolved = path.resolve(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return resolved;
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(usage());
    return 0;
  }
  const json = args.includes('--json');
  const files = args.filter(arg => !arg.startsWith('--'));
  if (command === 'validate') {
    if (!files[0]) throw new Error('validate requires <policy.json>.');
    const { resolved, value } = readJson(files[0]);
    const result = validateGrowthPolicy(value);
    if (json) process.stdout.write(`${JSON.stringify({ file: resolved, ...result }, null, 2)}\n`);
    else {
      process.stdout.write(`${result.valid ? 'PASS' : 'FAIL'} Growth Policy ${resolved}\n`);
      for (const issue of result.issues) process.stdout.write(`ERROR ${issue}\n`);
    }
    return result.valid ? 0 : 2;
  }
  if (command === 'compile') {
    if (!files[0] || !files[1]) throw new Error('compile requires <growth-plan.json> <policy.json>.');
    const plan = readJson(files[0]).value;
    const policy = readJson(files[1]).value;
    const manifest = compileGrowthPolicy(plan, policy);
    const output = option(args, 'output');
    if (output) {
      const written = write(output, manifest);
      process.stdout.write(`WROTE ${written}\n${formatImplementationManifest(manifest)}\n`);
    } else if (json) process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    else process.stdout.write(`${formatImplementationManifest(manifest)}\n`);
    return 0;
  }
  throw new Error(`Unknown command: ${command}`);
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(`ERROR ${error?.message || String(error)}\n`);
  process.exitCode = 1;
}
