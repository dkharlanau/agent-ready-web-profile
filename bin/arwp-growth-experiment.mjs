#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  createGrowthExperiment,
  evaluateGrowthExperiment,
  formatGrowthExperiment,
  reviewGrowthExperiment,
  validateGrowthExperiment
} from '../lib/growth-experiment.mjs';

function usage() {
  return `arwp-growth-experiment — link Growth hypotheses to before/after implementation and owner evidence\n\nUsage:\n  arwp-growth-experiment create <before.growth.snapshot.json> --id=<id> --hypothesis=<id> --actions=<id,id> [--before-visibility=<file>] [--commit=<sha>] [--change-uri=<uri>] [--implemented-at=<ISO>] [--output=<file>] [--json]\n  arwp-growth-experiment evaluate <experiment.json> <before.growth.snapshot.json> <after.growth.snapshot.json> [--before-visibility=<file>] [--after-visibility=<file>] [--evaluated-at=<ISO>] [--output=<file>] [--json]\n  arwp-growth-experiment review <experiment.json> --decision=<keep|revise|revert|retire|continue-measuring> [--reviewed-at=<ISO>] [--notes=<text>] [--output=<file>] [--json]\n  arwp-growth-experiment validate <experiment.json> [--json]\n\nExperiment outcomes remain observations. ARWP never turns an implementation or metric delta into a ranking/causality claim automatically.\n`;
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
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function writeOrPrint(value, args, json = false) {
  const output = optionValue(args, 'output');
  if (output) {
    const resolved = path.resolve(output);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    if (json) process.stdout.write(`${JSON.stringify({ written: resolved, experiment: value }, null, 2)}\n`);
    else process.stdout.write(`WROTE ${resolved}\n`);
    return;
  }
  process.stdout.write(json ? `${JSON.stringify(value, null, 2)}\n` : `${formatGrowthExperiment(value)}\n`);
}

function implementationFrom(args) {
  const commitSha = optionValue(args, 'commit');
  const changeUri = optionValue(args, 'change-uri');
  const implementedAt = optionValue(args, 'implemented-at');
  if (!commitSha && !changeUri && !implementedAt) return null;
  return {
    ...(commitSha ? { commitSha } : {}),
    ...(changeUri ? { changeUri } : {}),
    ...(implementedAt ? { implementedAt } : {})
  };
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(usage());
    return 0;
  }
  const command = args[0];
  const json = args.includes('--json');

  if (command === 'validate') {
    if (!args[1]) throw new Error('validate requires an experiment JSON file.');
    const result = validateGrowthExperiment(readJson(args[1]));
    if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else if (result.valid) process.stdout.write('PASS Growth experiment\n');
    else {
      for (const error of result.semanticErrors) process.stderr.write(`FAIL ${error}\n`);
      for (const error of result.errors) process.stderr.write(`FAIL ${error.instancePath || '/'} ${error.message}\n`);
    }
    return result.valid ? 0 : 2;
  }

  if (command === 'create') {
    if (!args[1]) throw new Error('create requires a before Growth snapshot.');
    const beforeGrowthSnapshot = readJson(args[1]);
    const beforeVisibilityFile = optionValue(args, 'before-visibility');
    const experiment = createGrowthExperiment({
      id: optionValue(args, 'id'),
      hypothesisId: optionValue(args, 'hypothesis'),
      actionIds: String(optionValue(args, 'actions') || '').split(',').map(value => value.trim()).filter(Boolean),
      beforeGrowthSnapshot,
      beforeVisibilitySnapshot: beforeVisibilityFile ? readJson(beforeVisibilityFile) : null,
      implementation: implementationFrom(args)
    });
    writeOrPrint(experiment, args, json);
    return 0;
  }

  if (command === 'evaluate') {
    if (!args[1] || !args[2] || !args[3]) throw new Error('evaluate requires experiment, before Growth snapshot and after Growth snapshot files.');
    const beforeVisibilityFile = optionValue(args, 'before-visibility');
    const afterVisibilityFile = optionValue(args, 'after-visibility');
    const evaluated = evaluateGrowthExperiment(readJson(args[1]), {
      beforeGrowthSnapshot: readJson(args[2]),
      afterGrowthSnapshot: readJson(args[3]),
      beforeVisibilitySnapshot: beforeVisibilityFile ? readJson(beforeVisibilityFile) : null,
      afterVisibilitySnapshot: afterVisibilityFile ? readJson(afterVisibilityFile) : null,
      evaluatedAt: optionValue(args, 'evaluated-at')
    });
    writeOrPrint(evaluated, args, json);
    return 0;
  }

  if (command === 'review') {
    if (!args[1]) throw new Error('review requires an experiment JSON file.');
    const reviewed = reviewGrowthExperiment(readJson(args[1]), {
      decision: optionValue(args, 'decision'),
      reviewedAt: optionValue(args, 'reviewed-at'),
      notes: optionValue(args, 'notes')
    });
    writeOrPrint(reviewed, args, json);
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
