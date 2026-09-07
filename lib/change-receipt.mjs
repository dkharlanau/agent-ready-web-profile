import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { canonicalJson, sha256Digest, verifyEvidenceReceipt } from './evidence-receipt.mjs';
import { validateTransformationBundle } from './transformation-engine.mjs';
import { validateBraidGraph, explainBraidGraph } from './braid-graph.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'change-receipt.schema.json');

export const CHANGE_RECEIPT_VERSION = '0.1';
export const CHANGE_RECEIPT_CANONICALIZATION = 'SignalBraid canonical JSON v0.1: object keys sorted recursively; array order preserved; UTF-8 JSON without insignificant whitespace';
const RE_REVIEW_STATES = new Set(['review-due', 'superseded', 'retired']);
const VERIFICATION_STATUSES = new Set(['passed', 'failed', 'unknown']);
const OUTCOME_STATUSES = new Set(['observed', 'positive', 'negative', 'neutral', 'mixed', 'unknown']);

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

function arrays(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function unique(values = []) {
  return [...new Set(values.filter(value => value != null && String(value).trim()).map(value => String(value)))];
}

function iso(value = null) {
  const date = value == null ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date/time: ${value}`);
  return date.toISOString();
}

function urnFromDigest(digest) {
  const value = String(digest || '');
  if (!/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error(`Invalid SHA-256 digest: ${digest}`);
  return `urn:sha256:${value.slice(7)}`;
}

function payloadForDigest(receipt) {
  const payload = structuredClone(receipt);
  delete payload.receiptId;
  delete payload.digests;
  return payload;
}

function artifactRef(kind, version, generatedAt, payload) {
  return {
    kind,
    version: String(version || 'unknown'),
    generatedAt: generatedAt == null ? null : iso(generatedAt),
    digest: sha256Digest(canonicalJson(payload))
  };
}

function finalise(receipt) {
  const payloadDigest = sha256Digest(canonicalJson(payloadForDigest(receipt)));
  receipt.digests = {
    algorithm: 'sha256',
    canonicalization: CHANGE_RECEIPT_CANONICALIZATION,
    payload: payloadDigest
  };
  receipt.receiptId = urnFromDigest(payloadDigest);
  const validation = validateChangeReceipt(receipt);
  if (!validation.valid) throw new Error(`Generated Change Receipt is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return receipt;
}

function transformBundleArtifact(bundle) {
  return artifactRef('transformation-bundle', bundle.version, bundle.generatedAt, bundle);
}

function braidGraphArtifact(graph) {
  return artifactRef('braid-graph', graph.version, graph.generatedAt, graph);
}

function graphIndexes(graph) {
  return {
    nodes: new Map(graph.nodes.map(node => [node.id, node])),
    incoming: graph.edges.reduce((map, edge) => {
      if (!map.has(edge.to)) map.set(edge.to, []);
      map.get(edge.to).push(edge);
      return map;
    }, new Map())
  };
}

function transformNodeForOperation(graph, operationId) {
  return graph.nodes.find(node => node.type === 'transform' && node.data?.operationId === operationId) || null;
}

function normaliseLineage(bundle, graph) {
  const bundleArtifact = transformBundleArtifact(bundle);
  if (graph.inputs?.transformationBundle?.digest !== bundleArtifact.digest) {
    throw new Error(`BraidGraph transformation bundle digest does not match Change Receipt bundle: expected ${bundleArtifact.digest}, observed ${graph.inputs?.transformationBundle?.digest || 'none'}.`);
  }
  if (graph.site !== bundle.site) throw new Error(`BraidGraph site ${graph.site} does not match Transformation Bundle site ${bundle.site}.`);
  if (graph.repository?.fullName !== bundle.repository.fullName || graph.repository?.baseRef !== bundle.repository.baseRef || graph.repository?.baseCommitSha !== bundle.repository.baseCommitSha) {
    throw new Error('BraidGraph repository evidence does not match the Transformation Bundle.');
  }

  const ruleMap = new Map();
  const sourceMap = new Map();
  const recommendationIds = new Set();
  const indexes = graphIndexes(graph);

  for (const operation of bundle.operations) {
    const transform = transformNodeForOperation(graph, operation.id);
    if (!transform) throw new Error(`BraidGraph is missing transform operation ${operation.id}.`);
    const explained = explainBraidGraph(graph, { transform: operation.id });
    for (const node of explained.lineage.nodes) {
      if (node.type === 'recommendation' && node.data?.recommendationId) recommendationIds.add(String(node.data.recommendationId));
      if (node.type === 'source' && node.data?.url) {
        sourceMap.set(node.id, {
          nodeId: node.id,
          url: String(node.data.url),
          versionKey: String(node.versionKey),
          state: String(node.state),
          authority: node.data?.authority == null ? null : String(node.data.authority)
        });
      }
      if (node.type === 'rule' && node.data?.ruleId) {
        const sourceNodeIds = unique((indexes.incoming.get(node.id) || []).filter(edge => edge.type === 'supports').map(edge => edge.from));
        ruleMap.set(node.id, {
          ruleId: String(node.data.ruleId),
          nodeId: node.id,
          versionKey: String(node.versionKey),
          state: String(node.state),
          sourceNodeIds
        });
      }
    }
  }

  for (const operation of bundle.operations) recommendationIds.add(operation.recommendationId);
  const ruleRefs = [...ruleMap.values()].sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.nodeId.localeCompare(b.nodeId));
  const sourceRefs = [...sourceMap.values()].sort((a, b) => a.url.localeCompare(b.url) || a.nodeId.localeCompare(b.nodeId));
  if (!ruleRefs.length || !sourceRefs.length) throw new Error('Change Receipt requires BraidGraph source/rule lineage for the transformed recommendations.');
  return { recommendationIds: [...recommendationIds].sort(), ruleRefs, sourceRefs };
}

function evidenceReceiptRef(item) {
  const wrapper = item?.receipt ? item : { receipt: item, role: 'supporting-observation' };
  const receipt = wrapper.receipt;
  const verification = verifyEvidenceReceipt(receipt);
  if (!verification.valid) throw new Error(`Invalid referenced Evidence Receipt: ${verification.issues.join(' ')}`);
  return {
    receiptId: receipt.receiptId,
    payloadDigest: receipt.digests.payload,
    role: String(wrapper.role || 'supporting-observation'),
    canonicalUrl: receipt.canonicalUrl || null,
    observedAt: receipt.observedAt || null
  };
}

function mergeEvidenceReceiptRefs(existing = [], additions = []) {
  const map = new Map(existing.map(item => [item.receiptId, structuredClone(item)]));
  for (const item of arrays(additions)) {
    const ref = evidenceReceiptRef(item);
    const prior = map.get(ref.receiptId);
    if (prior && canonicalJson(prior) !== canonicalJson(ref)) throw new Error(`Conflicting Evidence Receipt reference: ${ref.receiptId}`);
    map.set(ref.receiptId, ref);
  }
  return [...map.values()].sort((a, b) => a.receiptId.localeCompare(b.receiptId));
}

function receiptChanges(bundle) {
  return bundle.operations.map(operation => ({
    operationId: operation.id,
    recommendationId: operation.recommendationId,
    path: operation.path,
    operation: operation.operation,
    automationClass: operation.automationClass,
    beforeSha256: operation.precondition.sha256,
    afterSha256: operation.after.sha256,
    humanReviewRequired: Boolean(operation.humanReviewRequired),
    groundedEvidence: unique(operation.groundedEvidence || [])
  }));
}

function assertExecutionChanges(bundle, executionChanges) {
  const expected = new Map(bundle.operations.map(operation => [operation.path, operation]));
  const rows = arrays(executionChanges);
  if (rows.length !== bundle.operations.length) throw new Error(`Execution evidence covers ${rows.length} changes, expected ${bundle.operations.length}.`);
  for (const row of rows) {
    const operation = expected.get(row.path);
    if (!operation) throw new Error(`Execution evidence references unexpected path: ${row.path}`);
    if (row.recommendationId !== operation.recommendationId || row.beforeSha256 !== operation.precondition.sha256 || row.afterSha256 !== operation.after.sha256) {
      throw new Error(`Execution evidence does not match Transformation Bundle operation for ${row.path}.`);
    }
  }
}

function normaliseExecution(bundle, execution = null) {
  const bundleDigest = transformBundleArtifact(bundle).digest;
  if (!execution) {
    return {
      state: 'planned',
      executionKind: 'none',
      executedAt: null,
      executionEvidenceDigest: null,
      github: null,
      rollback: { state: 'not-applicable', evidenceDigest: null }
    };
  }
  const kind = String(execution.kind || '');
  const receipt = execution.receipt;
  if (!receipt || typeof receipt !== 'object') throw new Error('Execution evidence requires a receipt object.');
  if (receipt.sourceBundleSha256 !== bundleDigest) throw new Error(`Execution evidence bundle digest mismatch: expected ${bundleDigest}, observed ${receipt.sourceBundleSha256 || 'none'}.`);
  const evidenceDigest = sha256Digest(canonicalJson(receipt));

  if (kind === 'local') {
    assertExecutionChanges(bundle, receipt.changes);
    return {
      state: 'applied-local',
      executionKind: 'local',
      executedAt: iso(receipt.appliedAt),
      executionEvidenceDigest: evidenceDigest,
      github: null,
      rollback: { state: 'private-material-available', evidenceDigest }
    };
  }
  if (kind === 'github-pr') {
    assertExecutionChanges(bundle, receipt.operations);
    if (receipt.repository !== bundle.repository.fullName || receipt.base !== bundle.repository.baseRef || receipt.baseCommitSha !== bundle.repository.baseCommitSha) throw new Error('GitHub PR execution repository/base evidence does not match Transformation Bundle.');
    if (!/^[a-f0-9]{40}$/.test(String(receipt.commitSha || ''))) throw new Error('GitHub PR execution commitSha is invalid.');
    return {
      state: 'pr-opened',
      executionKind: 'github-pr',
      executedAt: iso(execution.observedAt || receipt.openedAt || bundle.generatedAt),
      executionEvidenceDigest: evidenceDigest,
      github: {
        branch: String(receipt.branch),
        commitSha: String(receipt.commitSha),
        pullRequestNumber: Number(receipt.pullRequest?.number),
        pullRequestUrl: receipt.pullRequest?.url || null
      },
      rollback: { state: 'not-applicable', evidenceDigest: null }
    };
  }
  throw new Error(`Unsupported Change Receipt execution kind: ${kind}`);
}

function verificationStatus(observations) {
  if (!observations.length) return 'unknown';
  const statuses = new Set(observations.map(item => item.status));
  if (statuses.size === 1) return [...statuses][0];
  return 'mixed';
}

function outcomeStatus(observations) {
  if (!observations.length) return 'unknown';
  const statuses = new Set(observations.map(item => item.status));
  if (statuses.size === 1) return [...statuses][0];
  return 'mixed';
}

function normaliseVerification(record, operationIds) {
  const operationId = String(record.operationId || record.transformOperationId || '');
  if (!operationIds.has(operationId)) throw new Error(`Verification references unknown operationId: ${operationId}`);
  const status = VERIFICATION_STATUSES.has(record.status) ? record.status : 'unknown';
  return {
    id: String(record.id || `verification:${operationId}:${record.observedAt}`),
    operationId,
    status,
    kind: String(record.kind || 'verification'),
    observedAt: iso(record.observedAt),
    evidenceRefs: unique(record.evidenceRefs || record.evidence || []),
    note: record.note == null ? null : String(record.note)
  };
}

function normaliseOutcome(record, operationIds) {
  const operationId = record.operationId ?? record.transformOperationId ?? null;
  if (operationId != null && !operationIds.has(String(operationId))) throw new Error(`Outcome references unknown operationId: ${operationId}`);
  const status = OUTCOME_STATUSES.has(record.status) ? record.status : 'observed';
  return {
    id: String(record.id || `outcome:${operationId || 'change'}:${record.observedAt}`),
    operationId: operationId == null ? null : String(operationId),
    status,
    kind: String(record.kind || 'outcome-observation'),
    provider: record.provider == null ? null : String(record.provider),
    metric: record.metric == null ? null : String(record.metric),
    value: record.value === undefined ? null : structuredClone(record.value),
    observedAt: iso(record.observedAt),
    evidenceClass: String(record.evidenceClass || 'observation'),
    evidenceRefs: unique(record.evidenceRefs || record.evidence || []),
    note: record.note == null ? null : String(record.note)
  };
}

function appendById(existing, additions, normalise) {
  const map = new Map(existing.map(item => [item.id, structuredClone(item)]));
  for (const raw of additions) {
    const item = normalise(raw);
    const prior = map.get(item.id);
    if (prior && canonicalJson(prior) !== canonicalJson(item)) throw new Error(`Conflicting evidence record ID: ${item.id}`);
    map.set(item.id, item);
  }
  return [...map.values()].sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.id.localeCompare(b.id));
}

function graphEvidence(graph, operationIds) {
  const indexes = graphIndexes(graph);
  const verifications = [];
  const outcomes = [];
  for (const operationId of operationIds) {
    const transform = transformNodeForOperation(graph, operationId);
    if (!transform) continue;
    for (const edge of indexes.incoming.get(transform.id) || []) {
      const node = indexes.nodes.get(edge.from);
      if (!node) continue;
      if (edge.type === 'verifies' && node.type === 'verification') {
        verifications.push({
          id: node.id,
          operationId,
          status: node.state,
          kind: node.data?.kind || 'verification',
          observedAt: edge.observedAt || node.versionKey,
          evidenceRefs: node.data?.evidence || [],
          note: node.data?.note || null
        });
      }
      if (edge.type === 'observes' && node.type === 'measurement') {
        outcomes.push({
          id: node.id,
          operationId,
          status: node.state,
          kind: node.data?.kind || 'outcome-observation',
          provider: node.data?.provider || null,
          metric: node.data?.metric || null,
          value: node.data?.value,
          observedAt: edge.observedAt || node.versionKey,
          evidenceClass: node.data?.evidenceClass || 'observation',
          evidenceRefs: node.data?.evidence || [],
          note: node.data?.note || null
        });
      }
    }
  }
  return { verifications, outcomes };
}

function expectedSignals(graph, recommendationIds) {
  const wanted = new Set(recommendationIds);
  return unique(graph.nodes.filter(node => node.type === 'recommendation' && wanted.has(node.data?.recommendationId)).flatMap(node => arrays(node.data?.measurementSignals))).sort();
}

function expectedVerification(bundle) {
  return bundle.operations.flatMap(operation => arrays(operation.verification).map(check => ({ operationId: operation.id, check: String(check) })));
}

function currentRuleNode(graph, ruleId) {
  const candidates = graph.nodes.filter(node => node.type === 'rule' && node.data?.ruleId === ruleId);
  candidates.sort((a, b) => {
    const ah = a.data?.historical === true ? 1 : 0;
    const bh = b.data?.historical === true ? 1 : 0;
    if (ah !== bh) return ah - bh;
    return String(b.versionKey).localeCompare(String(a.versionKey));
  });
  return candidates[0] || null;
}

function knowledgeFromGraph(originalRuleRefs, graph, checkedAt) {
  const graphDigest = braidGraphArtifact(graph).digest;
  const ruleStates = originalRuleRefs.map(original => {
    const current = currentRuleNode(graph, original.ruleId);
    const changed = !current || current.versionKey !== original.versionKey || current.state !== original.state || RE_REVIEW_STATES.has(current.state);
    return {
      ruleId: original.ruleId,
      originalNodeId: original.nodeId,
      originalVersionKey: original.versionKey,
      originalState: original.state,
      currentNodeId: current?.id || null,
      currentVersionKey: current?.versionKey || null,
      currentState: current?.state || null,
      changed
    };
  });
  return {
    reReviewRequired: ruleStates.some(item => item.changed),
    checkedAt: iso(checkedAt),
    braidGraphDigest: graphDigest,
    ruleStates
  };
}

function normaliseDeployment(value = null) {
  if (!value) return { state: 'unknown', observedAt: null, commitSha: null, url: null, evidenceRefs: [] };
  const state = String(value.state || 'unknown');
  if (!['unknown', 'not-deployed', 'deployed', 'failed'].includes(state)) throw new Error(`Unsupported deployment state: ${state}`);
  const commitSha = value.commitSha == null ? null : String(value.commitSha).toLowerCase();
  if (commitSha != null && !/^[a-f0-9]{40}$/.test(commitSha)) throw new Error('Deployment commitSha must be a 40-character SHA.');
  if (state === 'deployed' && !value.observedAt) throw new Error('Deployed state requires observedAt.');
  return {
    state,
    observedAt: value.observedAt == null ? null : iso(value.observedAt),
    commitSha,
    url: value.url == null ? null : String(value.url),
    evidenceRefs: unique(value.evidenceRefs || value.evidence || [])
  };
}

function normaliseReview(value = null) {
  if (!value) return { decision: 'pending', reviewedAt: null, note: null };
  const decision = String(value.decision || 'pending');
  if (!['pending', 'keep', 'revise', 'revert', 'retire', 'continue-measuring'].includes(decision)) throw new Error(`Unsupported Change Receipt review decision: ${decision}`);
  if (decision !== 'pending' && !value.reviewedAt) throw new Error(`${decision} review requires reviewedAt.`);
  return { decision, reviewedAt: value.reviewedAt == null ? null : iso(value.reviewedAt), note: value.note == null ? null : String(value.note) };
}

function semanticErrors(receipt) {
  const errors = [];
  const expectedChangeId = (() => {
    try { return urnFromDigest(receipt.source?.transformationBundle?.digest); } catch { return null; }
  })();
  if (expectedChangeId && receipt.changeId !== expectedChangeId) errors.push({ instancePath: '/changeId', message: 'must equal the Transformation Bundle content identity' });
  if (receipt.revision === 1 && receipt.previousReceiptId !== null) errors.push({ instancePath: '/previousReceiptId', message: 'must be null for revision 1' });
  if (receipt.revision > 1 && receipt.previousReceiptId == null) errors.push({ instancePath: '/previousReceiptId', message: 'is required after revision 1' });
  const operationIds = receipt.mutation?.changes?.map(item => item.operationId) || [];
  if (new Set(operationIds).size !== operationIds.length) errors.push({ instancePath: '/mutation/changes', message: 'operationId values must be unique' });
  const recommendationIds = new Set(receipt.source?.recommendationIds || []);
  for (const [index, change] of (receipt.mutation?.changes || []).entries()) if (!recommendationIds.has(change.recommendationId)) errors.push({ instancePath: `/mutation/changes/${index}/recommendationId`, message: 'must exist in source.recommendationIds' });
  if (receipt.mutation?.state === 'planned' && receipt.mutation?.executionKind !== 'none') errors.push({ instancePath: '/mutation/executionKind', message: 'planned mutation must use executionKind=none' });
  const receiptIds = receipt.source?.evidenceReceipts?.map(item => item.receiptId) || [];
  if (new Set(receiptIds).size !== receiptIds.length) errors.push({ instancePath: '/source/evidenceReceipts', message: 'receiptId values must be unique' });
  return errors;
}

export function validateChangeReceipt(receipt) {
  const validate = validator();
  const schemaValid = Boolean(validate(receipt));
  const errors = [...(validate.errors || [])];
  if (schemaValid) errors.push(...semanticErrors(receipt));
  return { valid: schemaValid && errors.length === 0, errors };
}

export function verifyChangeReceipt(receipt) {
  const validation = validateChangeReceipt(receipt);
  if (!validation.valid) return { valid: false, integrity: false, errors: validation.errors, expectedDigest: null, actualDigest: receipt?.digests?.payload || null };
  const expectedDigest = sha256Digest(canonicalJson(payloadForDigest(receipt)));
  const expectedReceiptId = urnFromDigest(expectedDigest);
  const errors = [];
  if (receipt.digests.payload !== expectedDigest) errors.push({ instancePath: '/digests/payload', message: 'does not match canonical receipt payload' });
  if (receipt.receiptId !== expectedReceiptId) errors.push({ instancePath: '/receiptId', message: 'does not match canonical receipt payload' });
  return {
    valid: errors.length === 0,
    integrity: errors.length === 0,
    errors,
    expectedDigest,
    actualDigest: receipt.digests.payload,
    expectedReceiptId,
    actualReceiptId: receipt.receiptId
  };
}

export function createChangeReceipt(bundle, braidGraph, options = {}) {
  const bundleValidation = validateTransformationBundle(bundle);
  if (!bundleValidation.valid) throw new Error(`A valid Transformation Bundle is required: ${bundleValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  if (!bundle.operations.length) throw new Error('Change Receipt requires at least one Transformation Bundle operation.');
  const graphValidation = validateBraidGraph(braidGraph);
  if (!graphValidation.valid) throw new Error(`A valid BraidGraph is required: ${graphValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);

  const createdAt = iso(options.createdAt);
  const bundleArtifact = transformBundleArtifact(bundle);
  const graphArtifact = braidGraphArtifact(braidGraph);
  const lineage = normaliseLineage(bundle, braidGraph);
  const execution = normaliseExecution(bundle, options.execution || null);
  const operationIds = new Set(bundle.operations.map(item => item.id));
  const fromGraph = graphEvidence(braidGraph, operationIds);
  const verifications = appendById([], [...fromGraph.verifications, ...arrays(options.verifications)], record => normaliseVerification(record, operationIds));
  const outcomes = appendById([], [...fromGraph.outcomes, ...arrays(options.outcomes)], record => normaliseOutcome(record, operationIds));

  const receipt = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/change-receipt.schema.json',
    version: CHANGE_RECEIPT_VERSION,
    receiptId: 'urn:sha256:' + '0'.repeat(64),
    changeId: urnFromDigest(bundleArtifact.digest),
    revision: 1,
    previousReceiptId: null,
    createdAt,
    site: bundle.site,
    repository: structuredClone(bundle.repository),
    source: {
      transformationBundle: bundleArtifact,
      adaptiveUpgradeDigest: bundle.sourceUpgrade.sha256,
      braidGraph: graphArtifact,
      recommendationIds: lineage.recommendationIds,
      ruleRefs: lineage.ruleRefs,
      sourceRefs: lineage.sourceRefs,
      evidenceReceipts: mergeEvidenceReceiptRefs([], options.evidenceReceipts || [])
    },
    mutation: {
      ...execution,
      changes: receiptChanges(bundle)
    },
    verification: {
      status: verificationStatus(verifications),
      expected: expectedVerification(bundle),
      observations: verifications
    },
    deployment: normaliseDeployment(options.deployment || null),
    outcomes: {
      status: outcomeStatus(outcomes),
      expectedSignals: expectedSignals(braidGraph, lineage.recommendationIds),
      observations: outcomes
    },
    knowledge: knowledgeFromGraph(lineage.ruleRefs, braidGraph, createdAt),
    review: normaliseReview(options.review || null),
    boundaries: {
      receiptIsMutationAuthorization: false,
      receiptIsRankingEvidence: false,
      verificationIsOutcome: false,
      rollbackContentEmbedded: false,
      missingOwnerEvidenceIsZero: false,
      historicalRevisionMutable: false,
      externalEvidenceDuplicated: false
    },
    digests: { algorithm: 'sha256', canonicalization: CHANGE_RECEIPT_CANONICALIZATION, payload: 'sha256:' + '0'.repeat(64) }
  };
  return finalise(receipt);
}

function assertStableRevision(previous, next) {
  if (next.changeId !== previous.changeId) throw new Error('Change Receipt revision cannot change changeId.');
  if (next.site !== previous.site || canonicalJson(next.repository) !== canonicalJson(previous.repository)) throw new Error('Change Receipt revision cannot change target site/repository identity.');
  if (canonicalJson(next.mutation.changes) !== canonicalJson(previous.mutation.changes)) throw new Error('Change Receipt revision cannot rewrite historical mutation changes.');
  if (next.source.transformationBundle.digest !== previous.source.transformationBundle.digest || next.source.adaptiveUpgradeDigest !== previous.source.adaptiveUpgradeDigest) throw new Error('Change Receipt revision cannot replace original transformation/upgrade evidence.');
  if (canonicalJson(next.source.ruleRefs) !== canonicalJson(previous.source.ruleRefs) || canonicalJson(next.source.sourceRefs) !== canonicalJson(previous.source.sourceRefs)) throw new Error('Change Receipt revision cannot rewrite original source/rule lineage.');
}

function applyExecutionRevision(receipt, execution) {
  if (!execution) return;
  const expectedBundleDigest = receipt.source.transformationBundle.digest;
  const evidence = execution.receipt;
  if (!evidence || evidence.sourceBundleSha256 !== expectedBundleDigest) throw new Error('Revision execution evidence does not match original Transformation Bundle digest.');
  const changes = new Map(receipt.mutation.changes.map(item => [item.path, item]));
  const rows = execution.kind === 'github-pr' ? arrays(evidence.operations) : arrays(evidence.changes);
  for (const row of rows) {
    const expected = changes.get(row.path);
    if (!expected || expected.recommendationId !== row.recommendationId || expected.beforeSha256 !== row.beforeSha256 || expected.afterSha256 !== row.afterSha256) throw new Error(`Revision execution evidence does not match change ${row.path}.`);
  }
  if (rows.length !== changes.size) throw new Error('Revision execution evidence does not cover every Change Receipt path.');
  const digest = sha256Digest(canonicalJson(evidence));
  if (execution.kind === 'local') {
    receipt.mutation.state = 'applied-local';
    receipt.mutation.executionKind = 'local';
    receipt.mutation.executedAt = iso(evidence.appliedAt);
    receipt.mutation.executionEvidenceDigest = digest;
    receipt.mutation.github = null;
    receipt.mutation.rollback = { state: 'private-material-available', evidenceDigest: digest };
  } else if (execution.kind === 'github-pr') {
    receipt.mutation.state = 'pr-opened';
    receipt.mutation.executionKind = 'github-pr';
    receipt.mutation.executedAt = iso(execution.observedAt || receipt.createdAt);
    receipt.mutation.executionEvidenceDigest = digest;
    receipt.mutation.github = {
      branch: String(evidence.branch),
      commitSha: String(evidence.commitSha),
      pullRequestNumber: Number(evidence.pullRequest?.number),
      pullRequestUrl: evidence.pullRequest?.url || null
    };
    receipt.mutation.rollback = { state: 'not-applicable', evidenceDigest: null };
  } else throw new Error(`Unsupported revision execution kind: ${execution.kind}`);
}

function applyMutationStateRevision(receipt, update) {
  if (!update) return;
  const state = String(update.state || '');
  if (!['merged', 'deployed', 'rolled-back', 'failed'].includes(state)) throw new Error(`Unsupported mutation revision state: ${state}`);
  if (['merged', 'deployed'].includes(state) && receipt.mutation.executionKind !== 'github-pr') throw new Error(`${state} mutation state requires prior github-pr execution evidence.`);
  receipt.mutation.state = state;
  if (update.observedAt) receipt.mutation.executedAt = iso(update.observedAt);
  if (update.evidence) receipt.mutation.executionEvidenceDigest = sha256Digest(canonicalJson(update.evidence));
  if (state === 'rolled-back') {
    receipt.mutation.rollback = {
      state: 'performed',
      evidenceDigest: update.evidence ? sha256Digest(canonicalJson(update.evidence)) : receipt.mutation.rollback.evidenceDigest
    };
  }
}

export function reviseChangeReceipt(previous, updates = {}, options = {}) {
  const priorVerification = verifyChangeReceipt(previous);
  if (!priorVerification.valid) throw new Error(`Cannot revise invalid Change Receipt: ${priorVerification.errors.map(error => error.message).join('; ')}`);
  const createdAt = iso(options.createdAt || updates.createdAt);
  const receipt = structuredClone(previous);
  receipt.receiptId = 'urn:sha256:' + '0'.repeat(64);
  receipt.digests.payload = 'sha256:' + '0'.repeat(64);
  receipt.revision = previous.revision + 1;
  receipt.previousReceiptId = previous.receiptId;
  receipt.createdAt = createdAt;

  receipt.source.evidenceReceipts = mergeEvidenceReceiptRefs(receipt.source.evidenceReceipts, updates.evidenceReceipts || []);
  applyExecutionRevision(receipt, updates.execution || null);
  applyMutationStateRevision(receipt, updates.mutation || null);

  const operationIds = new Set(receipt.mutation.changes.map(item => item.operationId));
  receipt.verification.observations = appendById(receipt.verification.observations, arrays(updates.verifications), record => normaliseVerification(record, operationIds));
  receipt.verification.status = verificationStatus(receipt.verification.observations);
  receipt.outcomes.observations = appendById(receipt.outcomes.observations, arrays(updates.outcomes), record => normaliseOutcome(record, operationIds));
  receipt.outcomes.status = outcomeStatus(receipt.outcomes.observations);
  if (updates.deployment !== undefined) receipt.deployment = normaliseDeployment(updates.deployment);
  if (updates.review !== undefined) receipt.review = normaliseReview(updates.review);

  if (updates.braidGraph) {
    const validation = validateBraidGraph(updates.braidGraph);
    if (!validation.valid) throw new Error('Current BraidGraph supplied to Change Receipt revision is invalid.');
    receipt.knowledge = knowledgeFromGraph(receipt.source.ruleRefs, updates.braidGraph, createdAt);
  } else {
    receipt.knowledge.checkedAt = createdAt;
  }

  assertStableRevision(previous, receipt);
  return finalise(receipt);
}

export function verifyChangeReceiptRevision(previous, current) {
  const before = verifyChangeReceipt(previous);
  const after = verifyChangeReceipt(current);
  const errors = [];
  if (!before.valid) errors.push({ instancePath: '/previous', message: 'previous receipt integrity failed' });
  if (!after.valid) errors.push({ instancePath: '/current', message: 'current receipt integrity failed' });
  if (current.previousReceiptId !== previous.receiptId) errors.push({ instancePath: '/previousReceiptId', message: 'does not reference previous receipt' });
  if (current.revision !== previous.revision + 1) errors.push({ instancePath: '/revision', message: 'must increment by exactly one' });
  try { assertStableRevision(previous, current); } catch (error) { errors.push({ instancePath: '/', message: error.message }); }
  return { valid: errors.length === 0, errors };
}

export function changeReceiptStatus(receipt) {
  const verification = verifyChangeReceipt(receipt);
  if (!verification.valid) throw new Error('A valid Change Receipt is required.');
  return {
    version: CHANGE_RECEIPT_VERSION,
    receiptId: receipt.receiptId,
    changeId: receipt.changeId,
    revision: receipt.revision,
    site: receipt.site,
    repository: receipt.repository,
    mutationState: receipt.mutation.state,
    verificationStatus: receipt.verification.status,
    deploymentState: receipt.deployment.state,
    outcomeStatus: receipt.outcomes.status,
    reReviewRequired: receipt.knowledge.reReviewRequired,
    reviewDecision: receipt.review.decision,
    missing: [
      ...(receipt.verification.status === 'unknown' ? ['verification'] : []),
      ...(receipt.deployment.state === 'unknown' ? ['deployment-evidence'] : []),
      ...(receipt.outcomes.status === 'unknown' ? ['outcome-evidence'] : []),
      ...(receipt.knowledge.reReviewRequired ? ['knowledge-re-review'] : [])
    ]
  };
}
