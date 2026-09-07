import { buildGrowthPlan as buildBaseGrowthPlan, formatGrowthPlan as formatBaseGrowthPlan } from './growth-plan.mjs';
import { verticalEvidenceActions, VERTICAL_EVIDENCE_VERSION } from './growth-vertical-evidence.mjs';
import { analyzeVerticalEvidenceSite } from './growth-vertical-site.mjs';

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

export async function buildGrowthPlan(input, options = {}) {
  const vertical = options.vertical || 'general';
  const baseBuilder = options.baseBuildImpl || buildBaseGrowthPlan;
  const base = await baseBuilder(input, options);
  const injectedSitemap = options.entryPage && options.sitemap === undefined
    ? { ok: false, url: null, text: null, issue: 'sitemap intentionally not fetched for injected entry-page fixture' }
    : options.sitemap;
  const verticalEvidence = await analyzeVerticalEvidenceSite(base.canonicalUrl, {
    vertical,
    maxPages: options.maxVerticalPages || 6,
    timeoutMs: options.timeoutMs || 8000,
    maxBytes: options.maxBytes || 512 * 1024,
    fetchImpl: options.fetchImpl || fetch,
    ...(options.resolveImpl ? { resolveImpl: options.resolveImpl } : {}),
    ...(options.entryPage ? { entryPage: options.entryPage } : {}),
    ...(injectedSitemap !== undefined ? { sitemap: injectedSitemap } : {}),
    ...(options.verticalPages ? { pages: options.verticalPages } : {})
  });
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
      verticalEvidencePagesObserved: verticalEvidence.pagesObserved || 0,
      verticalEvidenceMaxPages: options.maxVerticalPages || 6,
      verticalEvidenceEntryPageRefetch: options.entryPage ? false : true
    }
  };
}

export function formatGrowthPlan(plan) {
  const body = formatBaseGrowthPlan(plan);
  const evidence = plan.observations?.verticalEvidence;
  if (!evidence) return body;
  const status = Object.entries(evidence.summary || {}).map(([key, value]) => `${key}=${value}`).join(', ') || 'none';
  const lines = [body, '', `Vertical evidence (${evidence.vertical}, ${evidence.coverage}; pages=${evidence.pagesObserved || 0}): ${status}`];
  for (const item of evidence.checks || []) lines.push(`- [${item.status}] ${item.title}`);
  lines.push('Vertical evidence uses a bounded relevant-surface sample, not proof of site-wide absence, runtime capability or ranking impact.');
  return lines.join('\n');
}
