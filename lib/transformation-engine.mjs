import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateAdaptiveUpgradeGraph } from './adaptive-upgrade.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'transformation-bundle.schema.json');

export const TRANSFORMATION_BUNDLE_VERSION = '0.1';
export const TRANSFORMATION_PR_AUTHORIZATION = 'target-repository-transform-pr';
export const LOCAL_TRANSFORM_AUTHORIZATION = 'local-production-transform';
const DEFAULT_BLOCKED_PREFIXES = ['.git/', '.github/workflows/', '.github/actions/'];
const EXECUTABLE_AUTOMATION_CLASSES = new Set(['mechanical', 'grounded-template']);
const NEVER_EXECUTABLE_AUTOMATION_CLASSES = new Set(['policy-gated', 'editorial', 'owner-platform', 'runtime']);

function createValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

export function validateTransformationBundle(bundle) {
  const validate = createValidator();
  const valid = Boolean(validate(bundle));
  return { valid, errors: validate.errors || [] };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
}

export function canonicalJson(value) {
  return JSON.stringify(stableValue(value));
}

export function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value), 'utf8').digest('hex')}`;
}

function iso(value = null) {
  const date = value == null ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date/time: ${value}`);
  return date.toISOString();
}

function unique(values) {
  return [...new Set((values || []).filter(value => value != null && String(value).trim()).map(value => String(value)))];
}

function validRepository(value) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(value || ''));
}

export function normalizeRepoPath(value) {
  const raw = String(value || '').replace(/\\/g, '/');
  if (!raw || raw.startsWith('/') || raw.includes('\0')) throw new Error(`Unsafe repository path: ${value}`);
  const normalized = path.posix.normalize(raw);
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) throw new Error(`Unsafe repository path: ${value}`);
  if (normalized === '.git' || normalized.startsWith('.git/')) throw new Error(`Git internals are never transformable: ${value}`);
  return normalized;
}

function isBlocked(pathname, blockedPrefixes) {
  return blockedPrefixes.some(prefix => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix));
}

function inferMediaType(pathname) {
  const ext = path.extname(pathname).toLowerCase();
  if (ext === '.html' || ext === '.htm') return 'text/html';
  if (ext === '.json') return 'application/json';
  if (ext === '.jsonld') return 'application/ld+json';
  if (ext === '.xml') return 'application/xml';
  if (ext === '.md') return 'text/markdown';
  if (ext === '.txt') return 'text/plain';
  if (ext === '.yml' || ext === '.yaml') return 'application/yaml';
  return 'text/plain';
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let cursor = 0;
  while (true) {
    const index = haystack.indexOf(needle, cursor);
    if (index < 0) return count;
    count += 1;
    cursor = index + needle.length;
  }
}

function transformContent(spec) {
  const operation = spec.operation;
  const before = spec.beforeContent == null ? null : String(spec.beforeContent);
  if (operation === 'create-file') {
    if (before != null) throw new Error(`create-file ${spec.path} must not provide beforeContent.`);
    if (typeof spec.content !== 'string') throw new Error(`create-file ${spec.path} requires content.`);
    return { before: null, after: spec.content, match: null, matchCount: null };
  }
  if (before == null) throw new Error(`${operation} ${spec.path} requires beforeContent for a digest precondition.`);
  if (operation === 'replace-file') {
    if (typeof spec.content !== 'string') throw new Error(`replace-file ${spec.path} requires content.`);
    return { before, after: spec.content, match: null, matchCount: null };
  }
  const match = String(spec.match || '');
  if (!match) throw new Error(`${operation} ${spec.path} requires a non-empty exact match.`);
  const count = countOccurrences(before, match);
  const expected = Number(spec.expectedMatchCount == null ? 1 : spec.expectedMatchCount);
  if (!Number.isInteger(expected) || expected < 1 || expected > 20) throw new Error(`Invalid expectedMatchCount for ${spec.path}.`);
  if (count !== expected) throw new Error(`${operation} ${spec.path} expected exact match count ${expected}, observed ${count}.`);
  let replacement;
  if (operation === 'replace-exact') {
    if (typeof spec.replacement !== 'string') throw new Error(`replace-exact ${spec.path} requires replacement.`);
    replacement = spec.replacement;
  } else if (operation === 'insert-before-exact') {
    if (typeof spec.content !== 'string') throw new Error(`insert-before-exact ${spec.path} requires content.`);
    replacement = `${spec.content}${match}`;
  } else if (operation === 'insert-after-exact') {
    if (typeof spec.content !== 'string') throw new Error(`insert-after-exact ${spec.path} requires content.`);
    replacement = `${match}${spec.content}`;
  } else throw new Error(`Unsupported transformation operation: ${operation}`);

  let after = before;
  let cursor = 0;
  for (let i = 0; i < expected; i += 1) {
    const index = after.indexOf(match, cursor);
    after = `${after.slice(0, index)}${replacement}${after.slice(index + match.length)}`;
    cursor = index + replacement.length;
  }
  return { before, after, match, matchCount: expected };
}

function recommendationMap(graph) {
  return new Map((graph.recommendations || []).map(item => [item.id, item]));
}

function gateReason(recommendation, hasOperation) {
  if (recommendation.state !== 'recommended') return 'conditional-recommendation-needs-activation';
  if (recommendation.knowledgeState !== 'current') return 'knowledge-review-due';
  if (NEVER_EXECUTABLE_AUTOMATION_CLASSES.has(recommendation.change?.automationClass)) return `${recommendation.change.automationClass}-never-auto-promoted`;
  if (!EXECUTABLE_AUTOMATION_CLASSES.has(recommendation.change?.automationClass)) return 'unsupported-automation-class';
  if (!hasOperation) return recommendation.change?.automationClass === 'mechanical' ? 'no-deterministic-operation-resolved' : 'grounding-and-exact-target-resolution-required';
  return null;
}

function deterministicOperationId(recommendationId, pathname, operation, afterDigest) {
  const suffix = sha256(`${recommendationId}\n${pathname}\n${operation}\n${afterDigest}`).slice(7, 19);
  const base = `${recommendationId}:${pathname}:${operation}`.toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').slice(0, 145);
  return `${base}:${suffix}`;
}

function operationFromSpec(spec, recommendation, allowedPaths, blockedPrefixes) {
  const pathname = normalizeRepoPath(spec.path);
  if (!allowedPaths.has(pathname)) throw new Error(`Transformation path is not explicitly allowlisted: ${pathname}`);
  if (isBlocked(pathname, blockedPrefixes)) throw new Error(`Transformation path is blocked by policy: ${pathname}`);
  if (recommendation.state !== 'recommended') throw new Error(`Recommendation ${recommendation.id} is conditional and cannot be transformed yet.`);
  if (recommendation.knowledgeState !== 'current') throw new Error(`Recommendation ${recommendation.id} is review-due and cannot execute.`);
  const automationClass = recommendation.change?.automationClass;
  if (!EXECUTABLE_AUTOMATION_CLASSES.has(automationClass)) throw new Error(`Recommendation ${recommendation.id} has non-executable automation class ${automationClass}.`);
  const groundedEvidence = unique(spec.groundedEvidence || []);
  if (automationClass === 'grounded-template') {
    if (spec.reviewedGrounding !== true) throw new Error(`Grounded-template ${recommendation.id} requires reviewedGrounding=true.`);
    if (!groundedEvidence.length) throw new Error(`Grounded-template ${recommendation.id} requires groundedEvidence.`);
  }
  const transformed = transformContent({ ...spec, path: pathname });
  if (transformed.before === transformed.after) throw new Error(`Transformation ${recommendation.id} on ${pathname} is a no-op.`);
  const afterDigest = sha256(transformed.after);
  return {
    id: deterministicOperationId(recommendation.id, pathname, spec.operation, afterDigest),
    recommendationId: recommendation.id,
    automationClass,
    operation: spec.operation,
    path: pathname,
    mediaType: String(spec.mediaType || inferMediaType(pathname)),
    precondition: {
      exists: transformed.before != null,
      sha256: transformed.before == null ? null : sha256(transformed.before),
      ...(transformed.match == null ? {} : { match: transformed.match, matchCount: transformed.matchCount })
    },
    after: { sha256: afterDigest, content: transformed.after },
    groundedEvidence,
    verification: unique(spec.verification?.length ? spec.verification : recommendation.verification?.checks || ['re-run the relevant ARWP verification checks']),
    humanReviewRequired: automationClass !== 'mechanical'
  };
}

function topologicalRecommendationRank(graph) {
  const byId = recommendationMap(graph);
  const memo = new Map();
  function rank(id, stack = new Set()) {
    if (memo.has(id)) return memo.get(id);
    if (stack.has(id)) return 1000;
    const item = byId.get(id);
    if (!item) return 0;
    const next = new Set(stack).add(id);
    const dependencies = (item.dependencies || []).map(dep => rank(dep, next));
    const value = dependencies.length ? Math.max(...dependencies) + 1 : 0;
    memo.set(id, value);
    return value;
  }
  for (const id of byId.keys()) rank(id);
  return memo;
}

function summarize(operations, gatedRecommendations) {
  const paths = unique(operations.map(item => item.path));
  const byOperation = {};
  let bytes = 0;
  for (const item of operations) {
    byOperation[item.operation] = (byOperation[item.operation] || 0) + 1;
    bytes += Buffer.byteLength(item.after.content, 'utf8');
  }
  return { operations: operations.length, files: paths.length, bytes, gatedRecommendations: gatedRecommendations.length, byOperation };
}

export function buildTransformationBundle(graph, spec = {}, options = {}) {
  const graphValidation = validateAdaptiveUpgradeGraph(graph);
  if (!graphValidation.valid) throw new Error(`Invalid Adaptive Upgrade graph: ${graphValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  const repository = spec.repository || options.repository || {};
  if (!validRepository(repository.fullName)) throw new Error('Transformation repository.fullName must be owner/name.');
  const baseRef = String(repository.baseRef || 'main');
  if (!baseRef.trim()) throw new Error('Transformation repository.baseRef is required.');
  const baseCommitSha = repository.baseCommitSha == null || repository.baseCommitSha === '' ? null : String(repository.baseCommitSha).toLowerCase();
  if (baseCommitSha != null && !/^[0-9a-f]{40}$/.test(baseCommitSha)) throw new Error('repository.baseCommitSha must be a 40-character Git SHA when supplied.');

  const allowedPathsArray = unique(spec.allowedPaths || options.allowedPaths || []).map(normalizeRepoPath);
  if (!allowedPathsArray.length) throw new Error('An explicit allowedPaths list is required before compiling production-path transformations.');
  const allowedPaths = new Set(allowedPathsArray);
  const blockedPrefixes = unique([...(spec.blockedPrefixes || []), ...DEFAULT_BLOCKED_PREFIXES]).map(value => normalizeRepoPath(String(value).replace(/\/$/, '')) + '/');
  const maxFiles = Math.max(1, Math.min(Number(spec.maxFiles || 25), 60));
  const maxTotalBytes = Math.max(1, Math.min(Number(spec.maxTotalBytes || 2 * 1024 * 1024), 5 * 1024 * 1024));

  const recs = recommendationMap(graph);
  const seenPaths = new Set();
  const operations = [];
  for (const operationSpec of spec.operations || []) {
    const recommendation = recs.get(String(operationSpec.recommendationId || ''));
    if (!recommendation) throw new Error(`Unknown recommendationId in transformation spec: ${operationSpec.recommendationId}`);
    const operation = operationFromSpec(operationSpec, recommendation, allowedPaths, blockedPrefixes);
    if (seenPaths.has(operation.path)) throw new Error(`Transformation v0.1 allows one deterministic operation per file; duplicate path: ${operation.path}`);
    seenPaths.add(operation.path);
    operations.push(operation);
  }
  const rank = topologicalRecommendationRank(graph);
  operations.sort((a, b) => (rank.get(a.recommendationId) || 0) - (rank.get(b.recommendationId) || 0) || a.path.localeCompare(b.path));

  const operationRecommendationIds = new Set(operations.map(item => item.recommendationId));
  const gatedRecommendations = (graph.recommendations || [])
    .map(recommendation => ({ recommendation, reason: gateReason(recommendation, operationRecommendationIds.has(recommendation.id)) }))
    .filter(item => item.reason)
    .map(item => ({ recommendationId: item.recommendation.id, automationClass: item.recommendation.change?.automationClass || 'unknown', reason: item.reason }));

  const totals = summarize(operations, gatedRecommendations);
  if (totals.files > maxFiles) throw new Error(`Transformation file count ${totals.files} exceeds maxFiles ${maxFiles}.`);
  if (totals.bytes > maxTotalBytes) throw new Error(`Transformation content ${totals.bytes} bytes exceeds maxTotalBytes ${maxTotalBytes}.`);

  const selectedRecommendationIds = unique(operations.map(item => item.recommendationId));
  const bundle = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/transformation-bundle.schema.json',
    version: TRANSFORMATION_BUNDLE_VERSION,
    generatedAt: iso(options.generatedAt),
    site: graph.site,
    repository: { fullName: repository.fullName, baseRef, baseCommitSha },
    sourceUpgrade: {
      version: graph.version,
      generatedAt: graph.generatedAt,
      sha256: sha256(canonicalJson(graph)),
      selectedRecommendationIds
    },
    policy: {
      delivery: 'production-pr-first',
      allowedPaths: allowedPathsArray,
      blockedPrefixes,
      maxFiles,
      maxTotalBytes
    },
    summary: totals,
    operations,
    gatedRecommendations,
    guardrails: {
      explicitPathAllowlist: true,
      digestPreconditions: true,
      noDirectMainWrite: true,
      newBranchOnly: true,
      noForcePush: true,
      policyChangesNeverAutoPromoted: true,
      editorialChangesNeverAutoPromoted: true,
      ownerPlatformChangesNeverAutoPromoted: true,
      runtimeChangesNeverAutoPromoted: true,
      reviewDueKnowledgeNeverExecutes: true,
      noRankingGuarantee: true
    }
  };
  const validation = validateTransformationBundle(bundle);
  if (!validation.valid) throw new Error(`Generated transformation bundle is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return bundle;
}

export function simulateTransformationBundle(bundle) {
  const validation = validateTransformationBundle(bundle);
  if (!validation.valid) throw new Error('A valid transformation bundle is required.');
  return {
    version: '0.1',
    site: bundle.site,
    repository: bundle.repository,
    changes: bundle.operations.map(item => ({
      recommendationId: item.recommendationId,
      path: item.path,
      operation: item.operation,
      beforeSha256: item.precondition.sha256,
      afterSha256: item.after.sha256,
      humanReviewRequired: item.humanReviewRequired
    })),
    gatedRecommendations: bundle.gatedRecommendations,
    interpretation: {
      productionFilesWouldChange: bundle.operations.length > 0,
      digestPreconditionsRequired: true,
      rankingOrCitationUpliftPredicted: false,
      note: 'This simulation describes deterministic repository mutations only. It does not predict Search ranking, AI citation, recommendation, traffic or conversion changes.'
    }
  };
}

function ensureLocalPath(rootDir, pathname) {
  const rootResolved = path.resolve(rootDir);
  const resolved = path.resolve(rootResolved, pathname);
  const relative = path.relative(rootResolved, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Transformation path escapes root: ${pathname}`);
  return resolved;
}

function verifyCurrentContent(operation, current) {
  if (!operation.precondition.exists) {
    if (current != null) throw new Error(`Precondition failed: ${operation.path} must not exist.`);
    return;
  }
  if (current == null) throw new Error(`Precondition failed: ${operation.path} must exist.`);
  const digest = sha256(current);
  if (digest !== operation.precondition.sha256) throw new Error(`Precondition digest mismatch for ${operation.path}: expected ${operation.precondition.sha256}, observed ${digest}.`);
  if (operation.precondition.match != null) {
    const observed = countOccurrences(current, operation.precondition.match);
    if (observed !== operation.precondition.matchCount) throw new Error(`Exact-match precondition drift for ${operation.path}: expected ${operation.precondition.matchCount}, observed ${observed}.`);
  }
}

export function applyTransformationToDirectory(bundle, options = {}) {
  if (options.authorization !== LOCAL_TRANSFORM_AUTHORIZATION) throw new Error(`Explicit authorization required: ${LOCAL_TRANSFORM_AUTHORIZATION}`);
  const validation = validateTransformationBundle(bundle);
  if (!validation.valid) throw new Error('A valid transformation bundle is required.');
  const rootDir = options.rootDir;
  if (!rootDir) throw new Error('rootDir is required for local transformation.');

  const staged = [];
  for (const operation of bundle.operations) {
    const resolved = ensureLocalPath(rootDir, operation.path);
    const exists = fs.existsSync(resolved);
    const current = exists ? fs.readFileSync(resolved, 'utf8') : null;
    verifyCurrentContent(operation, current);
    staged.push({ operation, resolved, beforeContent: current });
  }
  for (const item of staged) {
    fs.mkdirSync(path.dirname(item.resolved), { recursive: true });
    fs.writeFileSync(item.resolved, item.operation.after.content, 'utf8');
    const observed = sha256(fs.readFileSync(item.resolved, 'utf8'));
    if (observed !== item.operation.after.sha256) throw new Error(`Post-write digest mismatch for ${item.operation.path}.`);
  }
  return {
    version: '0.1',
    appliedAt: iso(options.appliedAt),
    site: bundle.site,
    repository: bundle.repository,
    sourceBundleSha256: sha256(canonicalJson(bundle)),
    changes: staged.map(item => ({
      path: item.operation.path,
      recommendationId: item.operation.recommendationId,
      beforeSha256: item.operation.precondition.sha256,
      afterSha256: item.operation.after.sha256,
      rollback: item.beforeContent == null ? { operation: 'delete-created-file' } : { operation: 'restore-file', content: item.beforeContent, sha256: sha256(item.beforeContent) }
    })),
    guardrails: {
      verificationCommandsExecuted: false,
      externalOwnerControlsChanged: false,
      rankingImpactClaimed: false,
      rollbackDataMayContainRepositoryContent: true
    }
  };
}

export function rollbackTransformationReceipt(receipt, options = {}) {
  if (options.authorization !== LOCAL_TRANSFORM_AUTHORIZATION) throw new Error(`Explicit authorization required: ${LOCAL_TRANSFORM_AUTHORIZATION}`);
  const rootDir = options.rootDir;
  if (!rootDir) throw new Error('rootDir is required for rollback.');
  for (const change of [...(receipt.changes || [])].reverse()) {
    const resolved = ensureLocalPath(rootDir, normalizeRepoPath(change.path));
    const current = fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf8') : null;
    if (current == null || sha256(current) !== change.afterSha256) throw new Error(`Rollback precondition failed for ${change.path}; file drifted after transformation.`);
    if (change.rollback?.operation === 'delete-created-file') fs.unlinkSync(resolved);
    else if (change.rollback?.operation === 'restore-file') {
      fs.writeFileSync(resolved, String(change.rollback.content), 'utf8');
      if (sha256(fs.readFileSync(resolved, 'utf8')) !== change.rollback.sha256) throw new Error(`Rollback digest mismatch for ${change.path}.`);
    } else throw new Error(`Unsupported rollback operation for ${change.path}.`);
  }
  return { version: '0.1', rolledBackAt: iso(options.rolledBackAt), sourceBundleSha256: receipt.sourceBundleSha256, paths: (receipt.changes || []).map(item => item.path) };
}

async function responseJson(response) {
  try { return await response.json(); } catch { return null; }
}

async function githubRequest(fetchImpl, token, url, options = {}, allow404 = false) {
  const response = await fetchImpl(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (allow404 && response.status === 404) return { response, data: null };
  if (!response.ok) {
    let detail = '';
    try { detail = await response.text(); } catch {}
    throw new Error(`GitHub API ${response.status} for ${options.method || 'GET'} ${url}${detail ? `: ${detail.slice(0, 500)}` : ''}`);
  }
  return { response, data: await responseJson(response) };
}

function encodedRepo(repository) {
  const [owner, repo] = repository.split('/');
  return `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

function encodedRef(ref) {
  return String(ref).split('/').map(encodeURIComponent).join('/');
}

function prBody(bundle) {
  const review = bundle.operations.filter(item => item.humanReviewRequired).length;
  const lines = [
    '## ARWP target-site transformation',
    '',
    `Source site: ${bundle.site}`,
    `Adaptive Upgrade graph: \`${bundle.sourceUpgrade.sha256}\``,
    `Deterministic production-path operations: ${bundle.operations.length}`,
    `Grounded-template operations requiring human review: ${review}`,
    '',
    'Every changed file is protected by a before-state SHA-256 precondition and an explicit path allowlist. This PR was created on a new branch; ARWP did not write directly to the base branch.',
    '',
    '### Verification contract',
    ''
  ];
  for (const operation of bundle.operations) {
    lines.push(`- \`${operation.path}\` ← **${operation.recommendationId}** (${operation.operation})`);
    for (const check of operation.verification) lines.push(`  - ${check}`);
  }
  lines.push('', 'Merging a technically valid transformation does not establish Search ranking, AI citation, recommendation, traffic or conversion impact. Run the site build/tests, re-audit after deployment, then measure owner-side outcomes separately.');
  return lines.join('\n');
}

export async function openTransformationPr(bundle, options = {}) {
  if (options.authorization !== TRANSFORMATION_PR_AUTHORIZATION) throw new Error(`Explicit authorization required: --authorize=${TRANSFORMATION_PR_AUTHORIZATION}`);
  const token = String(options.token || '').trim();
  if (!token) throw new Error('GITHUB_TOKEN is required to open a target-repository transformation PR.');
  const validation = validateTransformationBundle(bundle);
  if (!validation.valid) throw new Error(`Invalid transformation bundle: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  if (!bundle.repository.baseCommitSha) throw new Error('A pinned repository.baseCommitSha is required before production-path PR delivery.');
  const apiBase = options.apiBase || 'https://api.github.com';
  if (apiBase !== 'https://api.github.com') throw new Error('Transformation PR delivery v0.1 supports only https://api.github.com.');
  const fetchImpl = options.fetchImpl || fetch;
  const repoPath = encodedRepo(bundle.repository.fullName);
  const base = bundle.repository.baseRef;

  const { data: baseRef } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/git/ref/heads/${encodedRef(base)}`);
  const baseSha = String(baseRef?.object?.sha || '').toLowerCase();
  if (!baseSha) throw new Error(`Base branch ${base} did not return a commit SHA.`);
  if (baseSha !== bundle.repository.baseCommitSha) throw new Error(`Base branch drifted: bundle pins ${bundle.repository.baseCommitSha}, current ${baseSha}. Recompile transformations against the current base.`);
  const { data: baseCommit } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/git/commits/${encodeURIComponent(baseSha)}`);
  const baseTreeSha = baseCommit?.tree?.sha;
  if (!baseTreeSha) throw new Error('Base commit did not return a tree SHA.');

  for (const operation of bundle.operations) {
    const contentsUrl = `${apiBase}/repos/${repoPath}/contents/${operation.path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(base)}`;
    const { response, data } = await githubRequest(fetchImpl, token, contentsUrl, {}, true);
    if (!operation.precondition.exists) {
      if (response.status !== 404) throw new Error(`Precondition failed: ${operation.path} already exists on ${base}.`);
    } else {
      if (response.status === 404) throw new Error(`Precondition failed: ${operation.path} does not exist on ${base}.`);
      if (data?.type !== 'file' || typeof data?.content !== 'string') throw new Error(`Unable to read text file ${operation.path} for digest verification.`);
      const current = Buffer.from(data.content.replace(/\n/g, ''), data.encoding || 'base64').toString('utf8');
      verifyCurrentContent(operation, current);
    }
  }

  const bundleDigest = sha256(canonicalJson(bundle));
  const date = bundle.generatedAt.slice(0, 10).replace(/-/g, '');
  const branchName = `arwp/transform-${date}-${bundleDigest.slice(7, 15)}`;
  const branchUrl = `${apiBase}/repos/${repoPath}/git/ref/heads/${encodedRef(branchName)}`;
  const branchCheck = await fetchImpl(branchUrl, { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' } });
  if (branchCheck.status !== 404) {
    if (branchCheck.ok) throw new Error(`Transformation branch already exists: ${branchName}`);
    throw new Error(`Unable to verify transformation branch availability: HTTP ${branchCheck.status}`);
  }

  const treeEntries = [];
  for (const operation of bundle.operations) {
    const { data: blob } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: operation.after.content, encoding: 'utf-8' })
    });
    if (!blob?.sha) throw new Error(`GitHub did not return a blob SHA for ${operation.path}.`);
    treeEntries.push({ path: operation.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const { data: tree } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries })
  });
  if (!tree?.sha) throw new Error('GitHub did not return the transformation tree SHA.');
  const { data: commit } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message: 'chore(arwp): apply verified target-site transformations', tree: tree.sha, parents: [baseSha] })
  });
  if (!commit?.sha) throw new Error('GitHub did not return the transformation commit SHA.');
  await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: commit.sha })
  });
  const [owner] = bundle.repository.fullName.split('/');
  const { data: pr } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/pulls`, {
    method: 'POST',
    body: JSON.stringify({
      title: `chore(arwp): apply verified site upgrades for ${new URL(bundle.site).hostname}`,
      head: `${owner}:${branchName}`,
      base,
      body: prBody(bundle),
      maintainer_can_modify: true
    })
  });
  if (!pr?.number) throw new Error('GitHub did not return a pull request number.');
  return {
    version: '0.1',
    repository: bundle.repository.fullName,
    base,
    baseCommitSha: baseSha,
    branch: branchName,
    commitSha: commit.sha,
    pullRequest: { number: pr.number, url: pr.html_url || null },
    sourceBundleSha256: bundleDigest,
    operations: bundle.operations.map(item => ({ path: item.path, recommendationId: item.recommendationId, beforeSha256: item.precondition.sha256, afterSha256: item.after.sha256 })),
    guardrails: { directBaseWrite: false, forcePush: false, newBranchOnly: true, mergePerformed: false, rankingImpactClaimed: false }
  };
}

export function formatTransformationBundle(bundle) {
  const lines = [
    `ARWP Target-Site Transformation ${bundle.version}`,
    `Target: ${bundle.site}`,
    `Repository: ${bundle.repository.fullName}@${bundle.repository.baseRef}${bundle.repository.baseCommitSha ? ` (${bundle.repository.baseCommitSha.slice(0, 12)})` : ''}`,
    `Operations: ${bundle.summary.operations} across ${bundle.summary.files} file(s); ${bundle.summary.bytes} bytes`,
    `Gated recommendations: ${bundle.summary.gatedRecommendations}`,
    ''
  ];
  for (const operation of bundle.operations) lines.push(`- ${operation.operation} ${operation.path} ← ${operation.recommendationId} [${operation.automationClass}]`);
  if (bundle.gatedRecommendations.length) {
    lines.push('', 'Still gated');
    for (const item of bundle.gatedRecommendations) lines.push(`- ${item.recommendationId}: ${item.reason}`);
  }
  lines.push('', 'Production delivery is PR-first, digest-gated and path-allowlisted. The bundle does not authorize direct writes to the base branch.');
  return lines.join('\n');
}
