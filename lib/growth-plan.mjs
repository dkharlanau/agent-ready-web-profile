import { buildGrowthPlan as buildBaseGrowthPlan } from './growth-profile.mjs';
import { fetchPublicText } from './public-fetch.mjs';
import { compactHypothesesForGrowthPlan } from './growth-hypotheses.mjs';
import { applyOwnerDataEvidence } from './growth-owner-data.mjs';
import { buildTrendRadar, loadTrendRegistry } from './trend-radar.mjs';

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
const OWNER_REVIEW_VERSION = '0.1';
const OWNER_REVIEW_EVIDENCE_CLASS = 'owner-controlled';
const OWNER_REVIEW_DECISIONS = new Set(['keep', 'revise', 'revert', 'retire']);
const OWNER_REVIEW_COMPLETING_DECISIONS = new Set(['keep', 'retire']);

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

function normalizedUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url.href;
  } catch {
    return null;
  }
}

function isHttpsUrl(value) {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function parseOwnerReviewReceipt(localOwnerReview, { canonicalUrl, now = new Date() } = {}) {
  const base = {
    url: localOwnerReview?.url || null,
    ok: Boolean(localOwnerReview?.ok),
    observed: Boolean(localOwnerReview?.ok && String(localOwnerReview?.text || '').trim()),
    valid: false,
    evidenceClass: null,
    reviewCount: 0,
    reviews: [],
    issues: []
  };
  if (!base.observed) return base;

  let payload;
  try { payload = JSON.parse(localOwnerReview.text); }
  catch {
    return { ...base, issues: ['invalid-json'] };
  }

  const issues = [];
  if (payload?.version !== OWNER_REVIEW_VERSION) issues.push('unsupported-version');
  if (payload?.evidenceClass !== OWNER_REVIEW_EVIDENCE_CLASS) issues.push('evidence-class-must-be-owner-controlled');
  if (!isHttpsUrl(payload?.site)) issues.push('site-must-be-https');
  if (canonicalUrl && normalizedUrl(payload?.site) !== normalizedUrl(canonicalUrl)) issues.push('site-does-not-match-canonical');
  if (payload?.guardrails?.notIndependentEvidence !== true) issues.push('not-independent-evidence-guardrail-missing');
  if (payload?.guardrails?.noRankingClaim !== true) issues.push('no-ranking-claim-guardrail-missing');
  if (payload?.guardrails?.manualJudgmentPreserved !== true) issues.push('manual-judgment-guardrail-missing');
  if (!Array.isArray(payload?.reviews) || !payload.reviews.length) issues.push('reviews-required');

  const nowMs = new Date(now).getTime();
  const reviews = [];
  for (const [index, review] of (payload?.reviews || []).entries()) {
    const prefix = `reviews[${index}]`;
    const reviewIssues = [];
    if (!/^growth:[a-z0-9._:-]+$/i.test(String(review?.actionId || ''))) reviewIssues.push(`${prefix}.actionId`);
    if (review?.status !== 'completed') reviewIssues.push(`${prefix}.status`);
    if (!OWNER_REVIEW_DECISIONS.has(review?.decision)) reviewIssues.push(`${prefix}.decision`);
    if (!validDate(review?.reviewedAt)) reviewIssues.push(`${prefix}.reviewedAt`);
    else if (Date.parse(`${review.reviewedAt}T00:00:00Z`) > nowMs + 24 * 60 * 60 * 1000) reviewIssues.push(`${prefix}.reviewedAt-future`);
    if (!String(review?.summary || '').trim()) reviewIssues.push(`${prefix}.summary`);
    if (!Array.isArray(review?.scope) || !review.scope.length || !review.scope.every(isHttpsUrl)) reviewIssues.push(`${prefix}.scope`);
    if (!Array.isArray(review?.evidence) || !review.evidence.length || !review.evidence.every(isHttpsUrl)) reviewIssues.push(`${prefix}.evidence`);
    issues.push(...reviewIssues);
    if (!reviewIssues.length) {
      reviews.push({
        actionId: review.actionId,
        status: review.status,
        decision: review.decision,
        reviewedAt: review.reviewedAt,
        summary: review.summary.trim(),
        scope: [...new Set(review.scope)],
        evidence: [...new Set(review.evidence)],
        reviewer: String(review.reviewer || '').trim() || null
      });
    }
  }

  const duplicateActionIds = reviews.map(item => item.actionId).filter((id, index, all) => all.indexOf(id) !== index);
  if (duplicateActionIds.length) issues.push(`duplicate-action-review:${[...new Set(duplicateActionIds)].join(',')}`);

  return {
    ...base,
    valid: issues.length === 0 && reviews.length > 0,
    evidenceClass: payload?.evidenceClass || null,
    reviewCount: reviews.length,
    reviews,
    issues
  };
}

export function inferHostingContext(canonicalUrl) {
  const hostname = new URL(canonicalUrl).hostname.toLowerCase();
  if (hostname === 'github.io' || hostname.endsWith('.github.io')) {
    return { provider: 'github-pages', confidence: 'high', signal: 'hostname', hostname };
  }
  if (hostname === 'pages.dev' || hostname.endsWith('.pages.dev')) {
    return { provider: 'cloudflare', confidence: 'high', signal: 'hostname', hostname };
  }
  if (hostname === 'netlify.app' || hostname.endsWith('.netlify.app')) {
    return { provider: 'netlify', confidence: 'high', signal: 'hostname', hostname };
  }
  if (hostname === 'vercel.app' || hostname.endsWith('.vercel.app')) {
    return { provider: 'vercel', confidence: 'high', signal: 'hostname', hostname };
  }
  return { provider: 'unknown', confidence: 'unknown', signal: null, hostname };
}

export function refineGrowthPlan(plan, { localSitemap = null, ownerReview = null, now = new Date() } = {}) {
  if (!plan || !Array.isArray(plan.actions)) throw new Error('A Growth Profile plan with actions is required.');
  let actions = plan.actions.filter(shouldKeepAuditAction);
  const local = localSitemap?.ok ? sitemapStats(localSitemap.text) : { lastmodCount: 0, validLastmodCount: 0 };
  const localSitemapHealthy = Boolean(localSitemap?.ok && local.lastmodCount > 0 && local.lastmodCount === local.validLastmodCount);
  if (localSitemapHealthy) actions = actions.filter(item => item.id !== 'audit:google-sitemap-lastmod');

  const hosting = inferHostingContext(plan.canonicalUrl);
  const contentSignalObserved = Boolean(plan.observations?.contentSignal?.observed);
  const contentSignalApplicable = hosting.provider === 'cloudflare' || contentSignalObserved;
  if (!contentSignalApplicable) actions = actions.filter(item => item.id !== 'growth:cloudflare-content-signals');

  const parsedOwnerReview = parseOwnerReviewReceipt(ownerReview, { canonicalUrl: plan.canonicalUrl, now });
  const completingReviews = new Map(
    parsedOwnerReview.valid
      ? parsedOwnerReview.reviews.filter(review => OWNER_REVIEW_COMPLETING_DECISIONS.has(review.decision)).map(review => [review.actionId, review])
      : []
  );
  const ownerReviewEvidence = [];
  actions = actions.filter(item => {
    const review = completingReviews.get(item.id);
    if (!review || item.status !== 'manual') return true;
    ownerReviewEvidence.push({
      actionId: item.id,
      decision: review.decision,
      reviewedAt: review.reviewedAt,
      summary: review.summary,
      scope: review.scope,
      evidence: review.evidence,
      reviewer: review.reviewer,
      evidenceClass: OWNER_REVIEW_EVIDENCE_CLASS,
      independentEvidence: false,
      rankingImpactClaimed: false
    });
    return false;
  });

  const matchedManualActionIds = ownerReviewEvidence.map(item => item.actionId);
  return {
    ...plan,
    summary: summarize(actions),
    observations: {
      ...(plan.observations || {}),
      hosting,
      localSitemap: {
        url: localSitemap?.url || null,
        ok: Boolean(localSitemap?.ok),
        ...local,
        usedToResolveRootScopeWarning: localSitemapHealthy
      },
      ownerReview: {
        url: parsedOwnerReview.url,
        ok: parsedOwnerReview.ok,
        observed: parsedOwnerReview.observed,
        valid: parsedOwnerReview.valid,
        evidenceClass: parsedOwnerReview.evidenceClass,
        reviewCount: parsedOwnerReview.reviewCount,
        matchedManualActionIds,
        issues: parsedOwnerReview.issues
      }
    },
    ownerReviewEvidence,
    actions,
    refinements: {
      duplicateAuditActionsSuppressed: true,
      notAssessedAuditItemsSuppressed: true,
      canonicalPathSitemapChecked: true,
      providerSpecificActionsScoped: true,
      ownerReviewReceiptsApplied: ownerReviewEvidence.length,
      ownerReviewEvidenceIsIndependent: false,
      note: 'The Growth backlog is intentionally smaller than the raw audit. External/runtime-only observations remain in the audit rather than becoming repetitive implementation tasks. Provider-specific actions are emitted only when public evidence makes that provider applicable. Valid owner review receipts can close repeated manual-review tasks, but remain owner-controlled evidence and never count as independent validation or ranking evidence.'
    }
  };
}

function compactTrendRadar(radar, vertical) {
  return {
    snapshot: radar.snapshot,
    reviewedAt: radar.reviewedAt,
    vertical,
    summary: radar.summary,
    opportunities: radar.trends.map(item => ({
      id: item.id,
      provider: item.provider,
      stage: item.stage,
      maturity: item.maturity,
      attentionState: item.attentionState,
      detectedAt: item.detectedAt,
      daysSinceDetected: item.daysSinceDetected,
      title: item.title,
      whyItMatters: item.whyItMatters,
      actionRefs: item.actionRefs,
      measurementRefs: item.measurementRefs,
      source: item.source
    })),
    note: 'Only ADOPT/MEASURED trends applicable to the selected vertical are attached to the Growth plan. WATCH stays visible in the standalone Trend Radar and is not promoted into default recommendations.'
  };
}

export function ownerActionsFromTrends(radar) {
  return radar.trends
    .filter(item => item.maturity === 'platform-control')
    .map(item => ({
      id: `trend-owner:${item.id}`,
      priority: 'P1',
      lane: 'ai-access',
      title: item.title,
      status: 'external-owner-data',
      reason: `${item.whyItMatters} This setting is authenticated owner-side state, so ARWP must ask for verification rather than infer it from public crawling.`,
      source: item.source,
      implementation: {
        surface: 'authenticated platform owner control',
        note: item.notes || 'Verify the actual owner-side state before changing policy.'
      },
      evidence: []
    }));
}

async function fetchOptionalPublicText(url, options) {
  try { return await fetchPublicText(url, options); }
  catch (error) { return { ok: false, url, issue: String(error?.message || error), text: null }; }
}

export async function buildGrowthPlan(input, options = {}) {
  const base = await buildBaseGrowthPlan(input, options);
  const canonical = new URL(base.canonicalUrl);
  const siteBase = canonical.href.endsWith('/') ? canonical.href : `${canonical.href}/`;
  const localSitemapUrl = new URL('sitemap.xml', siteBase).href;
  const ownerReviewUrl = new URL('ai/growth-review.json', siteBase).href;
  const ownerDataUrl = new URL('ai/growth-owner-data.json', siteBase).href;
  const network = {
    fetchImpl: options.fetchImpl || fetch,
    ...(options.resolveImpl ? { resolveImpl: options.resolveImpl } : {}),
    timeoutMs: options.timeoutMs || 8000,
    maxBytes: options.maxBytes || 512 * 1024,
    userAgent: 'arwp-growth/0.1'
  };
  const [localSitemap, ownerReview, ownerData] = await Promise.all([
    fetchOptionalPublicText(localSitemapUrl, { ...network, accept: 'application/xml, text/xml, text/plain;q=0.8, */*;q=0.1' }),
    fetchOptionalPublicText(ownerReviewUrl, { ...network, accept: 'application/json, text/plain;q=0.8, */*;q=0.1' }),
    fetchOptionalPublicText(ownerDataUrl, { ...network, accept: 'application/json, text/plain;q=0.8, */*;q=0.1' })
  ]);
  const refined = refineGrowthPlan(base, { localSitemap, ownerReview, now: options.now || new Date() });
  const vertical = options.vertical || 'general';
  const trendRadar = buildTrendRadar(options.trendRegistry || loadTrendRegistry(), {
    vertical,
    stage: 'adopt,measured',
    includeRetired: false,
    now: options.now || new Date()
  });
  const actions = [...new Map([...refined.actions, ...ownerActionsFromTrends(trendRadar)].map(item => [item.id, item])).values()];
  const planWithOwnerActions = { ...refined, actions, summary: summarize(actions) };
  const ownerDataApplied = applyOwnerDataEvidence(planWithOwnerActions, ownerData, {
    canonicalUrl: base.canonicalUrl,
    now: options.now || new Date()
  });
  const hypothesisProgram = compactHypothesesForGrowthPlan(
    ownerDataApplied,
    options.hypothesisRegistry,
    { vertical, includeExperiments: options.includeExperiments === true }
  );
  return { ...ownerDataApplied, trendRadar: compactTrendRadar(trendRadar, vertical), hypothesisProgram };
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
    if (item.implementation?.surface) lines.push(`  Surface: ${item.implementation.surface}`);
    if (item.source) lines.push(`  Source: ${item.source}`);
  }
  if (plan.ownerReviewEvidence?.length) {
    lines.push('', `Owner-controlled manual reviews applied: ${plan.ownerReviewEvidence.length}`);
    for (const item of plan.ownerReviewEvidence) {
      lines.push(`- ${item.actionId}: ${item.decision} (${item.reviewedAt})`);
      lines.push(`  Owner-controlled evidence only; independent evidence: no; ranking impact claimed: no.`);
    }
  }
  if (plan.ownerDataEvidence?.length) {
    lines.push('', `Owner-data actions resolved: ${plan.ownerDataEvidence.length}`);
    for (const item of plan.ownerDataEvidence) {
      lines.push(`- ${item.actionId}: ${item.provider}/${item.kind} (${item.observedAt})`);
      lines.push('  Owner-side evidence only; independent evidence: no; cross-surface inference: no; ranking impact claimed: no.');
    }
  }
  if (plan.opportunities?.length) {
    lines.push('', `Optional opportunities: ${plan.opportunities.length}`);
    for (const item of plan.opportunities.slice(0, 6)) {
      lines.push(`- [${item.priority}/${item.lane}] ${item.title}`);
      if (item.implementation?.url) lines.push(`  URL: ${item.implementation.url}`);
    }
  }
  if (plan.hypothesisProgram) {
    lines.push('', `Hypothesis program (${plan.hypothesisProgram.vertical}): ${plan.hypothesisProgram.summary.total} applicable hypotheses`);
    const linked = plan.hypothesisProgram.hypotheses.filter(item => item.activeActionRefs.length);
    for (const item of linked.slice(0, 6)) {
      lines.push(`- [${item.evidenceClass}/${item.confidence}] ${item.title}`);
      lines.push(`  Active actions: ${item.activeActionRefs.join(', ')}`);
      lines.push(`  Measure: ${item.successSignals.slice(0, 2).join('; ')}`);
    }
  }
  if (plan.trendRadar) {
    lines.push('', `Trend Radar (${plan.trendRadar.vertical}): ${plan.trendRadar.summary.total} applicable ADOPT/MEASURED changes`);
    for (const item of plan.trendRadar.opportunities.filter(trend => trend.attentionState === 'early').slice(0, 5)) {
      lines.push(`- [${item.attentionState.toUpperCase()}] ${item.provider}: ${item.title}`);
      lines.push(`  Detected ${item.detectedAt} · Source: ${item.source}`);
    }
  }
  lines.push('', plan.note);
  return lines.join('\n');
}
