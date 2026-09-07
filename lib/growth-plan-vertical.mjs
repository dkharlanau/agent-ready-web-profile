import { buildGrowthPlan as buildBaseGrowthPlan, formatGrowthPlan as formatBaseGrowthPlan } from './growth-plan.mjs';
import { fetchPublicText } from './public-fetch.mjs';
import { VERTICAL_EVIDENCE_VERSION } from './growth-vertical-evidence.mjs';
import {
  analyzeVerticalEvidenceSiteExtended,
  allVerticalActions,
  applyVerticalOwnerDataEvidence
} from './growth-vertical-extended.mjs';

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

function mergeEvidence(existing = [], added = []) {
  return [...new Map([...existing, ...added].map(item => [item.actionId, item])).values()];
}

async function fetchOptionalOwnerData(canonicalUrl, options) {
  if (options.ownerData) return options.ownerData;
  if (options.entryPage) {
    return { ok: false, url: null, text: null, issue: 'owner data intentionally not fetched for injected entry-page fixture' };
  }
  const siteBase = canonicalUrl.endsWith('/') ? canonicalUrl : `${canonicalUrl}/`;
  const url = new URL('ai/growth-owner-data.json', siteBase).href;
  try {
    return await fetchPublicText(url, {
      fetchImpl: options.fetchImpl || fetch,
      ...(options.resolveImpl ? { resolveImpl: options.resolveImpl } : {}),
      timeoutMs: options.timeoutMs || 8000,
      maxBytes: Math.min(options.maxBytes || 512 * 1024, 512 * 1024),
      accept: 'application/json, text/plain;q=0.8, */*;q=0.1',
      userAgent: 'arwp-growth-vertical-owner/0.1'
    });
  } catch (error) {
    return { ok: false, url, text: null, issue: String(error?.message || error) };
  }
}

export async function buildGrowthPlan(input, options = {}) {
  const vertical = options.vertical || 'general';
  const baseBuilder = options.baseBuildImpl || buildBaseGrowthPlan;
  const base = await baseBuilder(input, options);
  const injectedSitemap = options.entryPage && options.sitemap === undefined
    ? { ok: false, url: null, text: null, issue: 'sitemap intentionally not fetched for injected entry-page fixture' }
    : options.sitemap;
  const verticalEvidence = await analyzeVerticalEvidenceSiteExtended(base.canonicalUrl, {
    vertical,
    maxPages: options.maxVerticalPages || 6,
    timeoutMs: options.timeoutMs || 8000,
    maxBytes: options.maxBytes || 512 * 1024,
    fetchImpl: options.fetchImpl || fetch,
    ...(options.resolveImpl ? { resolveImpl: options.resolveImpl } : {}),
    ...(options.entryPage ? { entryPage: options.entryPage } : {}),
    ...(injectedSitemap !== undefined ? { sitemap: injectedSitemap } : {}),
    ...(options.verticalPages ? { pages: options.verticalPages } : {}),
    ...(options.ucp ? { ucp: options.ucp } : {})
  });

  const rawVerticalActions = allVerticalActions(verticalEvidence);
  const ownerActions = rawVerticalActions.filter(item => item.status === 'external-owner-data');
  const regularVerticalActions = rawVerticalActions.filter(item => item.status !== 'external-owner-data');
  const ownerData = await fetchOptionalOwnerData(base.canonicalUrl, options);
  const verticalOwner = applyVerticalOwnerDataEvidence(ownerActions, ownerData, {
    canonicalUrl: base.canonicalUrl,
    now: options.now || new Date()
  });
  const verticalActions = [...regularVerticalActions, ...verticalOwner.actions];
  const actions = [...new Map([...base.actions, ...verticalActions].map(item => [item.id, item])).values()]
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || String(a.lane).localeCompare(String(b.lane)) || String(a.id).localeCompare(String(b.id)));
  const ownerDataEvidence = mergeEvidence(base.ownerDataEvidence || [], verticalOwner.evidence);

  return {
    ...base,
    summary: summarize(actions),
    observations: {
      ...(base.observations || {}),
      verticalEvidence,
      verticalOwnerData: verticalOwner.observation
    },
    ownerDataEvidence,
    actions,
    refinements: {
      ...(base.refinements || {}),
      verticalEvidenceVersion: VERTICAL_EVIDENCE_VERSION,
      verticalEvidenceCoverage: verticalEvidence.coverage,
      verticalEvidenceActionsAdded: verticalActions.length,
      verticalEvidencePagesObserved: verticalEvidence.pagesObserved || 0,
      verticalEvidenceMaxPages: options.maxVerticalPages || 6,
      verticalEvidenceEntryPageRefetch: options.entryPage ? false : true,
      verticalOwnerGates: ownerActions.length,
      verticalOwnerDataReceiptsApplied: verticalOwner.evidence.length,
      verticalOwnerDataEvidenceIsIndependent: false
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
  const owner = plan.observations?.verticalOwnerData;
  if (owner?.matchedActionIds?.length) lines.push(`Vertical owner-data gates resolved: ${owner.matchedActionIds.join(', ')}`);
  lines.push('Vertical evidence uses a bounded relevant-surface sample, not proof of site-wide absence, runtime capability or ranking impact.');
  return lines.join('\n');
}
