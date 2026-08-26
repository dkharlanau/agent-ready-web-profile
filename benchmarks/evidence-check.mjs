import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runEvidenceChecks } from './evidence-checker.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpusDir = path.join(root, 'benchmarks', 'corpus');

function parseArgs(argv) {
  const options = { output: null, concurrency: 4, reviewMaxAgeDays: 90, strict: false };
  for (const arg of argv) {
    if (arg === '--strict') options.strict = true;
    else if (arg.startsWith('--output=')) options.output = arg.slice('--output='.length);
    else if (arg.startsWith('--concurrency=')) options.concurrency = Number(arg.slice('--concurrency='.length));
    else if (arg.startsWith('--review-max-age-days=')) options.reviewMaxAgeDays = Number(arg.slice('--review-max-age-days='.length));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function loadFixtures() {
  return fs.readdirSync(corpusDir)
    .filter(name => name.endsWith('.json') && name !== 'fixture.schema.json' && name !== 'example.fixture.json')
    .sort()
    .map(name => JSON.parse(fs.readFileSync(path.join(corpusDir, name), 'utf8')));
}

const options = parseArgs(process.argv.slice(2));
const report = await runEvidenceChecks(loadFixtures(), options);
const json = `${JSON.stringify(report, null, 2)}\n`;

if (options.output) {
  const target = path.resolve(options.output);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, json);
}

console.log(`Evidence liveness: ${report.totals.reachable}/${report.totals.targets} reachable; ${report.totals.unreachable} unreachable; ${report.totals.errors} errors; ${report.totals.redirected} redirected; ${report.totals.staleReviews} stale review(s).`);
for (const site of report.sites) {
  if (site.unreachable || site.errors || site.reviewStale) {
    console.log(`- ${site.id}: ${site.reachable}/${site.targets} reachable, ${site.unreachable} unreachable, ${site.errors} errors, review age ${site.reviewAgeDays ?? 'unknown'}d${site.reviewStale ? ' (stale)' : ''}`);
  }
}

if (options.strict && (report.totals.unreachable > 0 || report.totals.errors > 0 || report.totals.staleReviews > 0)) {
  process.exitCode = 2;
}
