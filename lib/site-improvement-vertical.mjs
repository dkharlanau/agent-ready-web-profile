import { buildSiteImprovementPlan as buildBasePlan, formatSiteImprovementPlan as formatBasePlan } from './site-improvement-deep.mjs';
import { fetchPublicText } from './public-fetch.mjs';
import { analyzeVerticalEvidence, verticalEvidenceActions, loadGrowthVerticalRegistry, VERTICAL_EVIDENCE_VERSION } from './growth-vertical-evidence.mjs';

const PRIORITY = { P0: 0, P1: 1, P2: 2, P3: 3 };
const EVIDENCE = { 'grounded-first-party': 0, 'direct-observation': 1, 'source-backed': 2, 'manual-review': 3, advisory: 4 };

function inferredVertical(options, base) {
  if (options.vertical && options.vertical !== 'auto') return options.vertical;
  const kind = options.siteKind && options.siteKind !== 'auto'
    ? options.siteKind
    : base?.searchSurface?.siteKind?.kind;
  return ({
    'software-product': 'software-product',
    ecommerce: 'commerce',
    'local-business': 'local-business',
    'editorial-news': 'editorial',
    'documentation-research': 'documentation'
  })[kind] || 'general';
}

function unavailableEvidence(vertical, issue) {
  const registry = loadGrowthVerticalRegistry();
  const definition = registry.verticals?.[vertical];
  if (!definition) throw new Error(`Unknown Growth vertical: ${vertical}`);
  return {
    version: VERTICAL_EVIDENCE_VERSION,
    registryVersion: registry.version,
    vertical,
    coverage: 'unavailable',
    summary: { unavailable: definition.checks.length },
    checks: definition.checks.map(check => ({
      id: check.id,
      priority: check.priority,
      title: check.title,
      status: 'unavailable',
      reason: `Public entry-page evidence could not be captured: ${issue}`,
      evidence: [],
      expectedEvidence: check.evidence
    })),
    limitations: [
      'Unavailable public evidence does not imply a failed vertical check.',
      'No vertical remediation is emitted from an unavailable entry-page capture.'
    ]
  };
}

async function captureEntryPage(site, options) {
  if (options.entryPage) return options.entryPage;
  try {
    return await fetchPublicText(site, {
      fetchImpl: options.fetchImpl || fetch,
      ...(options.resolveImpl ? { resolveImpl: options.resolveImpl } : {}),
      timeoutMs: options.timeoutMs || 8000,
      maxBytes: options.maxBytes || 256 * 1024,
      accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1',
      userAgent: 'arwp-improve-vertical/0.1'
    });
  } catch (error) {
    return { ok: false, url: site, text: null, issue: String(error?.message || error) };
  }
}

function verticalCandidate(action, report, site) {
  const evidence = [...new Set([site, ...(action.evidence || [])])];
  return {
    id: `vertical:${action.id}`,
    sourceKind: 'growth',
    priority: action.priority || 'P2',
    lane: action.lane || `vertical:${report.vertical}`,
    title: action.title,
    reason: action.reason,
    evidenceClass: 'direct-observation',
    evidence,
    target: { url: site, vertical: report.vertical, checkId: action.id.replace(/^growth:vertical:/, '') },
    proposal: action.implementation || null,
    verification: [
      'Open the relevant canonical surface and verify the expected evidence exists there, then rerun ARWP with the same vertical.',
      'Do not treat absence on the audited entry page as proof of site-wide absence.'
    ],
    measurement: [
      'Preserve the before/after Growth observation and owner-side Search/AI evidence when available.',
      'Checklist completion does not prove ranking, citation or recommendation causality.'
    ],
    dependencies: ['verify-canonical-surface-before-edit']
  };
}

function order(a, b) {
  return (PRIORITY[a.priority] ?? 9) - (PRIORITY[b.priority] ?? 9)
    || (EVIDENCE[a.evidenceClass] ?? 9) - (EVIDENCE[b.evidenceClass] ?? 9)
    || Number(!a.proposal) - Number(!b.proposal)
    || a.id.localeCompare(b.id);
}

function dedupe(items) {
  const ids = new Set();
  const signatures = new Set();
  const out = [];
  for (const item of items.sort(order)) {
    if (ids.has(item.id)) continue;
    const target = item.target?.file || item.target?.url || item.target?.entityId || item.target?.surface || '';
    const signature = `${item.lane}|${String(item.title || '').toLowerCase()}|${target}`;
    if (signatures.has(signature)) continue;
    ids.add(item.id);
    signatures.add(signature);
    out.push(item);
  }
  return out;
}

function select(items, maxActions) {
  const out = [];
  for (const priority of ['P0', 'P1', 'P2', 'P3']) {
    const group = items.filter(item => item.priority === priority && !out.includes(item));
    const lanes = new Set();
    for (const item of group) {
      if (out.length >= maxActions) break;
      if (lanes.has(item.lane)) continue;
      out.push(item);
      lanes.add(item.lane);
    }
    for (const item of group) {
      if (out.length >= maxActions) break;
      if (!out.includes(item)) out.push(item);
    }
    if (out.length >= maxActions) break;
  }
  return out;
}

export function mergeVerticalEvidencePlan(base, report, { maxActions = 8 } = {}) {
  if (!base || !Array.isArray(base.actions)) throw new Error('A Site Improvement Plan with actions is required.');
  if (!Number.isInteger(maxActions) || maxActions < 1 || maxActions > 25) throw new Error('maxActions must be an integer between 1 and 25.');
  const verticalActions = verticalEvidenceActions(report).map(item => verticalCandidate(item, report, base.site));
  const baseActions = base.actions.map(({ order: _order, ...item }) => item);
  const candidates = dedupe([...baseActions, ...verticalActions]);
  const selected = select(candidates, maxActions);
  return {
    ...base,
    summary: {
      candidates: candidates.length,
      selected: selected.length,
      suppressed: candidates.length - selected.length,
      byPriority: selected.reduce((acc, item) => (acc[item.priority] = (acc[item.priority] || 0) + 1, acc), {}),
      byLane: selected.reduce((acc, item) => (acc[item.lane] = (acc[item.lane] || 0) + 1, acc), {})
    },
    actions: selected.map((item, index) => ({ order: index + 1, ...item })),
    sourceSummary: {
      ...(base.sourceSummary || {}),
      verticalEvidenceVersion: report.version,
      verticalEvidenceRegistryVersion: report.registryVersion,
      verticalEvidenceChecks: report.checks.length,
      verticalEvidenceActions: verticalActions.length,
      verticalEvidenceCoverage: report.coverage
    },
    verticalEvidence: report,
    prioritization: {
      ...(base.prioritization || {}),
      maxActions
    },
    guardrails: {
      ...(base.guardrails || {}),
      verticalEntryPageNotWholeSiteProof: true,
      absentAgentInterfaceDoesNotCreateRequirement: true,
      ownerOnlyVerticalStateRemainsOwnerEvidence: true
    }
  };
}

export async function buildSiteImprovementPlan(input, options = {}) {
  const maxActions = options.maxActions || 8;
  const baseBuilder = options.baseBuildImpl || buildBasePlan;
  const base = await baseBuilder(input, { ...options, maxActions: 25 });
  const vertical = inferredVertical(options, base);
  const entryPage = await captureEntryPage(base.site, options);
  const report = entryPage?.ok && typeof entryPage.text === 'string'
    ? analyzeVerticalEvidence({ vertical, canonicalUrl: base.site, html: entryPage.text })
    : unavailableEvidence(vertical, entryPage?.issue || 'entry-page fetch unavailable');
  return mergeVerticalEvidencePlan(base, report, { maxActions });
}

export function formatSiteImprovementPlan(plan) {
  const body = formatBasePlan(plan);
  const report = plan.verticalEvidence;
  if (!report) return body;
  const summary = Object.entries(report.summary || {}).map(([key, value]) => `${key}=${value}`).join(', ') || 'none';
  return `${body}\n\nVertical evidence: ${report.vertical} (${report.coverage}; ${summary}). Entry-page absence is not whole-site proof.`;
}
