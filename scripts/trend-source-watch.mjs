import fs from 'node:fs';
import path from 'node:path';
import { runTrendSourceWatch } from '../lib/trend-source-watch.mjs';

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const outputArg = args.find(arg => arg.startsWith('--output='));
const output = outputArg ? outputArg.slice('--output='.length) : null;
const timeoutArg = args.find(arg => arg.startsWith('--timeout='));
const timeoutMs = Number(timeoutArg ? timeoutArg.slice('--timeout='.length) : 15000);

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('timeout must be a positive number');

const report = await runTrendSourceWatch(undefined, { timeoutMs });

if (output) {
  const resolved = path.resolve(output);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

if (jsonOutput || !output) console.log(JSON.stringify(report, null, 2));
else console.log(`Trend Radar source watch: ${report.summary.candidates} candidate(s), ${report.summary.failed} failed source(s). Wrote ${output}`);

if (report.summary.failed > 0 && args.includes('--strict-http')) process.exitCode = 1;
