import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateBraidGraph, impactBraidGraph } from './braid-graph.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const impactSchemaPath = path.join(root, 'schema', 'watch-impact-bundle.schema.json');
const targetsSchemaPath = path.join(root, 'schema', 'watch-targets.schema.json');

export const BRAID_WATCH_VERSION = '0.1';
const OWNER_GATED_CLASSES = new Set(['policy-gated', 'editorial', 'owner-platform', 'runtime']);
const EXECUTED_RECEIPT_STATES = new Set(['applied-local', 'pr-opened', 'merged', 'deployed', 'rolled-back', 'failed']);
const IMPORTANCE_ORDER = { critical: 0, high: 1, normal: 2, low: 3 };
const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };

function validator(schemaPath) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

export function validateWatchTargets(value) {
  const validate = validator(targetsSchemaPath);
  return { valid: Boolean(validate(value)), errors: validate.errors || [] };
}

export function validateWatchImpactBundle(value) {
  const validate = validator(impactSchemaPath);
  return { valid: Boolean(validate(value)), errors: validate.errors || [] };
}

function hash(value, length = 24) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex').slice(0, length);
}

function iso(value = null) {
  const date = value == null ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date/time: ${value}`);
  return date.toISOString();
}

function unique(values = []) {
  return [...new Set(values.filter(value => value != null && String(value).trim()).map(value => String(value)))];
}

function sourceOrRuleRef(node) {
  return node.type === 'rule' ? String(node.data?.ruleId || node.id) : String(node.data?.url || node.id);
}

function currentCandidate(graph, selector) {
  const candidates = graph.nodes.filter(node => {
    if (selector.rule) return node.type === 'rule' && node.data?.ruleId === selector.rule;
    if (selector.source) return node.type === 'source' && node.data?.url === selector.source;
    return false;
  });
  candidates.sort((a, b) => {
    const ah = a.data?.historical === true ? 1 : 0;
    const bh = b.data?.historical === true ? 1 : 0;
    if (ah !== bh) return ah - bh;
    const as = ['retired', 'review-due', 'current', 'superseded'].indexOf(a.state);
    const bs = ['retired', 'review-due', 'current', 'superseded'].indexOf(b.state);
    if (as !== bs) return (as < 0 ? 99 : as) - (bs < 0 ? 99 : bs);
    return String(b.versionKey).localeCompare(String(a.versionKey));
  });
  return candidates[0] || null;
}

function triggerFromNode(node) {
  return {
    id: `watch-trigger:${hash(`explicit\n${node.id}\n${node.versionKey}\n${node.state}`)}`,
    kind: 'explicit',
    nodeType: node.type,
    nodeId: node.id,
    ref: sourceOrRuleRef(node),
    state: node.state,
    observedAt: null,
    edgeId: null
  };
}

function changedSinceTriggers(graph, since) {
  const cutoff = new Date(since).getTime();
  if (Number.isNaN(cutoff)) throw new Error(`Invalid changed-since timestamp: ${since}`);
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const rows = [];
  for (const edge of graph.edges) {
    if (edge.type !== 'supersedes' || !edge.observedAt) continue;
    const observedAt = new Date(edge.observedAt).getTime();
    if (Number.isNaN(observedAt) || observedAt < cutoff) continue;
    const current = nodeMap.get(edge.from);
    if (!current || !['source', 'rule'].includes(current.type)) continue;
    rows.push({
      id: `watch-trigger:${hash(`supersedes\n${edge.id}`)}`,
      kind: 'supersedes-event',
      nodeType: current.type,
      nodeId: current.id,
      ref: sourceOrRuleRef(current),
      state: current.state,
      observedAt: edge.observedAt,
      edgeId: edge.id
    });
  }
  return rows.sort((a, b) => String(a.observedAt).localeCompare(String(b.observedAt)) || a.id.localeCompare(b.id));
}

function portfolioMeta(entry, graph, portfolio) {
  const sites = portfolio?.sites || [];
  const match = sites.find(site => entry.portfolioSiteId && site.id === entry.portfolioSiteId)
    || sites.find(site => site.canonicalUrl === graph.site)
    || sites.find(site => graph.repository?.fullName && site.repository === graph.repository.fullName)
    || null;
  return match ? {
    portfolioSiteId: match.id,
    name: match.name || null,
    rollout: match.rollout || null,
    verticals: match.verticals || [],
    goals: match.goals || []
  } : { portfolioSiteId: entry.portfolioSiteId || null, name: null, rollout: null, verticals: [], goals: [] };
}

function recommendations(nodes) {
  return nodes.filter(node => node.type === 'recommendation').map(node => ({
    id: String(node.data?.recommendationId || node.id),
    nodeId: node.id,
    state: node.state,
    automationClass: node.data?.automationClass == null ? null : String(node.data.automationClass)
  })).sort((a, b) => a.id.localeCompare(b.id) || a.nodeId.localeCompare(b.nodeId));
}

function transforms(nodes) {
  return nodes.filter(node => node.type === 'transform').map(node => ({
    nodeId: node.id,
    operationId: node.data?.operationId == null ? null : String(node.data.operationId),
    state: node.state,
    path: node.data?.path == null ? null : String(node.data.path)
  })).sort((a, b) => String(a.path || '').localeCompare(String(b.path || '')) || a.nodeId.localeCompare(b.nodeId));
}

function receipts(nodes) {
  return nodes.filter(node => node.type === 'change-receipt').map(node => ({
    nodeId: node.id,
    receiptId: node.data?.receiptId || null,
    revision: Number(node.data?.revision || 0),
    mutationState: String(node.data?.mutationState || node.state || 'unknown'),
    verificationStatus: String(node.data?.verificationStatus || 'unknown'),
    outcomeStatus: String(node.data?.outcomeStatus || 'unknown'),
    reReviewRequired: Boolean(node.data?.reReviewRequired),
    reviewDecision: String(node.data?.reviewDecision || 'pending')
  })).sort((a, b) => a.revision - b.revision || a.nodeId.localeCompare(b.nodeId));
}

function surfaceLabel(node) {
  return node.data?.surfaceKey || node.data?.routePath || node.data?.url || node.data?.target || node.id;
}

function ownerReviewReasons(recs, policyNodes) {
  const reasons = [];
  for (const rec of recs) if (OWNER_GATED_CLASSES.has(rec.automationClass)) reasons.push(`recommendation:${rec.id}:${rec.automationClass}`);
  for (const node of policyNodes) reasons.push(`policy:${node.id}`);
  return unique(reasons).sort();
}

function hasExecutedReceipt(rows) {
  return rows.some(row => EXECUTED_RECEIPT_STATES.has(row.mutationState));
}

function classification(trigger, recs, receiptRows, transformRows, ownerReasons) {
  if (ownerReasons.length) return 'blocked-owner-review';
  if (trigger.state === 'retired') return 'retire-candidate';
  if (trigger.state === 'superseded') return transformRows.length || receiptRows.length ? 'likely-update' : 're-review';
  if (trigger.kind === 'supersedes-event') return transformRows.length || receiptRows.length ? 'likely-update' : 're-review';
  if (trigger.state === 'review-due') return 're-review';
  return 're-review';
}

function priority(trigger, importance, receiptRows, transformRows, ownerReasons) {
  const executed = hasExecutedReceipt(receiptRows);
  const hasTransform = transformRows.length > 0;
  const highImportance = importance === 'critical' || importance === 'high';
  const revision = trigger.kind === 'supersedes-event' || ['superseded', 'retired'].includes(trigger.state);
  const factors = [
    `trigger-state:${trigger.state}`,
    `importance:${importance}`,
    ...(trigger.kind === 'supersedes-event' ? ['recorded-supersession-event'] : []),
    ...(executed ? ['executed-change-present'] : hasTransform ? ['planned-transform-present'] : ['no-transform-recorded']),
    ...(ownerReasons.length ? ['owner-or-policy-review-required'] : [])
  ];

  if (importance === 'critical' && revision && executed) return { priority: 'P0', factors };
  if (revision && executed) return { priority: 'P1', factors };
  if (ownerReasons.length && highImportance) return { priority: 'P1', factors };
  if (trigger.state === 'review-due' && executed && highImportance) return { priority: 'P1', factors };
  if ((revision || trigger.state === 'review-due') && (executed || hasTransform)) return { priority: 'P2', factors };
  if (ownerReasons.length) return { priority: 'P2', factors };
  return { priority: 'P3', factors };
}

function rationale(trigger, classificationValue, priorityValue, transformRows, receiptRows, ownerReasons) {
  const parts = [
    `${trigger.nodeType} ${trigger.ref} is recorded as ${trigger.state}${trigger.kind === 'supersedes-event' ? ' with a dated supersession event' : ''}.`,
    `${transformRows.length} transform(s) and ${receiptRows.length} Change Receipt revision(s) are reachable from the trigger.`
  ];
  if (ownerReasons.length) parts.push(`Owner/policy review remains required: ${ownerReasons.join(', ')}.`);
  parts.push(`Classification ${classificationValue}; priority ${priorityValue}. This is a re-review queue, not proof of breakage or authorization to mutate production.`);
  return parts.join(' ');
}

function impactRow(entry, graph, trigger, portfolio) {
  const impact = impactBraidGraph(graph, { nodeId: trigger.nodeId });
  const nodes = impact.affected.nodes;
  const recs = recommendations(nodes);
  const transformRows = transforms(nodes);
  const receiptRows = receipts(nodes);
  const policyNodes = nodes.filter(node => node.type === 'policy');
  const ownerReasons = ownerReviewReasons(recs, policyNodes);
  const classValue = classification(trigger, recs, receiptRows, transformRows, ownerReasons);
  const p = priority(trigger, entry.importance, receiptRows, transformRows, ownerReasons);
  const portfolioInfo = portfolioMeta(entry, graph, portfolio);
  const repoPaths = unique(nodes.filter(node => node.type === 'repo-file').map(node => node.data?.path)).sort();
  const surfaces = unique(nodes.filter(node => node.type === 'surface').map(surfaceLabel)).sort();
  const historicalEvidenceNodeIds = unique(nodes.filter(node => node.data?.historical === true || ['superseded', 'retired'].includes(node.state)).map(node => node.id)).sort();

  return {
    siteId: entry.id,
    site: graph.site,
    repository: graph.repository?.fullName || null,
    portfolioSiteId: portfolioInfo.portfolioSiteId,
    importance: entry.importance,
    triggerId: trigger.id,
    classification: classValue,
    priority: p.priority,
    priorityFactors: unique(p.factors),
    recommendations: recs,
    transforms: transformRows,
    repoPaths,
    surfaces,
    changeReceipts: receiptRows,
    policyNodeIds: policyNodes.map(node => node.id).sort(),
    ownerReviewReasons: ownerReasons,
    historicalEvidenceNodeIds,
    rationale: rationale(trigger, classValue, p.priority, transformRows, receiptRows, ownerReasons)
  };
}

function sortImpacts(rows) {
  return rows.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    || IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance]
    || a.siteId.localeCompare(b.siteId)
    || a.triggerId.localeCompare(b.triggerId));
}

function summary(targetCount, impacts, excludedSites) {
  const byPriority = {};
  const byClassification = {};
  for (const row of impacts) {
    byPriority[row.priority] = (byPriority[row.priority] || 0) + 1;
    byClassification[row.classification] = (byClassification[row.classification] || 0) + 1;
  }
  return {
    targets: targetCount,
    impactedSites: new Set(impacts.map(row => row.siteId)).size,
    impactRows: impacts.length,
    excludedSites: excludedSites.length,
    byPriority,
    byClassification
  };
}

function validateEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('Watch target entries must be objects.');
  if (!entry.id) throw new Error('Watch target id is required.');
  if (!['critical', 'high', 'normal', 'low'].includes(entry.importance)) throw new Error(`Invalid Watch target importance for ${entry.id}: ${entry.importance}`);
  const validation = validateBraidGraph(entry.graph);
  if (!validation.valid) throw new Error(`Invalid BraidGraph for Watch target ${entry.id}: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
}

export function buildWatchImpactBundle(entries, query = {}, options = {}) {
  const targets = (entries || []).map(entry => ({ ...entry, enabled: entry.enabled !== false }));
  if (!targets.length) throw new Error('SignalBraid Watch requires at least one target graph.');
  const explicitCount = Number(Boolean(query.rule)) + Number(Boolean(query.source));
  const changedSince = query.changedSince == null ? null : iso(query.changedSince);
  if (changedSince && explicitCount) throw new Error('Use either changedSince or one explicit rule/source selector, not both.');
  if (!changedSince && explicitCount !== 1) throw new Error('Watch impact requires exactly one of rule, source, or changedSince.');
  for (const entry of targets) if (entry.enabled) validateEntry(entry);

  const triggerEvents = [];
  const impacts = [];
  const excludedSites = [];
  const triggerSeen = new Set();

  for (const entry of targets) {
    if (!entry.enabled) {
      excludedSites.push({ siteId: entry.id, site: entry.graph?.site || null, reason: 'disabled' });
      continue;
    }
    const graph = entry.graph;
    let triggers = [];
    if (changedSince) {
      triggers = changedSinceTriggers(graph, changedSince);
      if (!triggers.length) {
        excludedSites.push({ siteId: entry.id, site: graph.site, reason: 'no-recorded-change-since' });
        continue;
      }
    } else {
      const node = currentCandidate(graph, query);
      if (!node) {
        excludedSites.push({ siteId: entry.id, site: graph.site, reason: 'trigger-not-present' });
        continue;
      }
      triggers = [triggerFromNode(node)];
    }

    for (const trigger of triggers) {
      if (!triggerSeen.has(trigger.id)) {
        triggerEvents.push(trigger);
        triggerSeen.add(trigger.id);
      }
      impacts.push(impactRow(entry, graph, trigger, options.portfolio || null));
    }
  }

  const bundle = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/watch-impact-bundle.schema.json',
    version: BRAID_WATCH_VERSION,
    generatedAt: iso(options.generatedAt),
    mode: changedSince ? 'changed-since' : 'explicit-impact',
    query: {
      rule: query.rule || null,
      source: query.source || null,
      changedSince
    },
    triggerEvents: triggerEvents.sort((a, b) => String(a.observedAt || '').localeCompare(String(b.observedAt || '')) || a.id.localeCompare(b.id)),
    impacts: sortImpacts(impacts),
    excludedSites: excludedSites.sort((a, b) => a.siteId.localeCompare(b.siteId)),
    summary: summary(targets.length, impacts, excludedSites),
    guardrails: {
      impactIsReviewCandidateNotBreakage: true,
      productionMutationAuthorized: false,
      priorityIsExplainableNotScore: true,
      historyPreserved: true,
      negativeAndNoChangeEvidencePreserved: true,
      ownerPolicyEditorialRemainGated: true,
      noRankingGuarantee: true
    }
  };
  const validation = validateWatchImpactBundle(bundle);
  if (!validation.valid) throw new Error(`Generated Watch impact bundle is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return bundle;
}

export function formatWatchImpactBundle(bundle) {
  const lines = [
    `SignalBraid Watch ${bundle.version}`,
    `Mode: ${bundle.mode}`,
    `Impacted sites: ${bundle.summary.impactedSites}/${bundle.summary.targets}`,
    `Impact rows: ${bundle.summary.impactRows}`,
    ''
  ];
  for (const row of bundle.impacts) {
    lines.push(`${row.priority} · ${row.siteId} · ${row.classification}`);
    lines.push(`  ${row.rationale}`);
    if (row.repoPaths.length) lines.push(`  Repo paths: ${row.repoPaths.join(', ')}`);
    if (row.ownerReviewReasons.length) lines.push(`  Owner gates: ${row.ownerReviewReasons.join(', ')}`);
  }
  if (bundle.excludedSites.length) {
    lines.push('', 'Excluded/unaffected targets');
    for (const row of bundle.excludedSites) lines.push(`- ${row.siteId}: ${row.reason}`);
  }
  lines.push('', 'Watch impact is a re-review queue. It does not prove breakage and never authorizes production mutation.');
  return lines.join('\n');
}
