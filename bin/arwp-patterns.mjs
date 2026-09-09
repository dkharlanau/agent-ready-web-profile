#!/usr/bin/env node
import path from 'node:path';
import {
  buildPatternLearningSignals,
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
const repeatArg = args.find(arg => arg.startsWith('--min-repeat='));
const root = path.resolve(rootArg ? rootArg.slice('--repo-root='.length) : '.');
const minRepeat = repeatArg ? Number(repeatArg.slice('--min-repeat='.length)) : 2;

function loadAndValidate(file) {
  const mapPath = path.resolve(file ?? path.join(root, '.arwp/site-pattern-map.json'));
  const map = loadSitePatternMap(mapPath);
  const catalogs = loadSitePatternCatalogs(root, map);
  const validation = validateSitePatternMap(map, catalogs);
  return { map, mapPath, validation };
}

function loadPortfolio(files) {
  const maps = [];
  const errors = [];
  for (const file of files) {
    const { map, validation } = loadAndValidate(file);
    if (!validation.valid) for (const error of validation.errors) errors.push(`${file}: ${error}`);
    else maps.push(map);
  }
  return { maps, errors };
}

function print(value) {
  if (typeof value === 'string') console.log(value);
  else process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
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
} else if (command === 'portfolio' || command === 'learning') {
  if (positional.length === 0) {
    console.error(`Usage: node bin/arwp-patterns.mjs ${command} map1.json map2.json [--json] [--repo-root=.]${command === 'learning' ? ' [--min-repeat=2]' : ''}`);
    process.exitCode = 2;
  } else {
    const { maps, errors } = loadPortfolio(positional);
    if (errors.length) {
      for (const error of errors) console.error(error);
      process.exitCode = 1;
    } else if (command === 'portfolio') print(summarizePatternPortfolio(maps));
    else {
      try { print(buildPatternLearningSignals(maps, { minRepeat })); }
      catch (error) { console.error(error.message); process.exitCode = 2; }
    }
  }
} else {
  console.error('Commands: check [map], summary [map], actions [map], portfolio <maps...>, learning <maps...>');
  process.exitCode = 2;
}
