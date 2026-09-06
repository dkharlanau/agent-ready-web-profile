#!/usr/bin/env node
import fs from 'node:fs';
import { planSearchOpportunities, formatOpportunityPlan } from '../lib/search-opportunities.mjs';
const args = process.argv.slice(2);
const usage = `ARWP search opportunity planner (offline, review only)
Usage: node bin/arwp-opportunities.mjs <map.json> [--search-console=<export.json>] [--min-impressions=50] [--json] [--output=<new-file.json>]
No network or API key. No target-site writes. Output files must not already exist.
Read docs/SEARCH-OPPORTUNITIES.md for the joint query+page export contract.`;
function readJson(file) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > 5 * 1024 * 1024) throw new Error('Input must be a regular JSON file of at most 5 MiB');
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/u, '')); }
  catch { throw new Error('Input is not valid JSON'); }
}
function main() {
  if (!args.length || args[0] === '--help' || args[0] === '-h') { console.log(usage); return; }
  const [source, ...flags] = args;
  if (source.startsWith('-')) throw new Error('Expected a map filename');
  const options = new Map();
  for (const flag of flags) {
    if (flag === '--json') {
      if (options.has('json')) throw new Error('Duplicate option');
      options.set('json', true); continue;
    }
    const match = /^--(search-console|min-impressions|output)=(.+)$/u.exec(flag);
    if (!match || options.has(match[1])) throw new Error('Unknown, missing or duplicate option; use --help');
    options.set(match[1], match[2]);
  }
  const report = planSearchOpportunities(readJson(source), options.has('search-console') ? readJson(options.get('search-console')) : null,
    { minImpressions: options.has('min-impressions') ? Number(options.get('min-impressions')) : 50 });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.has('output')) fs.writeFileSync(options.get('output'), json, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  console.log(options.has('json') ? json.trimEnd() : formatOpportunityPlan(report));
}
try { main(); }
catch (error) {
  // Filesystem messages may contain private filenames. Do not echo those paths.
  const message = error.code ? `File operation failed (${error.code})` : error.message;
  console.error(`ERROR ${message}`); process.exitCode = 2;
}
