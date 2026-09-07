import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateAdaptiveUpgradeGraph } from './adaptive-upgrade.mjs';
import { validateTransformationBundle } from './transformation-engine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'braid-graph.schema.json');

export const BRAID_GRAPH_VERSION = '0.1';

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

export function canonicalBraidJson(value) {
  return JSON.stringify(stable(value));
}

export function braidSha256(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value), 'utf8').digest('hex')}`;
}

function digestObject(value) {
  return braidSha256(canonicalBraidJson(value));
}

function shortHash(value, length = 16) {
  return braidSha256(value).slice(7, 7 + length);
}

function slug(value, max = 72) {
  const text = String(value || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return (text || 'item').slice(0, max);
}

function arrays(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function unique(values = []) {
  return [...new Set(values.filter(value => value != null && String(value).trim()).map(value => String(value)))];
}

function iso(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date/time: ${value}`);
  return date.toISOString();
}

function latestTimestamp(values, fallback) {
  const valid = values
    .filter(Boolean)
    .map(value => new Date(value))
    .filter(value => !Number.isNaN(value.getTime()));
  if (!valid.length) return iso(fallback || new Date());
  return new Date(Math.max(...valid.map(value => value.getTime()))).toISOString();
}

function provenance(artifact, ref, extra = {}) {
  return { artifact, ref: String(ref), ...extra };
}

function artifact(kind, value, fallbackVersion = '0.1') {
  return {
    kind,
    version: String(value?.version || fallbackVersion),
    generatedAt: value?.generatedAt ? iso(value.generatedAt) : null,
    digest: digestObject(value)
  };
}

function nodeId(type, identity) {
  return `${type}:${slug(identity, 84)}:${shortHash(identity, 12)}`;
}

function edgeId(type, from, to, discriminator = '') {
  return `edge:${type}:${shortHash(`${type}\n${from}\n${to}\n${discriminator}`, 20)}`;
}

class Builder {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
  }

  addNode(node) {
    const existing = this.nodes.get(node.id);
    if (!existing) {
      this.nodes.set(node.id, node);
      return node;
    }
    if (existing.type !== node.type || existing.versionKey !== node.versionKey) {
      throw new Error(`BraidGraph node ID collision: ${node.id}`);
    }
    const mergedProvenance = new Map();
    for (const item of [...existing.provenance, ...node.provenance]) mergedProvenance.set(canonicalBraidJson(item), item);
    existing.provenance = [...mergedProvenance.values()];
    if (existing.state !== 'review-due' && node.state === 'review-due') existing.state = 'review-due';
    existing.data = { ...existing.data, ...node.data };
    return existing;
  }

  addEdge(type, from, to, options = {}) {
    const id = edgeId(type, from, to, options.discriminator || options.state || '');
    const edge = {
      id,
      type,
      from,
      to,
      state: String(options.state || 'active'),
      observedAt: options.observedAt ? iso(options.observedAt) : null,
      provenance: arrays(options.provenance)
    };
    this.edges.set(id, edge);
    return edge;
  }

  finish() {
    return {
      nodes: [...this.nodes.values()].sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id)),
      edges: [...this.edges.values()].sort((a, b) => a.type.localeCompare(b.type) || a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.id.localeCompare(b.id))
    };
  }
}

function semanticErrors(graph) {
  const errors = [];
  const nodeIds = new Set();
  for (const [index, node] of arrays(graph?.nodes).entries()) {
    if (nodeIds.has(node.id)) errors.push({ instancePath: `/nodes/${index}/id`, message: `duplicate node id ${node.id}` });
    nodeIds.add(node.id);
  }
  const edgeIds = new Set();
  for (const [index, edge] of arrays(graph?.edges).entries()) {
    if (edgeIds.has(edge.id)) errors.push({ instancePath: `/edges/${index}/id`, message: `duplicate edge id ${edge.id}` });
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.from)) errors.push({ instancePath: `/edges/${index}/from`, message: `dangling from node ${edge.from}` });
    if (!nodeIds.has(edge.to)) errors.push({ instancePath: `/edges/${index}/to`, message: `dangling to node ${edge.to}` });
  }
  return errors;
}

export function validateBraidGraph(graph) {
  const validate = validator();
  const schemaValid = Boolean(validate(graph));
  const semantic = schemaValid ? semanticErrors(graph) : [];
  return { valid: schemaValid && semantic.length === 0, errors: [...(validate.errors || []), ...semantic] };
}

function sourceNodeKey(url, reviewedAt) {
  return nodeId('source', `${url}@${reviewedAt}`);
}

function ruleNodeKey(ruleId, registryVersion) {
  return nodeId('rule', `${ruleId}@${registryVersion}`);
}

function recommendationNodeKey(site, recommendationId, upgradeDigest) {
  return nodeId('recommendation', `${site}:${recommendationId}:${upgradeDigest}`);
}

function surfaceNodeKey(site, target) {
  return nodeId('surface', `${site}:${target}`);
}

function repoFileNodeKey(repository, pathname) {
  return nodeId('repo-file', `${repository}:${pathname}`);
}

function transformNodeKey(operationId) {
  return nodeId('transform', operationId);
}

function policyNodeKey(bundleDigest) {
  return nodeId('policy', bundleDigest);
}

function factNodeKey(site, statement) {
  return nodeId('fact', `${site}:${statement}`);
}

function verificationNodeKey(record) {
  return nodeId('verification', record.id || canonicalBraidJson(record));
}

function measurementNodeKey(record) {
  return nodeId('measurement', record.id || canonicalBraidJson(record));
}

function normalizeVerification(record) {
  if (!record || typeof record !== 'object') throw new Error('Verification evidence records must be objects.');
  if (!record.transformOperationId) throw new Error('Verification evidence requires transformOperationId.');
  if (!record.status) throw new Error('Verification evidence requires status.');
  if (!record.observedAt) throw new Error('Verification evidence requires observedAt.');
  return {
    id: record.id == null ? null : String(record.id),
    transformOperationId: String(record.transformOperationId),
    status: String(record.status),
    observedAt: iso(record.observedAt),
    kind: String(record.kind || 'implementation-check'),
    evidence: unique(record.evidence || []),
    note: record.note == null ? null : String(record.note)
  };
}

function normalizeMeasurement(record) {
  if (!record || typeof record !== 'object') throw new Error('Measurement evidence records must be objects.');
  if (!record.target || typeof record.target !== 'object') throw new Error('Measurement evidence requires target.');
  if (!['site', 'surface', 'transform'].includes(record.target.type)) throw new Error(`Unsupported measurement target type: ${record.target.type}`);
  if (!record.target.ref) throw new Error('Measurement evidence target.ref is required.');
  if (!record.status) throw new Error('Measurement evidence requires status.');
  if (!record.observedAt) throw new Error('Measurement evidence requires observedAt.');
  return {
    id: record.id == null ? null : String(record.id),
    target: { type: String(record.target.type), ref: String(record.target.ref) },
    status: String(record.status),
    observedAt: iso(record.observedAt),
    kind: String(record.kind || 'external-outcome'),
    provider: record.provider == null ? null : String(record.provider),
    metric: record.metric == null ? null : String(record.metric),
    value: record.value ?? null,
    evidenceClass: String(record.evidenceClass || 'unknown'),
    evidence: unique(record.evidence || []),
    note: record.note == null ? null : String(record.note)
  };
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

export function compileBraidGraph(input, options = {}) {
  const upgradeGraph = input?.upgradeGraph || input?.adaptiveUpgradeGraph;
  if (!upgradeGraph) throw new Error('compileBraidGraph requires upgradeGraph.');
  const upgradeValidation = validateAdaptiveUpgradeGraph(upgradeGraph);
  if (!upgradeValidation.valid) throw new Error(`Invalid Adaptive Upgrade graph: ${upgradeValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);

  const transformationBundle = input?.transformationBundle || null;
  if (transformationBundle) {
    const transformValidation = validateTransformationBundle(transformationBundle);
    if (!transformValidation.valid) throw new Error(`Invalid Transformation Bundle: ${transformValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
    if (transformationBundle.site !== upgradeGraph.site) throw new Error('Transformation Bundle site does not match Adaptive Upgrade graph site.');
    const expectedDigest = digestObject(upgradeGraph);
    if (transformationBundle.sourceUpgrade?.sha256 !== expectedDigest) throw new Error('Transformation Bundle does not reference this exact Adaptive Upgrade graph digest.');
  }

  const verifications = arrays(input?.verifications).map(normalizeVerification);
  const measurements = arrays(input?.measurements).map(normalizeMeasurement);
  if (verifications.length && !transformationBundle) throw new Error('Verification evidence requires a Transformation Bundle.');

  const generatedAt = latestTimestamp([
    options.generatedAt,
    upgradeGraph.generatedAt,
    transformationBundle?.generatedAt,
    ...verifications.map(item => item.observedAt),
    ...measurements.map(item => item.observedAt)
  ], upgradeGraph.generatedAt);
  const builder = new Builder();
  const upgradeArtifact = artifact('adaptive-upgrade-graph', upgradeGraph);
  const transformArtifact = transformationBundle ? artifact('transformation-bundle', transformationBundle) : null;
  const siteId = nodeId('site', upgradeGraph.site);
  builder.addNode({
    id: siteId,
    type: 'site',
    versionKey: upgradeGraph.site,
    state: 'target',
    data: { canonicalUrl: upgradeGraph.site, verticals: upgradeGraph.context.verticals, goals: upgradeGraph.context.goals },
    provenance: [provenance('adaptive-upgrade-graph', upgradeArtifact.digest)]
  });

  const recommendationNodes = new Map();
  const ruleNodes = new Map();
  const surfaceNodes = new Map();
  const reviewedAt = upgradeGraph.knowledge.reviewedAt;
  const registryVersion = upgradeGraph.knowledge.registryVersion;

  for (const recommendation of upgradeGraph.recommendations) {
    const ruleId = ruleNodeKey(recommendation.id, registryVersion);
    ruleNodes.set(recommendation.id, ruleId);
    builder.addNode({
      id: ruleId,
      type: 'rule',
      versionKey: `${registryVersion}:${reviewedAt}`,
      state: recommendation.knowledgeState,
      data: {
        ruleId: recommendation.id,
        title: recommendation.title,
        priority: recommendation.priority,
        lane: recommendation.lane,
        authority: recommendation.authority,
        automationClass: recommendation.change.automationClass,
        sourceReviewedAt: reviewedAt
      },
      provenance: [provenance('adaptive-upgrade-graph', recommendation.id)]
    });

    for (const sourceUrl of recommendation.sources) {
      const sourceId = sourceNodeKey(sourceUrl, reviewedAt);
      builder.addNode({
        id: sourceId,
        type: 'source',
        versionKey: reviewedAt,
        state: recommendation.knowledgeState,
        data: { url: sourceUrl, reviewedAt, authority: recommendation.authority },
        provenance: [provenance('adaptive-upgrade-graph', recommendation.id)]
      });
      builder.addEdge('supports', sourceId, ruleId, {
        state: recommendation.knowledgeState,
        observedAt: upgradeGraph.generatedAt,
        provenance: [provenance('adaptive-upgrade-graph', recommendation.id, { source: sourceUrl })]
      });
    }

    const recommendationId = recommendationNodeKey(upgradeGraph.site, recommendation.id, upgradeArtifact.digest);
    recommendationNodes.set(recommendation.id, recommendationId);
    builder.addNode({
      id: recommendationId,
      type: 'recommendation',
      versionKey: upgradeArtifact.digest,
      state: recommendation.state,
      data: {
        recommendationId: recommendation.id,
        title: recommendation.title,
        priority: recommendation.priority,
        lane: recommendation.lane,
        knowledgeState: recommendation.knowledgeState,
        reason: recommendation.reason,
        condition: recommendation.condition ?? null,
        automationClass: recommendation.change.automationClass,
        verificationChecks: recommendation.verification.checks,
        measurementSignals: recommendation.measurement.signals,
        ownerDataRequired: recommendation.measurement.ownerDataRequired,
        addresses: recommendation.addresses,
        evidence: recommendation.evidence
      },
      provenance: [provenance('adaptive-upgrade-graph', recommendation.id)]
    });
    builder.addEdge('applies-to', ruleId, recommendationId, {
      state: recommendation.state,
      observedAt: upgradeGraph.generatedAt,
      provenance: [provenance('adaptive-upgrade-graph', recommendation.id)]
    });

    for (const target of recommendation.change.targets) {
      const surfaceId = surfaceNodeKey(upgradeGraph.site, target);
      surfaceNodes.set(target, surfaceId);
      builder.addNode({
        id: surfaceId,
        type: 'surface',
        versionKey: upgradeArtifact.digest,
        state: 'target-reference',
        data: { target, existence: 'unverified', canonicalSite: upgradeGraph.site },
        provenance: [provenance('adaptive-upgrade-graph', recommendation.id)]
      });
      builder.addEdge('has-surface', siteId, surfaceId, {
        state: 'target-reference',
        observedAt: upgradeGraph.generatedAt,
        provenance: [provenance('adaptive-upgrade-graph', recommendation.id)]
      });
      builder.addEdge('targets', recommendationId, surfaceId, {
        state: recommendation.state,
        observedAt: upgradeGraph.generatedAt,
        provenance: [provenance('adaptive-upgrade-graph', recommendation.id)]
      });
    }
  }

  for (const recommendation of upgradeGraph.recommendations) {
    const from = recommendationNodes.get(recommendation.id);
    for (const dependency of recommendation.dependencies || []) {
      let to = ruleNodes.get(dependency);
      if (!to) {
        to = ruleNodeKey(dependency, registryVersion);
        ruleNodes.set(dependency, to);
        builder.addNode({
          id: to,
          type: 'rule',
          versionKey: `${registryVersion}:${reviewedAt}`,
          state: 'dependency-unresolved-in-current-plan',
          data: { ruleId: dependency, title: null, sourceReviewedAt: reviewedAt },
          provenance: [provenance('adaptive-upgrade-graph', recommendation.id, { dependency })]
        });
      }
      builder.addEdge('depends-on', from, to, {
        state: 'declared',
        observedAt: upgradeGraph.generatedAt,
        provenance: [provenance('adaptive-upgrade-graph', recommendation.id, { dependency })]
      });
    }
  }

  const transformNodesByOperation = new Map();
  if (transformationBundle) {
    const repository = transformationBundle.repository.fullName;
    const policyId = policyNodeKey(transformArtifact.digest);
    builder.addNode({
      id: policyId,
      type: 'policy',
      versionKey: transformArtifact.digest,
      state: 'enforced-by-bundle',
      data: {
        delivery: transformationBundle.policy.delivery,
        allowedPaths: transformationBundle.policy.allowedPaths,
        blockedPrefixes: transformationBundle.policy.blockedPrefixes,
        maxFiles: transformationBundle.policy.maxFiles,
        maxTotalBytes: transformationBundle.policy.maxTotalBytes,
        guardrails: transformationBundle.guardrails
      },
      provenance: [provenance('transformation-bundle', transformArtifact.digest)]
    });

    for (const operation of transformationBundle.operations) {
      const recommendationId = recommendationNodes.get(operation.recommendationId);
      if (!recommendationId) throw new Error(`Transformation operation references recommendation not present in upgrade graph: ${operation.recommendationId}`);
      const fileId = repoFileNodeKey(repository, operation.path);
      builder.addNode({
        id: fileId,
        type: 'repo-file',
        versionKey: `${repository}:${transformationBundle.repository.baseCommitSha || transformationBundle.repository.baseRef}`,
        state: operation.precondition.exists ? 'existing-at-base' : 'planned-create',
        data: {
          repository,
          path: operation.path,
          baseRef: transformationBundle.repository.baseRef,
          baseCommitSha: transformationBundle.repository.baseCommitSha,
          beforeSha256: operation.precondition.sha256,
          plannedAfterSha256: operation.after.sha256,
          mediaType: operation.mediaType
        },
        provenance: [provenance('transformation-bundle', operation.id)]
      });

      const transformId = transformNodeKey(operation.id);
      transformNodesByOperation.set(operation.id, transformId);
      builder.addNode({
        id: transformId,
        type: 'transform',
        versionKey: transformArtifact.digest,
        state: 'planned',
        data: {
          operationId: operation.id,
          recommendationId: operation.recommendationId,
          operation: operation.operation,
          path: operation.path,
          automationClass: operation.automationClass,
          humanReviewRequired: operation.humanReviewRequired,
          beforeSha256: operation.precondition.sha256,
          afterSha256: operation.after.sha256,
          verificationChecks: operation.verification,
          groundingEvidence: operation.groundedEvidence
        },
        provenance: [provenance('transformation-bundle', operation.id)]
      });
      builder.addEdge('implements', transformId, recommendationId, {
        state: 'planned',
        observedAt: transformationBundle.generatedAt,
        provenance: [provenance('transformation-bundle', operation.id)]
      });
      builder.addEdge('mutates', transformId, fileId, {
        state: 'planned',
        observedAt: transformationBundle.generatedAt,
        provenance: [provenance('transformation-bundle', operation.id)]
      });
      builder.addEdge('targets', recommendationId, fileId, {
        state: 'resolved-repository-target',
        observedAt: transformationBundle.generatedAt,
        provenance: [provenance('transformation-bundle', operation.id)]
      });
      builder.addEdge('allows', policyId, transformId, {
        state: 'bundle-policy-allows-planned-operation',
        observedAt: transformationBundle.generatedAt,
        provenance: [provenance('transformation-bundle', operation.id)]
      });

      for (const statement of operation.groundedEvidence || []) {
        const factId = factNodeKey(upgradeGraph.site, statement);
        builder.addNode({
          id: factId,
          type: 'fact',
          versionKey: transformArtifact.digest,
          state: 'reviewed-operation-grounding',
          data: { statement, evidenceClass: 'transformation-grounding' },
          provenance: [provenance('transformation-bundle', operation.id)]
        });
        builder.addEdge('grounds', factId, recommendationId, {
          state: 'reviewed-operation-grounding',
          observedAt: transformationBundle.generatedAt,
          provenance: [provenance('transformation-bundle', operation.id)]
        });
      }
    }

    for (const gated of transformationBundle.gatedRecommendations || []) {
      const recommendationId = recommendationNodes.get(gated.recommendationId);
      if (!recommendationId) continue;
      builder.addEdge('blocks', policyId, recommendationId, {
        state: gated.reason,
        observedAt: transformationBundle.generatedAt,
        provenance: [provenance('transformation-bundle', gated.recommendationId, { reason: gated.reason })]
      });
    }
  }

  for (const record of verifications) {
    const transformId = transformNodesByOperation.get(record.transformOperationId);
    if (!transformId) throw new Error(`Verification references unknown transform operation: ${record.transformOperationId}`);
    const id = verificationNodeKey(record);
    builder.addNode({
      id,
      type: 'verification',
      versionKey: record.observedAt,
      state: record.status,
      data: { kind: record.kind, evidence: record.evidence, note: record.note },
      provenance: [provenance('verification-evidence', record.id || id)]
    });
    builder.addEdge('verifies', id, transformId, {
      state: record.status,
      observedAt: record.observedAt,
      provenance: [provenance('verification-evidence', record.id || id)]
    });
  }

  const resolveMeasurementTarget = record => {
    if (record.target.type === 'site') {
      if (![upgradeGraph.site, 'site', siteId].includes(record.target.ref)) throw new Error(`Measurement site ref does not match target site: ${record.target.ref}`);
      return siteId;
    }
    if (record.target.type === 'transform') {
      if (record.target.ref.startsWith('transform:')) return record.target.ref;
      const target = transformNodesByOperation.get(record.target.ref);
      if (!target) throw new Error(`Measurement references unknown transform operation: ${record.target.ref}`);
      return target;
    }
    if (record.target.ref.startsWith('surface:')) return record.target.ref;
    const target = surfaceNodes.get(record.target.ref);
    if (!target) throw new Error(`Measurement references unknown surface target: ${record.target.ref}`);
    return target;
  };

  for (const record of measurements) {
    const targetId = resolveMeasurementTarget(record);
    const id = measurementNodeKey(record);
    builder.addNode({
      id,
      type: 'measurement',
      versionKey: record.observedAt,
      state: record.status,
      data: {
        kind: record.kind,
        provider: record.provider,
        metric: record.metric,
        value: record.value,
        evidenceClass: record.evidenceClass,
        evidence: record.evidence,
        note: record.note
      },
      provenance: [provenance('measurement-evidence', record.id || id)]
    });
    builder.addEdge('observes', id, targetId, {
      state: record.status,
      observedAt: record.observedAt,
      provenance: [provenance('measurement-evidence', record.id || id)]
    });
  }

  const built = builder.finish();
  const graph = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/braid-graph.schema.json',
    version: BRAID_GRAPH_VERSION,
    generatedAt,
    site: upgradeGraph.site,
    repository: transformationBundle ? {
      fullName: transformationBundle.repository.fullName,
      baseRef: transformationBundle.repository.baseRef,
      baseCommitSha: transformationBundle.repository.baseCommitSha
    } : null,
    inputs: {
      adaptiveUpgrade: upgradeArtifact,
      ...(transformArtifact ? { transformationBundle: transformArtifact } : {}),
      ...(verifications.length ? { verificationEvidence: artifact('braid-verification-evidence', verifications) } : {}),
      ...(measurements.length ? { measurementEvidence: artifact('braid-measurement-evidence', measurements) } : {})
    },
    nodes: built.nodes,
    edges: built.edges,
    summary: summarize(built.nodes, built.edges),
    guardrails: {
      graphIsIndexNotAuthority: true,
      recommendationIsNotAuthorization: true,
      verificationIsNotOutcome: true,
      measurementIsNotCausality: true,
      historyIsVersioned: true,
      ownerEvidenceMayRemainPrivate: true,
      noRankingGuarantee: true
    }
  };

  const validation = validateBraidGraph(graph);
  if (!validation.valid) throw new Error(`Generated BraidGraph is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return graph;
}

function graphIndex(graph) {
  const validation = validateBraidGraph(graph);
  if (!validation.valid) throw new Error(`Invalid BraidGraph: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return {
    node: new Map(graph.nodes.map(item => [item.id, item])),
    incoming: graph.edges.reduce((map, edge) => {
      if (!map.has(edge.to)) map.set(edge.to, []);
      map.get(edge.to).push(edge);
      return map;
    }, new Map()),
    outgoing: graph.edges.reduce((map, edge) => {
      if (!map.has(edge.from)) map.set(edge.from, []);
      map.get(edge.from).push(edge);
      return map;
    }, new Map())
  };
}

export function findBraidNode(graph, selector = {}) {
  if (selector.nodeId) return graph.nodes.find(node => node.id === selector.nodeId) || null;
  if (selector.path) return graph.nodes.find(node => node.type === 'repo-file' && node.data?.path === selector.path) || null;
  if (selector.source) return graph.nodes.find(node => node.type === 'source' && node.data?.url === selector.source) || null;
  if (selector.rule) return graph.nodes.find(node => node.type === 'rule' && node.data?.ruleId === selector.rule) || null;
  if (selector.recommendation) return graph.nodes.find(node => node.type === 'recommendation' && node.data?.recommendationId === selector.recommendation) || null;
  if (selector.transform) return graph.nodes.find(node => node.type === 'transform' && (node.id === selector.transform || node.data?.operationId === selector.transform)) || null;
  return null;
}

const UPSTREAM_INCOMING = new Set(['supports', 'applies-to', 'mutates', 'targets', 'grounds', 'allows', 'blocks', 'has-surface', 'renders']);
const UPSTREAM_OUTGOING = new Set(['implements', 'depends-on']);
const DOWNSTREAM_OUTGOING = new Set(['supports', 'applies-to', 'targets', 'mutates', 'has-surface', 'renders', 'grounds', 'supersedes']);
const DOWNSTREAM_REVERSE = new Set(['implements', 'depends-on', 'verifies', 'observes']);

function traverse(graph, startId, mode, maxDepth = 10) {
  const index = graphIndex(graph);
  const visited = new Set([startId]);
  const edgeIds = new Set();
  const queue = [{ id: startId, depth: 0 }];
  while (queue.length) {
    const current = queue.shift();
    if (current.depth >= maxDepth) continue;
    const candidates = [];
    if (mode === 'upstream') {
      for (const edge of index.incoming.get(current.id) || []) if (UPSTREAM_INCOMING.has(edge.type)) candidates.push({ edge, next: edge.from });
      for (const edge of index.outgoing.get(current.id) || []) if (UPSTREAM_OUTGOING.has(edge.type)) candidates.push({ edge, next: edge.to });
    } else {
      for (const edge of index.outgoing.get(current.id) || []) if (DOWNSTREAM_OUTGOING.has(edge.type)) candidates.push({ edge, next: edge.to });
      for (const edge of index.incoming.get(current.id) || []) if (DOWNSTREAM_REVERSE.has(edge.type)) candidates.push({ edge, next: edge.from });
    }
    for (const candidate of candidates) {
      edgeIds.add(candidate.edge.id);
      if (!visited.has(candidate.next)) {
        visited.add(candidate.next);
        queue.push({ id: candidate.next, depth: current.depth + 1 });
      }
    }
  }
  return {
    nodes: graph.nodes.filter(node => visited.has(node.id)),
    edges: graph.edges.filter(edge => edgeIds.has(edge.id))
  };
}

export function explainBraidGraph(graph, selector, options = {}) {
  const target = findBraidNode(graph, selector);
  if (!target) throw new Error('BraidGraph explain target was not found.');
  const lineage = traverse(graph, target.id, 'upstream', options.maxDepth || 10);
  const lineageIds = new Set(lineage.nodes.map(node => node.id));
  const evidenceEdges = graph.edges.filter(edge => ['verifies', 'observes'].includes(edge.type) && lineageIds.has(edge.to));
  const evidenceIds = new Set(evidenceEdges.map(edge => edge.from));
  return {
    version: BRAID_GRAPH_VERSION,
    target,
    lineage: {
      nodes: lineage.nodes,
      edges: lineage.edges,
      sourceCount: lineage.nodes.filter(node => node.type === 'source').length,
      ruleCount: lineage.nodes.filter(node => node.type === 'rule').length
    },
    attachedEvidence: {
      nodes: graph.nodes.filter(node => evidenceIds.has(node.id)),
      edges: evidenceEdges
    },
    interpretation: {
      explainsRecordedProvenanceOnly: true,
      recommendationIsNotAuthorization: true,
      verificationIsNotOutcome: true
    }
  };
}

export function impactBraidGraph(graph, selector, options = {}) {
  const target = findBraidNode(graph, selector);
  if (!target) throw new Error('BraidGraph impact source/rule was not found.');
  if (!['source', 'rule'].includes(target.type)) throw new Error('BraidGraph impact must start from a source or rule node.');
  const affected = traverse(graph, target.id, 'downstream', options.maxDepth || 12);
  const grouped = {};
  for (const node of affected.nodes.filter(node => node.id !== target.id)) {
    if (!grouped[node.type]) grouped[node.type] = [];
    grouped[node.type].push(node.id);
  }
  return {
    version: BRAID_GRAPH_VERSION,
    trigger: target,
    affected: {
      nodes: affected.nodes.filter(node => node.id !== target.id),
      edges: affected.edges,
      byType: grouped
    },
    interpretation: {
      impactMeansReReviewCandidateNotBreakage: true,
      productionMutationAuthorized: false,
      historyPreserved: true
    }
  };
}

export function missingBraidEvidence(graph) {
  const index = graphIndex(graph);
  const rows = [];
  for (const transform of graph.nodes.filter(node => node.type === 'transform')) {
    const incoming = index.incoming.get(transform.id) || [];
    const verificationEdges = incoming.filter(edge => edge.type === 'verifies');
    const measurementEdges = incoming.filter(edge => edge.type === 'observes');
    const missing = [];
    if (!verificationEdges.length) missing.push('verification');
    if (!measurementEdges.length) missing.push('outcome-measurement');
    rows.push({
      transformId: transform.id,
      operationId: transform.data?.operationId || null,
      path: transform.data?.path || null,
      state: transform.state,
      missing,
      verificationIds: verificationEdges.map(edge => edge.from),
      measurementIds: measurementEdges.map(edge => edge.from)
    });
  }
  return {
    version: BRAID_GRAPH_VERSION,
    site: graph.site,
    transforms: rows.length,
    complete: rows.filter(row => row.missing.length === 0).length,
    missingVerification: rows.filter(row => row.missing.includes('verification')).length,
    missingOutcomeMeasurement: rows.filter(row => row.missing.includes('outcome-measurement')).length,
    queue: rows.filter(row => row.missing.length > 0),
    interpretation: {
      missingOwnerEvidenceIsUnknownNotZero: true,
      implementationSuccessIsNotOutcomeSuccess: true
    }
  };
}
