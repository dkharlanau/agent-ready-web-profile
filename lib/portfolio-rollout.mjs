import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { loadTrendRegistry, normalizeTrend, validateTrendRegistry } from './trend-radar.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const defaultPortfolioPath = path.join(root, 'registry', 'portfolio-sites.json');
const schemaPath = path.join(root, 'schema', 'portfolio-sites.schema.json');
const verticalRegistryPath = path.join(root, 'registry', 'growth-verticals.json');
const DEFAULT_STAGES = new Set(['adopt', 'measured']);

export function loadPortfolioRegistry(file = defaultPortfolioPath) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function loadPortfolioSchema() {
  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
}

export function createPortfolioValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(loadPortfolioSchema());
}

function semanticErrors(registry) {
  const errors = [];
  const siteIds = new Set();
  const canonicalUrls = new Set();
  const repositories = new Set();
  const verticalRegistry = JSON.parse(fs.readFileSync(verticalRegistryPath, 'utf8'));
  const validVerticals = new Set(Object.keys(verticalRegistry.verticals || {}));

  for (const site of registry?.sites || []) {
    if (siteIds.has(site.id)) errors.push(`Duplicate portfolio site id: ${site.id}`);
    siteIds.add(site.id);
    if (canonicalUrls.has(site.canonicalUrl)) errors.push(`Duplicate portfolio canonicalUrl: ${site.canonicalUrl}`);
    canonicalUrls.add(site.canonicalUrl);
    if (repositories.has(site.repository)) errors.push(`Duplicate portfolio repository: ${site.repository}`);
    repositories.add(site.repository);
    for (const vertical of site.verticals || []) {
      if (!validVerticals.has(vertical)) errors.push(`Unknown vertical for ${site.id}: ${vertical}`);
    }
  }
  return errors;
}

export function validatePortfolioRegistry(registry = loadPortfolioRegistry()) {
  const validate = createPortfolioValidator();
  const schemaValid = Boolean(validate(registry));
  const semantic = semanticErrors(registry);
  return {
    valid: schemaValid && semantic.length === 0,
    errors: validate.errors ?? [],
    semanticErrors: semantic
  };
}

function csvSet(value) {
  if (!value) return null;
  return new Set(String(value).split(',').map(item => item.trim()).filter(Boolean));
}

function stageSet(options) {
  if (options.stage) return csvSet(options.stage);
  const stages = new Set(DEFAULT_STAGES);
  if (options.includeWatch) stages.add('watch');
  return stages;
}

function verticalMatch(site, trend) {
  const trendVerticals = new Set(trend.appliesTo || []);
  if (trendVerticals.has('general')) {
    return { applies: true, matchedVerticals: [...site.verticals], generalWildcard: true };
  }
  const matchedVerticals = site.verticals.filter(vertical => trendVerticals.has(vertical));
  return { applies: matchedVerticals.length > 0, matchedVerticals, generalWildcard: false };
}

function providerAllowed(site, trend) {
  const providers = site.rollout?.providers;
  return !Array.isArray(providers) || providers.length === 0 || providers.includes(trend.provider);
}

function candidateType(trend) {
  if ((trend.actionRefs || []).length) return 'site-audit';
  if ((trend.measurementRefs || []).length) return 'owner-review';
  return 'manual-review';
}

function candidateReason(site, trend, match) {
  const applicability = match.generalWildcard
    ? `trend declares general applicability; site verticals are ${site.verticals.join(', ')}`
    : `matched vertical${match.matchedVerticals.length === 1 ? '' : 's'}: ${match.matchedVerticals.join(', ')}`;
  return `${trend.stage.toUpperCase()} ${trend.provider} trend mapped to ${site.name} because ${applicability}. This is a rollout candidate only; the target site must still be audited before any change is proposed or applied.`;
}

function nextStep(trend) {
  if ((trend.actionRefs || []).length) return `Run the current ARWP Growth Profile for the target site and keep only active site actions related to: ${trend.actionRefs.join(', ')}.`;
  if ((trend.measurementRefs || []).length) return `Verify the owner-side control or measurement surface and collect evidence for: ${trend.measurementRefs.join(', ')}.`;
  return 'Perform a manual applicability review. Do not create a generic production patch.';
}

function compactCandidate(site, trend, match, now) {
  const normalized = normalizeTrend(trend, now);
  return {
    siteId: site.id,
    siteName: site.name,
    canonicalUrl: site.canonicalUrl,
    repository: site.repository,
    rolloutMode: site.rollout.mode,
    trendId: trend.id,
    stage: trend.stage,
    provider: trend.provider,
    title: trend.title,
    detectedAt: trend.detectedAt,
    attentionState: normalized.attentionState,
    surfaces: [...trend.surfaces],
    matchedVerticals: match.matchedVerticals,
    generalWildcard: match.generalWildcard,
    actionRefs: [...trend.actionRefs],
    measurementRefs: [...trend.measurementRefs],
    source: trend.source,
    candidateType: candidateType(trend),
    recommendationStatus: trend.stage === 'watch' ? 'watch-only' : 'review-candidate',
    requiresSiteAudit: true,
    requiresOwnerReview: true,
    productionMutationAllowed: false,
    evidenceClass: 'owner-controlled-portfolio',
    reason: candidateReason(site, trend, match),
    suggestedNextStep: nextStep(trend)
  };
}

export function buildPortfolioRollout(portfolio = loadPortfolioRegistry(), trends = loadTrendRegistry(), options = {}) {
  const portfolioValidation = validatePortfolioRegistry(portfolio);
  if (!portfolioValidation.valid) {
    const messages = [
      ...portfolioValidation.semanticErrors,
      ...portfolioValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`)
    ];
    throw new Error(`Invalid portfolio registry:\n- ${messages.join('\n- ')}`);
  }
  const trendValidation = validateTrendRegistry(trends);
  if (!trendValidation.valid) throw new Error(`Invalid Trend Radar registry:\n- ${trendValidation.errors.join('\n- ')}`);

  const now = options.now ? new Date(options.now) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`Invalid now: ${options.now}`);
  const stages = stageSet(options);
  const siteFilter = csvSet(options.site);
  const trendFilter = csvSet(options.trend);
  const providerFilter = csvSet(options.provider);
  const candidates = [];
  const skipped = [];

  for (const site of portfolio.sites) {
    if (!site.rollout.enabled) {
      skipped.push({ siteId: site.id, reason: 'rollout-disabled' });
      continue;
    }
    if (siteFilter && !siteFilter.has(site.id) && !siteFilter.has(site.repository)) continue;
    for (const trend of trends.trends) {
      if (!stages.has(trend.stage)) continue;
      if (trend.stage === 'retired') continue;
      if (trendFilter && !trendFilter.has(trend.id)) continue;
      if (providerFilter && !providerFilter.has(trend.provider)) continue;
      if ((site.rollout.excludeTrendIds || []).includes(trend.id)) {
        skipped.push({ siteId: site.id, trendId: trend.id, reason: 'explicitly-excluded' });
        continue;
      }
      if (!providerAllowed(site, trend)) {
        skipped.push({ siteId: site.id, trendId: trend.id, reason: 'provider-not-enabled' });
        continue;
      }
      const match = verticalMatch(site, trend);
      if (!match.applies) {
        skipped.push({ siteId: site.id, trendId: trend.id, reason: 'vertical-not-applicable' });
        continue;
      }
      candidates.push(compactCandidate(site, trend, match, now));
    }
  }

  candidates.sort((a, b) => a.siteId.localeCompare(b.siteId)
    || a.stage.localeCompare(b.stage)
    || a.provider.localeCompare(b.provider)
    || a.trendId.localeCompare(b.trendId));

  const bySite = {};
  const byStage = {};
  const byMode = {};
  for (const item of candidates) {
    bySite[item.siteId] = (bySite[item.siteId] || 0) + 1;
    byStage[item.stage] = (byStage[item.stage] || 0) + 1;
    byMode[item.rolloutMode] = (byMode[item.rolloutMode] || 0) + 1;
  }

  return {
    version: '0.1',
    generatedAt: now.toISOString(),
    portfolioUpdatedAt: portfolio.updatedAt,
    trendSnapshot: trends.snapshot,
    filters: {
      stages: [...stages].sort(),
      site: siteFilter ? [...siteFilter].sort() : null,
      trend: trendFilter ? [...trendFilter].sort() : null,
      provider: providerFilter ? [...providerFilter].sort() : null,
      includeWatch: Boolean(options.includeWatch)
    },
    summary: {
      sites: portfolio.sites.filter(site => site.rollout.enabled).length,
      candidates: candidates.length,
      bySite,
      byStage,
      byMode
    },
    candidates,
    skipped,
    guardrails: {
      ownerControlledEvidence: true,
      watchIsNotDefaultRollout: true,
      siteAuditRequiredBeforeMutation: true,
      noProductionMutation: true,
      noRankingInference: true
    },
    note: 'Portfolio rollout maps reviewed trends to candidate sites. It does not prove site-level applicability, create production patches, or infer Search/AI performance gains.'
  };
}

export function formatPortfolioRollout(result) {
  const lines = [
    `ARWP portfolio rollout — ${result.generatedAt}`,
    `Candidates: ${result.summary.candidates} across ${Object.keys(result.summary.bySite).length} matched site(s)`,
    `Stages: ${Object.entries(result.summary.byStage).map(([key, value]) => `${key}=${value}`).join(', ') || 'none'}`,
    ''
  ];
  let currentSite = null;
  for (const item of result.candidates) {
    if (item.siteId !== currentSite) {
      currentSite = item.siteId;
      lines.push(`${item.siteName} — ${item.repository} [${item.rolloutMode}]`);
    }
    lines.push(`  ${item.stage.toUpperCase()} ${item.provider}: ${item.title}`);
    lines.push(`    ${item.candidateType}; ${item.suggestedNextStep}`);
  }
  if (!result.candidates.length) lines.push('No rollout candidates for the selected filters.');
  lines.push('', result.note);
  return lines.join('\n');
}
