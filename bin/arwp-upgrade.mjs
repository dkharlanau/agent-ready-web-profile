#!/usr/bin/env node
import fs from 'node:fs';
import {
  buildAdaptiveUpgradeGraph,
  compileAdaptiveUpgradeGraph,
  formatAdaptiveUpgradeGraph,
  loadAdaptiveUpgradeRegistry,
  simulateAdaptiveUpgrade,
  validateAdaptiveUpgradeGraph
} from '../lib/adaptive-upgrade.mjs';

function option(args, name) {
  const prefix = `--${name}=`;
  const found = args.find(arg => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function list(value) {
  return value ? value.split(',').map(item => item.trim()).filter(Boolean) : [];
}

function output(payload, args, formatted = null) {
  const target = option(args, 'output');
  if (target) {
    fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
    process.stdout.write(`${target}\n`);
    return;
  }
  if (args.includes('--json') || !formatted) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  else process.stdout.write(`${formatted}\n`);
}

function usage() {
  process.stdout.write(`ARWP Adaptive Site Upgrade\n\n` +
    `Commands:\n` +
    `  site <https://site/> [--vertical=general] [--goals=search,generative-search,ai-citations,measurement] [--json] [--output=file]\n` +
    `  compile <growth-plan.json> [--verticals=editorial,research-dataset] [--goals=...] [--json] [--output=file]\n` +
    `  simulate <upgrade-graph.json> --accept=id1,id2 [--json]\n` +
    `  validate <upgrade-graph.json>\n` +
    `  packs [--json]\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  if (!command || ['-h', '--help', 'help'].includes(command)) {
    usage();
    return 0;
  }

  if (command === 'packs') {
    const registry = loadAdaptiveUpgradeRegistry();
    if (args.includes('--json')) process.stdout.write(`${JSON.stringify(registry, null, 2)}\n`);
    else {
      process.stdout.write(`ARWP Adaptive Upgrade Intelligence ${registry.ruleset}\n`);
      for (const pack of registry.packs) process.stdout.write(`${pack.priority} ${pack.id} [${pack.change.automationClass}] ${pack.title}\n`);
    }
    return 0;
  }

  if (command === 'validate') {
    if (!args[1]) throw new Error('validate requires an upgrade graph JSON file.');
    const graph = JSON.parse(fs.readFileSync(args[1], 'utf8'));
    const result = validateAdaptiveUpgradeGraph(graph);
    if (!result.valid) {
      process.stderr.write(`${result.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('\n')}\n`);
      return 1;
    }
    process.stdout.write('valid\n');
    return 0;
  }

  if (command === 'compile') {
    if (!args[1]) throw new Error('compile requires a Growth plan JSON file.');
    const plan = JSON.parse(fs.readFileSync(args[1], 'utf8'));
    const verticals = list(option(args, 'verticals'));
    const goals = list(option(args, 'goals'));
    const graph = compileAdaptiveUpgradeGraph(plan, {
      ...(verticals.length ? { verticals } : {}),
      ...(goals.length ? { goals } : {})
    });
    output(graph, args, formatAdaptiveUpgradeGraph(graph));
    return 0;
  }

  if (command === 'site') {
    if (!args[1]) throw new Error('site requires an HTTPS URL.');
    const vertical = option(args, 'vertical') || 'general';
    const goals = list(option(args, 'goals'));
    const graph = await buildAdaptiveUpgradeGraph(args[1], {
      vertical,
      ...(goals.length ? { goals } : {})
    });
    output(graph, args, formatAdaptiveUpgradeGraph(graph));
    return 0;
  }

  if (command === 'simulate') {
    if (!args[1]) throw new Error('simulate requires an upgrade graph JSON file.');
    const graph = JSON.parse(fs.readFileSync(args[1], 'utf8'));
    const accepted = list(option(args, 'accept'));
    if (!accepted.length) throw new Error('simulate requires --accept=id1,id2.');
    const simulation = simulateAdaptiveUpgrade(graph, accepted);
    output(simulation, args, null);
    return 0;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().then(code => {
  if (code) process.exitCode = code;
}).catch(error => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
