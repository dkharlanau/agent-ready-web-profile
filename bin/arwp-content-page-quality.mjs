#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  inspectContentPageDirectory,
  inspectContentPageQuality
} from '../lib/content-page-quality.mjs';

function usage() {
  console.log(`ARWP Content Page Quality

Usage:
  node bin/arwp-content-page-quality.mjs <file.html> --url=https://example.com/article/ [--strict] [--json]
  node bin/arwp-content-page-quality.mjs <build-dir> --base-url=https://example.com/ [--include=REGEX ... | --all-html] [--strict] [--json]
  node bin/arwp.mjs content-page-quality <same arguments>

Directory classification:
  By default, HTML is included only when it contains data-arwp-content-detail.
  --include=REGEX may be repeated to explicitly include matching relative paths or URLs.
  --all-html explicitly classifies every HTML file under the build root as content/detail.

Important:
  This command checks deterministic final HTML. Browser interaction, external share-provider behavior,
  Search/social preview selection and completed social sharing require separate runtime/provider evidence.`);
}

function parseArgs(argv) {
  const out = { includes: [], strict: false, json: false, allHtml: false, positional: [] };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--strict') out.strict = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--all-html') out.allHtml = true;
    else if (arg.startsWith('--url=')) out.url = arg.slice('--url='.length);
    else if (arg.startsWith('--base-url=')) out.baseUrl = arg.slice('--base-url='.length);
    else if (arg.startsWith('--include=')) out.includes.push(arg.slice('--include='.length));
    else if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
    else out.positional.push(arg);
  }
  return out;
}

function compileIncludes(values) {
  return values.map(value => {
    try {
      return new RegExp(value);
    } catch (error) {
      throw new Error(`Invalid --include regex ${JSON.stringify(value)}: ${error.message}`);
    }
  });
}

function relativeFromRoot(file, root) {
  return path.relative(path.resolve(root), path.resolve(file)).split(path.sep).join('/');
}

function formatCheck(item) {
  const icon = item.status === 'pass' ? 'PASS' : item.status === 'fail' ? 'FAIL' : item.status.toUpperCase();
  return `${icon.padEnd(14)} ${item.priority} ${item.id} — ${item.message}`;
}

function printPage(report) {
  console.log(`\n${report.url}`);
  for (const item of report.checks) console.log(formatCheck(item));
  console.log(`Summary: P0 failures=${report.summary.p0Failures}, P1 failures=${report.summary.p1Failures}, static strict=${report.summary.strictPass ? 'PASS' : 'FAIL'}`);
}

function strictFailed(report) {
  if (report.familyGate) return !report.familyGate.strictPass;
  return !report.summary.strictPass;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.positional.length === 0) {
    usage();
    process.exit(args.help ? 0 : 2);
  }
  if (args.positional.length !== 1) throw new Error('Provide exactly one HTML file or build directory.');

  const target = path.resolve(args.positional[0]);
  if (!fs.existsSync(target)) throw new Error(`Target does not exist: ${target}`);

  let report;
  if (fs.statSync(target).isFile()) {
    if (!args.url) throw new Error('Single-file inspection requires --url=<canonical page URL>.');
    report = inspectContentPageQuality({ html: fs.readFileSync(target, 'utf8'), url: args.url });
  } else if (fs.statSync(target).isDirectory()) {
    if (!args.baseUrl) throw new Error('Directory inspection requires --base-url=<canonical site root>.');
    const includes = compileIncludes(args.includes);
    report = inspectContentPageDirectory({
      root: target,
      baseUrl: args.baseUrl,
      include(file, url, html) {
        if (args.allHtml) return true;
        if (/\bdata-arwp-content-detail(?:\s*=|\s|>)/i.test(html)) return true;
        const relative = relativeFromRoot(file, target);
        return includes.some(pattern => pattern.test(relative) || pattern.test(url));
      }
    });
  } else {
    throw new Error('Target must be an HTML file or build directory.');
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.pages) {
    console.log(`Content Page Quality family gate: ${report.auditedContentPages}/${report.discoveredHtmlFiles} HTML file(s) classified as content/detail.`);
    for (const page of report.pages) printPage(page.report);
    console.log(`\nFamily summary: P0 failures=${report.familyGate.p0Failures}, P1 failures=${report.familyGate.p1Failures}, deterministic strict=${report.familyGate.strictPass ? 'PASS' : 'FAIL'}`);
    console.log('Runtime evidence remains required for each distinct Share/Copy/provider implementation.');
  } else {
    printPage(report);
    console.log('Single-page static inspection does not prove family-wide coverage or runtime share behavior.');
  }

  if (args.strict && strictFailed(report)) process.exitCode = 1;
}

main().catch(error => {
  console.error(`Content Page Quality error: ${error.message}`);
  process.exitCode = 2;
});
