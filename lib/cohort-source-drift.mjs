/**
 * Read-only, commit-pinned drift review for members of an existing frozen
 * Controlled Cohort. Complements route-level Treatment Cohort Integrity; it
 * does not infer deployed revisions, Search outcomes or causal effects.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

export const COHORT_SOURCE_DRIFT_VERSION = '0.1';
const EXACT_COMMIT = /^[a-f0-9]{40}$/;
const MAX_MEMBERS = 250;
const MAX_EVENTS = 500;

function requireSha(value, label) {
  if (typeof value !== 'string' || !EXACT_COMMIT.test(value)) {
    throw new Error(label + ' must be an exact lowercase 40-character Git commit SHA.');
  }
  return value;
}

function calendarDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(label + ' must be a YYYY-MM-DD calendar date.');
  }
  const d = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(d.valueOf()) || d.toISOString().slice(0, 10) !== value) {
    throw new Error(label + ' is not a valid calendar date.');
  }
  return value;
}

function plusDays(value, offset) {
  const date = new Date(value + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function requireSafePath(value) {
  if (typeof value !== 'string' || !value || value.length > 512
    || value.startsWith('/') || value.includes('\\') || /[\x00-\x1f\x7f]/.test(value)
    || value.split('/').some(segment => !segment || segment === '.' || segment === '..' || segment === '.git')
    || value.startsWith('-')) {
    throw new Error('Frozen source paths must be safe relative repository paths.');
  }
  return value;
}

function membersFromCohort(cohort) {
  if (!cohort || typeof cohort !== 'object' || Array.isArray(cohort)
    || typeof cohort.id !== 'string' || !cohort.id
    || typeof cohort.repository !== 'string' || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(cohort.repository)) {
    throw new Error('A valid frozen Controlled Cohort with a repository is required.');
  }
  const beforeSha = requireSha(cohort.sourceEvidence?.repositoryRef, 'Frozen sourceEvidence.repositoryRef');
  if (cohort.measurementGate?.implementationRef !== beforeSha) {
    throw new Error('Frozen source ref and measurement implementation ref disagree.');
  }
  const members = [];
  const ids = new Set();
  const sources = new Set();
  for (const group of ['treatment', 'control']) {
    if (!Array.isArray(cohort[group]) || !cohort[group].length) {
      throw new Error('Frozen cohort must have treatment and control members.');
    }
    for (const m of cohort[group]) {
      if (!m || typeof m.id !== 'string' || !/^[a-zA-Z0-9_.-]{1,90}$/.test(m.id)) {
        throw new Error('Every cohort member needs a bounded stable ID.');
      }
      const source = requireSafePath(m.source);
      if (ids.has(m.id) || sources.has(source)) {
        throw new Error('Frozen cohort member IDs and source paths must not be duplicated.');
      }
      ids.add(m.id);
      sources.add(source);
      members.push({ id: m.id, group, source });
    }
  }
  if (members.length > MAX_MEMBERS) throw new Error('Frozen source cohort is too large.');
  return { beforeSha, members };
}

function git(cwd, args) {
  try {
    return execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
      timeout: 12000,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
      stdio: ['ignore', 'pipe', 'pipe']
    }).trimEnd();
  } catch {
    // Do not echo Git errors: remote URLs/local paths may contain credentials.
    throw new Error('Git read failed. Check the local checkout, required commit history and permissions.');
  }
}

function validateRepoFolder(repoFolder) {
  if (typeof repoFolder !== 'string' || !repoFolder.trim()) throw new Error('An explicit local --repo checkout is required.');
  const folder = fs.realpathSync(path.resolve(repoFolder));
  if (!fs.statSync(folder).isDirectory()) throw new Error('Git checkout must be a directory.');
  const root = fs.realpathSync(git(folder, ['rev-parse', '--show-toplevel']));
  if (root !== folder) throw new Error('Point --repo at the Git checkout root, not a subdirectory.');
  return folder;
}

function verifyCommit(repoFolder, sha) {
  requireSha(sha, 'Commit');
  if (git(repoFolder, ['cat-file', '-t', sha]) !== 'commit') {
    throw new Error('Frozen source refs must be Git commits, not tags or blob IDs.');
  }
}

function verifyRepoIdentity(folder, expected) {
  let remote;
  try {
    remote = git(folder, ['remote', 'get-url', 'origin']);
  } catch {
    return 'no-origin-to-check';
  }
  const m = remote.match(/(?:github\.com[:/])([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+?)(?:\.git)?\/?$/i);
  if (!m) return 'origin-not-independently-verifiable';
  if (m[1].toLowerCase() !== expected.toLowerCase()) {
    throw new Error('Checkout GitHub origin disagrees with the frozen cohort repository.');
  }
  return 'github-origin-matches-cohort';
}

function treeBlobs(repoFolder, commitSha, sources) {
  const output = git(repoFolder, ['ls-tree', '-r', '-z', '--full-tree', commitSha, '--', ...sources]);
  const paths = new Set(sources);
  const found = new Map();
  for (const line of output.split('\0').filter(Boolean)) {
    const match = /^([0-7]{6}) (blob|commit) ([a-f0-9]{40})\t([\s\S]*)$/.exec(line);
    if (!match) throw new Error('Unexpected Git tree record.');
    const [, mode, kind, blob, source] = match;
    if (paths.has(source)) found.set(source, { mode, kind, sha: blob });
  }
  return found;
}

function normalizeEvents(cohort, eventsFile, members) {
  if (eventsFile == null) return { available: false, completeThrough: null, events: [] };
  if (!eventsFile || typeof eventsFile !== 'object' || Array.isArray(eventsFile)
    || eventsFile.version !== '0.1' || eventsFile.cohortId !== cohort.id
    || !Array.isArray(eventsFile.events) || eventsFile.events.length > MAX_EVENTS) {
    throw new Error('Publication events need version 0.1, exact cohortId and bounded events[].');
  }
  const allowed = new Map(members.map(m => [m.id, m.group]));
  const completeThrough = eventsFile.completeThrough == null
    ? null : calendarDate(eventsFile.completeThrough, 'completeThrough');
  const seen = new Set();
  const normalized = eventsFile.events.map(e => {
    if (!e || typeof e !== 'object' || !allowed.has(e.memberId)
      || !['editorial', 'redirect', 'metadata', 'technical', 'other'].includes(e.kind)) {
      throw new Error('Publication event requires a frozen member ID and supported kind.');
    }
    const publishedOn = calendarDate(e.publishedOn, 'event.publishedOn');
    const productionRef = requireSha(e.productionRef, 'event.productionRef');
    let evidenceUrl;
    try {
      evidenceUrl = new URL(e.evidenceUrl);
    } catch {
      throw new Error('Publication event needs an HTTPS evidence URL.');
    }
    if (evidenceUrl.protocol !== 'https:' || evidenceUrl.username || evidenceUrl.password) {
      throw new Error('Publication event needs a credential-free HTTPS evidence URL.');
    }
    const key = [e.memberId, publishedOn, productionRef].join('|');
    if (seen.has(key)) throw new Error('Duplicate dated publication event.');
    seen.add(key);
    if (completeThrough && publishedOn > completeThrough) {
      throw new Error('Publication event is after the declared reviewed completeThrough date.');
    }
    return {
      memberId: e.memberId,
      group: allowed.get(e.memberId),
      kind: e.kind,
      publishedOn,
      productionRef,
      evidenceUrl: evidenceUrl.href
    };
  });
  return { available: true, completeThrough, events: normalized.sort((a, b) =>
    a.publishedOn.localeCompare(b.publishedOn) || a.memberId.localeCompare(b.memberId)) };
}

function reviewWindows(cohort, deploymentDate, events) {
  if (!deploymentDate) return [];
  if (cohort.measurementGate?.state !== 'ready'
    || cohort.measurementGate?.implementationRef !== cohort.measurementGate?.productionRef) {
    throw new Error('Frozen cohort has no ready exact-deployment gate; cannot review observation windows.');
  }
  const deployedOn = calendarDate(deploymentDate, 'deploymentDate');
  const windows = cohort.observationWindowsDays;
  if (!Array.isArray(windows) || !windows.length
    || windows.some(n => !Number.isInteger(n) || n < 1 || n > 365)) {
    throw new Error('Frozen observation windows are invalid.');
  }
  return windows.map(days => {
    const startDate = plusDays(deployedOn, 1);
    const endDate = plusDays(deployedOn, days);
    const published = events.events.filter(e => e.publishedOn >= startDate && e.publishedOn <= endDate);
    const controls = published.filter(e => e.group === 'control');
    const treatments = published.filter(e => e.group === 'treatment');
    return {
      days,
      startDate,
      endDate,
      ownerLedgerState: !events.available ? 'not-provided'
        : !events.completeThrough || events.completeThrough < endDate ? 'partial-or-unbounded'
        : 'owner-declared-through-window-end',
      interpretation: controls.length ? 'review-control-change'
        : !events.available ? 'publication-unknown' : 'no-control-event-in-supplied-ledger',
      ownerReportedControlEvents: controls.map(e => ({ memberId: e.memberId, publishedOn: e.publishedOn, kind: e.kind })),
      ownerReportedTreatmentEvents: treatments.map(e => ({ memberId: e.memberId, publishedOn: e.publishedOn, kind: e.kind }))
    };
  });
}

/**
 * Require exact two Git commits, compare only frozen source members.
 * Git never reads working-tree changes and never authenticates a deployment.
 */
export function inspectCohortSourceDrift(cohort, { repoFolder, afterRef, deploymentDate = null, publicationEvents = null } = {}) {
  const { beforeSha, members } = membersFromCohort(cohort);
  const afterSha = requireSha(afterRef, 'afterRef');
  const folder = validateRepoFolder(repoFolder);
  const repoIdentity = verifyRepoIdentity(folder, cohort.repository);
  verifyCommit(folder, beforeSha);
  verifyCommit(folder, afterSha);
  const ancestry = spawnSync('git', ['-C', folder, 'merge-base', '--is-ancestor', beforeSha, afterSha], {
    timeout: 12000,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    stdio: 'ignore'
  });
  if (ancestry.status !== 0) throw new Error('Selected afterRef is not proven descended from the frozen source commit.');
  const sources = members.map(m => m.source);
  const before = treeBlobs(folder, beforeSha, sources);
  const after = treeBlobs(folder, afterSha, sources);
  const rows = members.map(member => {
    const a = before.get(member.source);
    const b = after.get(member.source);
    const comparable = a?.kind === 'blob' && b?.kind === 'blob'
      && ['100644', '100755'].includes(a.mode) && ['100644', '100755'].includes(b.mode);
    const state = comparable ? (a.sha === b.sha && a.mode === b.mode ? 'source-unchanged' : 'source-changed')
      : 'unknown-source-ownership';
    return {
      id: member.id,
      group: member.group,
      source: member.source,
      baselineBlob: a?.sha || null,
      afterBlob: b?.sha || null,
      state,
      reason: state === 'source-changed' ? 'Committed source blob or executable bit differs; live publication is not established.'
        : state === 'source-unchanged' ? 'Frozen source blob and executable bit match at both selected commits; shared build dependencies are not assessed.'
        : 'Source is missing, a symlink, a submodule, or otherwise not a comparable regular Git blob.'
    };
  });
  const events = normalizeEvents(cohort, publicationEvents, members);
  const windows = reviewWindows(cohort, deploymentDate, events);
  const count = (group, state) => rows.filter(row => row.group === group && row.state === state).length;
  const changedControls = count('control', 'source-changed');
  const unknownControls = count('control', 'unknown-source-ownership');
  return {
    version: COHORT_SOURCE_DRIFT_VERSION,
    kind: 'frozen-cohort-source-drift',
    cohortId: cohort.id,
    repository: cohort.repository,
    baselineCommit: beforeSha,
    comparedCommit: afterSha,
    repositoryIdentity: repoIdentity,
    measurementGateAtFreeze: cohort.measurementGate?.state || 'unknown',
    summary: {
      treatmentCount: members.filter(m => m.group === 'treatment').length,
      controlCount: members.filter(m => m.group === 'control').length,
      changedTreatments: count('treatment', 'source-changed'),
      unchangedTreatments: count('treatment', 'source-unchanged'),
      unknownTreatments: count('treatment', 'unknown-source-ownership'),
      changedControls,
      unchangedControls: count('control', 'source-unchanged'),
      unknownControls
    },
    members: rows,
    publicationEvidence: {
      state: events.available ? 'owner-declared-not-independently-authenticated' : 'not-provided',
      completeThrough: events.completeThrough,
      recordedEvents: events.events.length
    },
    windows,
    reviewRequired: Boolean(changedControls || unknownControls ||
      windows.some(w => w.interpretation === 'review-control-change')),
    nextAction: changedControls
      ? 'Review each changed control source against dated observed publication receipts; do not assume an unchanged live control.'
      : unknownControls
        ? 'Resolve missing or nonregular control sources before asserting an unchanged comparison group.'
        : 'Preserve this result as a source-only observation; check dated deployments, redirects, shared inputs and owner outcomes separately.',
    guardrails: {
      frozenDesignUnmodified: true,
      comparesCommittedSourcesOnly: true,
      localWorkingTreeIgnored: true,
      noSiteMutation: true,
      sourceChangeIsNotLiveDeployment: true,
      publicationEventsAreOwnerDeclared: true,
      noAutomaticCausalOutcome: true,
      notAnIndexingOrRankingObservation: true
    }
  };
}
