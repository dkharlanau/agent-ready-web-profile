import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateGrowthExperiment } from './growth-experiment.mjs';
import { loadTrendRegistry, validateTrendRegistry } from './trend-radar.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'trend-measurement-evidence.schema.json');

function createValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

export function validateTrendMeasurementEvidence(report) {
  const validate = createValidator();
  const valid = Boolean(validate(report));
  return { valid, errors: validate.errors || [] };
}

function iso(value = null) {
  const date = value == null ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date/time: ${value}`);
  return date.toISOString();
}

function walkJsonFiles(inputPath, out = []) {
  const absolute = path.resolve(inputPath);
  const stat = fs.statSync(absolute);
  if (stat.isFile()) {
    if (absolute.toLowerCase().endsWith('.json')) out.push(absolute);
    return out;
  }
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) walkJsonFiles(child, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) out.push(child);
  }
  return out;
}

function recordsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.experiments)) return payload.experiments;
  if (payload && typeof payload === 'object') return [payload];
  return [];
}

export function loadGrowthExperimentsFromPath(inputPath) {
  const files = walkJsonFiles(inputPath).sort();
  const experiments = [];
  for (const file of files) {
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const experiment of recordsFromPayload(payload)) experiments.push(experiment);
  }
  return { experiments, files };
}

function ownerEvidence(experiment) {
  return Boolean(
    experiment?.status === 'reviewed' &&
    experiment?.review &&
    experiment?.evaluation &&
    experiment?.evidence?.beforeVisibility &&
    experiment?.evidence?.afterVisibility &&
    Number(experiment?.evaluation?.visibility?.comparableMetrics || 0) > 0
  );
}

function outcomeCounters() {
  return { positive: 0, negative: 0, mixed: 0, noChange: 0, ownerEvidenceUnavailable: 0 };
}

function decisionCounters() {
  return { keep: 0, revise: 0, revert: 0, retire: 0, continueMeasuring: 0 };
}

function countOutcome(outcomes, state) {
  const key = {
    'positive-observation': 'positive',
    'negative-observation': 'negative',
    'mixed-observation': 'mixed',
    'no-change-observation': 'noChange',
    'owner-evidence-unavailable': 'ownerEvidenceUnavailable'
  }[state];
  if (key) outcomes[key] += 1;
}

function countDecision(decisions, decision) {
  const key = decision === 'continue-measuring' ? 'continueMeasuring' : decision;
  if (Object.prototype.hasOwnProperty.call(decisions, key)) decisions[key] += 1;
}

function eligibility(trend, ownerEvidenceExperiments) {
  if (trend.stage === 'retired') return 'retired';
  if (trend.stage === 'measured') return 'already-measured';
  if (trend.stage !== 'adopt') return 'not-adopted';
  if (!trend.actionRefs?.length) return 'no-linked-actions';
  return ownerEvidenceExperiments > 0 ? 'eligible-for-review' : 'insufficient-owner-evidence';
}

export function buildTrendMeasurementEvidence(experiments, registry = loadTrendRegistry(), options = {}) {
  const registryValidation = validateTrendRegistry(registry);
  if (!registryValidation.valid) throw new Error(`Invalid Trend Radar registry: ${registryValidation.errors.join('; ')}`);
  if (!Array.isArray(experiments)) throw new Error('experiments must be an array.');

  const validExperiments = experiments.map((experiment, index) => {
    const validation = validateGrowthExperiment(experiment);
    if (!validation.valid) {
      const details = [
        ...validation.semanticErrors,
        ...validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`)
      ].join('; ');
      throw new Error(`Invalid Growth experiment at index ${index}: ${details}`);
    }
    return experiment;
  });

  const trendRows = [];
  const proposals = [];
  for (const trend of registry.trends || []) {
    const actionSet = new Set(trend.actionRefs || []);
    const linked = actionSet.size
      ? validExperiments.filter(experiment => (experiment.actionIds || []).some(action => actionSet.has(action)))
      : [];
    const reviewed = linked.filter(experiment => experiment.status === 'reviewed' && experiment.review && experiment.evaluation);
    const withOwnerEvidence = reviewed.filter(ownerEvidence);
    const outcomes = outcomeCounters();
    const reviewDecisions = decisionCounters();
    const sites = new Set();
    for (const experiment of reviewed) {
      sites.add(experiment.site);
      countOutcome(outcomes, experiment.evaluation?.outcomeState);
      countDecision(reviewDecisions, experiment.review?.decision);
    }
    const row = {
      trendId: trend.id,
      provider: trend.provider,
      currentStage: trend.stage,
      linkedActionRefs: [...(trend.actionRefs || [])],
      totalExperiments: linked.length,
      reviewedExperiments: reviewed.length,
      ownerEvidenceExperiments: withOwnerEvidence.length,
      sites: [...sites].sort(),
      outcomes,
      reviewDecisions,
      eligibility: eligibility(trend, withOwnerEvidence.length)
    };
    trendRows.push(row);

    if (row.eligibility === 'eligible-for-review') {
      proposals.push({
        id: `measure:${trend.id}`,
        trendId: trend.id,
        currentStage: 'adopt',
        proposedStage: 'measured',
        status: 'review-required',
        evidenceExperimentIds: withOwnerEvidence.map(experiment => experiment.id).sort(),
        sites: [...new Set(withOwnerEvidence.map(experiment => experiment.site))].sort(),
        note: 'Real reviewed owner-side outcome evidence exists for actions linked to this trend. MEASURED means longitudinal evidence was observed; it does not mean the trend was beneficial or causal. Negative, mixed and unchanged observations remain in the evidence set.'
      });
    }
  }

  const report = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/trend-measurement-evidence.schema.json',
    version: '0.1',
    generatedAt: iso(options.generatedAt),
    trends: trendRows.sort((a, b) => a.trendId.localeCompare(b.trendId)),
    proposals: proposals.sort((a, b) => a.trendId.localeCompare(b.trendId)),
    guardrails: {
      noAutomaticMeasuredPromotion: true,
      negativeAndNeutralResultsIncluded: true,
      measuredMeansObservedNotPositive: true,
      noCausalityInference: true
    }
  };
  const validation = validateTrendMeasurementEvidence(report);
  if (!validation.valid) throw new Error(`Generated Trend measurement evidence is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return report;
}

export function formatTrendMeasurementEvidence(report) {
  const eligible = report.trends.filter(item => item.eligibility === 'eligible-for-review');
  const reviewedExperiments = report.trends.reduce((sum, item) => sum + item.reviewedExperiments, 0);
  const ownerEvidenceExperiments = report.trends.reduce((sum, item) => sum + item.ownerEvidenceExperiments, 0);
  const lines = [
    'ARWP Trend MEASURED evidence',
    `Reviewed linked experiments: ${reviewedExperiments}; with owner outcome evidence: ${ownerEvidenceExperiments}`,
    `ADOPT -> MEASURED proposals requiring review: ${report.proposals.length}`,
    ''
  ];
  for (const item of eligible) {
    lines.push(`REVIEW ${item.trendId}`);
    lines.push(`  Owner-evidence experiments: ${item.ownerEvidenceExperiments}; sites: ${item.sites.length}`);
    lines.push(`  Outcomes: +${item.outcomes.positive} / -${item.outcomes.negative} / mixed ${item.outcomes.mixed} / unchanged ${item.outcomes.noChange}`);
  }
  lines.push('', 'MEASURED means real longitudinal observations exist. It is not a positive-effect label and does not establish causality. Registry stage changes remain explicit reviewed edits.');
  return lines.join('\n');
}
