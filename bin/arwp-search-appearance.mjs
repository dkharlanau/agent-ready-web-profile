#!/usr/bin/env node
import fs from 'node:fs';
import { inspectSearchAppearance, MAX_HTML_BYTES } from '../lib/search-appearance.mjs';

const usage = 'Usage: node bin/arwp-search-appearance.mjs <built-page.html> --url=https://example.com/ [--strict] [--output=report.json]\nOffline HTML inspection. --strict fails only on review/fail findings, not unknown or absent declarations.';
try {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log(usage); process.exit(0); }
  const options = new Map();
  let file;
  for (const arg of args) {
    if (arg === '--strict') {
      if (options.has('strict')) throw new Error('Duplicate --strict.');
      options.set('strict', true);
    } else if (arg.startsWith('--')) {
      const match = arg.match(/^--(url|output)=(.+)$/);
      if (!match || options.has(match[1])) throw new Error(`Unknown, empty or duplicate option: ${arg.split('=')[0]}`);
      options.set(match[1], match[2]);
    } else if (!file) file = arg;
    else throw new Error('Only one local HTML file is accepted.');
  }
  if (!file || !options.has('url')) throw new Error(usage);
  const descriptor = fs.openSync(file, 'r');
  let buffer;
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile()) throw new Error('Input must be a regular local HTML file.');
    if (stat.size > MAX_HTML_BYTES) throw new Error('HTML exceeds the 1 MiB inspection limit.');
    // Bounded read even if the file grows between stat and read.
    buffer = Buffer.alloc(MAX_HTML_BYTES + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const count = fs.readSync(descriptor, buffer, offset, buffer.length - offset, null);
      if (!count) break;
      offset += count;
    }
    if (offset > MAX_HTML_BYTES) throw new Error('HTML exceeds the 1 MiB inspection limit.');
    buffer = buffer.subarray(0, offset);
  } finally { fs.closeSync(descriptor); }
  const html = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  const report = inspectSearchAppearance({ html, url: options.get('url') });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.has('output')) {
    // Never overwrite an input, existing report or symlink target implicitly.
    fs.writeFileSync(options.get('output'), json, { encoding: 'utf8', flag: 'wx' });
  } else process.stdout.write(json);
  if (options.has('strict') && report.checks.some(check => ['fail', 'review'].includes(check.status))) process.exitCode = 1;
} catch (error) {
  console.error(`arwp-search-appearance: ${error.message}`);
  process.exitCode = 2;
}
