import crypto from 'node:crypto';
import { validateBraidGraph } from './braid-graph.mjs';
import { canonicalSiteStateJson, siteStateSha256, validateSiteStateGraph } from './repository-mapper.mjs';

export const REPOSITORY_MAP_BRAID_VERSION = '0.1';

function hash(value, length = 20) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex').slice(0, length);
}

function slug(value, max = 72) {
  const text = String(value || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return (text || 'item').slice(0, max);
}

function artifactDigest(map) {
  return siteStateSha256(canonicalSiteStateJson(map));
}

function mapCanonicalSite(map) {
  const basePath = map.site.basePath === '/' ? '/' : `${map.site.basePath.replace(/\/$/, '')}/`;
  return new URL(basePath, map.site.origin).href;
}

function normalizeUrl(value) {
  return new URL(value).href;
}

function edgeId(type, from, to, digest) {
  return `edge:${type}:${hash(`${type}\n${from}\n${to}\n${digest}`, 22)}`;
}

function repoFileId(repository, pathname) {
  return `repo-file:map-${slug(pathname, 72)}:${hash(`${repository}\n${pathname}`, 16)}`;
}

function surfaceId(site, surfaceKey, digest) {
  return `surface:map-${slug(surfaceKey, 72)}:${hash(`${site}\n${surfaceKey}\n${digest}`, 16)}`;
}

function factId(repository, fact, digest) {
  return `fact:map-${slug(`${fact.key}-${fact.sourcePath}`, 70)}:${hash(`${repository}\n${fact.sourcePath}\n${fact.routePath}\n${fact.key}\n${JSON.stringify(fact.value)}\n${digest}`, 16)}`;
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

function mapArtifact(map, digest) {
  return {
    kind: 'site-state-graph',
    version: map.version,
    generatedAt: map.generatedAt,
    digest
  };
}

function addProvenance(node, item) {
  const key = JSON.stringify(item);
  if (!node.provenance.some(existing => JSON.stringify(existing) === key)) node.provenance.push(item);
}

function mappedRepoFileNode(graph, map, file, digest) {
  const repository = map.repository.fullName;
  const existing = graph.nodes.find(node => node.type === 'repo-file' && node.data?.repository === repository && node.data?.path === file.path);
  if (existing) {
    if (map.repository.baseCommitSha && existing.data?.baseCommitSha && map.repository.baseCommitSha !== existing.data.baseCommitSha) {
      throw new Error(`Repository Map base commit does not match existing BraidGraph repo-file evidence for ${file.path}.`);
    }
    if (existing.data?.beforeSha256 && existing.data.beforeSha256 !== file.sha256) {
      throw new Error(`Repository Map file digest conflicts with Transformation Bundle before-state for ${file.path}.`);
    }
    existing.data = {
      ...existing.data,
      mappedSha256: file.sha256,
      mappedRole: file.role,
      mappedMutationClass: file.mutationClass,
      mappedGenerated: file.generated
    };
    addProvenance(existing, { artifact: 'site-state-graph', ref: file.path, digest });
    return existing;
  }
  const node = {
    id: repoFileId(repository, file.path),
    type: 'repo-file',
    versionKey: `${repository}:${map.repository.baseCommitSha || map.repository.baseRef}`,
    state: 'observed-source',
    data: {
      repository,
      path: file.path,
      baseRef: map.repository.baseRef,
      baseCommitSha: map.repository.baseCommitSha,
      mappedSha256: file.sha256,
      mappedRole: file.role,
      mappedMutationClass: file.mutationClass,
      mappedGenerated: file.generated
    },
    provenance: [{ artifact: 'site-state-graph', ref: file.path, digest }]
  };
  graph.nodes.push(node);
  return node;
}

function latestTimestamp(left, right) {
  const values = [left, right].map(value => new Date(value)).filter(value => !Number.isNaN(value.getTime()));
  return new Date(Math.max(...values.map(value => value.getTime()))).toISOString();
}

export function mergeRepositoryMapIntoBraidGraph(inputGraph, map) {
  const graphValidation = validateBraidGraph(inputGraph);
  if (!graphValidation.valid) throw new Error(`A valid BraidGraph is required: ${graphValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  const mapValidation = validateSiteStateGraph(map);
  if (!mapValidation.valid) throw new Error(`A valid Site State Graph is required: ${mapValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);

  const expectedSite = mapCanonicalSite(map);
  if (normalizeUrl(inputGraph.site) !== normalizeUrl(expectedSite)) {
    throw new Error(`Site State Graph site ${expectedSite} does not match BraidGraph site ${inputGraph.site}.`);
  }
  if (inputGraph.repository && inputGraph.repository.fullName !== map.repository.fullName) {
    throw new Error(`Site State Graph repository ${map.repository.fullName} does not match BraidGraph repository ${inputGraph.repository.fullName}.`);
  }
  if (inputGraph.repository?.baseCommitSha && map.repository.baseCommitSha && inputGraph.repository.baseCommitSha !== map.repository.baseCommitSha) {
    throw new Error('Site State Graph base commit does not match BraidGraph repository base commit.');
  }

  const graph = structuredClone(inputGraph);
  const digest = artifactDigest(map);
  if (graph.inputs.repositoryMap && graph.inputs.repositoryMap.digest !== digest) {
    throw new Error('BraidGraph already contains a different Repository Map artifact; compile a fresh graph rather than silently replacing ownership history.');
  }
  graph.inputs.repositoryMap = mapArtifact(map, digest);
  if (!graph.repository) {
    graph.repository = {
      fullName: map.repository.fullName,
      baseRef: map.repository.baseRef,
      baseCommitSha: map.repository.baseCommitSha
    };
  }

  const siteNode = graph.nodes.find(node => node.type === 'site' && normalizeUrl(node.data?.canonicalUrl || graph.site) === normalizeUrl(graph.site));
  if (!siteNode) throw new Error('BraidGraph site node was not found.');
  const mapFileByPath = new Map(map.files.map(file => [file.path, file]));
  const edgeKeys = new Set(graph.edges.map(edge => `${edge.type}\n${edge.from}\n${edge.to}\n${edge.state}`));

  const addEdge = (type, from, to, state, ref) => {
    const key = `${type}\n${from}\n${to}\n${state}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    graph.edges.push({
      id: edgeId(type, from, to, digest),
      type,
      from,
      to,
      state,
      observedAt: map.generatedAt,
      provenance: [{ artifact: 'site-state-graph', ref, digest }]
    });
  };

  for (const ownership of map.ownership) {
    const id = surfaceId(graph.site, ownership.surfaceKey, digest);
    let surface = graph.nodes.find(node => node.id === id);
    if (!surface) {
      surface = {
        id,
        type: 'surface',
        versionKey: digest,
        state: `mapped-${ownership.state}`,
        data: {
          surfaceKey: ownership.surfaceKey,
          surfaceType: ownership.surfaceType,
          routePath: ownership.routePath,
          value: ownership.value,
          ownershipState: ownership.state,
          ownerPath: ownership.ownerPath,
          candidates: ownership.candidates,
          mutationClass: ownership.mutationClass,
          evidenceClass: ownership.evidenceClass,
          locator: ownership.locator
        },
        provenance: [{ artifact: 'site-state-graph', ref: ownership.surfaceKey, digest }]
      };
      graph.nodes.push(surface);
    }
    addEdge('has-surface', siteNode.id, surface.id, `mapped-${ownership.state}`, ownership.surfaceKey);

    if (ownership.state !== 'resolved' || !ownership.ownerPath) continue;
    const file = mapFileByPath.get(ownership.ownerPath);
    if (!file) throw new Error(`Resolved ownership references a file absent from Site State Graph files[]: ${ownership.ownerPath}`);
    const fileNode = mappedRepoFileNode(graph, map, file, digest);
    addEdge('renders', fileNode.id, surface.id, 'verified-map-ownership', ownership.surfaceKey);
  }

  for (const fact of map.facts) {
    const id = factId(map.repository.fullName, fact, digest);
    if (graph.nodes.some(node => node.id === id)) continue;
    graph.nodes.push({
      id,
      type: 'fact',
      versionKey: digest,
      state: 'repository-source-fact',
      data: {
        key: fact.key,
        value: fact.value,
        routePath: fact.routePath,
        sourcePath: fact.sourcePath,
        locator: fact.locator,
        evidenceClass: fact.evidenceClass
      },
      provenance: [{ artifact: 'site-state-graph', ref: `${fact.sourcePath}:${fact.locator.field}`, digest }]
    });
  }

  graph.nodes.sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
  graph.edges.sort((a, b) => a.type.localeCompare(b.type) || a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.id.localeCompare(b.id));
  graph.generatedAt = latestTimestamp(graph.generatedAt, map.generatedAt);
  graph.summary = summarize(graph.nodes, graph.edges);

  const validation = validateBraidGraph(graph);
  if (!validation.valid) throw new Error(`Repository-mapped BraidGraph is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return graph;
}

export function repositoryMapBraidReport(graph) {
  const validation = validateBraidGraph(graph);
  if (!validation.valid) throw new Error(`Invalid BraidGraph: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  const mapDigest = graph.inputs?.repositoryMap?.digest || null;
  const mappedSurfaces = graph.nodes.filter(node => node.type === 'surface' && node.versionKey === mapDigest);
  const renders = graph.edges.filter(edge => edge.type === 'renders' && edge.provenance?.some(item => item.artifact === 'site-state-graph'));
  return {
    version: REPOSITORY_MAP_BRAID_VERSION,
    repositoryMapDigest: mapDigest,
    mappedSurfaces: mappedSurfaces.length,
    resolvedRenderedOwnership: renders.length,
    ambiguousOrUnresolvedSurfaces: mappedSurfaces.filter(node => node.data?.ownershipState !== 'resolved').map(node => node.data?.surfaceKey),
    interpretation: {
      rendersEdgesRequireResolvedMapOwnership: true,
      ownershipDoesNotAuthorizeMutation: true,
      mapEvidenceDoesNotProveDeployment: true
    }
  };
}
