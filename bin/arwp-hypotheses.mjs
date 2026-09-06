#!/usr/bin/env node
import { buildGrowthHypothesisProgram, formatGrowthHypothesisProgram, loadGrowthHypotheses, validateGrowthHypotheses } from '../lib/growth-hypotheses.mjs';

function usage() {
  return `arwp-hypotheses — evidence-backed Search / recommendation growth hypotheses\n\nUsage:\n  node bin/arwp-hypotheses.mjs list [--vertical=general|documentation|editorial|software-product|commerce|local-business|research-dataset] [--evidence-class=platform-requirement,platform-guidance] [--confidence=high,medium] [--surface=google-discover] [--exclude-experiments] [--json]\n  node bin/arwp-hypotheses.mjs show <hypothesis-id> [--json]\n  node bin/arwp-hypotheses.mjs check [--json]\n\nThis tool makes assumptions, checks and success signals explicit. It does not predict ranking, citation or recommendation outcomes.\n`;
}
function optionValue(args, name) {
  const prefix = `--${name}=`;
  return args.find(arg => arg.startsWith(prefix))?.slice(prefix.length) || null;
}
function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) { process.stdout.write(usage()); return 0; }
  const command = args[0];
  const registry = loadGrowthHypotheses();
  const json = args.includes('--json');
  if (command === 'check') {
    const result = validateGrowthHypotheses(registry);
    if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else if (result.valid) process.stdout.write(`PASS Growth Hypotheses registry (${registry.hypotheses.length} hypotheses)\n`);
    else for (const error of result.errors) process.stderr.write(`FAIL ${error}\n`);
    return result.valid ? 0 : 2;
  }
  if (command === 'show') {
    const id = args[1];
    const item = registry.hypotheses.find(x => x.id === id);
    if (!item) throw new Error(`Unknown hypothesis: ${id || '(missing)'}`);
    process.stdout.write(json ? `${JSON.stringify(item, null, 2)}\n` : `${item.id}\n${item.title}\n${item.hypothesis}\nMeasure: ${item.successSignals.join('; ')}\n`);
    return 0;
  }
  if (command === 'list') {
    const program = buildGrowthHypothesisProgram(registry, {
      vertical: optionValue(args, 'vertical') || 'general',
      evidenceClass: optionValue(args, 'evidence-class'),
      confidence: optionValue(args, 'confidence'),
      surface: optionValue(args, 'surface'),
      includeExperiments: !args.includes('--exclude-experiments')
    });
    process.stdout.write(json ? `${JSON.stringify(program, null, 2)}\n` : `${formatGrowthHypothesisProgram(program)}\n`);
    return 0;
  }
  throw new Error(`Unknown command: ${command}`);
}
try { process.exitCode = main(); } catch (error) { process.stderr.write(`ERROR ${error?.message || String(error)}\n`); process.exitCode = 2; }
