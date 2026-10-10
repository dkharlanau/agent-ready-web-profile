#!/usr/bin/env node
import fs from 'node:fs';
import { technicalIntegrity } from '../lib/technical-integrity.mjs';
import { diagnoseSearchFailure, formatSearchFailureDiagnosis } from '../lib/search-failure-doctor.mjs';

const HELP = [
  'Goose Search Failure Doctor — one useful next check, not another SEO score',
  '',
  'Usage:',
  '  arwp search-doctor https://example.com/ --scan [--owner=PRIVATE.json] [--json]',
  '  arwp-search-doctor --technical=technical.json [--owner=PRIVATE.json] [--json]',
  '  arwp-search-doctor https://example.com/ [--json]',
  '',
  'Options:',
  '  --scan             Run the existing bounded public Technical Integrity audit (requires an HTTPS site)',
  '  --max-pages=N      Public pages to inspect with --scan, 1-20 (default 8)',
  '  --technical=FILE   Read an existing arwp technical-integrity --json report (up to 4 MiB)',
  '  --owner=FILE       Read optional LOCAL owner evidence (up to 1 MiB); never uploaded',
  '  --json             Emit a machine-readable diagnosis',
  '  --help             Show this help',
  '',
  'A site alone returns the first evidence-collection action, not a pretend live scan.',
  'The optional owner file must use the documented versioned contract.',
  'Observed owner counts are not independently verified and are never called causal uplift.'
].join('\n');

const args = process.argv.slice(2);
const options = args.filter(item => item.startsWith('--'));
const positions = args.filter(item => !item.startsWith('--'));
function option(name) {
  const matching = options.filter(item => item.startsWith('--' + name + '='));
  if (matching.length > 1) throw new Error('Duplicate option: --' + name);
  return matching[0]?.slice(name.length + 3) || null;
}
function positiveBoundedInt(value, label, max) {
  if (value === null) return Math.min(max, 8);
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new Error(label + ' must be an integer in 1-' + max + '.');
  return n;
}
function loadJson(filename, maxBytes) {
  const stat = fs.statSync(filename);
  if (!stat.isFile() || stat.size > maxBytes) throw new Error('Input must be a regular JSON file up to ' + maxBytes + ' bytes.');
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}
async function main() {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(HELP + '\n');
    return;
  }
  const supported = new Set(['--scan', '--json']);
  for (const arg of options) {
    if (!supported.has(arg) && !['--owner=', '--technical=', '--max-pages='].some(prefix => arg.startsWith(prefix))) {
      throw new Error('Unsupported option: ' + arg);
    }
  }
  if (positions.length > 1) throw new Error('Supply at most one site URL.');
  const site = positions[0] || null;
  const ownerFile = option('owner');
  const technicalFile = option('technical');
  const scan = args.includes('--scan');
  if (scan && technicalFile) throw new Error('Choose --scan or --technical, not both.');
  if (scan && !site) throw new Error('--scan requires an HTTPS site URL.');
  if (option('max-pages') && !scan) throw new Error('--max-pages requires --scan.');
  if (!site && !technicalFile && !ownerFile) throw new Error('Supply an HTTPS site, --technical or --owner.');
  const owner = ownerFile ? loadJson(ownerFile, 1024 * 1024) : null;
  let technical = technicalFile ? loadJson(technicalFile, 4 * 1024 * 1024) : null;
  if (scan) technical = await technicalIntegrity(site, {
    maxPages: positiveBoundedInt(option('max-pages'), '--max-pages', 20),
    concurrency: 2,
    timeoutMs: 8000
  });
  const result = diagnoseSearchFailure({site, technical, owner});
  process.stdout.write(args.includes('--json')
    ? JSON.stringify(result, null, 2) + '\n'
    : formatSearchFailureDiagnosis(result) + '\n');
}

try {
  await main();
} catch (error) {
  process.stderr.write('Search Failure Doctor: ' + (error?.message || String(error)) + '\n');
  process.exitCode = 1;
}
