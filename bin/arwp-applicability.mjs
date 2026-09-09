#!/usr/bin/env node
import fs from 'node:fs';
import { buildApplicabilityGapReport, buildArchetypePatternPlan, buildPlanFromSitePatternContext, loadApplicabilityRuntime, validatePatternApplicabilityRegistry, validateSitePatternContext } from '../lib/pattern-applicability.mjs';

const args = process.argv.slice(2);
const command = args[0] ?? 'check';
const json = args.includes('--json');
const archetypeArg = args.find(arg => arg.startsWith('--archetype='));
const facetsArg = args.find(arg => arg.startsWith('--facets='));
const archetype = archetypeArg?.slice('--archetype='.length);
const facets = facetsArg ? facetsArg.slice('--facets='.length).split(',').map(v => v.trim()).filter(Boolean) : [];
const positional = args.slice(1).filter(arg => !arg.startsWith('--'));
const runtime = loadApplicabilityRuntime(process.cwd());
const { registry, facetRegistry, blueprint, catalogs } = runtime;

const print = value => process.stdout.write(`${json ? JSON.stringify(value, null, 2) : typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);

if (command === 'check') {
  const result = validatePatternApplicabilityRegistry(registry, blueprint, catalogs, facetRegistry);
  if (json) print(result);
  else {
    console.log(`${result.valid ? 'PASS' : 'FAIL'} Pattern Applicability v${registry.version}`);
    for (const warning of result.warnings) console.log(`WARN ${warning}`);
    for (const error of result.errors) console.error(`ERROR ${error}`);
  }
  if (!result.valid) process.exitCode = 1;
} else if (command === 'list') {
  print({ version: registry.version, profiles: registry.profiles.map(profile => ({ id: profile.id, label: blueprint.siteKinds[profile.blueprintKind]?.label, matchTags: profile.matchTags })), facets: facetRegistry.facets.map(row => ({ id: row.id, label: row.label, tags: row.tags })) });
} else if (command === 'plan') {
  if (!archetype) {
    console.error('Usage: node bin/arwp-applicability.mjs plan --archetype=<id> [--facets=a,b] [--json]');
    process.exitCode = 2;
  } else print(buildArchetypePatternPlan({ archetype, facets, registry, facetRegistry, blueprint, catalogs }));
} else if (command === 'gaps') {
  print(buildApplicabilityGapReport(registry, catalogs, facetRegistry));
} else if (command === 'context') {
  if (!positional[0]) {
    console.error('Usage: node bin/arwp-applicability.mjs context <pattern-context.json> [--json]');
    process.exitCode = 2;
  } else {
    const context = JSON.parse(fs.readFileSync(positional[0], 'utf8'));
    const validation = validateSitePatternContext(context, runtime);
    if (!validation.valid) {
      if (json) print(validation); else for (const error of validation.errors) console.error(`ERROR ${error}`);
      process.exitCode = 1;
    } else print({ validation, ...buildPlanFromSitePatternContext(context, runtime) });
  }
} else {
  console.error('Commands: check | list | plan --archetype=<id> [--facets=a,b] | gaps | context <file>');
  process.exitCode = 2;
}
