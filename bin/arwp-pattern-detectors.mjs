#!/usr/bin/env node
import path from 'node:path';
import { loadSitePatternCatalogs } from '../lib/site-pattern-graph.mjs';
import {
  loadSitePatternDetectorRegistry,
  selectSitePatternDetectors,
  validateSitePatternDetectorRegistry
} from '../lib/site-pattern-detectors.mjs';

const args = process.argv.slice(2);
const command = args[0] ?? 'check';
const rootArg = args.find(arg => arg.startsWith('--repo-root='));
const patternArg = args.find(arg => arg.startsWith('--pattern='));
const kindArg = args.find(arg => arg.startsWith('--kind='));
const modeArg = args.find(arg => arg.startsWith('--mode='));
const authorityArg = args.find(arg => arg.startsWith('--authority='));
const root = path.resolve(rootArg ? rootArg.slice('--repo-root='.length) : '.');
const registry = loadSitePatternDetectorRegistry(root);
const catalogs = loadSitePatternCatalogs(root);
const validation = validateSitePatternDetectorRegistry(registry, catalogs);

if (command === 'check') {
  console.log(`${validation.valid ? 'PASS' : 'FAIL'} Site Pattern Detector Registry`);
  for (const warning of validation.warnings) console.log(`WARN ${warning}`);
  for (const error of validation.errors) console.error(`ERROR ${error}`);
  console.log(JSON.stringify(validation.summary, null, 2));
  if (!validation.valid) process.exitCode = 1;
} else if (command === 'list') {
  if (!validation.valid) {
    for (const error of validation.errors) console.error(`ERROR ${error}`);
    process.exitCode = 1;
  } else {
    const result = selectSitePatternDetectors(registry, {
      patternId: patternArg ? patternArg.slice('--pattern='.length) : null,
      kind: kindArg ? kindArg.slice('--kind='.length) : null,
      mode: modeArg ? modeArg.slice('--mode='.length) : null,
      authority: authorityArg ? authorityArg.slice('--authority='.length) : null
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
} else {
  console.error('Commands: check, list [--pattern=id] [--kind=practice|anti-pattern] [--mode=...] [--authority=candidate|verdict]');
  process.exitCode = 2;
}
