import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { applySiteFocusIntent } from './site-focus-intent.mjs';

export const SITE_FOCUS_LATEST_VERSION = '0.3';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'site-focus-profile-v0.3.schema.json');
const STOP = new Set('a an and are as at be by can do for from get has have how in into is it its of on or our that the their this to use using we what when where which who why with you your'.split(' '));
const GENERIC = new Set('home page pages site website product products service services about docs documentation guide guides help learn more read start overview index'.split(' '));

const EXPERIENCE_SOURCES = [
  {
    id: 'google-people-first-primary-focus',
    url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content',
    supports: 'People-first content, an intended audience and a primary site purpose/focus.',
    reviewedAt: '2026-09-08'
  },
  {
    id: 'webdev-core-web-vitals',
    url: 'https://web.dev/articles/vitals',
    supports: 'Current good Core Web Vitals thresholds: LCP <= 2500 ms, INP <= 200 ms and CLS <= 0.1 at the 75th percentile.',
    reviewedAt: '2026-09-08'
  },
  {
    id: 'wcag-consistent-navigation',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation',
    supports: 'Repeated navigation should occur in a consistent relative order across a set of pages.',
    reviewedAt: '2026-09-08'
  }
];

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

export function validateSiteFocusV3Profile(profile) {
  const validate = validator();
  const valid = Boolean(validate(profile));
  const errors = [...(validate.errors || [])];
  if (valid) {
    const laneIds = new Set((profile.problemLanes || []).map(lane => lane.id));
    if (!laneIds.has(profile.homepage.primaryLane)) errors.push({ instancePath: '/homepage/primaryLane', message: 'must reference a declared problem lane' });
    for (const lane of profile.homepage.supportingLanes || []) {
      if (!laneIds.has(lane)) errors.push({ instancePath: '/homepage/supportingLanes', message: `contains undeclared lane ${lane}` });
      if (lane === profile.homepage.primaryLane) errors.push({ instancePath: '/homepage/supportingLanes', message: 'must not repeat the primary lane' });
    }
    for (const rule of profile.routeRules || []) {
      if (rule.lane != null && !laneIds.has(rule.lane)) errors.push({ instancePath: '/routeRules', message: `references undeclared lane ${rule.lane}` });
    }
  }
  return { valid: errors.length === 0, errors };
}

function toV2Profile(profile) {
  const result = {
    ...(profile.$schema ? { $schema: profile.$schema } : {}),
    version: '0.2',
    canonicalUrl: profile.canonicalUrl,
    thesis: profile.thesis,
    scope: profile.scope,
    problemLanes: profile.problemLanes.map(({ id, label, job }) => ({ id, label, job })),
    primaryNavigation: profile.primaryNavigation,
    routeRules: profile.routeRules,
    ...(profile.locales ? { locales: profile.locales } : {}),
    ...(profile.notes ? { notes: profile.notes } : {})
  };
  delete result.$schema;
  return result;
}

function tokens(value) {
  return [...new Set(String(value || '').toLowerCase().replace(/[^\p{L}\p{N}-]+/gu, ' ').split(/\s+/)
    .filter(token => token.length >= 3 && !STOP.has(token) && !GENERIC.has(token)))];
}

function normalizePath(value, base) {
  try {
    const url = new URL(value, base);
    let pathname = url.pathname.replace(/\/+/g, '/');
    if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
    return pathname || '/';
  } catch {
    return null;
  }
}

function normalizeRulePath(value) {
  let pathname = String(value || '/').replace(/\/+/g, '/');
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  return pathname || '/';
}

function ruleSpecificity(rule) {
  if (rule.match?.path) return 10000 + rule.match.path.length;
  return String(rule.match?.pathPrefix || '').length;
}

function matchingRule(value, profile) {
  const pathname = normalizePath(value, profile.canonicalUrl);
  if (!pathname) return null;
  const rules = [...(profile.routeRules || [])].sort((a, b) => ruleSpecificity(b) - ruleSpecificity(a));
  for (const rule of rules) {
    if (rule.match?.path && pathname === normalizeRulePath(rule.match.path)) return rule;
    if (rule.match?.pathPrefix) {
      const prefix = normalizeRulePath(rule.match.pathPrefix);
      if (pathname === prefix || pathname.startsWith(prefix === '/' ? '/' : `${prefix}/`)) return rule;
    }
  }
  return null;
}

function signalValue(signal, thesis) {
  if (signal === 'problem') return thesis.primaryProblem;
  if (signal === 'audience') return thesis.primaryAudience;
  if (signal === 'outcome') return thesis.usefulOutcome;
  if (signal === 'evidence') return thesis.distinctEvidence;
  if (signal === 'action') return thesis.primaryAction;
  return '';
}

function homepageSignals(report, profile) {
  const observed = new Set(report.observedSiteThesis?.tokens || []);
  return profile.homepage.requiredSignals.map(signal => {
    const declaredTokens = tokens(signalValue(signal, profile.thesis));
    const overlapTokens = declaredTokens.filter(token => observed.has(token));
    const coverage = declaredTokens.length ? overlapTokens.length / declaredTokens.length : 0;
    const state = coverage >= 0.5 ? 'observed' : coverage >= 0.2 ? 'partial' : 'missing';
    return {
      signal,
      state,
      declaredTokens,
      overlapTokens,
      tokenCoverage: Number(coverage.toFixed(3)),
      interpretation: 'Transparent lexical evidence only; this does not prove comprehension, persuasion or ranking impact.'
    };
  });
}

function buildExperienceContract(report, profile) {
  const home = (report.pageContracts || []).find(page => normalizePath(page.url, profile.canonicalUrl) === '/');
  const observedHomeLane = home?.declaredLane || null;
  const laneStatus = !home ? 'not-observed' : observedHomeLane === profile.homepage.primaryLane ? 'aligned' : 'mismatch';
  const signals = homepageSignals(report, profile);

  const primaryNav = report.navigation?.primary || [];
  const representedLanes = [...new Set(primaryNav.map(item => matchingRule(item.url, profile)?.lane).filter(Boolean))];
  const navigationBudget = profile.experience.navigation.maxPrimaryItems;
  const navigationStatus = primaryNav.length > navigationBudget ? 'over-budget' : 'within-budget';

  const laneCoverage = profile.problemLanes.map(lane => {
    const rules = profile.routeRules.filter(rule => rule.lane === lane.id);
    const observedPages = (report.pageContracts || []).filter(page => page.declaredLane === lane.id).map(page => page.url);
    const navigationEntries = primaryNav.filter(item => matchingRule(item.url, profile)?.lane === lane.id).map(item => item.url);
    let status = 'observed';
    if (!rules.length) status = 'contract-gap';
    else if (!observedPages.length) status = 'not-observed-in-sample';
    return {
      id: lane.id,
      label: lane.label,
      audience: lane.audience,
      problem: lane.problem,
      desiredOutcome: lane.desiredOutcome,
      primaryAction: lane.primaryAction,
      declaredRouteRules: rules.length,
      observedPages,
      primaryNavigationEntries: navigationEntries,
      status
    };
  });

  return {
    homepage: {
      primaryLane: profile.homepage.primaryLane,
      supportingLanes: profile.homepage.supportingLanes,
      observedHomeLane,
      laneStatus,
      requiredSignals: profile.homepage.requiredSignals,
      signals
    },
    lanes: {
      declared: profile.problemLanes.length,
      coverage: laneCoverage,
      contractGaps: laneCoverage.filter(lane => lane.status === 'contract-gap').map(lane => lane.id)
    },
    navigation: {
      budget: navigationBudget,
      declaredPrimaryItems: profile.primaryNavigation.length,
      observedPrimaryItems: primaryNav.length,
      status: navigationStatus,
      representedLanes,
      consistencyRequirement: profile.experience.navigation.consistentAcrossPages ? 'required' : 'not-declared',
      consistencyAssessment: 'not-assessed-by-homepage-only-navigation-observation'
    },
    visual: {
      principles: profile.experience.visualPrinciples,
      assessmentState: 'owner-declared-not-static-quality-scored'
    },
    performance: {
      budget: profile.experience.performance,
      assessmentState: 'field-data-required',
      note: 'Static Site Focus inspection does not invent LCP/INP/CLS evidence. Attach real field data or an explicit performance measurement artifact.'
    },
    sources: EXPERIENCE_SOURCES
  };
}

function v3Handoff(baseHandoff, experience, report) {
  const candidates = [...(baseHandoff?.candidates || [])];
  if (experience.navigation.status === 'over-budget') candidates.push({
    id: `focus:navigation-budget:${report.canonicalUrl}`,
    sourceDecision: 'REVIEW',
    action: 'reduce-or-restructure-primary-navigation',
    target: { url: report.canonicalUrl, file: null },
    reason: `Observed primary navigation has ${experience.navigation.observedPrimaryItems} items against the owner-declared budget of ${experience.navigation.budget}.`,
    executable: false,
    requiresHumanApproval: true
  });
  if (experience.homepage.laneStatus === 'mismatch') candidates.push({
    id: `focus:homepage-lane:${report.canonicalUrl}`,
    sourceDecision: 'REVIEW',
    action: 'align-homepage-primary-problem-lane',
    target: { url: report.canonicalUrl, file: null },
    reason: `Homepage is mapped to ${experience.homepage.observedHomeLane || 'no lane'} but the declared primary lane is ${experience.homepage.primaryLane}.`,
    executable: false,
    requiresHumanApproval: true
  });
  const missingSignals = experience.homepage.signals.filter(item => item.state === 'missing').map(item => item.signal);
  if (missingSignals.length) candidates.push({
    id: `focus:homepage-signals:${report.canonicalUrl}`,
    sourceDecision: 'REVIEW',
    action: 'clarify-homepage-problem-contract',
    target: { url: report.canonicalUrl, file: null },
    reason: `Required homepage signals need review: ${missingSignals.join(', ')}.`,
    executable: false,
    requiresHumanApproval: true
  });
  for (const lane of experience.lanes.contractGaps) candidates.push({
    id: `focus:lane-contract:${lane}`,
    sourceDecision: 'REVIEW',
    action: 'map-problem-lane-to-route-or-remove-lane',
    target: { url: report.canonicalUrl, file: null },
    reason: `Declared problem lane ${lane} has no route rule; either give it an explicit surface or remove it from the site contract.`,
    executable: false,
    requiresHumanApproval: true
  });
  return {
    mode: 'proposal-only',
    executable: false,
    candidates,
    acceptedDecisionRequiredBeforeTransformation: true,
    destructiveOperationsAllowed: false,
    note: 'Site Focus v0.3 may propose architecture changes, but editorial truth, visual design, redirects and production mutation remain explicit human decisions.'
  };
}

export function applySiteFocusProfile(report, profile, options = {}) {
  if (!profile || profile.version === '0.2') return applySiteFocusIntent(report, profile, options);
  if (profile.version !== '0.3') throw new Error(`Unsupported Site Focus profile version ${profile.version || 'missing'}. Supported versions: 0.2, 0.3.`);

  const validation = validateSiteFocusV3Profile(profile);
  if (!validation.valid) throw new Error(`Invalid Site Focus v0.3 profile: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);

  const base = applySiteFocusIntent(report, toV2Profile(profile), options);
  const experienceContract = buildExperienceContract(base, profile);
  const findings = [...(base.siteFindings || [])];

  if (experienceContract.homepage.laneStatus === 'mismatch') findings.push({
    id: 'homepage-primary-lane-mismatch',
    severity: 'review',
    evidence: { declared: experienceContract.homepage.primaryLane, observed: experienceContract.homepage.observedHomeLane },
    message: 'Observed homepage route ownership does not match the declared primary problem lane.'
  });
  const missingSignals = experienceContract.homepage.signals.filter(item => item.state === 'missing');
  if (missingSignals.length) findings.push({
    id: 'homepage-contract-signal-missing',
    severity: 'review',
    evidence: missingSignals,
    message: 'One or more required homepage problem-contract signals have little or no lexical evidence in the sampled homepage.'
  });
  if (experienceContract.navigation.status === 'over-budget') findings.push({
    id: 'primary-navigation-over-budget',
    severity: 'review',
    evidence: experienceContract.navigation,
    message: 'Observed primary navigation exceeds the owner-declared top-level item budget.'
  });
  if (experienceContract.lanes.contractGaps.length) findings.push({
    id: 'problem-lane-without-route-contract',
    severity: 'review',
    evidence: experienceContract.lanes.contractGaps,
    message: 'One or more declared problem lanes have no route rule and therefore no explicit site-surface ownership.'
  });

  return {
    ...base,
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/site-focus-report-v0.3.schema.json',
    version: '0.3',
    intentVersion: '0.3',
    declaredFocus: {
      ...base.declaredFocus,
      version: '0.3',
      problemLanes: profile.problemLanes,
      homepage: profile.homepage,
      experience: profile.experience
    },
    experienceContract,
    metrics: {
      ...base.metrics,
      problemLanesDeclared: profile.problemLanes.length,
      laneContractGaps: experienceContract.lanes.contractGaps.length,
      homepageRequiredSignalsMissing: missingSignals.length,
      primaryNavigationItemsObserved: experienceContract.navigation.observedPrimaryItems
    },
    siteFindings: findings,
    transformationHandoff: v3Handoff(base.transformationHandoff, experienceContract, base),
    guardrails: {
      ...(base.guardrails || {}),
      performanceBudgetRequiresFieldEvidence: true,
      visualPrinciplesAreOwnerIntentNotQualityEvidence: true,
      noCompositeFocusExperienceScore: true
    }
  };
}

export function formatSiteFocusV3(report) {
  if (!report?.experienceContract) return null;
  const x = report.experienceContract;
  const missing = x.homepage.signals.filter(item => item.state === 'missing').map(item => item.signal);
  const laneGaps = x.lanes.contractGaps;
  return [
    'Site Focus v0.3 experience contract:',
    `Homepage primary lane: ${x.homepage.primaryLane} (${x.homepage.laneStatus})`,
    `Homepage required signals missing: ${missing.join(', ') || 'none'}`,
    `Problem lanes: ${x.lanes.declared}; route-contract gaps: ${laneGaps.join(', ') || 'none'}`,
    `Primary navigation: ${x.navigation.observedPrimaryItems}/${x.navigation.budget} (${x.navigation.status})`,
    `Visual principles: ${x.visual.principles.join(' · ')}`,
    `Performance budget: LCP<=${x.performance.budget.lcpMsP75Max}ms, INP<=${x.performance.budget.inpMsP75Max}ms, CLS<=${x.performance.budget.clsP75Max} at p75 (${x.performance.assessmentState})`,
    'No composite focus/experience score is produced.'
  ].join('\n');
}
