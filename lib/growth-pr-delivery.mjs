import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateGrowthRemediationManifest } from './growth-remediation.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'growth-pr-delivery.schema.json');

export const GROWTH_PR_DELIVERY_VERSION = '0.1';
export const GROWTH_PR_AUTHORIZATION = 'target-repository-pr';
const REVIEW_ROOT = '.arwp/proposals/';
const MAX_TOTAL_CONTENT_BYTES = 2 * 1024 * 1024;

function createValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

export function validateGrowthPrDeliveryBundle(bundle) {
  const validate = createValidator();
  const valid = Boolean(validate(bundle));
  return { valid, errors: validate.errors || [] };
}

function iso(value = null) {
  const date = value == null ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date/time: ${value}`);
  return date.toISOString();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
}

export function canonicalJson(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(text) {
  return `sha256:${crypto.createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function validRepository(value) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(value || ''));
}

function safeSlug(value) {
  const slug = String(value || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return slug || 'item';
}

function snippetExtension(item) {
  if (item.disposition === 'structured-data-proposal' || String(item.implementation?.templateRef || '').endsWith('.jsonld')) return 'jsonld';
  if (item.disposition === 'external-link-proposal' || String(item.implementation?.templateRef || '').endsWith('.html')) return 'html';
  return 'txt';
}

function reviewFile(pathname, mediaType, content) {
  if (!pathname.startsWith(REVIEW_ROOT)) throw new Error(`Review file path escapes ${REVIEW_ROOT}: ${pathname}`);
  return {
    path: pathname,
    mediaType,
    content,
    sha256: sha256(content),
    reviewOnly: true
  };
}

function markdownEscape(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function buildReadme(manifest, repository, digest) {
  const lines = [
    '# ARWP Growth review proposal',
    '',
    `Target repository: \`${repository}\``,
    `Site: ${manifest.site}`,
    `Source remediation manifest: ${digest}`,
    '',
    'This directory is **review-only**. ARWP has not changed production website files.',
    '',
    '## Safety boundary',
    '',
    '- No production paths are written by this delivery mode.',
    '- `robots.txt` policy is never applied automatically.',
    '- Structured data snippets are proposals and must match visible real-world facts before use.',
    '- Editorial/governance changes remain human decisions.',
    '- Authenticated owner controls (Search Console, Merchant/feed state, Business Profile, etc.) are never automated here.',
    '- Opening this PR does not imply ranking, citation, recommendation or traffic impact.',
    '',
    '## Remediation items',
    '',
    '| Priority | Action | Disposition | Review |',
    '| --- | --- | --- | --- |'
  ];
  for (const item of manifest.items) {
    lines.push(`| ${markdownEscape(item.priority)} | ${markdownEscape(item.title)} | ${markdownEscape(item.disposition)} | required |`);
  }
  lines.push('', 'See `growth-remediation.json` for the complete source manifest and `snippets/` for any generated review snippets.');
  return `${lines.join('\n')}\n`;
}

function prBody(manifest, digest) {
  const gated = manifest.items.filter(item => item.humanReviewRequired).length;
  return [
    '## ARWP Growth review proposal',
    '',
    `Source site: ${manifest.site}`,
    `Source remediation manifest: \`${digest}\``,
    `Review-gated items: ${gated}`,
    '',
    'This PR adds **review artifacts only** under `.arwp/proposals/`.',
    '',
    'It does **not** modify `robots.txt`, structured data, editorial pages, application code, deployment configuration, or authenticated owner controls. Review the proposal artifacts and implement approved changes separately in normal repository changes.',
    '',
    'No ranking, AI citation, recommendation, traffic or conversion effect is claimed by opening or merging this proposal PR.'
  ].join('\n');
}

function ensureReviewFileLimits(files) {
  if (files.length < 2 || files.length > 60) throw new Error(`Review delivery must contain between 2 and 60 files; got ${files.length}.`);
  const total = files.reduce((sum, file) => sum + Buffer.byteLength(file.content, 'utf8'), 0);
  if (total > MAX_TOTAL_CONTENT_BYTES) throw new Error(`Review delivery content exceeds ${MAX_TOTAL_CONTENT_BYTES} bytes.`);
  for (const file of files) {
    if (!file.path.startsWith(REVIEW_ROOT)) throw new Error(`Production path is forbidden in review-only delivery: ${file.path}`);
  }
}

export function buildGrowthPrDeliveryBundle(remediationManifest, options = {}) {
  const remediationValidation = validateGrowthRemediationManifest(remediationManifest);
  if (!remediationValidation.valid) {
    throw new Error(`Invalid Growth remediation manifest: ${remediationValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  }
  const repository = String(options.repository || '');
  if (!validRepository(repository)) throw new Error('repository must be owner/name.');
  const generatedAt = iso(options.generatedAt);
  const manifestCanonical = canonicalJson(remediationManifest);
  const manifestDigest = sha256(manifestCanonical);
  const date = generatedAt.slice(0, 10).replace(/-/g, '');
  const branchName = `arwp/growth-proposal-${date}-${manifestDigest.slice('sha256:'.length, 'sha256:'.length + 8)}`;
  const base = options.base == null || options.base === '' ? null : String(options.base);
  if (base != null && (!base.trim() || base.length > 200)) throw new Error('base must be a non-empty branch name when supplied.');

  const manifestContent = `${JSON.stringify(remediationManifest, null, 2)}\n`;
  const files = [
    reviewFile(`${REVIEW_ROOT}growth-remediation.json`, 'application/json', manifestContent),
    reviewFile(`${REVIEW_ROOT}README.md`, 'text/markdown', buildReadme(remediationManifest, repository, manifestDigest))
  ];

  const usedSnippetPaths = new Set();
  for (const item of remediationManifest.items) {
    const snippet = item.implementation?.snippet;
    if (typeof snippet !== 'string' || !snippet.length) continue;
    const extension = snippetExtension(item);
    const baseSlug = safeSlug(item.actionId);
    let pathname = `${REVIEW_ROOT}snippets/${baseSlug}.${extension}`;
    if (usedSnippetPaths.has(pathname)) pathname = `${REVIEW_ROOT}snippets/${baseSlug}-${sha256(item.actionId).slice(7, 13)}.${extension}`;
    usedSnippetPaths.add(pathname);
    const mediaType = extension === 'jsonld' ? 'application/ld+json' : extension === 'html' ? 'text/html' : 'text/plain';
    files.push(reviewFile(pathname, mediaType, snippet));
  }
  ensureReviewFileLimits(files);

  const gatedItems = remediationManifest.items.map(item => ({
    actionId: item.actionId,
    disposition: item.disposition,
    humanReviewRequired: true,
    warnings: [...new Set(item.warnings || [])]
  }));

  const bundle = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/growth-pr-delivery.schema.json',
    version: GROWTH_PR_DELIVERY_VERSION,
    generatedAt,
    repository,
    site: remediationManifest.site,
    sourceManifest: {
      remediationVersion: remediationManifest.version,
      generatedAt: remediationManifest.generatedAt,
      sha256: manifestDigest
    },
    branch: { name: branchName, base },
    pullRequest: {
      title: `chore(arwp): review Growth proposal for ${new URL(remediationManifest.site).hostname}`,
      body: prBody(remediationManifest, manifestDigest)
    },
    files,
    gatedItems,
    guardrails: {
      reviewArtifactsOnly: true,
      writesProductionPaths: false,
      requiresExplicitAuthorization: true,
      openPrCommandRequiresToken: true,
      robotsPolicyNeverApplied: true,
      structuredDataNeverApplied: true,
      editorialContentNeverApplied: true,
      externalOwnerControlsNeverApplied: true,
      branchMustNotExist: true,
      noForcePush: true,
      noRankingGuarantee: true
    }
  };
  const validation = validateGrowthPrDeliveryBundle(bundle);
  if (!validation.valid) {
    throw new Error(`Generated Growth PR delivery bundle is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  }
  return bundle;
}

export function formatGrowthPrDeliveryBundle(bundle) {
  const lines = [
    'ARWP Growth review-only PR delivery',
    `Repository: ${bundle.repository}`,
    `Site: ${bundle.site}`,
    `Branch: ${bundle.branch.name}`,
    `Review files: ${bundle.files.length}`,
    `Gated items: ${bundle.gatedItems.length}`,
    '',
    'Only .arwp/proposals/ review artifacts may be committed. Production website paths are never modified by this delivery mode.'
  ];
  return lines.join('\n');
}

async function responseJson(response) {
  try { return await response.json(); } catch { return null; }
}

async function githubRequest(fetchImpl, token, url, options = {}, expected = null) {
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
  if (expected != null && response.status === expected) return { response, data: await responseJson(response) };
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

export async function openGrowthProposalPr(bundle, options = {}) {
  if (options.authorization !== GROWTH_PR_AUTHORIZATION) {
    throw new Error(`Explicit authorization required: --authorize=${GROWTH_PR_AUTHORIZATION}`);
  }
  const token = String(options.token || '').trim();
  if (!token) throw new Error('GITHUB_TOKEN is required to open a target-repository proposal PR.');
  const validation = validateGrowthPrDeliveryBundle(bundle);
  if (!validation.valid) throw new Error(`Invalid Growth PR delivery bundle: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  ensureReviewFileLimits(bundle.files);
  if (bundle.guardrails.reviewArtifactsOnly !== true || bundle.guardrails.writesProductionPaths !== false) throw new Error('Review-only delivery guardrails are not satisfied.');

  const apiBase = options.apiBase || 'https://api.github.com';
  if (apiBase !== 'https://api.github.com') throw new Error('Growth PR delivery v0.1 supports only https://api.github.com.');
  const fetchImpl = options.fetchImpl || fetch;
  const repoPath = encodedRepo(bundle.repository);

  const { data: repository } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}`);
  const base = bundle.branch.base || repository?.default_branch;
  if (!base) throw new Error('Unable to determine target repository base branch.');

  const branchUrl = `${apiBase}/repos/${repoPath}/git/ref/heads/${encodedRef(bundle.branch.name)}`;
  const branchResponse = await fetchImpl(branchUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (branchResponse.status !== 404) {
    if (branchResponse.ok) throw new Error(`Target proposal branch already exists: ${bundle.branch.name}`);
    let detail = '';
    try { detail = await branchResponse.text(); } catch {}
    throw new Error(`GitHub API ${branchResponse.status} while checking target branch${detail ? `: ${detail.slice(0, 500)}` : ''}`);
  }

  const { data: baseRef } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/git/ref/heads/${encodedRef(base)}`);
  const baseSha = baseRef?.object?.sha;
  if (!baseSha) throw new Error(`Base branch ${base} did not return a commit SHA.`);
  const { data: baseCommit } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/git/commits/${encodeURIComponent(baseSha)}`);
  const baseTreeSha = baseCommit?.tree?.sha;
  if (!baseTreeSha) throw new Error('Base commit did not return a tree SHA.');

  const treeEntries = [];
  for (const file of bundle.files) {
    if (!file.path.startsWith(REVIEW_ROOT)) throw new Error(`Production path is forbidden in review-only delivery: ${file.path}`);
    const { data: blob } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: file.content, encoding: 'utf-8' })
    });
    if (!blob?.sha) throw new Error(`GitHub did not return a blob SHA for ${file.path}.`);
    treeEntries.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const { data: tree } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries })
  });
  if (!tree?.sha) throw new Error('GitHub did not return the proposal tree SHA.');

  const { data: commit } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: 'chore(arwp): add Growth review proposal',
      tree: tree.sha,
      parents: [baseSha]
    })
  });
  if (!commit?.sha) throw new Error('GitHub did not return the proposal commit SHA.');

  await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${bundle.branch.name}`, sha: commit.sha })
  });

  const { data: pull } = await githubRequest(fetchImpl, token, `${apiBase}/repos/${repoPath}/pulls`, {
    method: 'POST',
    body: JSON.stringify({
      title: bundle.pullRequest.title,
      body: bundle.pullRequest.body,
      head: bundle.branch.name,
      base
    })
  });

  return {
    repository: bundle.repository,
    base,
    branch: bundle.branch.name,
    commitSha: commit.sha,
    prNumber: pull?.number ?? null,
    url: pull?.html_url ?? null,
    reviewArtifactsOnly: true
  };
}
