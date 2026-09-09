#!/usr/bin/env node
import { buildApplicabilityGapReport, buildArchetypePatternPlan, loadApplicabilityRuntime, validatePatternApplicabilityRegistry } from '../lib/pattern-applicability.mjs';

const args = process.argv.slice(2);
const command = args[0] ?? 'check';
const json = args.includes('--json');
const archetypeArg = args.find(arg => arg.startsWith('--archetype='));
const archetype = archetypeArg?.slice('--archetype='.length);
const { registry, blueprint, catalogs } = loadApplicabilityRuntime(process.cwd());

const print = value => process.stdout.write(`${json ? JSON.stringify(value, null, 2) : typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);

if (command === 'check') {
  const result = validatePatternApplicabilityRegistry(registry, blueprint, catalogs);
  if (json) print(result);
  else {
    console.log(`${result.valid ? 'PASS' : 'FAIL'} Pattern Applicability v${registry.version}`);
    for (const warning of result.warnings) console.log(`WARN ${warning}`);
    for (const error of result.errors) console.error(`ERROR ${error}`);
  }
  if (!result.valid) process.exitCode = 1;
} else if (command === 'list') {
  print({ version: registry.version, profiles: registry.profiles.map(profile => ({ id: profile.id, label: blueprint.siteKinds[profile.blueprintKind]?.label, matchTags: profile.matchTags })) });
} else if (command === 'plan') {
  if (!archetype) {
    console.error('Usage: node bin/arwp-applicability.mjs plan --archetype=<id> [--json]');
    process.exitCode = 2;
  } else print(buildArchetypePatternPlan({ archetype, registry, blueprint, catalogs }));
} else if (command === 'gaps') {
  print(buildApplicabilityGapReport(registry, catalogs));
} else {
  console.error('Commands: check | list | plan --archetype=<id> | gaps');
  process.exitCode = 2;
}
