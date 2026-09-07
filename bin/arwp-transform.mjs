#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  buildTransformationBundle,
  validateTransformationBundle,
  simulateTransformationBundle,
  applyTransformationToDirectory,
  rollbackTransformationReceipt,
  openTransformationPr,
  formatTransformationBundle,
  TRANSFORMATION_PR_AUTHORIZATION,
  LOCAL_TRANSFORM_AUTHORIZATION
} from '../lib/transformation-engine.mjs';

function usage() {
  return `arwp-transform — deterministic target-site transformation engine

Usage:
  arwp-transform compile <upgrade.json> <transform-spec.json> [--output=FILE]
  arwp-transform validate <bundle.json>
  arwp-transform simulate <bundle.json> [--json]
  arwp-transform apply <bundle.json> --root=DIR --authorize=${LOCAL_TRANSFORM_AUTHORIZATION} [--receipt=FILE]
  arwp-transform rollback <receipt.json> --root=DIR --authorize=${LOCAL_TRANSFORM_AUTHORIZATION}
  arwp-transform open-pr <bundle.json> --authorize=${TRANSFORMATION_PR_AUTHORIZATION}

The transform spec must explicitly name allowed production paths and deterministic operations.
Policy, editorial, owner-platform and runtime recommendations are never auto-promoted into executable operations.
Production GitHub delivery always uses a new branch + PR and requires a pinned base commit SHA.
`;
}

function optionValue(args, name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function writeJson(file, value) {
  const resolved = path.resolve(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
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
  if (command === 'compile') {
    if (!args[1] || !args[2]) throw new Error('compile requires <upgrade.json> <transform-spec.json>.');
    const graph = readJson(args[1]);
    const spec = readJson(args[2]);
    const bundle = buildTransformationBundle(graph, spec);
    const output = optionValue(args, 'output');
    if (output) process.stdout.write(`WROTE ${writeJson(output, bundle)}\n${formatTransformationBundle(bundle)}\n`);
    else process.stdout.write(`${JSON.stringify(bundle, null, 2)}\n`);
    return 0;
  }
  if (command === 'validate') {
    if (!args[1]) throw new Error('validate requires <bundle.json>.');
    const result = validateTransformationBundle(readJson(args[1]));
    if (!result.valid) {
      for (const error of result.errors) process.stderr.write(`${error.instancePath || '/'} ${error.message}\n`);
      return 2;
    }
    process.stdout.write('PASS transformation bundle is valid\n');
    return 0;
  }
  if (command === 'simulate') {
    if (!args[1]) throw new Error('simulate requires <bundle.json>.');
    const simulation = simulateTransformationBundle(readJson(args[1]));
    process.stdout.write(`${JSON.stringify(simulation, null, 2)}\n`);
    return 0;
  }
  if (command === 'apply') {
    if (!args[1]) throw new Error('apply requires <bundle.json>.');
    const rootDir = optionValue(args, 'root');
    if (!rootDir) throw new Error('apply requires --root=DIR.');
    const receipt = applyTransformationToDirectory(readJson(args[1]), {
      rootDir,
      authorization: optionValue(args, 'authorize')
    });
    const receiptFile = optionValue(args, 'receipt');
    if (receiptFile) process.stdout.write(`WROTE ${writeJson(receiptFile, receipt)}\n`);
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    return 0;
  }
  if (command === 'rollback') {
    if (!args[1]) throw new Error('rollback requires <receipt.json>.');
    const rootDir = optionValue(args, 'root');
    if (!rootDir) throw new Error('rollback requires --root=DIR.');
    const result = rollbackTransformationReceipt(readJson(args[1]), {
      rootDir,
      authorization: optionValue(args, 'authorize')
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }
  if (command === 'open-pr') {
    if (!args[1]) throw new Error('open-pr requires <bundle.json>.');
    const result = await openTransformationPr(readJson(args[1]), {
      authorization: optionValue(args, 'authorize'),
      token: process.env.GITHUB_TOKEN
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
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
