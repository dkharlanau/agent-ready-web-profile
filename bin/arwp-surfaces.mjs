#!/usr/bin/env node
import fs from 'node:fs';
import { analyzeSearchSurfaceSite, formatSearchSurfaceReport, SEARCH_SURFACE_RULESET } from '../lib/search-surface.mjs';

function usage() {
  return `ARWP Search Surface Blueprint ${SEARCH_SURFACE_RULESET}\n\nUsage:\n  arwp-surfaces <https://site.example/> [options]\n\nOptions:\n  --kind=<kind>        auto, software-product, service-business, editorial-news,\n                       documentation-research, ecommerce, portfolio, local-business\n  --max-pages=<n>      Bounded page sample, 1..50 (default 20)\n  --json               Print JSON report\n  --output=<path>      Write JSON report to a file\n  --help               Show this help\n\nThe report is conditional and evidence-oriented. Missing optional surfaces are not SEO failures,\nand the tool does not produce a universal readiness or ranking score.`;
}

const args = process.argv.slice(2);
if (!args.length || args.includes('--help') || args.includes('-h')) {
  console.log(usage());
  process.exit(args.length ? 0 : 1);
}
const input = args.find(value => !value.startsWith('-'));
if (!input) throw new Error('A public HTTPS URL is required.');
const value = name => args.find(arg => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const maxPages = value('--max-pages') ? Number(value('--max-pages')) : 20;
const kind = value('--kind') || 'auto';
const report = await analyzeSearchSurfaceSite(input, { kind, maxPages });
const output = value('--output');
if (output) fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
else if (output) console.log(`Wrote ${output}`);
else console.log(formatSearchSurfaceReport(report));
