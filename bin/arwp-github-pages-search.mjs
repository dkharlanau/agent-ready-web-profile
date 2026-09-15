#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { compileGithubPagesSearchPack, formatGithubPagesSearchPackReport } from '../lib/github-pages-search-pack.mjs';

function usage() {
  console.log(`Usage:
  arwp-github-pages-search check --root=<repo> --repository=<owner/name> --site=<https://site/> [--publishing-mode=branch|github-actions|unknown] [--pages-source=.|docs] [--artifact=<dir>] [--source-sha=<sha>] [--json] [--output=<file>]

The command is read-only and does not deploy or change GitHub Pages settings.
CNAME is treated as source evidence only; exact deployment SHA and live parity belong to Production Search Build Gate.`);
}
function parse(argv) {
  const options = { command: null, json: false };
  for (const arg of argv) {
    if (!options.command && !arg.startsWith('-')) { options.command = arg; continue; }
    if (arg === '--json') { options.json = true; continue; }
    if (arg === '--help' || arg === '-h') { options.help = true; continue; }
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (!match) throw new Error(`Unknown argument: ${arg}`);
    options[match[1]] = match[2];
  }
  return options;
}
function writeOutput(file, content) {
  if (!file) return;
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  console.error(`WROTE ${target}`);
}

try {
  const args = parse(process.argv.slice(2));
  if (args.help || !args.command) { usage(); process.exit(0); }
  if (args.command !== 'check') throw new Error(`Unknown command: ${args.command}`);
  for (const name of ['root', 'repository', 'site']) if (!args[name]) throw new Error(`--${name} is required`);
  const report = compileGithubPagesSearchPack({
    root: args.root,
    repositoryFullName: args.repository,
    siteUrl: args.site,
    publishingMode: args['publishing-mode'] || 'unknown',
    pagesSource: args['pages-source'] || '.',
    artifactRoot: args.artifact || null,
    sourceSha: args['source-sha'] || null
  });
  const text = args.json ? `${JSON.stringify(report, null, 2)}\n` : `${formatGithubPagesSearchPackReport(report)}\n`;
  writeOutput(args.output, text);
  process.stdout.write(text);
  process.exit(report.pass ? 0 : 1);
} catch (error) {
  console.error(`ERROR ${error?.message || error}`);
  process.exit(1);
}
