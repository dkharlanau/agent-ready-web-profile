import crypto from 'node:crypto';
import { validateBraidGraph } from './braid-graph.mjs';

export const BRAID_HISTORY_VERSION = '0.1';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function canonical(value) {
  return JSON.stringify(stable(value));
}

function sha(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function iso(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date/time: ${value}`);
  return date.toISOString();
}

function arrays(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter(value => value != null && String(value).trim()).map(value => String(value)))];
}

function targetNode(graph, revision) {
  if (revision.entityType === 'rule') {
    return graph.nodes.find(node => node.type === 'rule' && node.data?.ruleId === revision.currentRef) || null;
  }
  if (revision.entityType === 'source') {
    return graph.nodes.find(node => node.type === 'source' && node.data?.url === revision.currentRef) || null;
  }
  throw new Error(`Unsupported revision entityType: ${revision.entityType}`);
}

function normalizeRevision(record) {
  if (!record || typeof record !== 'object') throw new Error('Braid history records must be objects.');
  const entityType = String(record.entityType || '');
  if (!['source', 'rule'].includes(entityType)) throw new Error(`Braid history entityType must be source or rule: ${record.entityType}`);
  const currentRef = String(record.currentRef || '').trim();
  if (!currentRef) throw new Error('Braid history currentRef is required.');
  const previousVersionKey = String(record.previousVersionKey || '').trim();
  if (!previousVersionKey) throw new Error('Braid history previousVersionKey is required.');
  const previousState = String(record.previousState || 'superseded').trim();
  if (!previousState) throw new Error('Braid history previousState is required.');
  const observedAt = iso(record.observedAt);
  const id = String(record.id || `${entityType}:${currentRef}:${previousVersionKey}:${observedAt}`);
  return {
    id,
    entityType,
    currentRef,
    previousVersionKey,
    previousState,
    observedAt,
    previousData: record.previousData && typeof record.previousData === 'object' ? record.previousData : {},
    evidence: uniqueStrings(record.evidence || []),
    note: record.note == null ? null : String(record.note)
  };
}

function priorNodeId(revision) {
  return `historical:${revision.entityType}:${sha(`${revision.entityType}\n${revision.currentRef}\n${revision.previousVersionKey}`).slice(0, 24)}`;
}

function supersedesEdgeId(currentId, previousId, revision) {
  return `edge:supersedes:${sha(`${currentId}\n${previousId}\n${revision.id}`).slice(0, 24)}`;
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

function latestTimestamp(graph, revisions) {
  const values = [graph.generatedAt, ...revisions.map(item => item.observedAt)]
    .map(value => new Date(value))
    .filter(value => !Number.isNaN(value.getTime()));
  return new Date(Math.max(...values.map(value => value.getTime()))).toISOString();
}

export function enrichBraidHistory(inputGraph, revisionRecords = []) {
  const validation = validateBraidGraph(inputGraph);
  if (!validation.valid) throw new Error(`A valid BraidGraph is required: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  const revisions = arrays(revisionRecords).map(normalizeRevision);
  if (!revisions.length) return structuredClone(inputGraph);

  const graph = structuredClone(inputGraph);
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const edges = new Map(graph.edges.map(edge => [edge.id, edge]));

  for (const revision of revisions) {
    const current = targetNode(graph, revision);
    if (!current) throw new Error(`Current ${revision.entityType} not found for history record ${revision.id}: ${revision.currentRef}`);
    if (current.versionKey === revision.previousVersionKey) {
      throw new Error(`History record ${revision.id} previousVersionKey equals the current node versionKey.`);
    }

    const previousId = priorNodeId(revision);
    const prior = {
      id: previousId,
      type: revision.entityType,
      versionKey: revision.previousVersionKey,
      state: revision.previousState,
      data: {
        ...structuredClone(current.data),
        ...structuredClone(revision.previousData),
        historical: true,
        supersededBy: current.id,
        historyNote: revision.note
      },
      provenance: [
        {
          artifact: 'braid-revision-evidence',
          ref: revision.id,
          observedAt: revision.observedAt,
          evidence: revision.evidence
        }
      ]
    };

    const existing = nodes.get(previousId);
    if (existing && canonical(existing) !== canonical(prior)) {
      throw new Error(`Conflicting Braid history records resolve to the same prior node: ${previousId}`);
    }
    nodes.set(previousId, prior);

    const edge = {
      id: supersedesEdgeId(current.id, previousId, revision),
      type: 'supersedes',
      from: current.id,
      to: previousId,
      state: 'recorded-revision',
      observedAt: revision.observedAt,
      provenance: [
        {
          artifact: 'braid-revision-evidence',
          ref: revision.id,
          evidence: revision.evidence
        }
      ]
    };
    edges.set(edge.id, edge);
  }

  graph.nodes = [...nodes.values()].sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
  graph.edges = [...edges.values()].sort((a, b) => a.type.localeCompare(b.type) || a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.id.localeCompare(b.id));
  graph.generatedAt = latestTimestamp(graph, revisions);
  graph.summary = summarize(graph.nodes, graph.edges);

  const enrichedValidation = validateBraidGraph(graph);
  if (!enrichedValidation.valid) throw new Error(`Enriched BraidGraph is invalid: ${enrichedValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return graph;
}

export function revisionDigest(revisionRecords = []) {
  const revisions = arrays(revisionRecords).map(normalizeRevision);
  return `sha256:${sha(canonical(revisions))}`;
}
