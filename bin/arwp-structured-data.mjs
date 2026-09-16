#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  analyzeStructuredDataPages,
  analyzeStructuredDataUrl,
  formatStructuredDataReport
} from '../lib/structured-data-knowledge-graph.mjs';

function usage() {
  return `arwp-structured-data — Structured Data & Knowledge Graph audit

Usage:
  node bin/arwp-structured-data.mjs <https://site.example/page> [--json] [--output=FILE]
  node bin/arwp-structured-data.mjs --file=page.html [--url=https://site.example/page] [--json] [--output=FILE]

Checks:
  - JSON-LD parseability and typed entities;
  - stable reusable @id values;
  - ARWP core properties by entity family;
  - visible entity-name parity;
  - conflicting reuse of the same @id;
  - unresolved same-origin entity relations;
  - Organization, LocalBusiness/Place, Service, Product/ProductGroup/Offer,
    Dataset/DataCatalog/DataDownload, Article, Event, ImageObject and related graph families.

This command does not prove Search feature eligibility, indexing, ranking, Knowledge Panel inclusion or AI citation.
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

  const file = optionValue(args, 'file');
  let report;
  if (file) {
    const html = fs.readFileSync(path.resolve(file), 'utf8');
    const url = optionValue(args, 'url') || 'https://example.invalid/';
    report = analyzeStructuredDataPages([{ url, html }]);
  } else {
    const target = args.find(arg => !arg.startsWith('--'));
    if (!target) throw new Error('A public HTTPS URL or --file is required.');
    report = await analyzeStructuredDataUrl(target, {
      timeoutMs: positiveNumber(args, 'timeout', 8000),
      maxBytes: positiveNumber(args, 'max-bytes', 512 * 1024)
    });
  }

  const output = optionValue(args, 'output');
  if (output) process.stdout.write(`WROTE ${writeJson(output, report)}\n`);
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else process.stdout.write(`${formatStructuredDataReport(report)}\n`);

  return report.summary.gaps.P0 || report.summary.gaps.P1 ? 1 : 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(`ERROR ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
}
