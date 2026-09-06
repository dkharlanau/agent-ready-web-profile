import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const registryPath = path.join(root, 'registry', 'growth-hypotheses.json');
const EVIDENCE_CLASSES = new Set(['platform-requirement', 'platform-guidance', 'platform-feature', 'platform-measurement', 'project-experiment']);
const CONFIDENCE = new Set(['high', 'medium', 'experimental']);
const CHECK_MODES = new Set(['automated', 'manual', 'configured', 'owner-data', 'runtime']);

export function loadGrowthHypotheses() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

export function validateGrowthHypotheses(registry = loadGrowthHypotheses()) {
  const errors = [];
  if (!registry || typeof registry !== 'object') return { valid: false, errors: ['registry must be an object'] };
  if (registry.version !== '0.1') errors.push(`unsupported registry version: ${registry.version}`);
  if (!Array.isArray(registry.hypotheses) || !registry.hypotheses.length) errors.push('hypotheses must be a non-empty array');
  const ids = new Set();
  for (const item of registry.hypotheses || []) {
    if (!item?.id || typeof item.id !== 'string') errors.push('every hypothesis requires a string id');
    else if (ids.has(item.id)) errors.push(`duplicate hypothesis id: ${item.id}`);
    else ids.add(item.id);
    if (!item?.title || !item?.hypothesis) errors.push(`${item?.id || 'unknown'}: title and hypothesis are required`);
    if (!EVIDENCE_CLASSES.has(item?.evidenceClass)) errors.push(`${item?.id || 'unknown'}: invalid evidenceClass ${item?.evidenceClass}`);
    if (!CONFIDENCE.has(item?.confidence)) errors.push(`${item?.id || 'unknown'}: invalid confidence ${item?.confidence}`);
    if (!Array.isArray(item?.appliesTo) || !item.appliesTo.length) errors.push(`${item?.id || 'unknown'}: appliesTo must be non-empty`);
    if (!Array.isArray(item?.targetSurfaces) || !item.targetSurfaces.length) errors.push(`${item?.id || 'unknown'}: targetSurfaces must be non-empty`);
    if (!Array.isArray(item?.checks) || !item.checks.length) errors.push(`${item?.id || 'unknown'}: checks must be non-empty`);
    for (const check of item?.checks || []) {
      if (!check?.id || !check?.expect) errors.push(`${item?.id || 'unknown'}: every check needs id and expect`);
      if (!CHECK_MODES.has(check?.mode)) errors.push(`${item?.id || 'unknown'}:${check?.id || 'unknown'} invalid check mode ${check?.mode}`);
    }
    if (!Array.isArray(item?.successSignals) || !item.successSignals.length) errors.push(`${item?.id || 'unknown'}: successSignals must be non-empty`);
    if (!Array.isArray(item?.sources) || !item.sources.length) errors.push(`${item?.id || 'unknown'}: sources must be non-empty`);
    for (const source of item?.sources || []) if (!/^https:\/\//i.test(String(source))) errors.push(`${item?.id || 'unknown'}: source must be public HTTPS: ${source}`);
  }
  return { valid: errors.length === 0, errors };
}

function matches(value, filter) {
  if (!filter) return true;
  return new Set(String(filter).split(',').map(x => x.trim()).filter(Boolean)).has(value);
}

function applies(item, vertical) {
  if (!vertical || vertical === 'general') return item.appliesTo.includes('all') || item.appliesTo.includes('general');
  return item.appliesTo.includes('all') || item.appliesTo.includes(vertical);
}

function summarize(items) {
  return items.reduce((acc, item) => {
    acc.total += 1;
    acc.byEvidenceClass[item.evidenceClass] = (acc.byEvidenceClass[item.evidenceClass] || 0) + 1;
    acc.byConfidence[item.confidence] = (acc.byConfidence[item.confidence] || 0) + 1;
    return acc;
  }, { total: 0, byEvidenceClass: {}, byConfidence: {} });
}

export function buildGrowthHypothesisProgram(registry = loadGrowthHypotheses(), options = {}) {
  const validation = validateGrowthHypotheses(registry);
  if (!validation.valid) throw new Error(`Invalid Growth Hypotheses registry:\n- ${validation.errors.join('\n- ')}`);
  const vertical = options.vertical || 'general';
  const hypotheses = registry.hypotheses.filter(item => {
    if (!applies(item, vertical)) return false;
    if (options.includeExperiments === false && item.evidenceClass === 'project-experiment') return false;
    if (!matches(item.evidenceClass, options.evidenceClass)) return false;
    if (!matches(item.confidence, options.confidence)) return false;
    if (options.surface && !item.targetSurfaces.includes(options.surface)) return false;
    return true;
  });
  return { version: registry.version, snapshot: registry.snapshot, reviewedAt: registry.reviewedAt, vertical, summary: summarize(hypotheses), hypotheses, guardrails: registry.principles };
}

export function compactHypothesesForGrowthPlan(plan, registry = loadGrowthHypotheses(), options = {}) {
  const program = buildGrowthHypothesisProgram(registry, options);
  const actionIds = new Set((plan?.actions || []).map(item => item.id));
  return {
    snapshot: program.snapshot,
    reviewedAt: program.reviewedAt,
    vertical: program.vertical,
    summary: program.summary,
    hypotheses: program.hypotheses.map(item => ({
      id: item.id,
      title: item.title,
      hypothesis: item.hypothesis,
      evidenceClass: item.evidenceClass,
      confidence: item.confidence,
      targetSurfaces: item.targetSurfaces,
      activeActionRefs: (item.actionRefs || []).filter(id => actionIds.has(id)),
      checkModes: [...new Set(item.checks.map(check => check.mode))],
      successSignals: item.successSignals,
      sources: item.sources
    })),
    note: 'Hypotheses explain why a change might matter and how to test it. An active action reference is not proof of causal impact.'
  };
}

export function formatGrowthHypothesisProgram(program) {
  const lines = [`ARWP Growth Hypotheses ${program.version}`, `Snapshot: ${program.snapshot}`, `Vertical: ${program.vertical}`, `Hypotheses: ${program.summary.total}`, ''];
  for (const item of program.hypotheses) {
    lines.push(`${item.id} [${item.evidenceClass}/${item.confidence}]`);
    lines.push(`  ${item.title}`);
    lines.push(`  ${item.hypothesis}`);
    lines.push(`  Checks: ${item.checks.map(check => `${check.id}:${check.mode}`).join(', ')}`);
    lines.push(`  Measure: ${item.successSignals.join('; ')}`);
  }
  return lines.join('\n');
}
