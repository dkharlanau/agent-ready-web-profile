#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  listTransformationPacks,
  loadTransformationPackRegistry,
  prepareTransformationPackOperation,
  validateTransformationPackRegistry
} from '../lib/transformation-pack.mjs';
import {
  summarizeTransformationPackCoverage,
  validateTransformationPackCoverageManifest
} from '../lib/transformation-pack-coverage.mjs';

function usage() {
  console.log(`SignalBraid Transformation Packs

Usage:
  arwp-transform-pack list [--adapter=static-html|jekyll|astro|nextjs] [--status=active|experimental|retired]
  arwp-transform-pack validate [registry.json]
  arwp-transform-pack prepare <site-state.json> --pack=<pack-id> --recipe=<recipe-id> --recommendation=<id> (--route=<path> | --surface=<key>) --before=<source-file> [--inputs=<inputs.json>] [--grounding=<ref,ref>] [--reviewed-grounding] [--out=<result.json>]
  arwp-transform-pack coverage <coverage-manifest.json> [--validate-only] [--out=<report.json>]

prepare is read-only. A ready result is an operation spec for the existing Transformation Engine; it is not production mutation authorization.
coverage summarizes observed preparation outcomes. It is not a readiness score, ranking prediction or mutation authorization.`);
}

function parse(argv) {
  const positionals = [];
  const flags = {};
  for (const value of argv) {
    if (!value.startsWith('--')) {
      positionals.push(value);
      continue;
    }
    const equal = value.indexOf('=');
    if (equal < 0) flags[value.slice(2)] = true;
    else flags[value.slice(2, equal)] = value.slice(equal + 1);
  }
  return { positionals, flags };
}

function readJson(filename, label) {
  if (!filename || typeof filename !== 'string') throw new Error(`${label} path is required.`);
  return JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8'));
}

function write(value, filename = null) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (typeof filename === 'string') fs.writeFileSync(path.resolve(filename), text, 'utf8');
  else process.stdout.write(text);
}

function main() {
  const { positionals, flags } = parse(process.argv.slice(2));
  const command = positionals[0];
  if (!command || ['help', '-h', '--help'].includes(command)) {
    usage();
    return;
  }

  if (command === 'list') {
    write({
      version: '0.1',
      packs: listTransformationPacks({ adapter: flags.adapter, status: flags.status })
    }, flags.out);
    return;
  }

  if (command === 'validate') {
    const registry = positionals[1] ? readJson(positionals[1], 'Transformation Pack registry') : loadTransformationPackRegistry();
    const validation = validateTransformationPackRegistry(registry);
    write(validation, flags.out);
    if (!validation.valid) process.exitCode = 1;
    return;
  }

  if (command === 'prepare') {
    const siteState = readJson(positionals[1], 'Site State Graph');
    if (typeof flags.pack !== 'string') throw new Error('prepare requires --pack=<pack-id>.');
    if (typeof flags.recipe !== 'string') throw new Error('prepare requires --recipe=<recipe-id>.');
    if (typeof flags.recommendation !== 'string') throw new Error('prepare requires --recommendation=<id>.');
    const hasRoute = typeof flags.route === 'string';
    const hasSurface = typeof flags.surface === 'string';
    if (Number(hasRoute) + Number(hasSurface) !== 1) throw new Error('prepare requires exactly one of --route or --surface.');
    if (typeof flags.before !== 'string') throw new Error('prepare requires --before=<source-file>.');
    const request = {
      packId: flags.pack,
      recipeId: flags.recipe,
      recommendationId: flags.recommendation,
      ...(hasRoute ? { routePath: flags.route } : { surfaceKey: flags.surface }),
      beforeContent: fs.readFileSync(path.resolve(flags.before), 'utf8'),
      inputs: typeof flags.inputs === 'string' ? readJson(flags.inputs, 'Transformation Pack inputs') : {},
      groundedEvidence: typeof flags.grounding === 'string' ? flags.grounding.split(',').map(value => value.trim()).filter(Boolean) : [],
      reviewedGrounding: flags['reviewed-grounding'] === true
    };
    write(prepareTransformationPackOperation(siteState, request), flags.out);
    return;
  }

  if (command === 'coverage') {
    const manifest = readJson(positionals[1], 'Transformation Pack coverage manifest');
    const validation = validateTransformationPackCoverageManifest(manifest);
    if (flags['validate-only'] === true) {
      write(validation, flags.out);
      if (!validation.valid) process.exitCode = 1;
      return;
    }
    if (!validation.valid) throw new Error(`Invalid Transformation Pack coverage manifest: ${validation.errors.join('; ')}`);
    write(summarizeTransformationPackCoverage(manifest), flags.out);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(`arwp-transform-pack: ${error.message}`);
  process.exitCode = 1;
}
