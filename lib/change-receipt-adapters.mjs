import { canonicalJson, sha256Digest } from './evidence-receipt.mjs';
import { validateVisibilitySnapshot } from './visibility-evidence.mjs';
import { validateAgentEvalReceipt } from './agent-eval.mjs';
import { validateGrowthExperiment } from './growth-experiment.mjs';
import { verifyChangeReceipt } from './change-receipt.mjs';

function artifactRef(kind, artifact) {
  return `${kind}:${sha256Digest(canonicalJson(artifact))}`;
}

function unique(values = []) {
  return [...new Set(values.filter(value => value != null && String(value).trim()).map(value => String(value)))];
}

function assertReceipt(receipt) {
  const verification = verifyChangeReceipt(receipt);
  if (!verification.valid) throw new Error('A valid Change Receipt is required for direct artifact adaptation.');
}

function assertSite(receipt, site, kind) {
  if (receipt.site !== site) throw new Error(`${kind} site mismatch: ${site} != ${receipt.site}`);
}

function operationId(receipt, requested = null) {
  if (requested == null) return null;
  const id = String(requested);
  if (!receipt.mutation.changes.some(change => change.operationId === id)) throw new Error(`Unknown Change Receipt operationId: ${id}`);
  return id;
}

export function visibilitySnapshotToChangeOutcomes(receipt, snapshot, options = {}) {
  assertReceipt(receipt);
  const validation = validateVisibilitySnapshot(snapshot);
  if (!validation.valid) throw new Error('A valid ARWP visibility snapshot is required.');
  assertSite(receipt, snapshot.site, 'Visibility snapshot');
  const opId = operationId(receipt, options.operationId ?? null);
  const digestRef = artifactRef('visibility-snapshot', snapshot);
  const rows = [];
  for (const source of snapshot.sources || []) {
    if (source.status === 'unavailable') continue;
    const sourceEvidence = unique([digestRef, source.evidence || null, `period:${snapshot.period.start}..${snapshot.period.end}`]);
    const metrics = Object.entries(source.metrics || {}).filter(([, value]) => typeof value === 'number' && Number.isFinite(value));
    if (!metrics.length) {
      rows.push({
        id: `visibility:${source.provider}:${snapshot.capturedAt}:source-status`,
        operationId: opId,
        status: 'observed',
        kind: 'visibility-snapshot-source',
        provider: source.provider,
        metric: null,
        value: { sourceStatus: source.status },
        observedAt: snapshot.capturedAt,
        evidenceClass: 'owner-visibility-snapshot',
        evidenceRefs: sourceEvidence,
        note: source.notes || 'Provider source was observed without a comparable numeric metric. No directional effect is inferred.'
      });
      continue;
    }
    for (const [metric, value] of metrics) {
      rows.push({
        id: `visibility:${source.provider}:${metric}:${snapshot.capturedAt}`,
        operationId: opId,
        status: 'observed',
        kind: 'visibility-snapshot-metric',
        provider: source.provider,
        metric,
        value,
        observedAt: snapshot.capturedAt,
        evidenceClass: 'owner-visibility-snapshot',
        evidenceRefs: sourceEvidence,
        note: source.notes || 'Absolute owner-side observation. A single snapshot does not establish positive/negative movement or causality.'
      });
    }
  }
  return rows;
}

export function agentEvalReceiptToChangeOutcomes(receipt, agentEvalReceipt, options = {}) {
  assertReceipt(receipt);
  const validation = validateAgentEvalReceipt(agentEvalReceipt);
  if (!validation.valid) throw new Error('A valid ARWP Agent Eval receipt is required.');
  assertSite(receipt, agentEvalReceipt.site, 'Agent Eval receipt');
  const opId = operationId(receipt, options.operationId ?? null);
  const digestRef = artifactRef('agent-eval-receipt', agentEvalReceipt);
  const rows = [];
  for (const task of agentEvalReceipt.tasks) {
    for (const variant of task.variants) {
      rows.push({
        id: `agent-eval:${task.id}:${variant.mode}:${agentEvalReceipt.capturedAt}`,
        operationId: opId,
        status: 'observed',
        kind: 'browser-agent-task-result',
        provider: `browser:${agentEvalReceipt.runtime.browser}`,
        metric: `task.${task.id}.${variant.mode}`,
        value: {
          success: variant.success,
          interactions: variant.interactions,
          retries: variant.retries,
          toolCalls: variant.toolCalls,
          durationMs: variant.durationMs ?? null,
          errors: variant.errors || []
        },
        observedAt: agentEvalReceipt.capturedAt,
        evidenceClass: 'browser-runtime-agent-eval',
        evidenceRefs: unique([digestRef, variant.evidence || null]),
        note: `Runtime-scoped ${variant.mode} task observation; success/failure is not generalized to universal agent compatibility, trust, ranking or citation impact.`
      });
    }
  }
  return rows;
}

function growthOutcomeStatus(experiment) {
  const state = experiment.evaluation?.outcomeState;
  if (state === 'positive-observation') return 'positive';
  if (state === 'negative-observation') return 'negative';
  if (state === 'mixed-observation') return 'mixed';
  if (state === 'no-change-observation') return 'neutral';
  return 'unknown';
}

export function growthExperimentToChangeReceiptUpdates(receipt, experiment, options = {}) {
  assertReceipt(receipt);
  const validation = validateGrowthExperiment(experiment);
  if (!validation.valid) throw new Error('A valid ARWP Growth Experiment is required.');
  assertSite(receipt, experiment.site, 'Growth Experiment');
  const opId = operationId(receipt, options.operationId ?? null);
  const digestRef = artifactRef('growth-experiment', experiment);
  const evidenceRefs = unique([
    digestRef,
    experiment.implementation?.changeUri || null,
    experiment.evidence?.beforeVisibility?.digest || null,
    experiment.evidence?.afterVisibility?.digest || null,
    experiment.evidence?.beforeGrowth?.digest || null,
    experiment.evidence?.afterGrowth?.digest || null
  ]);
  const outcomes = [];
  if (experiment.evaluation) {
    outcomes.push({
      id: `growth-experiment:${experiment.id}:${experiment.evaluation.evaluatedAt}`,
      operationId: opId,
      status: growthOutcomeStatus(experiment),
      kind: 'growth-experiment-evaluation',
      provider: 'arwp-growth-experiment',
      metric: 'experiment-outcome-state',
      value: {
        hypothesisId: experiment.hypothesisId,
        actionIds: experiment.actionIds,
        outcomeState: experiment.evaluation.outcomeState,
        implementationDiff: experiment.evaluation.implementationDiff,
        visibility: experiment.evaluation.visibility || null
      },
      observedAt: experiment.evaluation.evaluatedAt,
      evidenceClass: 'reviewable-growth-experiment',
      evidenceRefs,
      note: experiment.evaluation.interpretation
    });
  }
  const updates = { outcomes };
  if (experiment.review) {
    updates.review = {
      decision: experiment.review.decision,
      reviewedAt: experiment.review.reviewedAt,
      note: experiment.review.notes || `Imported from Growth Experiment ${experiment.id}.`
    };
  }
  return updates;
}

export function artifactAdapterSummary(receipt, { visibilitySnapshots = [], agentEvalReceipts = [], growthExperiments = [], operationId: requestedOperationId = null } = {}) {
  const outcomes = [];
  let review = undefined;
  for (const snapshot of visibilitySnapshots) outcomes.push(...visibilitySnapshotToChangeOutcomes(receipt, snapshot, { operationId: requestedOperationId }));
  for (const evalReceipt of agentEvalReceipts) outcomes.push(...agentEvalReceiptToChangeOutcomes(receipt, evalReceipt, { operationId: requestedOperationId }));
  for (const experiment of growthExperiments) {
    const adapted = growthExperimentToChangeReceiptUpdates(receipt, experiment, { operationId: requestedOperationId });
    outcomes.push(...adapted.outcomes);
    if (adapted.review) {
      if (review && canonicalJson(review) !== canonicalJson(adapted.review)) throw new Error('Multiple Growth Experiments supplied conflicting review decisions for one Change Receipt revision.');
      review = adapted.review;
    }
  }
  return {
    outcomes,
    ...(review ? { review } : {}),
    summary: {
      visibilitySnapshots: visibilitySnapshots.length,
      agentEvalReceipts: agentEvalReceipts.length,
      growthExperiments: growthExperiments.length,
      outcomeObservations: outcomes.length,
      reviewImported: Boolean(review)
    },
    interpretation: {
      artifactsAreObservedEvidenceNotCausality: true,
      absoluteVisibilitySnapshotHasNoDirection: true,
      runtimeAgentEvalIsTaskAndEnvironmentScoped: true,
      growthExperimentOutcomeStatePreserved: true
    }
  };
}
