#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  buildSitePatternActions,
  loadSitePatternCatalogs,
  loadSitePatternMap,
  summarizePatternPortfolio,
  summarizeSitePatternMap,
  validateSitePatternMap
} from '../lib/site-pattern-graph.mjs';

const args = process.argv.slice(2);
const command = args[0] ?? 'check';
const json = args.includes('--json');
const positional = args.slice(1).filter(arg => !arg.startsWith('--'));
const rootArg = args.find(arg => arg.startsWith('--repo-root='));
const root = path.resolve(rootArg ? rootArg.slice('--repo-root='.length) : '.');

function loadAndValidate(file) {
  const mapPath = path.resolve(file ?? path.join(root, '.arwp/site-pattern-map.json'));
  const map = loadSitePatternMap(mapPath);
  const catalogs = loadSitePatternCatalogs(root, map);
  const validation = validateSitePatternMap(map, catalogs);
  return { map, mapPath, validation };
}

function print(value) {
  if (json) process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  else console.log(value);
}

if (command === 'check') {
  const { mapPath, validation } = loadAndValidate(positional[0]);
  if (json) print({ file: mapPath, ...validation });
  else {
    console.log(`${validation.valid ? 'PASS' : 'FAIL'} Site Pattern Map ${mapPath}`);
    for (const warning of validation.warnings) console.log(`WARN ${warning}`);
    for (const error of validation.errors) console.error(`ERROR ${error}`);
    console.log(`Fingerprint ${validation.fingerprint}`);
    console.log(`Instances ${validation.summary.total}; practice present ${validation.summary.practicePresent}; practice absent ${validation.summary.practiceAbsent}; anti-pattern present ${validation.summary.antiPatternPresent}; unknown ${validation.summary.unknown}`);
  }
  if (!validation.valid) process.exitCode = 1;
} else if (command === 'summary') {
  const { map, validation } = loadAndValidate(positional[0]);
  if (!validation.valid) {
    for (const error of validation.errors) console.error(`ERROR ${error}`);
    process.exitCode = 1;
  } else print({ site: map.site, coverage: map.coverage, summary: summarizeSitePatternMap(map), knownUnknowns: map.knownUnknowns, fingerprint: validation.fingerprint });
} else if (command === 'actions') {
  const { map, validation } = loadAndValidate(positional[0]);
  if (!validation.valid) {
    for (const error of validation.errors) console.error(`ERROR ${error}`);
    process.exitCode = 1;
  } else print({ site: map.site, actions: buildSitePatternActions(map), scope: 'Actions are review/remediation candidates derived from explicit site bindings, not ranking recommendations.' });
} else if (command === 'portfolio') {
  if (positional.length === 0) {
    console.error('Usage: node bin/arwp-patterns.mjs portfolio map1.json map2.json [--json] [--repo-root=.]');
    process.exitCode = 2;
  } else {
    const maps = [];
    let invalid = false;
    for (const file of positional) {
      const { map, validation } = loadAndValidate(file);
      if (!validation.valid) {
        invalid = true;
        for (const error of validation.errors) console.error(`${file}: ${error}`);
      } else maps.push(map);
    }
    if (invalid) process.exitCode = 1;
    else print(summarizePatternPortfolio(maps));
  }
} else {
  console.error('Commands: check [map], summary [map], actions [map], portfolio <maps...>');
  process.exitCode = 2;
}
