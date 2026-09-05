#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  createAiSearchProfileStarter,
  formatAiSearchProfilePlan,
  loadAiSearchProfile,
  validateAiSearchProfile
} from '../lib/ai-search-profile.mjs';

function usage() {
  console.log(`ARWP AI Search & Citation Profile

Usage:
  arwp-ai-search init <https://site.example/> [--name=<name>] [--languages=en,de,ru] [--output=ai/ai-search-profile.json] [--force]
  arwp-ai-search validate <ai-search-profile.json> [--json]
  arwp-ai-search plan <ai-search-profile.json> [--json]

The profile is a non-normative implementation plan. It does not produce an AI-readiness score or claim ranking gains.`);
}

const args = process.argv.slice(2);
const command = args[0];
const source = args[1];
const jsonOutput = args.includes('--json');

function optionValue(name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
}

function formatError(error) {
  const location = error.instancePath || '/';
  return `${location} ${error.message}`;
}

function writeProfile(profile, output) {
  const resolved = path.resolve(output);
  if (fs.existsSync(resolved) && !args.includes('--force')) {
    throw new Error(`Refusing to overwrite existing file: ${resolved}. Use --force to replace it.`);
  }
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
  return resolved;
}

function main() {
  if (!command || command === '--help' || command === '-h') {
    usage();
    return 0;
  }

  if (command === 'init') {
    if (!source) throw new Error('init requires a canonical HTTPS website URL.');
    const languages = String(optionValue('languages') || 'en').split(',').map(value => value.trim()).filter(Boolean);
    const profile = createAiSearchProfileStarter(source, {
      name: optionValue('name') || undefined,
      languages,
      canonicalLanguage: languages[0] || 'en'
    });
    const output = optionValue('output') || path.join('ai', 'ai-search-profile.json');
    const written = writeProfile(profile, output);
    if (jsonOutput) console.log(JSON.stringify({ written, profile }, null, 2));
    else {
      console.log(`WROTE ${written}`);
      console.log(formatAiSearchProfilePlan(profile));
    }
    return 0;
  }

  if (!['validate', 'plan'].includes(command) || !source) {
    usage();
    return 2;
  }

  const profile = loadAiSearchProfile(source);
  const validation = validateAiSearchProfile(profile);

  if (command === 'validate') {
    if (jsonOutput) console.log(JSON.stringify(validation, null, 2));
    else if (validation.valid) {
      console.log(`PASS ${source}`);
      for (const warning of validation.warnings) console.warn(`WARN ${warning}`);
    } else {
      console.error(`FAIL ${source}`);
      for (const error of validation.errors) console.error(`  ${formatError(error)}`);
      for (const warning of validation.warnings) console.warn(`WARN ${warning}`);
    }
    return validation.valid ? 0 : 1;
  }

  if (jsonOutput) {
    const { planAiSearchProfile } = await import('../lib/ai-search-profile.mjs');
    console.log(JSON.stringify(planAiSearchProfile(profile), null, 2));
  } else console.log(formatAiSearchProfilePlan(profile));
  return validation.valid ? 0 : 1;
}

try {
  const exitCode = await main();
  if (Number.isInteger(exitCode)) process.exit(exitCode);
} catch (error) {
  if (jsonOutput) console.log(JSON.stringify({ valid: false, fatal: String(error.message ?? error) }, null, 2));
  else console.error(`ERROR ${error.message ?? error}`);
  process.exit(2);
}
