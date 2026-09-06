import { buildGrowthPlan as buildBaseGrowthPlan } from './growth-profile.mjs';
import { fetchPublicText } from './public-fetch.mjs';

const DUPLICATED_OR_NON_ACTIONABLE_AUDIT_IDS = new Set([
  'audit:google-non-commodity-content',
  'audit:google-preferred-sources',
  'audit:google-generative-ai-measurement',
  'audit:bing-ai-performance-measurement',
  'audit:webmcp-runtime-tools',
  'audit:webmcp-evals-security',
  'audit:indexnow-change-notification',
  'audit:aipref-content-usage'
]);

function sitemapStats(text) {
  const lastmods = [...String(text || '').matchAll(/<lastmod\b[^>]*>([^<]+)<\/lastmod>/gi)].map(match => match[1].trim());
  return {
    lastmodCount: lastmods.length,
    validLastmodCount: lastmods.filter(value => !Number.isNaN(Date.parse(value))).length
  };
}

function summarize(actions) {
  return actions.reduce((acc, item) => {
    acc.totalActions += 1;
    acc.byPriority[item.priority] = (acc.byPriority[item.priority] || 0) + 1;
    acc.byLane[item.lane] = (acc.byLane[item.lane] || 0) + 1;
    return acc;
  }, { totalActions: 0, byPriority: {}, byLane: {} });
}

function shouldKeepAuditAction(item) {
  if (!String(item?.id || '').startsWith('audit:')) return true;
  if (DUPLICATED_OR_NON_ACTIONABLE_AUDIT_IDS.has(item.id)) return false;
  if (item.status === 'not-assessed' || item.status === 'not-applicable' || item.status === 'watch') return false;
  return true;
}

export function refineGrowthPlan(plan, { localSitemap = null } = {}) {
  if (!plan || !Array.isArray(plan.actions)) throw new Error('A Growth Profile plan with actions is required.');
  let actions = plan.actions.filter(shouldKeepAuditAction);
  const local = localSitemap?.ok ? sitemapStats(localSitemap.text) : { lastmodCount: 0, validLastmodCount: 0 };
  const localSitemapHealthy = Boolean(localSitemap?.ok && local.lastmodCount > 0 && local.lastmodCount === local.validLastmodCount);
  if (localSitemapHealthy) actions = actions.filter(item => item.id !== 'audit:google-sitemap-lastmod');
  return {
    ...plan,
    summary: summarize(actions),
    observations: {
      ...(plan.observations || {}),
      localSitemap: {
        url: localSitemap?.url || null,
        ok: Boolean(localSitemap?.ok),
        ...local,
        usedToResolveRootScopeWarning: localSitemapHealthy
      }
    },
    actions,
    refinements: {
      duplicateAuditActionsSuppressed: true,
      notAssessedAuditItemsSuppressed: true,
      canonicalPathSitemapChecked: true,
      note: 'The Growth backlog is intentionally smaller than the raw audit. External/runtime-only observations remain in the audit rather than becoming repetitive implementation tasks.'
    }
  };
}

export async function buildGrowthPlan(input, options = {}) {
  const base = await buildBaseGrowthPlan(input, options);
  const canonical = new URL(base.canonicalUrl);
  const localSitemapUrl = new URL('sitemap.xml', canonical.href.endsWith('/') ? canonical.href : `${canonical.href}/`).href;
  let localSitemap = null;
  try {
    localSitemap = await fetchPublicText(localSitemapUrl, {
      fetchImpl: options.fetchImpl || fetch,
      ...(options.resolveImpl ? { resolveImpl: options.resolveImpl } : {}),
      timeoutMs: options.timeoutMs || 8000,
      maxBytes: options.maxBytes || 512 * 1024,
      accept: 'application/xml, text/xml, text/plain;q=0.8, */*;q=0.1',
      userAgent: 'arwp-growth/0.1'
    });
  } catch (error) {
    localSitemap = { ok: false, url: localSitemapUrl, issue: String(error?.message || error), text: null };
  }
  return refineGrowthPlan(base, { localSitemap });
}

export function formatGrowthPlan(plan) {
  const lines = [
    `ARWP Growth Profile ${plan.profile}`,
    `Target: ${plan.canonicalUrl}`,
    `Actions: ${plan.summary.totalActions}`,
    ''
  ];
  let current = null;
  for (const item of plan.actions) {
    if (item.priority !== current) {
      current = item.priority;
      lines.push(current);
    }
    lines.push(`- [${item.lane}] ${item.title}`);
    lines.push(`  ${item.reason}`);
    if (item.implementation?.file) lines.push(`  File: ${item.implementation.file}`);
    if (item.implementation?.url) lines.push(`  URL: ${item.implementation.url}`);
    if (item.source) lines.push(`  Source: ${item.source}`);
  }
  lines.push('', plan.note);
  return lines.join('\n');
}
