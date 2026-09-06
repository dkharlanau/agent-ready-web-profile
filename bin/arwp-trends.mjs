#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { buildTrendRadar, findTrend, formatTrendRadar, loadTrendRegistry, validateTrendRegistry } from '../lib/trend-radar.mjs';
import { loadTrendWatchConfig } from '../lib/trend-source-watch.mjs';
import {
  buildTrendPromotionProposals,
  formatTrendPromotions,
  loadTrendPromotionBatch,
  reviewTrendPromotion
} from '../lib/trend-promotion.mjs';
import {
  buildTrendMeasurementEvidence,
  formatTrendMeasurementEvidence,
  loadGrowthExperimentsFromPath
} from '../lib/trend-measurement.mjs';

const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith('--') ? args[0] : 'list';
const subject = args[1] && !args[1].startsWith('--') ? args[1] : null;
const jsonOutput = args.includes('--json');

function optionValue(name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
}

function usage() {
  console.log(`ARWP Trend Radar\n\nUsage:\n  arwp-trends list [--stage=adopt,watch] [--provider=google] [--vertical=editorial] [--surface=ai-mode] [--since=90] [--exclude-retired] [--json]\n  arwp-trends show <trend-id> [--json]\n  arwp-trends check [--json]\n  arwp-trends propose <source-watch.json> [--output=proposals.json] [--json]\n  arwp-trends review <proposals.json> --id=<proposal-id> --decision=<approve|reject|defer> --reviewer=<name> [--note=text] [--output=reviewed.json] [--json]\n  arwp-trends measure <experiment.json|experiment-directory> [--output=trend-measurement.json] [--json]\n\nWATCH -> ADOPT and ADOPT -> MEASURED are explicit evidence/review workflows. Neither command silently mutates registry/trends.json. MEASURED means longitudinal evidence exists, not that an observed effect was positive or causal.\n`);
}

function parseSince() {
  const raw = optionValue('since');
  if (raw == null) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid --since value: ${raw}`);
  return value;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function writeJson(value, output) {
  const absolute = path.resolve(output);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return absolute;
}

async function main() {
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    return 0;
  }
  const registry = loadTrendRegistry();
  if (command === 'check') {
    const result = validateTrendRegistry(registry);
    if (jsonOutput) console.log(JSON.stringify(result, null, 2));
    else if (result.valid) console.log(`PASS Trend Radar registry (${registry.trends.length} trends)`);
    else for (const error of result.errors) console.error(`FAIL ${error}`);
    return result.valid ? 0 : 1;
  }
  if (command === 'show') {
    if (!subject) throw new Error('A trend id is required.');
    const trend = findTrend(subject, registry);
    if (!trend) throw new Error(`Unknown trend: ${subject}`);
    if (jsonOutput) console.log(JSON.stringify(trend, null, 2));
    else {
      const radar = buildTrendRadar({ ...registry, trends: [trend] });
      console.log(formatTrendRadar(radar));
    }
    return 0;
  }
  if (command === 'propose') {
    if (!subject) throw new Error('propose requires a Trend source-watch JSON report.');
    const batch = buildTrendPromotionProposals(readJson(subject), registry, loadTrendWatchConfig());
    const output = optionValue('output');
    const written = output ? writeJson(batch, output) : null;
    if (jsonOutput) console.log(JSON.stringify({ batch, written }, null, 2));
    else {
      if (written) console.log(`WROTE ${written}`);
      console.log(formatTrendPromotions(batch));
    }
    return 0;
  }
  if (command === 'review') {
    if (!subject) throw new Error('review requires a Trend promotion proposal JSON file.');
    const id = optionValue('id');
    const decision = optionValue('decision');
    const reviewer = optionValue('reviewer');
    if (!id || !decision || !reviewer) throw new Error('review requires --id, --decision and --reviewer.');
    const reviewed = reviewTrendPromotion(loadTrendPromotionBatch(subject), id, decision, {
      reviewer,
      note: optionValue('note')
    });
    const output = optionValue('output');
    const written = output ? writeJson(reviewed, output) : null;
    if (jsonOutput) console.log(JSON.stringify({ batch: reviewed, written }, null, 2));
    else {
      if (written) console.log(`WROTE ${written}`);
      console.log(formatTrendPromotions(reviewed));
    }
    return 0;
  }
  if (command === 'measure') {
    if (!subject) throw new Error('measure requires a Growth experiment JSON file or directory.');
    const loaded = loadGrowthExperimentsFromPath(subject);
    const report = buildTrendMeasurementEvidence(loaded.experiments, registry);
    const output = optionValue('output');
    const written = output ? writeJson(report, output) : null;
    if (jsonOutput) console.log(JSON.stringify({ report, files: loaded.files, written }, null, 2));
    else {
      if (written) console.log(`WROTE ${written}`);
      console.log(`Loaded experiment files: ${loaded.files.length}`);
      console.log(formatTrendMeasurementEvidence(report));
    }
    return 0;
  }
  if (command !== 'list') throw new Error(`Unknown command: ${command}`);
  const radar = buildTrendRadar(registry, {
    stage: optionValue('stage'),
    provider: optionValue('provider'),
    vertical: optionValue('vertical'),
    surface: optionValue('surface'),
    sinceDays: parseSince(),
    includeRetired: !args.includes('--exclude-retired')
  });
  if (jsonOutput) console.log(JSON.stringify(radar, null, 2));
  else console.log(formatTrendRadar(radar));
  return 0;
}

main().then(code => {
  if (Number.isInteger(code)) process.exitCode = code;
}).catch(error => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
