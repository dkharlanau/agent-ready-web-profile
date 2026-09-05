#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  auditContentItem,
  createContentItemStarter,
  createContentProfileStarter,
  formatContentAudit,
  formatContentPlan,
  loadContentArchetypes,
  loadContentItem,
  loadContentProfile,
  validateContentItem,
  validateContentProfile
} from '../lib/content-profile.mjs';

function usage() {
  console.log(`ARWP Adaptive Content Profile

Usage:
  node bin/arwp-content.mjs init-profile <https://site.example/> [--name=<name>] [--languages=en,de,ru] [--output=ai/content-profile.json] [--force]
  node bin/arwp-content.mjs validate-profile <content-profile.json> [--json]
  node bin/arwp-content.mjs plan <format> [--json]
  node bin/arwp-content.mjs init-item <https://site.example/article> --format=<format> --title=<title> [--language=en] [--author=<name>] [--output=content-item.json] [--force]
  node bin/arwp-content.mjs validate-item <content-item.json> [--json]
  node bin/arwp-content.mjs audit <content-item.json> [--profile=ai/content-profile.json] [--json]

Formats are semantic archetypes, not visible heading templates. Style lint emits warnings only and does not ban phrases mechanically.`);
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

function writeJson(value, output) {
  const resolved = path.resolve(output);
  if (fs.existsSync(resolved) && !args.includes('--force')) {
    throw new Error(`Refusing to overwrite existing file: ${resolved}. Use --force to replace it.`);
  }
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return resolved;
}

function validationOutput(result, file) {
  if (jsonOutput) console.log(JSON.stringify(result, null, 2));
  else if (result.valid) {
    console.log(`PASS ${file}`);
    for (const warning of result.warnings || []) console.warn(`WARN ${warning}`);
  } else {
    console.error(`FAIL ${file}`);
    for (const error of result.errors || []) console.error(`  ${formatError(error)}`);
    for (const warning of result.warnings || []) console.warn(`WARN ${warning}`);
  }
  return result.valid ? 0 : 1;
}

function main() {
  if (!command || command === '--help' || command === '-h') {
    usage();
    return 0;
  }

  if (command === 'init-profile') {
    if (!source) throw new Error('init-profile requires a canonical HTTPS website URL.');
    const languages = String(optionValue('languages') || 'en').split(',').map(value => value.trim()).filter(Boolean);
    const profile = createContentProfileStarter(source, {
      name: optionValue('name') || undefined,
      languages,
      canonicalLanguage: languages[0] || 'en'
    });
    const written = writeJson(profile, optionValue('output') || path.join('ai', 'content-profile.json'));
    if (jsonOutput) console.log(JSON.stringify({ written, profile }, null, 2));
    else console.log(`WROTE ${written}`);
    return 0;
  }

  if (command === 'plan') {
    if (!source) throw new Error('plan requires a content format such as research, comparison, guide or analysis.');
    if (jsonOutput) {
      const registry = loadContentArchetypes();
      const archetype = registry.archetypes.find(item => item.id === source);
      if (!archetype) throw new Error(`Unknown content archetype: ${source}`);
      console.log(JSON.stringify(archetype, null, 2));
    } else console.log(formatContentPlan(source));
    return 0;
  }

  if (command === 'init-item') {
    if (!source) throw new Error('init-item requires a canonical HTTPS content URL.');
    const format = optionValue('format') || 'analysis';
    const title = optionValue('title') || 'Untitled content item';
    const item = createContentItemStarter(source, {
      title,
      archetype: format,
      language: optionValue('language') || 'en',
      author: optionValue('author') || 'Editorial team'
    });
    const written = writeJson(item, optionValue('output') || 'content-item.json');
    if (jsonOutput) console.log(JSON.stringify({ written, item }, null, 2));
    else {
      console.log(`WROTE ${written}`);
      console.log(formatContentPlan(format));
    }
    return 0;
  }

  if (command === 'validate-profile') {
    if (!source) throw new Error('validate-profile requires a profile path.');
    return validationOutput(validateContentProfile(loadContentProfile(source)), source);
  }

  if (command === 'validate-item') {
    if (!source) throw new Error('validate-item requires a content item path.');
    return validationOutput(validateContentItem(loadContentItem(source)), source);
  }

  if (command === 'audit') {
    if (!source) throw new Error('audit requires a content item path.');
    const item = loadContentItem(source);
    const profilePath = optionValue('profile');
    const profile = profilePath ? loadContentProfile(profilePath) : null;
    if (profile) {
      const profileValidation = validateContentProfile(profile);
      if (!profileValidation.valid) {
        if (jsonOutput) console.log(JSON.stringify({ valid: false, profileErrors: profileValidation.errors }, null, 2));
        else console.error(`FAIL invalid profile ${profilePath}`);
        return 1;
      }
    }
    const result = auditContentItem(item, profile);
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else console.log(formatContentAudit(result, item));
    return result.valid ? 0 : 1;
  }

  usage();
  return 2;
}

try {
  const exitCode = await main();
  if (Number.isInteger(exitCode)) process.exit(exitCode);
} catch (error) {
  if (jsonOutput) console.log(JSON.stringify({ valid: false, fatal: String(error.message ?? error) }, null, 2));
  else console.error(`ERROR ${error.message ?? error}`);
  process.exit(2);
}
