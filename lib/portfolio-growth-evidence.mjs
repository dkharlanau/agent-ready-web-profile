import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { loadPortfolioRegistry, validatePortfolioRegistry } from './portfolio-rollout.mjs';
import { buildGrowthPlan as buildVerticalGrowthPlan } from './growth-plan-vertical.mjs';
import { createGrowthSnapshot, diffGrowthSnapshots } from './growth-history.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'portfolio-growth-run.schema.json');

export const PORTFOLIO_GROWTH_RUN_VERSION = '0.1';

function iso(value = null) {
  const date = value == null ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid observedAt: ${value}`);
  return date.toISOString();
}

export function portfolioRunId(observedAt) {
  return iso(observedAt).replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function createValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

export function validatePortfolioGrowthRun(run) {
  const validate = createValidator();
  const valid = Boolean(validate(run));
  return { valid, errors: validate.errors || [] };
}

function compactVerticalEvidence(plan) {
  const report = plan?.observations?.verticalEvidence;
  if (!report) return null;
  return {
    coverage: report.coverage || null,
    pagesObserved: Number(report.pagesObserved || 0),
    summary: report.summary && typeof report.summary === 'object' ? report.summary : {}
  };
}

function compactOwnerData(plan) {
  const owner = plan?.observations?.ownerData;
  if (!owner) return null;
  return {
    observed: Boolean(owner.observed),
    valid: Boolean(owner.valid),
    recordCount: Number(owner.recordCount || 0)
  };
}

function siteBase(site) {
  return {
    siteId: site.id,
    name: site.name,
    canonicalUrl: site.canonicalUrl,
    repository: site.repository,
    vertical: site.verticals[0] || 'general',
    rolloutMode: site.rollout.mode,
    measurementState: 'awaiting-owner-measurement'
  };
}

async function captureSite(site, observedAt, options) {
  const base = siteBase(site);
  try {
    const plan = await (options.buildGrowthImpl || buildVerticalGrowthPlan)(site.canonicalUrl, {
      vertical: base.vertical,
      maxVerticalPages: options.maxVerticalPages || 4,
      timeoutMs: options.timeoutMs || 10000,
      maxBytes: options.maxBytes || 384 * 1024,
      now: new Date(observedAt),
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      ...(options.resolveImpl ? { resolveImpl: options.resolveImpl } : {})
    });
    return {
      ...base,
      status: 'captured',
      snapshot: createGrowthSnapshot(plan, { observedAt, toolVersion: options.toolVersion || '0.2.0' }),
      verticalEvidence: compactVerticalEvidence(plan),
      ownerDataState: compactOwnerData(plan),
      error: null
    };
  } catch (error) {
    return {
      ...base,
      status: 'unavailable',
      snapshot: null,
      verticalEvidence: null,
      ownerDataState: null,
      error: String(error?.message || error).slice(0, 4000)
    };
  }
}

export async function createPortfolioGrowthRun(portfolio = loadPortfolioRegistry(), options = {}) {
  const validation = validatePortfolioRegistry(portfolio);
  if (!validation.valid) {
    const messages = [...validation.semanticErrors, ...validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`)];
    throw new Error(`Invalid portfolio registry: ${messages.join('; ')}`);
  }
  const observedAt = iso(options.observedAt);
  const enabled = portfolio.sites.filter(site => site.rollout.enabled);
  const concurrency = Math.max(1, Math.min(Number(options.concurrency || 2), 5));
  const sites = [];
  for (let index = 0; index < enabled.length; index += concurrency) {
    const group = enabled.slice(index, index + concurrency);
    const captured = await Promise.all(group.map(site => captureSite(site, observedAt, options)));
    sites.push(...captured);
  }
  sites.sort((a, b) => a.siteId.localeCompare(b.siteId));
  const captured = sites.filter(site => site.status === 'captured').length;
  const unavailable = sites.length - captured;
  const run = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/portfolio-growth-run.schema.json',
    version: PORTFOLIO_GROWTH_RUN_VERSION,
    runId: portfolioRunId(observedAt),
    observedAt,
    evidenceClass: 'owner-controlled-public-observation',
    portfolioUpdatedAt: portfolio.updatedAt,
    summary: {
      enabledSites: enabled.length,
      captured,
      unavailable,
      awaitingOwnerMeasurement: enabled.length
    },
    sites,
    guardrails: {
      ownerControlledPortfolio: true,
      publicEvidenceOnly: true,
      noIndependentAdoptionInference: true,
      noMissingMetricZeros: true,
      ownerMetricsSeparate: true,
      noRankingCausality: true,
      failuresRemainVisible: true
    }
  };
  const runValidation = validatePortfolioGrowthRun(run);
  if (!runValidation.valid) {
    throw new Error(`Generated portfolio Growth run is invalid: ${runValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  }
  return run;
}

function bySite(run) {
  return new Map((run?.sites || []).map(site => [site.siteId, site]));
}

export function diffPortfolioGrowthRuns(before, after) {
  if (before?.version !== PORTFOLIO_GROWTH_RUN_VERSION || after?.version !== PORTFOLIO_GROWTH_RUN_VERSION) {
    throw new Error(`Portfolio Growth runs must use version ${PORTFOLIO_GROWTH_RUN_VERSION}.`);
  }
  const left = bySite(before);
  const right = bySite(after);
  const sites = [];
  for (const [siteId, current] of right) {
    const previous = left.get(siteId);
    let growthDiff = null;
    let comparisonState = 'unavailable';
    if (previous?.status === 'captured' && current.status === 'captured' && previous.snapshot && current.snapshot) {
      growthDiff = diffGrowthSnapshots(previous.snapshot, current.snapshot);
      comparisonState = 'comparable-public-implementation-state';
    } else if (!previous) comparisonState = 'new-site';
    else if (previous.status !== current.status) comparisonState = `${previous.status}-to-${current.status}`;
    sites.push({
      siteId,
      canonicalUrl: current.canonicalUrl,
      beforeStatus: previous?.status || null,
      afterStatus: current.status,
      comparisonState,
      growthDiff,
      ownerMeasurementState: 'awaiting-owner-measurement'
    });
  }
  const comparable = sites.filter(site => site.growthDiff).length;
  const improved = sites.filter(site => site.growthDiff?.interpretation?.implementationStateImproved).length;
  return {
    version: '0.1',
    before: { runId: before.runId, observedAt: before.observedAt },
    after: { runId: after.runId, observedAt: after.observedAt },
    summary: {
      sites: sites.length,
      comparable,
      implementationDebtImproved: improved,
      awaitingOwnerMeasurement: sites.length
    },
    sites,
    interpretation: {
      publicImplementationStateOnly: true,
      ownerOutcomeEvidenceIncluded: false,
      note: 'This diff compares observed implementation state. It does not establish Search ranking, AI citation, referral, traffic or conversion effects.'
    }
  };
}

export function formatPortfolioGrowthRun(run) {
  const lines = [
    `ARWP portfolio Growth observation ${run.runId}`,
    `Captured: ${run.summary.captured}/${run.summary.enabledSites}; unavailable: ${run.summary.unavailable}`,
    `Owner measurement: awaiting for ${run.summary.awaitingOwnerMeasurement} site(s)`,
    ''
  ];
  for (const site of run.sites) {
    if (site.status === 'captured') lines.push(`- ${site.siteId} [${site.vertical}]: public Growth snapshot captured; P0=${site.snapshot.debt.p0}, P1=${site.snapshot.debt.p1}`);
    else lines.push(`- ${site.siteId} [${site.vertical}]: unavailable — ${site.error}`);
  }
  lines.push('', 'These are owner-controlled public observations, not independent adoption evidence or outcome measurements.');
  return lines.join('\n');
}
