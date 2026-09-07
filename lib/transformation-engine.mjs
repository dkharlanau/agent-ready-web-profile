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
const EXECUTABLE_CLASSES = new Set(['mechanical', 'grounded-template']);
const NEVER_EXECUTABLE_CLASSES = new Set(['policy-gated', 'editorial', 'owner-platform', 'runtime']);

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

export function validateTransformationBundle(bundle) {
  const validate = validator();
  return { valid: Boolean(validate(bundle)), errors: validate.errors || [] };
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

export function canonicalJson(value) {
  return JSON.stringify(stable(value));
}

export function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value), 'utf8').digest('hex')}`;
}

function iso(value = null) {
  const date = value == null ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date/time: ${value}`);
  return date.toISOString();
}

function unique(values = []) {
  return [...new Set(values.filter(value => value != null && String(value).trim()).map(value => String(value)))];
}

function validRepository(value) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(value || ''));
}

export function normalizeRepoPath(value) {
  const raw = String(value || '').replace(/\\/g, '/');
  if (!raw || raw.startsWith('/') || raw.includes('\0')) throw new Error(`Unsafe repository path: ${value}`);
  const normalized = path.posix.normalize(raw);
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) throw new Error(`Unsafe repository path: ${value}`);
  return normalized;
}

function normalizeBlockedPrefix(value) {
  const normalized = normalizeRepoPath(String(value || '').replace(/\/$/, ''));
  return `${normalized}/`;
}

function isBlocked(pathname, blockedPrefixes) {
  return blockedPrefixes.some(prefix => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix));
}

function inferMediaType(pathname) {
  const ext = path.extname(pathname).toLowerCase();
  if (['.html', '.htm'].includes(ext)) return 'text/html';
  if (ext === '.json') return 'application/json';
  if (ext === '.jsonld') return 'application/ld+json';
  if (ext === '.xml') return 'application/xml';
  if (ext === '.md') return 'text/markdown';
  if (ext === '.yml' || ext === '.yaml') return 'application/yaml';
  return 'text/plain';
}

function countExact(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let cursor = 0;
  while (true) {
    const index = text.indexOf(needle, cursor);
    if (index < 0) return count;
    count += 1;
    cursor = index + needle.length;
  }
}

function deriveAfter(spec, pathname) {
  const before = spec.beforeContent == null ? null : String(spec.beforeContent);
  if (spec.operation === 'create-file') {
    if (before != null) throw new Error(`create-file ${pathname} must not provide beforeContent.`);
    if (typeof spec.content !== 'string') throw new Error(`create-file ${pathname} requires content.`);
    return { before: null, after: spec.content, match: null, matchCount: null };
  }
  if (before == null) throw new Error(`${spec.operation} ${pathname} requires beforeContent.`);
  if (spec.operation === 'replace-file') {
    if (typeof spec.content !== 'string') throw new Error(`replace-file ${pathname} requires content.`);
    return { before, after: spec.content, match: null, matchCount: null };
  }

  const match = String(spec.match || '');
  if (!match) throw new Error(`${spec.operation} ${pathname} requires an exact match.`);
  const expected = Number(spec.expectedMatchCount == null ? 1 : spec.expectedMatchCount);
  if (!Number.isInteger(expected) || expected < 1 || expected > 20) throw new Error(`Invalid expectedMatchCount for ${pathname}.`);
  const observed = countExact(before, match);
  if (observed !== expected) throw new Error(`${spec.operation} ${pathname} expected ${expected} exact match(es), observed ${observed}.`);

  let replacement;
  if (spec.operation === 'replace-exact') {
    if (typeof spec.replacement !== 'string') throw new Error(`replace-exact ${pathname} requires replacement.`);
    replacement = spec.replacement;
  } else if (spec.operation === 'insert-before-exact') {
    if (typeof spec.content !== 'string') throw new Error(`insert-before-exact ${pathname} requires content.`);
    replacement = `${spec.content}${match}`;
  } else if (spec.operation === 'insert-after-exact') {
    if (typeof spec.content !== 'string') throw new Error(`insert-after-exact ${pathname} requires content.`);
    replacement = `${match}${spec.content}`;
  } else throw new Error(`Unsupported transformation operation: ${spec.operation}`);

  let after = before;
  let cursor = 0;
  for (let i = 0; i < expected; i += 1) {
    const index = after.indexOf(match, cursor);
    after = `${after.slice(0, index)}${replacement}${after.slice(index + match.length)}`;
    cursor = index + replacement.length;
  }
  return { before, after, match, matchCount: expected };
}

function recMap(graph) {
  return new Map((graph.recommendations || []).map(item => [item.id, item]));
}

function gateReason(recommendation, hasOperation) {
  if (recommendation.state !== 'recommended') return 'conditional-recommendation-needs-activation';
  if (recommendation.knowledgeState !== 'current') return 'knowledge-review-due';
  const automationClass = recommendation.change?.automationClass;
  if (NEVER_EXECUTABLE_CLASSES.has(automationClass)) return `${automationClass}-never-auto-promoted`;
  if (!EXECUTABLE_CLASSES.has(automationClass)) return 'unsupported-automation-class';
  if (!hasOperation) return automationClass === 'mechanical' ? 'no-deterministic-operation-resolved' : 'grounding-and-exact-target-resolution-required';
  return null;
}

function opId(recommendationId, pathname, operation, digest) {
  const base = `${recommendationId}:${pathname}:${operation}`.toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').slice(0, 145);
  return `${base}:${sha256(`${base}\n${digest}`).slice(7, 19)}`;
}

function compileOperation(spec, recommendation, allowedPaths, blockedPrefixes) {
  const pathname = normalizeRepoPath(spec.path);
  if (!allowedPaths.has(pathname)) throw new Error(`Transformation path is not explicitly allowlisted: ${pathname}`);
  if (isBlocked(pathname, blockedPrefixes)) throw new Error(`Transformation path is blocked by policy: ${pathname}`);
  if (recommendation.state !== 'recommended') throw new Error(`Recommendation ${recommendation.id} is conditional.`);
  if (recommendation.knowledgeState !== 'current') throw new Error(`Recommendation ${recommendation.id} is review-due.`);
  const automationClass = recommendation.change?.automationClass;
  if (!EXECUTABLE_CLASSES.has(automationClass)) throw new Error(`Recommendation ${recommendation.id} has non-executable automation class ${automationClass}.`);

  const groundedEvidence = unique(spec.groundedEvidence || []);
  if (automationClass === 'grounded-template') {
    if (spec.reviewedGrounding !== true) throw new Error(`Grounded-template ${recommendation.id} requires reviewedGrounding=true.`);
    if (!groundedEvidence.length) throw new Error(`Grounded-template ${recommendation.id} requires groundedEvidence.`);
  }

  const transformed = deriveAfter(spec, pathname);
  if (transformed.before === transformed.after) throw new Error(`Transformation on ${pathname} is a no-op.`);
  const afterDigest = sha256(transformed.after);
  return {
    id: opId(recommendation.id, pathname, spec.operation, afterDigest),
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
    verification: unique(spec.verification?.length ? spec.verification : recommendation.verification?.checks || ['re-run relevant ARWP checks']),
    humanReviewRequired: automationClass !== 'mechanical'
  };
}

function dependencyRank(graph) {
  const map = recMap(graph);
  const memo = new Map();
  function visit(id, stack = new Set()) {
    if (memo.has(id)) return memo.get(id);
    if (stack.has(id)) return 1000;
    const item = map.get(id);
    if (!item) return 0;
    const next = new Set(stack).add(id);
    const deps = (item.dependencies || []).map(dep => visit(dep, next));
    const value = deps.length ? Math.max(...deps) + 1 : 0;
    memo.set(id, value);
    return value;
  }
  for (const id of map.keys()) visit(id);
  return memo;
}

function summary(operations, gatedRecommendations) {
  const byOperation = {};
  let bytes = 0;
  for (const item of operations) {
    byOperation[item.operation] = (byOperation[item.operation] || 0) + 1;
    bytes += Buffer.byteLength(item.after.content, 'utf8');
  }
  return { operations: operations.length, files: unique(operations.map(item => item.path)).length, bytes, gatedRecommendations: gatedRecommendations.length, byOperation };
}

export function buildTransformationBundle(graph, spec = {}, options = {}) {
  const graphValidation = validateAdaptiveUpgradeGraph(graph);
  if (!graphValidation.valid) throw new Error(`Invalid Adaptive Upgrade graph: ${graphValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);

  const repository = spec.repository || options.repository || {};
  if (!validRepository(repository.fullName)) throw new Error('repository.fullName must be owner/name.');
  const baseRef = String(repository.baseRef || 'main');
  const baseCommitSha = repository.baseCommitSha == null || repository.baseCommitSha === '' ? null : String(repository.baseCommitSha).toLowerCase();
  if (baseCommitSha != null && !/^[0-9a-f]{40}$/.test(baseCommitSha)) throw new Error('repository.baseCommitSha must be a 40-character Git SHA.');

  const allowed = unique(spec.allowedPaths || options.allowedPaths || []).map(normalizeRepoPath);
  if (!allowed.length) throw new Error('An explicit allowedPaths list is required.');
  const allowedPaths = new Set(allowed);
  const blockedPrefixes = unique([...DEFAULT_BLOCKED_PREFIXES, ...(spec.blockedPrefixes || [])]).map(normalizeBlockedPrefix);
  const maxFiles = Math.max(1, Math.min(Number(spec.maxFiles || 25), 60));
  const maxTotalBytes = Math.max(1, Math.min(Number(spec.maxTotalBytes || 2 * 1024 * 1024), 5 * 1024 * 1024));

  const recommendations = recMap(graph);
  const operations = [];
  const seenPaths = new Set();
  for (const operationSpec of spec.operations || []) {
    const recommendation = recommendations.get(String(operationSpec.recommendationId || ''));
    if (!recommendation) throw new Error(`Unknown recommendationId: ${operationSpec.recommendationId}`);
    const operation = compileOperation(operationSpec, recommendation, allowedPaths, blockedPrefixes);
    if (seenPaths.has(operation.path)) throw new Error(`v0.1 permits one deterministic operation per file: ${operation.path}`);
    seenPaths.add(operation.path);
    operations.push(operation);
  }

  const ranks = dependencyRank(graph);
  operations.sort((a, b) => (ranks.get(a.recommendationId) || 0) - (ranks.get(b.recommendationId) || 0) || a.path.localeCompare(b.path));
  const operated = new Set(operations.map(item => item.recommendationId));
  const gatedRecommendations = (graph.recommendations || []).map(recommendation => ({ recommendation, reason: gateReason(recommendation, operated.has(recommendation.id)) })).filter(item => item.reason).map(item => ({ recommendationId: item.recommendation.id, automationClass: item.recommendation.change?.automationClass || 'unknown', reason: item.reason }));
  const totals = summary(operations, gatedRecommendations);
  if (totals.files > maxFiles) throw new Error(`Transformation file count ${totals.files} exceeds ${maxFiles}.`);
  if (totals.bytes > maxTotalBytes) throw new Error(`Transformation content ${totals.bytes} bytes exceeds ${maxTotalBytes}.`);

  const bundle = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/transformation-bundle.schema.json',
    version: TRANSFORMATION_BUNDLE_VERSION,
    generatedAt: iso(options.generatedAt),
    site: graph.site,
    repository: { fullName: repository.fullName, baseRef, baseCommitSha },
    sourceUpgrade: { version: graph.version, generatedAt: graph.generatedAt, sha256: sha256(canonicalJson(graph)), selectedRecommendationIds: unique(operations.map(item => item.recommendationId)) },
    policy: { delivery: 'production-pr-first', allowedPaths: allowed, blockedPrefixes, maxFiles, maxTotalBytes },
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
    changes: bundle.operations.map(item => ({ recommendationId: item.recommendationId, path: item.path, operation: item.operation, beforeSha256: item.precondition.sha256, afterSha256: item.after.sha256, humanReviewRequired: item.humanReviewRequired })),
    gatedRecommendations: bundle.gatedRecommendations,
    interpretation: { productionFilesWouldChange: bundle.operations.length > 0, digestPreconditionsRequired: true, rankingOrCitationUpliftPredicted: false }
  };
}

function localPath(rootDir, pathname) {
  const base = path.resolve(rootDir);
  const resolved = path.resolve(base, pathname);
  const relative = path.relative(base, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Transformation path escapes root: ${pathname}`);
  return resolved;
}

function verifyCurrent(operation, current) {
  if (!operation.precondition.exists) {
    if (current != null) throw new Error(`Precondition failed: ${operation.path} must not exist.`);
    return;
  }
  if (current == null) throw new Error(`Precondition failed: ${operation.path} must exist.`);
  const digest = sha256(current);
  if (digest !== operation.precondition.sha256) throw new Error(`Precondition digest mismatch for ${operation.path}: expected ${operation.precondition.sha256}, observed ${digest}.`);
  if (operation.precondition.match != null && countExact(current, operation.precondition.match) !== operation.precondition.matchCount) throw new Error(`Exact-match precondition drift for ${operation.path}.`);
}

export function applyTransformationToDirectory(bundle, options = {}) {
  if (options.authorization !== LOCAL_TRANSFORM_AUTHORIZATION) throw new Error(`Explicit authorization required: ${LOCAL_TRANSFORM_AUTHORIZATION}`);
  const validation = validateTransformationBundle(bundle);
  if (!validation.valid) throw new Error('A valid transformation bundle is required.');
  if (!options.rootDir) throw new Error('rootDir is required.');
  const staged = bundle.operations.map(operation => {
    const resolved = localPath(options.rootDir, operation.path);
    const current = fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf8') : null;
    verifyCurrent(operation, current);
    return { operation, resolved, beforeContent: current };
  });
  for (const item of staged) {
    fs.mkdirSync(path.dirname(item.resolved), { recursive: true });
    fs.writeFileSync(item.resolved, item.operation.after.content, 'utf8');
    if (sha256(fs.readFileSync(item.resolved, 'utf8')) !== item.operation.after.sha256) throw new Error(`Post-write digest mismatch for ${item.operation.path}.`);
  }
  return {
    version: '0.1',
    appliedAt: iso(options.appliedAt),
    site: bundle.site,
    repository: bundle.repository,
    sourceBundleSha256: sha256(canonicalJson(bundle)),
    changes: staged.map(item => ({ path: item.operation.path, recommendationId: item.operation.recommendationId, beforeSha256: item.operation.precondition.sha256, afterSha256: item.operation.after.sha256, rollback: item.beforeContent == null ? { operation: 'delete-created-file' } : { operation: 'restore-file', content: item.beforeContent, sha256: sha256(item.beforeContent) } })),
    guardrails: { verificationCommandsExecuted: false, externalOwnerControlsChanged: false, rankingImpactClaimed: false, rollbackDataMayContainRepositoryContent: true }
  };
}

export function rollbackTransformationReceipt(receipt, options = {}) {
  if (options.authorization !== LOCAL_TRANSFORM_AUTHORIZATION) throw new Error(`Explicit authorization required: ${LOCAL_TRANSFORM_AUTHORIZATION}`);
  if (!options.rootDir) throw new Error('rootDir is required.');
  for (const change of [...(receipt.changes || [])].reverse()) {
    const resolved = localPath(options.rootDir, normalizeRepoPath(change.path));
    const current = fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf8') : null;
    if (current == null || sha256(current) !== change.afterSha256) throw new Error(`Rollback precondition failed for ${change.path}.`);
    if (change.rollback?.operation === 'delete-created-file') fs.unlinkSync(resolved);
    else if (change.rollback?.operation === 'restore-file') fs.writeFileSync(resolved, String(change.rollback.content), 'utf8');
    else throw new Error(`Unsupported rollback operation for ${change.path}.`);
  }
  return { version: '0.1', rolledBackAt: iso(options.rolledBackAt), sourceBundleSha256: receipt.sourceBundleSha256, paths: (receipt.changes || []).map(item => item.path) };
}

async function parseJson(response) {
  try { return await response.json(); } catch { return null; }
}

async function githubRequest(fetchImpl, token, url, options = {}, allow404 = false) {
  const response = await fetchImpl(url, {
    ...options,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  if (allow404 && response.status === 404) return { response, data: null };
  if (!response.ok) {
    let detail = '';
    try { detail = await response.text(); } catch {}
    throw new Error(`GitHub API ${response.status} for ${options.method || 'GET'} ${url}${detail ? `: ${detail.slice(0, 500)}` : ''}`);
  }
  return { response, data: await parseJson(response) };
}

function repoApiPath(repository) {
  const [owner, repo] = repository.split('/');
  return `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

function refPath(ref) {
  return String(ref).split('/').map(encodeURIComponent).join('/');
}

function prBody(bundle) {
  const lines = ['## ARWP target-site transformation', '', `Source site: ${bundle.site}`, `Adaptive Upgrade graph: \`${bundle.sourceUpgrade.sha256}\``, `Deterministic production-path operations: ${bundle.operations.length}`, '', 'Every changed file is protected by a before-state SHA-256 precondition and explicit path allowlist. ARWP created a new branch and did not write directly to the base branch.', '', '### Verification contract', ''];
  for (const operation of bundle.operations) {
    lines.push(`- \`${operation.path}\` ← **${operation.recommendationId}** (${operation.operation})`);
    for (const check of operation.verification) lines.push(`  - ${check}`);
  }
  lines.push('', 'A successful merge proves only that the scoped repository transformation was applied. It does not establish Search ranking, AI citation, recommendation, traffic or conversion impact.');
  return lines.join('\n');
}

export async function openTransformationPr(bundle, options = {}) {
  if (options.authorization !== TRANSFORMATION_PR_AUTHORIZATION) throw new Error(`Explicit authorization required: --authorize=${TRANSFORMATION_PR_AUTHORIZATION}`);
  const token = String(options.token || '').trim();
  if (!token) throw new Error('GITHUB_TOKEN is required.');
  const validation = validateTransformationBundle(bundle);
  if (!validation.valid) throw new Error('A valid transformation bundle is required.');
  if (!bundle.operations.length) throw new Error('Transformation bundle has no executable operations.');
  if (!bundle.repository.baseCommitSha) throw new Error('A pinned repository.baseCommitSha is required.');
  const apiBase = options.apiBase || 'https://api.github.com';
  if (apiBase !== 'https://api.github.com') throw new Error('v0.1 supports only https://api.github.com.');
  const fetchImpl = options.fetchImpl || fetch;
  const repoPath = repoApiPath(bundle.repository.fullName);
  const base = bundle.repository.baseRef;

  const { data: baseRef } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/git/ref/heads/${refPath(base)}`);
  const baseSha = String(baseRef?.object?.sha || '').toLowerCase();
  if (baseSha !== bundle.repository.baseCommitSha) throw new Error(`Base branch drifted: expected ${bundle.repository.baseCommitSha}, observed ${baseSha || 'none'}.`);
  const { data: baseCommit } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/git/commits/${baseSha}`);
  const baseTreeSha = baseCommit?.tree?.sha;
  if (!baseTreeSha) throw new Error('Base commit tree SHA is unavailable.');

  for (const operation of bundle.operations) {
    const encodedPath = operation.path.split('/').map(encodeURIComponent).join('/');
    const { response, data } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/contents/${encodedPath}?ref=${encodeURIComponent(base)}`, {}, true);
    if (!operation.precondition.exists) {
      if (response.status !== 404) throw new Error(`Precondition failed: ${operation.path} already exists.`);
    } else {
      if (response.status === 404 || data?.type !== 'file' || typeof data?.content !== 'string') throw new Error(`Precondition failed: unable to read ${operation.path}.`);
      const current = Buffer.from(data.content.replace(/\n/g, ''), data.encoding || 'base64').toString('utf8');
      verifyCurrent(operation, current);
    }
  }

  const bundleDigest = sha256(canonicalJson(bundle));
  const branch = `arwp/transform-${bundle.generatedAt.slice(0, 10).replace(/-/g, '')}-${bundleDigest.slice(7, 15)}`;
  const branchCheck = await fetchImpl(`${apiBase}/repos/${repoPath}/git/ref/heads/${refPath(branch)}`, { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' } });
  if (branchCheck.status !== 404) throw new Error(branchCheck.ok ? `Transformation branch already exists: ${branch}` : `Unable to verify branch availability: HTTP ${branchCheck.status}`);

  const entries = [];
  for (const operation of bundle.operations) {
    const { data: blob } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: operation.after.content, encoding: 'utf-8' }) });
    if (!blob?.sha) throw new Error(`Blob SHA missing for ${operation.path}.`);
    entries.push({ path: operation.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const { data: tree } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: baseTreeSha, tree: entries }) });
  const { data: commit } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/git/commits`, { method: 'POST', body: JSON.stringify({ message: 'chore(arwp): apply verified target-site transformations', tree: tree?.sha, parents: [baseSha] }) });
  if (!commit?.sha) throw new Error('Transformation commit SHA is unavailable.');
  await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }) });
  const { data: pr } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/pulls`, { method: 'POST', body: JSON.stringify({ title: `chore(arwp): apply verified site upgrades for ${new URL(bundle.site).hostname}`, head: branch, base, body: prBody(bundle), maintainer_can_modify: true }) });
  if (!pr?.number) throw new Error('Pull request number is unavailable.');
  return { version: '0.1', repository: bundle.repository.fullName, base, baseCommitSha: baseSha, branch, commitSha: commit.sha, pullRequest: { number: pr.number, url: pr.html_url || null }, sourceBundleSha256: bundleDigest, operations: bundle.operations.map(item => ({ path: item.path, recommendationId: item.recommendationId, beforeSha256: item.precondition.sha256, afterSha256: item.after.sha256 })), guardrails: { directBaseWrite: false, forcePush: false, newBranchOnly: true, mergePerformed: false, rankingImpactClaimed: false } };
}

export function formatTransformationBundle(bundle) {
  const lines = [`ARWP Target-Site Transformation ${bundle.version}`, `Target: ${bundle.site}`, `Repository: ${bundle.repository.fullName}@${bundle.repository.baseRef}`, `Operations: ${bundle.summary.operations} across ${bundle.summary.files} file(s)`, `Gated recommendations: ${bundle.summary.gatedRecommendations}`, ''];
  for (const operation of bundle.operations) lines.push(`- ${operation.operation} ${operation.path} ← ${operation.recommendationId} [${operation.automationClass}]`);
  if (bundle.gatedRecommendations.length) {
    lines.push('', 'Still gated');
    for (const item of bundle.gatedRecommendations) lines.push(`- ${item.recommendationId}: ${item.reason}`);
  }
  lines.push('', 'Production delivery is PR-first, digest-gated and path-allowlisted.');
  return lines.join('\n');
}
