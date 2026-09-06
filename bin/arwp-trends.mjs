#!/usr/bin/env node

import { buildTrendRadar, findTrend, formatTrendRadar, loadTrendRegistry, validateTrendRegistry } from '../lib/trend-radar.mjs';

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
  console.log(`ARWP Trend Radar\n\nUsage:\n  node bin/arwp-trends.mjs list [--stage=adopt,watch] [--provider=google] [--vertical=editorial] [--surface=ai-mode] [--since=90] [--exclude-retired] [--json]\n  node bin/arwp-trends.mjs show <trend-id> [--json]\n  node bin/arwp-trends.mjs check [--json]\n`);
}

function parseSince() {
  const raw = optionValue('since');
  if (raw == null) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid --since value: ${raw}`);
  return value;
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
