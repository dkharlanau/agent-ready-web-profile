#!/usr/bin/env node
import fs from 'node:fs';
import {
  buildSearchAppearancePatchManifest,
  formatSearchAppearancePatchManifest,
  validateSearchAppearancePatchManifest
} from '../lib/search-appearance-patch.mjs';

const usage = `Usage:
  node bin/arwp-search-appearance-patch.mjs build <appearance.json> <site-state.json> [--output=patch.json] [--text]
  node bin/arwp-search-appearance-patch.mjs validate <patch.json>

Build maps Search Appearance findings to proven repository ownership. It never edits the target repository.`;

function readJson(file, label) {
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error(`${label} must be a regular local JSON file.`);
  if (stat.size > 5 * 1024 * 1024) throw new Error(`${label} exceeds the 5 MiB input limit.`);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file)));
}

try {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) { console.log(usage); process.exit(args.includes('--help') ? 0 : 2); }
  const command = args.shift();
  if (command === 'validate') {
    if (args.length !== 1 || args[0].startsWith('--')) throw new Error(usage);
    const manifest = readJson(args[0], 'Patch manifest');
    const result = validateSearchAppearancePatchManifest(manifest);
    if (!result.valid) {
      console.error(result.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('\n'));
      process.exitCode = 1;
    } else console.log(`PASS Search Appearance patch manifest v${manifest.version}: ${manifest.operations.length} operation(s)`);
  } else if (command === 'build') {
    const positionals = [];
    const options = new Map();
    for (const arg of args) {
      if (arg === '--text') {
        if (options.has('text')) throw new Error('Duplicate --text.');
        options.set('text', true);
      } else if (arg.startsWith('--')) {
        const match = arg.match(/^--output=(.+)$/);
        if (!match || options.has('output')) throw new Error(`Unknown, empty or duplicate option: ${arg.split('=')[0]}`);
        options.set('output', match[1]);
      } else positionals.push(arg);
    }
    if (positionals.length !== 2) throw new Error(usage);
    const report = readJson(positionals[0], 'Search Appearance report');
    const graph = readJson(positionals[1], 'Site State Graph');
    const manifest = buildSearchAppearancePatchManifest(report, graph);
    const body = options.has('text') ? `${formatSearchAppearancePatchManifest(manifest)}\n` : `${JSON.stringify(manifest, null, 2)}\n`;
    if (options.has('output')) fs.writeFileSync(options.get('output'), body, { encoding: 'utf8', flag: 'wx' });
    else process.stdout.write(body);
  } else throw new Error(usage);
} catch (error) {
  console.error(`arwp-search-appearance-patch: ${error.message}`);
  process.exitCode = 2;
}
