#!/usr/bin/env node
import {
  evaluateRegionalSearchSurfaces,
  formatRegionalSearchSurfaceReport,
  listRegionalQueryTypes,
  loadRegionalSearchSurfaces,
  validateRegionalSearchSurfaces
} from '../lib/regional-search-surfaces.mjs';

function usage() {
  console.log(`ARWP Regional Search Surface Review

Usage:
  node bin/arwp-regional-search.mjs --market=eea --query=products
  node bin/arwp-regional-search.mjs --market=turkiye --query=hotels,local-businesses --role=aggregator --json
  node bin/arwp-regional-search.mjs --check
  node bin/arwp-regional-search.mjs --list

Markets:
  eea | turkiye | south-africa | other

This command maps current provider-documented regional Search experiences. It does not produce a ranking score or guarantee feature placement.`);
}

const args = process.argv.slice(2);
const has = name => args.includes(`--${name}`);
const value = name => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;

if (has('help') || has('h')) {
  usage();
  process.exit(0);
}

const registry = loadRegionalSearchSurfaces();
if (has('check')) {
  const result = validateRegionalSearchSurfaces(registry);
  if (has('json')) console.log(JSON.stringify(result, null, 2));
  else console.log(result.valid ? `PASS regional Search registry v${registry.version} (${registry.features.length} feature records)` : `FAIL ${result.errors.join('; ')}`);
  process.exit(result.valid ? 0 : 2);
}

if (has('list')) {
  const result = {
    markets: registry.markets,
    queryTypes: listRegionalQueryTypes(registry),
    featureCount: registry.features.length,
    source: registry.source,
    reviewedAt: registry.reviewedAt
  };
  if (has('json')) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Markets: ${result.markets.map(item => item.id).join(', ')}`);
    console.log(`Query types: ${result.queryTypes.join(', ')}`);
    console.log(`Feature records: ${result.featureCount}`);
    console.log(`Source: ${result.source}`);
  }
  process.exit(0);
}

const market = value('market');
const query = value('query') || value('vertical');
const role = value('role');
if (!market || !query) {
  usage();
  process.exit(2);
}

const result = evaluateRegionalSearchSurfaces({ market, queryTypes: query, roles: role || [] }, registry);
if (has('json')) console.log(JSON.stringify(result, null, 2));
else console.log(formatRegionalSearchSurfaceReport(result));
process.exit(result.valid ? 0 : 2);
