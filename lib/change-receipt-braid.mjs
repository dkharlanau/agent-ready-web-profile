import { createHash } from 'node:crypto';
import { canonicalJson } from './evidence-receipt.mjs';
import { validateBraidGraph } from './braid-graph.mjs';
import { verifyChangeReceipt } from './change-receipt.mjs';

function hash(value, length = 24) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex').slice(0, length);
}

function provenance(receipt, extra = {}) {
  return [{ artifact: 'change-receipt', ref: receipt.receiptId, ...extra }];
}

function receiptNodeId(receiptId) {
  return `change-receipt:${String(receiptId).replace(/^urn:sha256:/, '')}`;
}

function evidenceNodeId(type, receipt, observation) {
  return `${type}:change-receipt:${hash(`${receipt.receiptId}\n${observation.id}`)}`;
}

function edgeId(type, from, to, receipt, suffix = '') {
  return `edge:${type}:${hash(`${from}\n${to}\n${receipt.receiptId}\n${suffix}`)}`;
}

function maxTime(...values) {
  const dates = values.filter(Boolean).map(value => new Date(value)).filter(value => !Number.isNaN(value.getTime()));
  return dates.length ? new Date(Math.max(...dates.map(value => value.getTime()))).toISOString() : new Date().toISOString();
}

function summarize(nodes, edges) {
  const byNodeType = {};
  const byEdgeType = {};
  for (const node of nodes) byNodeType[node.type] = (byNodeType[node.type] || 0) + 1;
  for (const edge of edges) byEdgeType[edge.type] = (byEdgeType[edge.type] || 0) + 1;
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const verified = new Set(edges.filter(edge => edge.type === 'verifies' && nodeMap.get(edge.to)?.type === 'transform').map(edge => edge.to));
  const measured = new Set(edges.filter(edge => edge.type === 'observes' && nodeMap.get(edge.to)?.type === 'transform').map(edge => edge.to));
  return {
    nodes: nodes.length,
    edges: edges.length,
    byNodeType,
    byEdgeType,
    reviewDueRules: nodes.filter(node => node.type === 'rule' && node.state === 'review-due').length,
    transforms: nodes.filter(node => node.type === 'transform').length,
    verifiedTransforms: verified.size,
    measuredTransforms: measured.size
  };
}

function addNode(nodes, node) {
  const existing = nodes.get(node.id);
  if (existing && canonicalJson(existing) !== canonicalJson(node)) throw new Error(`BraidGraph Change Receipt node collision: ${node.id}`);
  nodes.set(node.id, node);
}

function addEdge(edges, edge) {
  const existing = edges.get(edge.id);
  if (existing && canonicalJson(existing) !== canonicalJson(edge)) throw new Error(`BraidGraph Change Receipt edge collision: ${edge.id}`);
  edges.set(edge.id, edge);
}

function transformForOperation(graph, operationId) {
  return graph.nodes.find(node => node.type === 'transform' && node.data?.operationId === operationId) || null;
}

export function mergeChangeReceiptIntoBraidGraph(inputGraph, receipt) {
  const graphValidation = validateBraidGraph(inputGraph);
  if (!graphValidation.valid) throw new Error(`A valid BraidGraph is required: ${graphValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  const receiptValidation = verifyChangeReceipt(receipt);
  if (!receiptValidation.valid) throw new Error(`A valid Change Receipt is required: ${receiptValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  if (inputGraph.site !== receipt.site) throw new Error(`Change Receipt site ${receipt.site} does not match BraidGraph site ${inputGraph.site}.`);
  if (inputGraph.repository?.fullName !== receipt.repository.fullName) throw new Error('Change Receipt repository does not match BraidGraph repository.');
  if (inputGraph.inputs?.transformationBundle?.digest !== receipt.source.transformationBundle.digest) throw new Error('Change Receipt Transformation Bundle digest does not match BraidGraph input.');

  const graph = structuredClone(inputGraph);
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const edges = new Map(graph.edges.map(edge => [edge.id, edge]));
  const id = receiptNodeId(receipt.receiptId);

  addNode(nodes, {
    id,
    type: 'change-receipt',
    versionKey: receipt.receiptId,
    state: receipt.mutation.state,
    data: {
      receiptId: receipt.receiptId,
      changeId: receipt.changeId,
      revision: receipt.revision,
      previousReceiptId: receipt.previousReceiptId,
      mutationState: receipt.mutation.state,
      verificationStatus: receipt.verification.status,
      deploymentState: receipt.deployment.state,
      outcomeStatus: receipt.outcomes.status,
      reReviewRequired: receipt.knowledge.reReviewRequired,
      reviewDecision: receipt.review.decision,
      evidenceReceiptIds: receipt.source.evidenceReceipts.map(item => item.receiptId),
      payloadDigest: receipt.digests.payload
    },
    provenance: provenance(receipt)
  });

  for (const change of receipt.mutation.changes) {
    const transform = transformForOperation(graph, change.operationId);
    if (!transform) throw new Error(`Change Receipt references transform operation absent from BraidGraph: ${change.operationId}`);
    if (transform.data?.beforeSha256 !== change.beforeSha256 || transform.data?.afterSha256 !== change.afterSha256 || transform.data?.path !== change.path) throw new Error(`Change Receipt mutation evidence conflicts with BraidGraph transform ${change.operationId}.`);
    addEdge(edges, {
      id: edgeId('depends-on', id, transform.id, receipt, change.operationId),
      type: 'depends-on',
      from: id,
      to: transform.id,
      state: 'records-exact-transform',
      observedAt: receipt.createdAt,
      provenance: provenance(receipt, { operationId: change.operationId })
    });
  }

  if (receipt.previousReceiptId) {
    const previous = [...nodes.values()].find(node => node.type === 'change-receipt' && node.data?.receiptId === receipt.previousReceiptId);
    if (!previous) throw new Error(`Previous Change Receipt must be present in BraidGraph before its revision is merged: ${receipt.previousReceiptId}`);
    addEdge(edges, {
      id: edgeId('supersedes', id, previous.id, receipt),
      type: 'supersedes',
      from: id,
      to: previous.id,
      state: 'immutable-revision-chain',
      observedAt: receipt.createdAt,
      provenance: provenance(receipt)
    });
  }

  for (const observation of receipt.verification.observations) {
    const verificationId = evidenceNodeId('verification', receipt, observation);
    addNode(nodes, {
      id: verificationId,
      type: 'verification',
      versionKey: observation.observedAt,
      state: observation.status,
      data: {
        kind: observation.kind,
        receiptId: receipt.receiptId,
        observationId: observation.id,
        operationId: observation.operationId,
        evidenceRefs: observation.evidenceRefs,
        note: observation.note
      },
      provenance: provenance(receipt, { observationId: observation.id })
    });
    addEdge(edges, {
      id: edgeId('verifies', verificationId, id, receipt, observation.id),
      type: 'verifies',
      from: verificationId,
      to: id,
      state: observation.status,
      observedAt: observation.observedAt,
      provenance: provenance(receipt, { observationId: observation.id })
    });
  }

  for (const observation of receipt.outcomes.observations) {
    const measurementId = evidenceNodeId('measurement', receipt, observation);
    addNode(nodes, {
      id: measurementId,
      type: 'measurement',
      versionKey: observation.observedAt,
      state: observation.status,
      data: {
        kind: observation.kind,
        receiptId: receipt.receiptId,
        observationId: observation.id,
        operationId: observation.operationId,
        provider: observation.provider,
        metric: observation.metric,
        value: observation.value,
        evidenceClass: observation.evidenceClass,
        evidenceRefs: observation.evidenceRefs,
        note: observation.note
      },
      provenance: provenance(receipt, { observationId: observation.id })
    });
    addEdge(edges, {
      id: edgeId('observes', measurementId, id, receipt, observation.id),
      type: 'observes',
      from: measurementId,
      to: id,
      state: observation.status,
      observedAt: observation.observedAt,
      provenance: provenance(receipt, { observationId: observation.id })
    });
  }

  graph.nodes = [...nodes.values()].sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
  graph.edges = [...edges.values()].sort((a, b) => a.type.localeCompare(b.type) || a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.id.localeCompare(b.id));
  graph.generatedAt = maxTime(graph.generatedAt, receipt.createdAt, receipt.deployment.observedAt, ...receipt.verification.observations.map(item => item.observedAt), ...receipt.outcomes.observations.map(item => item.observedAt));
  graph.summary = summarize(graph.nodes, graph.edges);

  const validation = validateBraidGraph(graph);
  if (!validation.valid) throw new Error(`BraidGraph with Change Receipt is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return graph;
}

export function changeReceiptBraidReport(graph) {
  const validation = validateBraidGraph(graph);
  if (!validation.valid) throw new Error('A valid BraidGraph is required.');
  const receipts = graph.nodes.filter(node => node.type === 'change-receipt');
  const latest = new Map();
  for (const node of receipts) {
    const key = node.data?.changeId || node.id;
    const prior = latest.get(key);
    if (!prior || Number(node.data?.revision || 0) > Number(prior.data?.revision || 0)) latest.set(key, node);
  }
  const rows = [...latest.values()].map(node => ({
    nodeId: node.id,
    receiptId: node.data?.receiptId || null,
    changeId: node.data?.changeId || null,
    revision: Number(node.data?.revision || 0),
    mutationState: node.data?.mutationState || node.state,
    verificationStatus: node.data?.verificationStatus || 'unknown',
    deploymentState: node.data?.deploymentState || 'unknown',
    outcomeStatus: node.data?.outcomeStatus || 'unknown',
    reReviewRequired: Boolean(node.data?.reReviewRequired),
    reviewDecision: node.data?.reviewDecision || 'pending'
  })).sort((a, b) => String(a.changeId).localeCompare(String(b.changeId)));

  const mergedStates = new Set(['merged', 'deployed']);
  return {
    version: '0.1',
    site: graph.site,
    receipts: receipts.length,
    changes: rows.length,
    latest: rows,
    queues: {
      mergedButUnmeasured: rows.filter(row => mergedStates.has(row.mutationState) && row.outcomeStatus === 'unknown'),
      missingVerification: rows.filter(row => row.mutationState !== 'planned' && row.verificationStatus === 'unknown'),
      reReviewRequired: rows.filter(row => row.reReviewRequired),
      failedVerification: rows.filter(row => ['failed', 'mixed'].includes(row.verificationStatus)),
      rolledBack: rows.filter(row => row.mutationState === 'rolled-back')
    },
    interpretation: {
      missingOwnerEvidenceIsUnknownNotZero: true,
      mergedDoesNotMeanMeasured: true,
      reReviewDoesNotMeanBroken: true
    }
  };
}
