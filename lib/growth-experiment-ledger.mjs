import fs from 'node:fs';
import path from 'node:path';
import { validateGrowthExperiment } from './growth-experiment.mjs';

export const DEFAULT_GROWTH_EXPERIMENT_DIR = '.arwp-evidence/growth/experiments';

function jsonFiles(root) {
  if (!fs.existsSync(root)) return [];
  const stat = fs.statSync(root);
  if (stat.isFile()) return root.toLowerCase().endsWith('.json') ? [root] : [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const child = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...jsonFiles(child));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) files.push(child);
  }
  return files.sort();
}

function attentionState(experiment) {
  if (experiment.status === 'planned') return 'awaiting-implementation';
  if (experiment.status === 'implemented') return 'awaiting-measurement';
  if (experiment.status === 'measured') return 'awaiting-review';
  if (experiment.status === 'reviewed') return 'reviewed';
  if (experiment.status === 'stopped') return 'stopped';
  return 'unknown';
}

function compact(experiment, file) {
  return {
    id: experiment.id,
    site: experiment.site,
    hypothesisId: experiment.hypothesisId,
    actionIds: [...experiment.actionIds],
    status: experiment.status,
    attention: attentionState(experiment),
    createdAt: experiment.createdAt,
    implementation: experiment.implementation || null,
    hasBeforeGrowth: Boolean(experiment.evidence?.beforeGrowth),
    hasAfterGrowth: Boolean(experiment.evidence?.afterGrowth),
    hasBeforeVisibility: Boolean(experiment.evidence?.beforeVisibility),
    hasAfterVisibility: Boolean(experiment.evidence?.afterVisibility),
    outcomeState: experiment.evaluation?.outcomeState || null,
    reviewDecision: experiment.review?.decision || null,
    file
  };
}

export function loadGrowthExperimentLedger(input = DEFAULT_GROWTH_EXPERIMENT_DIR, options = {}) {
  const root = path.resolve(input);
  const site = options.site || null;
  const files = jsonFiles(root);
  const experiments = [];
  const invalid = [];
  for (const file of files) {
    let payload;
    try {
      payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      invalid.push({ file, error: `invalid JSON: ${error.message}` });
      continue;
    }
    const records = Array.isArray(payload) ? payload : Array.isArray(payload?.experiments) ? payload.experiments : [payload];
    for (const record of records) {
      const validation = validateGrowthExperiment(record);
      if (!validation.valid) {
        invalid.push({
          file,
          id: record?.id || null,
          error: [...validation.semanticErrors, ...validation.errors.map(item => `${item.instancePath || '/'} ${item.message}`)].join('; ')
        });
        continue;
      }
      if (site && record.site !== site) continue;
      experiments.push(compact(record, path.relative(process.cwd(), file) || file));
    }
  }
  experiments.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.id.localeCompare(b.id));
  const byAttention = {};
  for (const item of experiments) byAttention[item.attention] = (byAttention[item.attention] || 0) + 1;
  const attention = experiments.filter(item => ['awaiting-implementation', 'awaiting-measurement', 'awaiting-review'].includes(item.attention));
  return {
    version: '0.1',
    root: path.relative(process.cwd(), root) || '.',
    site,
    summary: {
      total: experiments.length,
      awaitingImplementation: byAttention['awaiting-implementation'] || 0,
      awaitingMeasurement: byAttention['awaiting-measurement'] || 0,
      awaitingReview: byAttention['awaiting-review'] || 0,
      reviewed: byAttention.reviewed || 0,
      stopped: byAttention.stopped || 0,
      invalid: invalid.length,
      attentionRequired: attention.length
    },
    attention,
    experiments,
    invalid,
    convention: {
      defaultDirectory: DEFAULT_GROWTH_EXPERIMENT_DIR,
      note: 'Experiment files are ordinary versioned evidence records. ARWP reads this directory but never commits, deletes or rewrites target-repository evidence automatically.'
    }
  };
}

export function formatGrowthExperimentLedger(ledger) {
  const s = ledger.summary;
  const lines = [
    'ARWP Growth experiment ledger',
    `Directory: ${ledger.root}`,
    `Experiments: ${s.total}; attention: ${s.attentionRequired}; invalid: ${s.invalid}`,
    `Awaiting implementation: ${s.awaitingImplementation}; measurement: ${s.awaitingMeasurement}; review: ${s.awaitingReview}; reviewed: ${s.reviewed}; stopped: ${s.stopped}`,
    ''
  ];
  for (const item of ledger.attention) {
    lines.push(`${item.attention.toUpperCase()} ${item.id}`);
    lines.push(`  Hypothesis: ${item.hypothesisId}`);
    lines.push(`  Actions: ${item.actionIds.join(', ')}`);
    lines.push(`  File: ${item.file}`);
  }
  if (!ledger.attention.length) lines.push('No experiments currently require implementation, measurement or review.');
  if (ledger.invalid.length) {
    lines.push('', 'Invalid experiment records:');
    for (const item of ledger.invalid) lines.push(`- ${item.file}${item.id ? ` (${item.id})` : ''}: ${item.error}`);
  }
  return lines.join('\n');
}
