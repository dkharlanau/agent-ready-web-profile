import { canonicalJson, sha256Digest } from './evidence-receipt.mjs';
import {
  CHANGE_RECEIPT_CANONICALIZATION,
  reviseChangeReceipt,
  verifyChangeReceipt
} from './change-receipt.mjs';

function iso(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid transition date/time: ${value}`);
  return date.toISOString();
}

function unique(values = []) {
  return [...new Set(values.filter(value => value != null && String(value).trim()).map(value => String(value)))];
}

function sha40(value, label) {
  const text = String(value || '').toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(text)) throw new Error(`${label} must be a 40-character commit SHA.`);
  return text;
}

function urnFromDigest(digest) {
  if (!/^sha256:[a-f0-9]{64}$/.test(String(digest || ''))) throw new Error(`Invalid SHA-256 digest: ${digest}`);
  return `urn:sha256:${String(digest).slice(7)}`;
}

function payloadForDigest(receipt) {
  const payload = structuredClone(receipt);
  delete payload.receiptId;
  delete payload.digests;
  return payload;
}

function refFromEvidence(evidence) {
  if (typeof evidence === 'string') return evidence;
  if (evidence && typeof evidence === 'object') return `transition-evidence:${sha256Digest(canonicalJson(evidence))}`;
  return null;
}

function finaliseAugmentedReceipt(receipt) {
  const payloadDigest = sha256Digest(canonicalJson(payloadForDigest(receipt)));
  receipt.digests = {
    algorithm: 'sha256',
    canonicalization: CHANGE_RECEIPT_CANONICALIZATION,
    payload: payloadDigest
  };
  receipt.receiptId = urnFromDigest(payloadDigest);
  const verification = verifyChangeReceipt(receipt);
  if (!verification.valid) throw new Error(`Hardened Change Receipt failed integrity verification: ${verification.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return receipt;
}

function requireGithub(receipt, state) {
  if (receipt.mutation.executionKind !== 'github-pr' || !receipt.mutation.github) {
    throw new Error(`${state} transition requires a prior GitHub PR Change Receipt revision.`);
  }
}

function hardenMerged(receipt, transition) {
  requireGithub(receipt, 'merged');
  const mergeCommitSha = sha40(transition.mergeCommitSha, 'mergeCommitSha');
  const mergedAt = iso(transition.mergedAt || transition.observedAt);
  const evidenceRefs = unique([
    ...(transition.evidenceRefs || []),
    refFromEvidence(transition.evidence || null),
    transition.mergeUrl || null
  ]);
  if (!evidenceRefs.length) throw new Error('merged transition requires at least one explicit evidenceRef, evidence payload, or mergeUrl.');
  receipt.mutation.github = {
    ...receipt.mutation.github,
    mergeCommitSha,
    mergedAt,
    mergeEvidenceRefs: evidenceRefs
  };
  receipt.mutation.state = 'merged';
  receipt.mutation.executedAt = mergedAt;
  return receipt;
}

function hardenDeployment(receipt, transition, deployment) {
  requireGithub(receipt, 'deployed');
  if (!receipt.mutation.github.mergeCommitSha || !receipt.mutation.github.mergedAt) {
    throw new Error('deployed transition requires inspectable merge evidence from a prior merged revision.');
  }
  const normalizedDeployment = deployment || {};
  if (normalizedDeployment.state !== 'deployed') throw new Error('deployed mutation transition requires deployment.state="deployed" in the same revision.');
  const deployCommitSha = sha40(normalizedDeployment.commitSha, 'deployment.commitSha');
  if (deployCommitSha !== receipt.mutation.github.mergeCommitSha) {
    throw new Error(`Deployment commit ${deployCommitSha} does not match recorded merge commit ${receipt.mutation.github.mergeCommitSha}.`);
  }
  if (!normalizedDeployment.observedAt) throw new Error('deployed transition requires deployment.observedAt.');
  if (!unique(normalizedDeployment.evidenceRefs || normalizedDeployment.evidence || []).length) {
    throw new Error('deployed transition requires explicit deployment evidenceRefs/evidence.');
  }
  receipt.mutation.state = 'deployed';
  receipt.mutation.executedAt = iso(transition.observedAt || normalizedDeployment.observedAt);
  return receipt;
}

export function reviseChangeReceiptWithTransitionEvidence(previous, updates = {}, options = {}) {
  const transition = updates.mutation || null;
  const state = transition?.state || null;
  const revised = reviseChangeReceipt(previous, updates, options);
  if (!state || !['merged', 'deployed'].includes(state)) return revised;

  let hardened = structuredClone(revised);
  if (state === 'merged') hardened = hardenMerged(hardened, transition);
  if (state === 'deployed') hardened = hardenDeployment(hardened, transition, updates.deployment);
  return finaliseAugmentedReceipt(hardened);
}

export function inspectGitHubTransitionEvidence(receipt) {
  const verification = verifyChangeReceipt(receipt);
  if (!verification.valid) throw new Error('A valid Change Receipt is required.');
  const github = receipt.mutation.github;
  return {
    receiptId: receipt.receiptId,
    revision: receipt.revision,
    mutationState: receipt.mutation.state,
    github: github ? {
      branch: github.branch,
      commitSha: github.commitSha,
      pullRequestNumber: github.pullRequestNumber,
      pullRequestUrl: github.pullRequestUrl,
      mergeCommitSha: github.mergeCommitSha || null,
      mergedAt: github.mergedAt || null,
      mergeEvidenceRefs: github.mergeEvidenceRefs || []
    } : null,
    deployment: receipt.deployment,
    complete: Boolean(
      github?.mergeCommitSha &&
      github?.mergedAt &&
      Array.isArray(github?.mergeEvidenceRefs) && github.mergeEvidenceRefs.length &&
      (receipt.mutation.state !== 'deployed' || (
        receipt.deployment.state === 'deployed' &&
        receipt.deployment.commitSha === github.mergeCommitSha &&
        receipt.deployment.evidenceRefs.length
      ))
    )
  };
}
