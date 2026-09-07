#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  validateSiteStateGraph,
  resolveMappedSurface,
  resolveUpgradeOwnership
} from '../lib/repository-mapper.mjs';
import { compileRepositorySiteStateGraph } from '../lib/repository-mapper-frameworks.mjs';
import { mergeRepositoryMapIntoBraidGraph, repositoryMapBraidReport } from '../lib/repository-map-braid.mjs';
import {
  prepareMappedTransformationSpec,
  validateMappedTransformationPreparation,
  formatMappedTransformationPreparation
} from '../lib/mapped-transform-preparation.mjs';

function usage() {
  console.log(`SignalBraid Repository Mapper

Usage:
  arwp-map-repo compile --root=<repo> --repository=<owner/name> --site=<https://site> [--site-root=docs] [--base-path=/project/] [--base-ref=main] [--base-sha=<40-sha>] [--adapter=auto|static-html|jekyll|astro] [--out=site-state.json]
  arwp-map-repo validate <site-state.json>
  arwp-map-repo resolve <site-state.json> (--surface=<surface-key> | --route=</path/> [--type=canonical])
  arwp-map-repo upgrade-hints <adaptive-upgrade.json> <site-state.json>
  arwp-map-repo prepare-transform <adaptive-upgrade.json> <site-state.json> [--recommendations=id1,id2] [--out=mapped-transform.json] [--text]
  arwp-map-repo validate-transform-prep <mapped-transform.json>
  arwp-map-repo braid <braid.json> <site-state.json> [--out=braid-with-map.json]
  arwp-map-repo braid-report <braid-with-map.json>

Repository mapping records proven/explicit ownership and ambiguity. Astro auto-detection is evidence-backed and maps only inspectable static file routes; dynamic/runtime/uninspectable routes fail closed. Transform preparation resolves safe candidate paths and current digests, but it never invents an after-state or authorizes mutation.`);
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
  if (!filename) throw new Error(`${label} path is required.`);
  return JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8'));
}

function writeJson(value, filename = null) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (filename) fs.writeFileSync(path.resolve(filename), text, 'utf8');
  else process.stdout.write(text);
}

function commaList(value) {
  if (typeof value !== 'string') return [];
  return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))];
}

function main() {
  const { positionals, flags } = parse(process.argv.slice(2));
  const command = positionals[0];
  if (!command || ['help', '-h', '--help'].includes(command)) {
    usage();
    return;
  }

  if (command === 'compile') {
    if (!flags.repository) throw new Error('--repository=<owner/name> is required.');
    if (!flags.site) throw new Error('--site=<https://site> is required.');
    const graph = compileRepositorySiteStateGraph({
      root: typeof flags.root === 'string' ? flags.root : '.',
      siteRoot: typeof flags['site-root'] === 'string' ? flags['site-root'] : '.',
      repository: {
        fullName: flags.repository,
        baseRef: typeof flags['base-ref'] === 'string' ? flags['base-ref'] : 'main',
        baseCommitSha: typeof flags['base-sha'] === 'string' ? flags['base-sha'] : null
      },
      site: {
        origin: flags.site,
        basePath: typeof flags['base-path'] === 'string' ? flags['base-path'] : '/'
      },
      adapter: typeof flags.adapter === 'string' ? flags.adapter : 'auto'
    });
    writeJson(graph, typeof flags.out === 'string' ? flags.out : null);
    return;
  }

  if (command === 'validate') {
    const graph = readJson(positionals[1], 'Site State Graph');
    const validation = validateSiteStateGraph(graph);
    writeJson(validation);
    if (!validation.valid) process.exitCode = 1;
    return;
  }

  if (command === 'resolve') {
    const graph = readJson(positionals[1], 'Site State Graph');
    const selector = {};
    if (typeof flags.surface === 'string') selector.surfaceKey = flags.surface;
    if (typeof flags.route === 'string') selector.routePath = flags.route;
    if (typeof flags.type === 'string') selector.surfaceType = flags.type;
    if (!selector.surfaceKey && !selector.routePath) throw new Error('resolve requires --surface=<surface-key> or --route=</path/>.');
    writeJson(resolveMappedSurface(graph, selector));
    return;
  }

  if (command === 'upgrade-hints') {
    const upgrade = readJson(positionals[1], 'Adaptive Upgrade graph');
    const graph = readJson(positionals[2], 'Site State Graph');
    writeJson(resolveUpgradeOwnership(upgrade, graph));
    return;
  }

  if (command === 'prepare-transform') {
    const upgrade = readJson(positionals[1], 'Adaptive Upgrade graph');
    const graph = readJson(positionals[2], 'Site State Graph');
    const preparation = prepareMappedTransformationSpec(upgrade, graph, {
      recommendationIds: commaList(flags.recommendations)
    });
    if (flags.text === true) {
      process.stdout.write(`${formatMappedTransformationPreparation(preparation)}\n`);
      return;
    }
    writeJson(preparation, typeof flags.out === 'string' ? flags.out : null);
    return;
  }

  if (command === 'validate-transform-prep') {
    const preparation = readJson(positionals[1], 'Mapped Transformation Preparation');
    const validation = validateMappedTransformationPreparation(preparation);
    writeJson(validation);
    if (!validation.valid) process.exitCode = 1;
    return;
  }

  if (command === 'braid') {
    const braid = readJson(positionals[1], 'BraidGraph');
    const graph = readJson(positionals[2], 'Site State Graph');
    writeJson(mergeRepositoryMapIntoBraidGraph(braid, graph), typeof flags.out === 'string' ? flags.out : null);
    return;
  }

  if (command === 'braid-report') {
    writeJson(repositoryMapBraidReport(readJson(positionals[1], 'BraidGraph')));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(`arwp-map-repo: ${error.message}`);
  process.exitCode = 1;
}
