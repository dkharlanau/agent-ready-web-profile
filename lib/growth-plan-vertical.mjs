import { buildGrowthPlan as buildBaseGrowthPlan, formatGrowthPlan as formatBaseGrowthPlan } from './growth-plan.mjs';
import { fetchPublicText } from './public-fetch.mjs';
import { analyzeVerticalEvidence, loadGrowthVerticalRegistry, verticalEvidenceActions, VERTICAL_EVIDENCE_VERSION } from './growth-vertical-evidence.mjs';

function priorityRank(priority) {
  return ({ P0: 0, 'P0-when-targeted': 0, P1: 1, P2: 2, P3: 3 }[priority] ?? 9);
}

function summarize(actions) {
  return actions.reduce((acc, item) => {
    acc.totalActions += 1;
    acc.byPriority[item.priority] = (acc.byPriority[item.priority] || 0) + 1;
    acc.byLane[item.lane] = (acc.byLane[item.lane] || 0) + 1;
    return acc;
  }, { totalActions: 0, byPriority: {}, byLane: {} });
}

function unavailableVerticalEvidence(vertical, issue) {
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
      'No remediation is emitted from an unavailable entry-page capture.'
    ]
  };
}

async function captureEntryPage(canonicalUrl, options) {
  if (options.entryPage) return options.entryPage;
  try {
    return await fetchPublicText(canonicalUrl, {
      fetchImpl: options.fetchImpl || fetch,
      ...(options.resolveImpl ? { resolveImpl: options.resolveImpl } : {}),
      timeoutMs: options.timeoutMs || 8000,
      maxBytes: options.maxBytes || 512 * 1024,
      accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1',
      userAgent: 'arwp-growth-vertical/0.1'
    });
  } catch (error) {
    return { ok: false, url: canonicalUrl, text: null, issue: String(error?.message || error) };
  }
}

export async function buildGrowthPlan(input, options = {}) {
  const vertical = options.vertical || 'general';
  const baseBuilder = options.baseBuildImpl || buildBaseGrowthPlan;
  const base = await baseBuilder(input, options);
  const entryPage = await captureEntryPage(base.canonicalUrl, options);
  const verticalEvidence = entryPage?.ok && typeof entryPage.text === 'string'
    ? analyzeVerticalEvidence({ vertical, canonicalUrl: base.canonicalUrl, html: entryPage.text })
    : unavailableVerticalEvidence(vertical, entryPage?.issue || 'entry-page fetch unavailable');
  const verticalActions = verticalEvidenceActions(verticalEvidence);
  const actions = [...new Map([...base.actions, ...verticalActions].map(item => [item.id, item])).values()]
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || String(a.lane).localeCompare(String(b.lane)) || String(a.id).localeCompare(String(b.id)));
  return {
    ...base,
    summary: summarize(actions),
    observations: {
      ...(base.observations || {}),
      verticalEvidence
    },
    actions,
    refinements: {
      ...(base.refinements || {}),
      verticalEvidenceVersion: VERTICAL_EVIDENCE_VERSION,
      verticalEvidenceCoverage: verticalEvidence.coverage,
      verticalEvidenceActionsAdded: verticalActions.length,
      verticalEvidenceEntryPageRefetch: options.entryPage ? false : true
    }
  };
}

export function formatGrowthPlan(plan) {
  const body = formatBaseGrowthPlan(plan);
  const evidence = plan.observations?.verticalEvidence;
  if (!evidence) return body;
  const status = Object.entries(evidence.summary || {}).map(([key, value]) => `${key}=${value}`).join(', ') || 'none';
  const lines = [body, '', `Vertical evidence (${evidence.vertical}, ${evidence.coverage}): ${status}`];
  for (const item of evidence.checks || []) lines.push(`- [${item.status}] ${item.title}`);
  lines.push('Vertical entry-page evidence is bounded evidence, not proof of site-wide absence, runtime capability or ranking impact.');
  return lines.join('\n');
}
