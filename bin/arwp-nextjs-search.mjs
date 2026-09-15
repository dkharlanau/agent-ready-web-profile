#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { compileNextjsSearchPack, formatNextjsSearchPackReport } from '../lib/nextjs-search-pack.mjs';

function usage() {
  console.log(`Usage:
  arwp-nextjs-search check --root=<repo> --repository=<owner/name> --site=<https://site/> [--site-root=.] [--base-path=/] [--base-ref=main] [--base-sha=<sha>] [--artifact=<out>] [--json] [--output=<file>]

The command is read-only. It does not execute Next.js or target repository code.
Use --artifact only for an already-produced final static export directory.`);
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
  if (!args.root) throw new Error('--root is required');
  if (!args.repository) throw new Error('--repository is required');
  if (!args.site) throw new Error('--site is required');
  const siteUrl = new URL(args.site);
  const basePath = args['base-path'] || siteUrl.pathname || '/';
  const report = compileNextjsSearchPack({
    root: args.root,
    siteRoot: args['site-root'] || '.',
    repository: {
      fullName: args.repository,
      baseRef: args['base-ref'] || 'main',
      baseCommitSha: args['base-sha'] || null,
      siteRoot: args['site-root'] || '.'
    },
    site: { origin: siteUrl.origin, basePath },
    artifactRoot: args.artifact || null,
    artifactSite: siteUrl.href,
    sourceSha: args['base-sha'] || null
  });
  const text = args.json ? `${JSON.stringify(report, null, 2)}\n` : `${formatNextjsSearchPackReport(report)}\n`;
  writeOutput(args.output, text);
  process.stdout.write(text);
  process.exit(report.pass ? 0 : 1);
} catch (error) {
  console.error(`ERROR ${error?.message || error}`);
  process.exit(1);
}
