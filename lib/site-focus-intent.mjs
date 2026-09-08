import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export const SITE_FOCUS_INTENT_VERSION = '0.2';
export const SITE_FOCUS_ROLES = ['problem-commercial', 'proof-portfolio', 'trust-utility', 'technical-reference', 'localization-equivalent'];

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'site-focus-profile.schema.json');
const STOP = new Set('a an and are as at be by can do for from get has have how in into is it its of on or our that the their this to use using we what when where which who why with you your'.split(' '));
const GENERIC = new Set('home page pages site website product products service services about docs documentation guide guides help learn more read start overview index'.split(' '));

function profileValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

export function validateSiteFocusProfile(profile) {
  const validate = profileValidator();
  const valid = Boolean(validate(profile));
  return { valid, errors: validate.errors || [] };
}

function tokens(value) {
  return [...new Set(String(value || '').toLowerCase().replace(/[^\p{L}\p{N}-]+/gu, ' ').split(/\s+/)
    .filter(token => token.length >= 3 && !STOP.has(token) && !GENERIC.has(token)))];
}

function cleanUrl(value, base = null) {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function normalizedPath(value, canonicalUrl) {
  const url = cleanUrl(value, canonicalUrl);
  if (!url) return null;
  const parsed = new URL(url);
  let pathname = parsed.pathname.replace(/\/+/g, '/');
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  return pathname || '/';
}

function resolveNavigation(values, canonicalUrl) {
  return [...new Set((values || []).map(value => cleanUrl(value, canonicalUrl)).filter(Boolean))];
}

function localeInfo(url, profile) {
  const pathname = normalizedPath(url, profile.canonicalUrl) || '/';
  const locales = profile.locales || null;
  if (!locales) return { locale: null, canonicalPath: pathname, equivalentKey: pathname };
  const candidates = Object.entries(locales.prefixes || {})
    .map(([locale, prefix]) => [locale, String(prefix).replace(/\/$/, '') || '/'])
    .filter(([, prefix]) => prefix !== '/')
    .sort((a, b) => b[1].length - a[1].length);
  for (const [locale, prefix] of candidates) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      const stripped = pathname.slice(prefix.length) || '/';
      return { locale, canonicalPath: stripped.startsWith('/') ? stripped : `/${stripped}`, equivalentKey: stripped || '/' };
    }
  }
  return { locale: locales.default || null, canonicalPath: pathname, equivalentKey: pathname };
}

function ruleSpecificity(rule) {
  if (rule.match?.path) return 10000 + rule.match.path.length;
  return String(rule.match?.pathPrefix || '').length;
}

function matchingRule(url, profile) {
  const pathname = normalizedPath(url, profile.canonicalUrl);
  if (!pathname) return null;
  const locale = localeInfo(url, profile);
  const candidatePaths = [...new Set([pathname, locale.canonicalPath])];
  const rules = [...(profile.routeRules || [])].sort((a, b) => ruleSpecificity(b) - ruleSpecificity(a));
  for (const rule of rules) {
    for (const candidate of candidatePaths) {
      if (rule.match?.path && candidate === normalizeRulePath(rule.match.path)) return rule;
      if (rule.match?.pathPrefix) {
        const prefix = normalizeRulePath(rule.match.pathPrefix);
        if (candidate === prefix || candidate.startsWith(prefix === '/' ? '/' : `${prefix}/`)) return rule;
      }
    }
  }
  return null;
}

function normalizeRulePath(value) {
  let pathname = String(value || '/').replace(/\/+/g, '/');
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  return pathname || '/';
}

function declaredThesisTokens(profile) {
  const thesis = profile.thesis || {};
  return tokens([thesis.primaryProblem, thesis.primaryAudience, thesis.usefulOutcome, thesis.distinctEvidence, thesis.primaryAction].join(' '));
}

function thesisAlignment(report, profile) {
  const declared = declaredThesisTokens(profile);
  const observed = [...new Set(report.observedSiteThesis?.tokens || [])];
  const declaredSet = new Set(declared), observedSet = new Set(observed);
  const overlap = declared.filter(token => observedSet.has(token));
  const missing = declared.filter(token => !observedSet.has(token));
  const unexpected = observed.filter(token => !declaredSet.has(token));
  const coverage = declared.length ? overlap.length / declared.length : 0;
  let status = 'drift-review';
  if (coverage >= 0.5) status = 'aligned';
  else if (coverage >= 0.2) status = 'partial-review';
  return {
    status,
    declaredTokens: declared,
    observedTokens: observed,
    overlapTokens: overlap,
    missingDeclaredTokens: missing,
    additionalObservedTokens: unexpected,
    tokenCoverage: Number(coverage.toFixed(3)),
    interpretation: 'Token coverage is a transparent wording diagnostic, not a focus/ranking score or proof of user comprehension.'
  };
}

function navigationAlignment(report, profile) {
  const declared = resolveNavigation(profile.primaryNavigation, profile.canonicalUrl);
  const observed = [...new Set((report.navigation?.primary || []).map(item => cleanUrl(item.url, profile.canonicalUrl)).filter(Boolean))];
  const d = new Set(declared), o = new Set(observed);
  return {
    declared,
    observed,
    missingDeclared: declared.filter(url => !o.has(url)),
    unexpectedObserved: observed.filter(url => !d.has(url)),
    matches: declared.filter(url => o.has(url))
  };
}

function localeEquivalentPair(pair, profile) {
  if (!profile.locales || !Array.isArray(pair?.urls) || pair.urls.length !== 2) return false;
  const [a, b] = pair.urls.map(url => localeInfo(url, profile));
  return a.equivalentKey === b.equivalentKey && a.locale !== b.locale;
}

function fallbackDecision(contract) {
  if (!contract.title || !contract.h1 || (contract.primaryActionCandidates || []).length === 0) {
    return { decision: 'NARROW', confidence: 'heuristic-medium', reason: 'After suppressing locale-equivalent duplication, the page contract still lacks a clear title/H1/action signal.' };
  }
  return { decision: 'KEEP', confidence: 'heuristic-low', reason: 'Locale-equivalent duplication was suppressed; no other sampled focus conflict currently requires consolidation.' };
}

function roleSummary(contracts) {
  const roles = {};
  const scopes = {};
  for (const contract of contracts) {
    roles[contract.declaredRole || 'unclassified'] = (roles[contract.declaredRole || 'unclassified'] || 0) + 1;
    scopes[contract.declaredScope || 'UNCLASSIFIED'] = (scopes[contract.declaredScope || 'UNCLASSIFIED'] || 0) + 1;
  }
  return { roles, scopes };
}

function buildHandoff(contracts) {
  const candidates = [];
  for (const page of contracts) {
    if (page.decision === 'NARROW') candidates.push({
      id: `focus:narrow:${page.url}`,
      sourceDecision: 'NARROW',
      action: 'clarify-page-contract',
      target: { url: page.url, file: page.file || null },
      reason: page.reasons?.[0] || 'Page contract needs clarification.',
      executable: false,
      requiresHumanApproval: true
    });
    if (page.decision === 'MERGE') candidates.push({
      id: `focus:merge:${page.url}`,
      sourceDecision: 'MERGE',
      action: 'review-consolidation-and-redirect-history',
      target: { url: page.url, file: page.file || null },
      reason: page.reasons?.[0] || 'Potential intent overlap requires consolidation review.',
      executable: false,
      requiresHumanApproval: true
    });
    if (page.decision === 'DEFER' && page.declaredScope === 'OUT') candidates.push({
      id: `focus:scope:${page.url}`,
      sourceDecision: 'DEFER',
      action: 'review-scope-placement',
      target: { url: page.url, file: page.file || null },
      reason: 'The owner-declared route rule marks this surface OUT of the current site boundary.',
      executable: false,
      requiresHumanApproval: true
    });
  }
  return {
    mode: 'proposal-only',
    executable: false,
    candidates,
    acceptedDecisionRequiredBeforeTransformation: true,
    destructiveOperationsAllowed: false,
    note: 'Focus findings may inform Target Transformation only after explicit human acceptance, redirect/history review and exact repository targeting.'
  };
}

export function applySiteFocusIntent(report, profile, { profileSource = null } = {}) {
  if (!profile) return {
    ...report,
    intentVersion: SITE_FOCUS_INTENT_VERSION,
    declaredFocus: null,
    declaredAlignment: { status: 'not-provided' },
    transformationHandoff: buildHandoff(report.pageContracts || []),
    guardrails: { ...(report.guardrails || {}), declaredIntentDoesNotProveObservedQuality: true, localeEquivalenceDoesNotProveCanonicalCorrectness: true, transformationHandoffIsProposalOnly: true }
  };

  const validation = validateSiteFocusProfile(profile);
  if (!validation.valid) throw new Error(`Invalid Site Focus profile: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  const declaredCanonical = cleanUrl(profile.canonicalUrl);
  const observedCanonical = cleanUrl(report.canonicalUrl);
  if (!declaredCanonical || !observedCanonical) throw new Error('Site Focus canonical URL is invalid.');
  const declaredRoot = new URL(declaredCanonical), observedRoot = new URL(observedCanonical);
  if (declaredRoot.origin !== observedRoot.origin) throw new Error(`Site Focus profile origin ${declaredRoot.origin} does not match observed origin ${observedRoot.origin}.`);

  const suppressedLocalePairs = (report.duplicateIntentClusters || []).filter(pair => localeEquivalentPair(pair, profile));
  const duplicateIntentClusters = (report.duplicateIntentClusters || []).filter(pair => !localeEquivalentPair(pair, profile));
  const remainingDuplicateUrls = new Set(duplicateIntentClusters.flatMap(pair => pair.urls || []));
  const suppressedLocaleUrls = new Set(suppressedLocalePairs.flatMap(pair => pair.urls || []));

  const pageContracts = (report.pageContracts || []).map(contract => {
    const rule = matchingRule(contract.url, profile);
    const locale = localeInfo(contract.url, profile);
    const reasons = [...(contract.reasons || [])];
    let decision = contract.decision;
    let confidence = contract.confidence;

    if (suppressedLocaleUrls.has(contract.url) && decision === 'MERGE' && !remainingDuplicateUrls.has(contract.url)) {
      const fallback = fallbackDecision(contract);
      decision = fallback.decision;
      confidence = fallback.confidence;
      reasons.unshift(fallback.reason);
    }

    if (rule?.scope === 'OUT') {
      decision = 'DEFER';
      confidence = 'declared-high';
      reasons.unshift('Owner-declared Site Focus route rule marks this surface OUT of the current site boundary; review placement before further expansion.');
    } else if (decision === 'DEFER' && rule && ['IN', 'ADJACENT'].includes(rule.scope) && ['proof-portfolio', 'trust-utility', 'technical-reference', 'localization-equivalent'].includes(rule.role)) {
      decision = 'KEEP';
      confidence = 'declared-high';
      reasons.unshift(`Low homepage lexical overlap is expected for the explicitly declared supporting role ${rule.role}; the route remains ${rule.scope}.`);
    }

    return {
      ...contract,
      decision,
      confidence,
      reasons,
      locale: locale.locale,
      localeEquivalentKey: locale.equivalentKey,
      declaredRole: rule?.role || null,
      declaredScope: rule?.scope || null,
      declaredLane: rule?.lane || null,
      declaredRule: rule || null
    };
  });

  const dispositions = pageContracts.reduce((acc, page) => (acc[page.decision] = (acc[page.decision] || 0) + 1, acc), {});
  const roles = roleSummary(pageContracts);
  const thesis = thesisAlignment(report, profile);
  const navigation = navigationAlignment(report, profile);
  const findings = [...(report.siteFindings || []).filter(item => item.id !== 'many-route-territories')];
  if (thesis.status === 'drift-review') findings.push({ id: 'declared-thesis-drift', severity: 'review', evidence: thesis, message: 'Observed homepage wording has little token coverage of the owner-declared thesis. Review whether the homepage or declaration is stale.' });
  if (navigation.missingDeclared.length) findings.push({ id: 'declared-navigation-missing', severity: 'review', evidence: navigation.missingDeclared, message: 'One or more owner-declared primary navigation destinations were not observed in the sampled homepage navigation.' });
  if (navigation.unexpectedObserved.length) findings.push({ id: 'undeclared-primary-navigation', severity: 'review', evidence: navigation.unexpectedObserved, message: 'Observed homepage navigation contains destinations not listed in the owner-declared primary navigation contract.' });
  const unclassified = pageContracts.filter(page => !page.declaredRole).map(page => page.url);
  if (unclassified.length) findings.push({ id: 'unclassified-route-role', severity: 'review', evidence: unclassified, message: 'Sampled pages exist outside the declared route-role map. Classify them or confirm they are intentionally unmanaged.' });

  return {
    ...report,
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/site-focus-report-v0.2.schema.json',
    version: SITE_FOCUS_INTENT_VERSION,
    intentVersion: SITE_FOCUS_INTENT_VERSION,
    declaredFocus: {
      source: profileSource,
      canonicalUrl: declaredCanonical,
      thesis: profile.thesis,
      scope: profile.scope,
      problemLanes: profile.problemLanes,
      primaryNavigation: resolveNavigation(profile.primaryNavigation, profile.canonicalUrl),
      routeRules: profile.routeRules,
      locales: profile.locales || null
    },
    declaredAlignment: { thesis, navigation },
    metrics: {
      ...report.metrics,
      duplicateIntentPairs: duplicateIntentClusters.length,
      localeEquivalentDuplicatePairsSuppressed: suppressedLocalePairs.length,
      declaredRouteRoles: Object.keys(roles.roles).length,
      unclassifiedRouteRoles: unclassified.length
    },
    duplicateIntentClusters,
    localeEquivalentDuplicatePairsSuppressed: suppressedLocalePairs,
    dispositions,
    siteFindings: findings,
    pageContracts,
    routeRoleSummary: roles,
    transformationHandoff: buildHandoff(pageContracts),
    guardrails: {
      ...(report.guardrails || {}),
      declaredIntentDoesNotProveObservedQuality: true,
      localeEquivalenceDoesNotProveCanonicalCorrectness: true,
      routeFamiliesAreNotProblemTerritories: true,
      supportingRolesMayLegitimatelyDivergeFromHomepageVocabulary: true,
      transformationHandoffIsProposalOnly: true
    }
  };
}

export function findSiteFocusProfile(repoRoot, explicitPath = null) {
  const base = path.resolve(repoRoot);
  const candidates = explicitPath ? [path.resolve(explicitPath)] : [path.join(base, '.arwp', 'site-focus.json'), path.join(base, 'site-focus.json')];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
    const profile = JSON.parse(fs.readFileSync(candidate, 'utf8'));
    const validation = validateSiteFocusProfile(profile);
    if (!validation.valid) throw new Error(`Invalid Site Focus profile ${candidate}: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
    return { profile, source: candidate };
  }
  return { profile: null, source: null };
}

export function loadSiteFocusProfile(file) {
  const resolved = path.resolve(file);
  const profile = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const validation = validateSiteFocusProfile(profile);
  if (!validation.valid) throw new Error(`Invalid Site Focus profile ${resolved}: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return { profile, source: resolved };
}

export function formatDeclaredSiteFocus(report) {
  if (!report.declaredFocus) return 'Declared Site Focus: not provided.';
  const thesis = report.declaredAlignment?.thesis;
  const nav = report.declaredAlignment?.navigation;
  return [
    `Declared Site Focus: ${report.declaredFocus.thesis.primaryProblem}`,
    `Primary audience: ${report.declaredFocus.thesis.primaryAudience}`,
    `Declared ↔ observed thesis: ${thesis?.status || 'unknown'} (token coverage ${thesis?.tokenCoverage ?? 'n/a'})`,
    `Declared nav: ${(nav?.declared || []).length}; observed nav: ${(nav?.observed || []).length}; missing: ${(nav?.missingDeclared || []).length}; unexpected: ${(nav?.unexpectedObserved || []).length}`,
    `Locale-equivalent duplicate pairs suppressed: ${report.metrics?.localeEquivalentDuplicatePairsSuppressed || 0}`,
    `Unclassified route roles: ${report.metrics?.unclassifiedRouteRoles || 0}`,
    `Transformation handoff: proposal-only (${report.transformationHandoff?.candidates?.length || 0} candidate reviews)`
  ].join('\n');
}
