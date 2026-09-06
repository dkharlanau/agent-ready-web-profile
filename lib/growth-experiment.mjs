import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { sha256Digest } from './evidence-receipt.mjs';
import { diffGrowthSnapshots } from './growth-history.mjs';
import { compareVisibilitySnapshots, validateVisibilitySnapshot } from './visibility-evidence.mjs';
import { loadGrowthHypotheses } from './growth-hypotheses.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'growth-experiment.schema.json');

function isoInstant(value = null) {
  const date = value == null ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Expected a valid date/time.');
  return date.toISOString();
}

function unique(values) {
  return [...new Set((values || []).map(value => String(value).trim()).filter(Boolean))];
}

export function loadGrowthExperimentSchema() {
  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
}

export function createGrowthExperimentValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(loadGrowthExperimentSchema());
}

export function validateGrowthExperiment(experiment) {
  const validate = createGrowthExperimentValidator();
  const schemaValid = Boolean(validate(experiment));
  const semanticErrors = [];
  const warnings = [];

  if (experiment?.evidence?.beforeGrowth?.observedAt && experiment?.evidence?.afterGrowth?.observedAt &&
      experiment.evidence.beforeGrowth.observedAt > experiment.evidence.afterGrowth.observedAt) {
    semanticErrors.push('beforeGrowth.observedAt is after afterGrowth.observedAt.');
  }
  if ((experiment?.evidence?.beforeVisibility && !experiment?.evidence?.afterVisibility) ||
      (!experiment?.evidence?.beforeVisibility && experiment?.evidence?.afterVisibility)) {
    warnings.push('visibility evidence is incomplete; owner-side before/after comparison is unavailable.');
  }
  if (experiment?.status === 'measured' && !experiment?.evaluation) semanticErrors.push('measured experiments require an evaluation.');
  if (experiment?.status === 'reviewed' && !experiment?.review) semanticErrors.push('reviewed experiments require a review decision.');
  if (experiment?.evaluation && !experiment?.evidence?.afterGrowth) semanticErrors.push('evaluated experiments require afterGrowth evidence.');

  return { valid: schemaValid && semanticErrors.length === 0, errors: validate.errors ?? [], semanticErrors, warnings };
}

function growthEvidence(snapshot) {
  if (!snapshot || snapshot.snapshotVersion !== '0.1' || !snapshot.snapshotId || !snapshot.digest || !snapshot.observedAt) {
    throw new Error('A valid ARWP Growth snapshot is required.');
  }
  return {
    snapshotId: snapshot.snapshotId,
    digest: snapshot.digest,
    observedAt: snapshot.observedAt,
    highPriorityDebt: Number(snapshot.debt?.highPriority || 0)
  };
}

function visibilityEvidence(snapshot, site) {
  const validation = validateVisibilitySnapshot(snapshot);
  if (!validation.valid) throw new Error('A valid ARWP visibility snapshot is required.');
  if (snapshot.site !== site) throw new Error(`Visibility snapshot site mismatch: ${snapshot.site} != ${site}`);
  return {
    digest: sha256Digest(snapshot),
    capturedAt: snapshot.capturedAt,
    period: snapshot.period
  };
}

function assertGrowthSite(snapshot, site) {
  if (snapshot?.canonicalUrl !== site) throw new Error(`Growth snapshot site mismatch: ${snapshot?.canonicalUrl || '(missing)'} != ${site}`);
}

function assertStoredGrowthEvidence(stored, snapshot, label) {
  const actual = growthEvidence(snapshot);
  if (stored?.snapshotId !== actual.snapshotId || stored?.digest !== actual.digest) {
    throw new Error(`${label} Growth snapshot does not match the experiment evidence record.`);
  }
}

function hypothesisExists(id, registry = loadGrowthHypotheses()) {
  return Boolean(registry?.hypotheses?.some(item => item.id === id));
}

export function createGrowthExperiment({
  id,
  hypothesisId,
  actionIds,
  beforeGrowthSnapshot,
  beforeVisibilitySnapshot = null,
  createdAt = null,
  implementation = null,
  hypothesisRegistry = null
}) {
  if (!id || !hypothesisId) throw new Error('Experiment id and hypothesisId are required.');
  const actions = unique(actionIds);
  if (!actions.length) throw new Error('At least one action id is required.');
  const registry = hypothesisRegistry || loadGrowthHypotheses();
  if (!hypothesisExists(hypothesisId, registry)) throw new Error(`Unknown Growth hypothesis: ${hypothesisId}`);
  if (!beforeGrowthSnapshot?.canonicalUrl) throw new Error('beforeGrowthSnapshot must include canonicalUrl.');

  const beforeActionIds = new Set((beforeGrowthSnapshot.actions || []).map(item => item.id));
  const missing = actions.filter(actionId => !beforeActionIds.has(actionId));
  if (missing.length) throw new Error(`Experiment actions are not active in the before Growth snapshot: ${missing.join(', ')}`);

  const site = beforeGrowthSnapshot.canonicalUrl;
  const evidence = { beforeGrowth: growthEvidence(beforeGrowthSnapshot) };
  if (beforeVisibilitySnapshot) evidence.beforeVisibility = visibilityEvidence(beforeVisibilitySnapshot, site);

  const record = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/growth-experiment.schema.json',
    version: '0.1',
    id,
    site,
    hypothesisId,
    actionIds: actions,
    createdAt: isoInstant(createdAt),
    status: implementation ? 'implemented' : 'planned',
    ...(implementation ? { implementation: { ...implementation } } : {}),
    evidence,
    guardrails: {
      noRankingGuarantee: true,
      noCausalityInference: true,
      preserveNegativeResults: true,
      humanReviewBeforePromotion: true
    }
  };

  const validation = validateGrowthExperiment(record);
  if (!validation.valid) throw new Error(`Invalid Growth experiment: ${[...validation.semanticErrors, ...validation.errors.map(error => error.message)].join('; ')}`);
  return record;
}

function actionResults(experiment, before, after, diff) {
  const beforeIds = new Set((before.actions || []).map(item => item.id));
  const afterIds = new Set((after.actions || []).map(item => item.id));
  const changed = new Set((diff.changed || []).map(item => item.id));
  return experiment.actionIds.map(id => {
    let state = 'still-open';
    if (!beforeIds.has(id)) state = 'not-observed-before';
    else if (!afterIds.has(id)) state = 'resolved';
    else if (changed.has(id)) state = 'changed';
    return { id, state };
  });
}

function visibilitySummary(comparison) {
  if (!comparison) return { outcomeState: 'owner-evidence-unavailable', summary: null };
  const comparable = comparison.changes.filter(item => item.comparable);
  const positive = comparable.filter(item => item.delta > 0).length;
  const negative = comparable.filter(item => item.delta < 0).length;
  const unchanged = comparable.filter(item => item.delta === 0).length;
  let outcomeState = 'no-change-observation';
  if (positive && negative) outcomeState = 'mixed-observation';
  else if (positive) outcomeState = 'positive-observation';
  else if (negative) outcomeState = 'negative-observation';
  return {
    outcomeState,
    summary: { comparableMetrics: comparable.length, positive, negative, unchanged }
  };
}

export function evaluateGrowthExperiment(experiment, {
  beforeGrowthSnapshot,
  afterGrowthSnapshot,
  beforeVisibilitySnapshot = null,
  afterVisibilitySnapshot = null,
  evaluatedAt = null
}) {
  const validation = validateGrowthExperiment(experiment);
  if (!validation.valid) throw new Error('Cannot evaluate an invalid Growth experiment.');
  assertGrowthSite(beforeGrowthSnapshot, experiment.site);
  assertGrowthSite(afterGrowthSnapshot, experiment.site);
  assertStoredGrowthEvidence(experiment.evidence.beforeGrowth, beforeGrowthSnapshot, 'Before');

  const diff = diffGrowthSnapshots(beforeGrowthSnapshot, afterGrowthSnapshot);
  const evidence = { ...experiment.evidence, afterGrowth: growthEvidence(afterGrowthSnapshot) };

  const hasBeforeVisibility = Boolean(beforeVisibilitySnapshot);
  const hasAfterVisibility = Boolean(afterVisibilitySnapshot);
  if (hasBeforeVisibility !== hasAfterVisibility) throw new Error('beforeVisibilitySnapshot and afterVisibilitySnapshot must be supplied together.');

  let visibilityComparison = null;
  if (hasBeforeVisibility && hasAfterVisibility) {
    const beforeRef = visibilityEvidence(beforeVisibilitySnapshot, experiment.site);
    if (experiment.evidence.beforeVisibility?.digest && experiment.evidence.beforeVisibility.digest !== beforeRef.digest) {
      throw new Error('Before visibility snapshot does not match the experiment evidence record.');
    }
    const afterRef = visibilityEvidence(afterVisibilitySnapshot, experiment.site);
    visibilityComparison = compareVisibilitySnapshots(beforeVisibilitySnapshot, afterVisibilitySnapshot);
    if (!visibilityComparison.valid) throw new Error('Visibility snapshots cannot be compared.');
    evidence.beforeVisibility = beforeRef;
    evidence.afterVisibility = afterRef;
  }

  const observed = visibilitySummary(visibilityComparison);
  const evaluated = {
    ...experiment,
    status: visibilityComparison ? 'measured' : 'implemented',
    evidence,
    evaluation: {
      evaluatedAt: isoInstant(evaluatedAt),
      actionResults: actionResults(experiment, beforeGrowthSnapshot, afterGrowthSnapshot, diff),
      implementationDiff: {
        actionsAdded: diff.summary.actionsAdded,
        actionsResolved: diff.summary.actionsResolved,
        actionsChanged: diff.summary.actionsChanged,
        highPriorityDebtDelta: diff.summary.highPriorityDebtDelta
      },
      ...(observed.summary ? { visibility: observed.summary } : {}),
      outcomeState: observed.outcomeState,
      reviewRequired: true,
      interpretation: visibilityComparison
        ? 'Observed owner-side metric movement is recorded for review. It does not prove that the tested change caused ranking, recommendation, citation, referral or conversion movement.'
        : 'Implementation-state change was measured, but owner-side outcome evidence is unavailable. Do not promote the hypothesis from this record alone.'
    }
  };

  const resultValidation = validateGrowthExperiment(evaluated);
  if (!resultValidation.valid) throw new Error(`Invalid evaluated Growth experiment: ${[...resultValidation.semanticErrors, ...resultValidation.errors.map(error => error.message)].join('; ')}`);
  return evaluated;
}

export function reviewGrowthExperiment(experiment, { decision, reviewedAt = null, notes = null }) {
  const allowed = new Set(['keep', 'revise', 'revert', 'retire', 'continue-measuring']);
  if (!allowed.has(decision)) throw new Error(`Unsupported review decision: ${decision}`);
  if (!experiment?.evaluation) throw new Error('Only evaluated experiments can be reviewed.');
  const reviewed = {
    ...experiment,
    status: 'reviewed',
    review: {
      decision,
      reviewedAt: isoInstant(reviewedAt),
      ...(notes ? { notes: String(notes) } : {})
    }
  };
  const validation = validateGrowthExperiment(reviewed);
  if (!validation.valid) throw new Error('Invalid reviewed Growth experiment.');
  return reviewed;
}

export function formatGrowthExperiment(experiment) {
  const lines = [
    `ARWP Growth Experiment ${experiment.version}`,
    `ID: ${experiment.id}`,
    `Site: ${experiment.site}`,
    `Hypothesis: ${experiment.hypothesisId}`,
    `Status: ${experiment.status}`,
    `Actions: ${experiment.actionIds.join(', ')}`,
    `Before Growth: ${experiment.evidence.beforeGrowth.snapshotId}`
  ];
  if (experiment.evidence.afterGrowth) lines.push(`After Growth: ${experiment.evidence.afterGrowth.snapshotId}`);
  if (experiment.evaluation) {
    lines.push(`Outcome observation: ${experiment.evaluation.outcomeState}`);
    lines.push(`High-priority implementation debt delta: ${experiment.evaluation.implementationDiff.highPriorityDebtDelta >= 0 ? '+' : ''}${experiment.evaluation.implementationDiff.highPriorityDebtDelta}`);
    lines.push(experiment.evaluation.interpretation);
  }
  if (experiment.review) lines.push(`Review: ${experiment.review.decision}`);
  return lines.join('\n');
}
