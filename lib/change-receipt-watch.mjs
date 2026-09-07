import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateBraidGraph } from './braid-graph.mjs';
import { changeReceiptBraidReport } from './change-receipt-braid.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'watch-proof-queue-bundle.schema.json');

export const WATCH_PROOF_QUEUE_VERSION = '0.1';

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };
const IMPORTANCE_ORDER = { critical: 0, high: 1, normal: 2, low: 3 };
const QUEUE_ORDER = ['failedVerification', 'missingVerification', 'reReviewRequired', 'mergedButUnmeasured', 'rolledBack'];
const QUEUE_CLASSIFICATION = {
  failedVerification: 'verification-failure',
  missingVerification: 'verification-gap',
  reReviewRequired: 'knowledge-re-review',
  mergedButUnmeasured: 'measurement-gap',
  rolledBack: 'rollback-review'
};
const QUEUE_PRIORITY = {
  failedVerification: { critical: 'P0', high: 'P0', normal: 'P1', low: 'P2' },
  missingVerification: { critical: 'P0', high: 'P1', normal: 'P2', low: 'P3' },
  reReviewRequired: { critical: 'P0', high: 'P1', normal: 'P2', low: 'P3' },
  mergedButUnmeasured: { critical: 'P1', high: 'P2', normal: 'P2', low: 'P3' },
  rolledBack: { critical: 'P1', high: 'P1', normal: 'P2', low: 'P3' }
};

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

export function validateWatchProofQueueBundle(value) {
  const validate = validator();
  return { valid: Boolean(validate(value)), errors: validate.errors || [] };
}

function iso(value = null) {
  const date = value == null ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date/time: ${value}`);
  return date.toISOString();
}

function unique(values = []) {
  return [...new Set(values.filter(value => value != null && String(value).trim()).map(value => String(value)))];
}

function validateEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('Watch target entries must be objects.');
  if (!entry.id) throw new Error('Watch target id is required.');
  if (!['critical', 'high', 'normal', 'low'].includes(entry.importance)) {
    throw new Error(`Invalid Watch target importance for ${entry.id}: ${entry.importance}`);
  }
  const validation = validateBraidGraph(entry.graph);
  if (!validation.valid) {
    throw new Error(`Invalid BraidGraph for Watch target ${entry.id}: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  }
}

function portfolioMeta(entry, graph, portfolio) {
  const sites = portfolio?.sites || [];
  const match = sites.find(site => entry.portfolioSiteId && site.id === entry.portfolioSiteId)
    || sites.find(site => site.canonicalUrl === graph.site)
    || sites.find(site => graph.repository?.fullName && site.repository === graph.repository.fullName)
    || null;
  return {
    portfolioSiteId: match?.id || entry.portfolioSiteId || null,
    portfolioName: match?.name || null
  };
}

function key(row) {
  return String(row.changeId || row.receiptId || row.nodeId);
}

function queueMembership(report) {
  const memberships = new Map();
  for (const queue of QUEUE_ORDER) {
    for (const row of report.queues?.[queue] || []) {
      const id = key(row);
      if (!memberships.has(id)) memberships.set(id, new Set());
      memberships.get(id).add(queue);
    }
  }
  return memberships;
}

function reasonsFor(queues, importance) {
  return queues.map(queue => ({
    queue,
    classification: QUEUE_CLASSIFICATION[queue],
    priority: QUEUE_PRIORITY[queue][importance]
  })).sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    || QUEUE_ORDER.indexOf(a.queue) - QUEUE_ORDER.indexOf(b.queue));
}

function rationale(row, reasons, importance) {
  const queueText = reasons.map(reason => reason.queue).join(', ');
  const primary = reasons[0];
  return `Change ${row.changeId || row.receiptId} is in ${queueText} for an explicitly ${importance} target. Primary review reason ${primary.classification}; priority ${primary.priority}. This is evidence for portfolio review, not proof of Search/AI outcome impact and not authorization to mutate production.`;
}

function attentionRows(entry, graph, portfolio) {
  const report = changeReceiptBraidReport(graph);
  const memberships = queueMembership(report);
  const meta = portfolioMeta(entry, graph, portfolio);
  const rows = [];

  for (const receipt of report.latest) {
    const queues = QUEUE_ORDER.filter(queue => memberships.get(key(receipt))?.has(queue));
    if (!queues.length) continue;
    const reasons = reasonsFor(queues, entry.importance);
    rows.push({
      siteId: entry.id,
      site: graph.site,
      repository: graph.repository?.fullName || null,
      portfolioSiteId: meta.portfolioSiteId,
      portfolioName: meta.portfolioName,
      importance: entry.importance,
      changeId: receipt.changeId,
      receiptId: receipt.receiptId,
      revision: receipt.revision,
      mutationState: receipt.mutationState,
      verificationStatus: receipt.verificationStatus,
      deploymentState: receipt.deploymentState,
      outcomeStatus: receipt.outcomeStatus,
      reReviewRequired: receipt.reReviewRequired,
      reviewDecision: receipt.reviewDecision,
      queues,
      reasons,
      priority: reasons[0].priority,
      priorityFactors: unique([
        `importance:${entry.importance}`,
        `mutation-state:${receipt.mutationState}`,
        `verification-status:${receipt.verificationStatus}`,
        `outcome-status:${receipt.outcomeStatus}`,
        ...queues.map(queue => `queue:${queue}`)
      ]),
      rationale: rationale(receipt, reasons, entry.importance)
    });
  }

  return { rows, report };
}

function sortRows(rows) {
  return rows.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    || IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance]
    || a.siteId.localeCompare(b.siteId)
    || String(a.changeId || a.receiptId).localeCompare(String(b.changeId || b.receiptId)));
}

function summarize(targets, rows, excludedSites) {
  const byPriority = {};
  const byQueue = {};
  for (const row of rows) {
    byPriority[row.priority] = (byPriority[row.priority] || 0) + 1;
    for (const queue of row.queues) byQueue[queue] = (byQueue[queue] || 0) + 1;
  }
  return {
    targets: targets.length,
    enabledTargets: targets.filter(entry => entry.enabled !== false).length,
    sitesWithAttention: new Set(rows.map(row => row.siteId)).size,
    changesWithAttention: rows.length,
    excludedSites: excludedSites.length,
    byPriority,
    byQueue
  };
}

export function buildWatchProofQueueBundle(entries, options = {}) {
  const targets = (entries || []).map(entry => ({ ...entry, enabled: entry.enabled !== false }));
  if (!targets.length) throw new Error('SignalBraid Watch Proof queues require at least one target graph.');

  const attention = [];
  const excludedSites = [];
  for (const entry of targets) {
    if (!entry.enabled) {
      excludedSites.push({ siteId: entry.id, site: entry.graph?.site || null, reason: 'disabled' });
      continue;
    }
    validateEntry(entry);
    const result = attentionRows(entry, entry.graph, options.portfolio || null);
    if (!result.report.changes) {
      excludedSites.push({ siteId: entry.id, site: entry.graph.site, reason: 'no-change-receipts' });
      continue;
    }
    if (!result.rows.length) {
      excludedSites.push({ siteId: entry.id, site: entry.graph.site, reason: 'no-proof-queue-items' });
      continue;
    }
    attention.push(...result.rows);
  }

  const rows = sortRows(attention);
  const bundle = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/watch-proof-queue-bundle.schema.json',
    version: WATCH_PROOF_QUEUE_VERSION,
    generatedAt: iso(options.generatedAt),
    mode: 'change-receipt-queues',
    summary: summarize(targets, rows, excludedSites),
    attention: rows,
    excludedSites: excludedSites.sort((a, b) => a.siteId.localeCompare(b.siteId)),
    interpretation: {
      queueMembershipIsReviewEvidenceNotOutcomeCausality: true,
      missingOutcomeIsUnknownNotZero: true,
      verificationFailureIsImplementationEvidence: true,
      reReviewDoesNotMeanBroken: true,
      productionMutationAuthorized: false
    }
  };

  const validation = validateWatchProofQueueBundle(bundle);
  if (!validation.valid) {
    throw new Error(`Invalid Watch Proof queue bundle: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  }
  return bundle;
}

export function formatWatchProofQueueBundle(bundle) {
  const lines = [
    'SignalBraid Watch · Proof queues',
    `${bundle.summary.changesWithAttention} change(s) need review across ${bundle.summary.sitesWithAttention} site(s).`
  ];
  for (const row of bundle.attention) {
    lines.push('');
    lines.push(`${row.priority} · ${row.siteId} · ${row.reasons[0].classification}`);
    lines.push(`change: ${row.changeId || row.receiptId}`);
    lines.push(`queues: ${row.queues.join(', ')}`);
    lines.push(`state: mutation=${row.mutationState}; verification=${row.verificationStatus}; outcome=${row.outcomeStatus}; review=${row.reviewDecision}`);
    lines.push(row.rationale);
  }
  if (bundle.excludedSites.length) {
    lines.push('');
    lines.push(`excluded: ${bundle.excludedSites.map(row => `${row.siteId}:${row.reason}`).join(', ')}`);
  }
  lines.push('');
  lines.push('Proof queues preserve missing/negative evidence. They do not prove ranking or citation impact and do not authorize production mutation.');
  return lines.join('\n');
}
