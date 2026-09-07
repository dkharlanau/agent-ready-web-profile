#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { analyzeEntityGraphSite, formatEntityGapReport } from '../lib/entity-gap.mjs';

function usage() {
  return `arwp-entities — bounded Entity Graph Gap Report

Usage:
  node bin/arwp-entities.mjs <https://site.example> [--json] [--output=FILE] [--max-pages=N] [--timeout=MS] [--max-bytes=N]

What it does:
  - samples a bounded set of same-site HTML pages from internal links and sitemap URLs;
  - extracts observed JSON-LD entities such as Person, Organization, Product, SoftwareApplication,
    Service, Dataset, Event, DefinedTerm and Article-family nodes;
  - checks stable @id reuse, visible-page grounding, entity-page coverage, relations and
    family-specific evidence such as Service.provider, Dataset.license/creator and Article.author;
  - emits explicit P0/P1/P2/P3 gaps without producing a ranking, rich-result or AI-citation score.

Examples:
  node bin/arwp-entities.mjs https://example.com
  node bin/arwp-entities.mjs https://example.com --max-pages=20 --json
  node bin/arwp-entities.mjs https://example.com --output=entity-gap-report.json
`;
}

function optionValue(args, name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
}

function positiveNumber(args, name, fallback) {
  const raw = optionValue(args, name);
  if (raw == null) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid --${name}: ${raw}`);
  return value;
}

function positiveInteger(args, name, fallback, max = Number.MAX_SAFE_INTEGER) {
  const value = positiveNumber(args, name, fallback);
  if (!Number.isInteger(value) || value > max) throw new Error(`--${name} must be an integer <= ${max}.`);
  return value;
}

function writeJson(file, value) {
  const resolved = path.resolve(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return resolved;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(usage());
    return 0;
  }
  const target = args.find(arg => !arg.startsWith('--'));
  if (!target) throw new Error('A public HTTPS website URL is required.');

  const report = await analyzeEntityGraphSite(target, {
    timeoutMs: positiveNumber(args, 'timeout', 8000),
    maxBytes: positiveNumber(args, 'max-bytes', 256 * 1024),
    maxPages: positiveInteger(args, 'max-pages', 12, 50)
  });

  const output = optionValue(args, 'output');
  if (output) {
    const written = writeJson(output, report);
    process.stdout.write(`WROTE ${written}\n`);
  }
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else process.stdout.write(`${formatEntityGapReport(report)}\n`);

  return report.summary.gaps.P0 || report.summary.gaps.P1 ? 1 : 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(`ERROR ${error?.message || String(error)}\n`);
  process.exitCode = 2;
}
