import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const SITE_PATTERN_MAP_VERSION = '0.1';
export const CANONICAL_CATALOGS = Object.freeze({
  discoverability: 'knowledge/discoverability-corpus.json',
  antiPatterns: 'knowledge/research/anti-patterns.json'
});

const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const array = value => Array.isArray(value);
const semver = value => typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function sitePatternMapFingerprint(map) {
  return `sha256:${sha256(canonicalJson(map))}`;
}

export function loadSitePatternMap(file = '.arwp/site-pattern-map.json') {
  return readJson(path.resolve(file));
}

export function loadSitePatternCatalogs(root = process.cwd(), map = null) {
  const requested = {
    discoverability: map?.catalogs?.discoverability?.path ?? CANONICAL_CATALOGS.discoverability,
    antiPatterns: map?.catalogs?.antiPatterns?.path ?? CANONICAL_CATALOGS.antiPatterns
  };
  for (const [key, expected] of Object.entries(CANONICAL_CATALOGS)) {
    if (requested[key] !== expected) throw new Error(`${key} catalog path must be ${expected}; load historical snapshots explicitly instead of redirecting a site map.`);
  }
  return {
    discoverability: readJson(path.join(root, requested.discoverability)),
    antiPatterns: readJson(path.join(root, requested.antiPatterns))
  };
}

function catalogIndexes(catalogs) {
  return {
    practices: new Map((catalogs.discoverability?.tactics ?? []).map(row => [row.id, row])),
    antiPatterns: new Map((catalogs.antiPatterns?.anti_patterns ?? []).map(row => [row.id, row]))
  };
}

function validateEvidence(instance, errors) {
  const evidence = instance.evidence;
  if (!array(evidence)) {
    errors.push(`${instance.id}: evidence must be an array.`);
    return;
  }
  if (['present', 'absent'].includes(instance.verdict) && evidence.length === 0) errors.push(`${instance.id}: present/absent verdicts require evidence.`);
  for (const [index, item] of evidence.entries()) {
    if (!object(item) || !nonempty(item.type) || !nonempty(item.locator) || !nonempty(item.observedAt) || !nonempty(item.summary)) errors.push(`${instance.id}: evidence[${index}] needs type, locator, observedAt and summary.`);
  }
}

function validateOutcome(instance, errors) {
  if (!array(instance.outcomes)) {
    errors.push(`${instance.id}: outcomes must be an array.`);
    return;
  }
  for (const [index, item] of instance.outcomes.entries()) {
    if (!object(item) || !nonempty(item.metric) || !nonempty(item.observationWindow) || !nonempty(item.source) || !nonempty(item.interpretation)) errors.push(`${instance.id}: outcomes[${index}] is incomplete.`);
    if (item?.causalClaim !== false) errors.push(`${instance.id}: outcomes[${index}].causalClaim must remain false; observational before/after data does not prove causation.`);
  }
}

export function summarizeSitePatternMap(map) {
  const summary = {
    practicePresent: 0,
    practiceAbsent: 0,
    antiPatternPresent: 0,
    antiPatternAbsent: 0,
    unknown: 0,
    notApplicable: 0,
    total: Array.isArray(map?.instances) ? map.instances.length : 0
  };
  for (const instance of map?.instances ?? []) {
    if (instance.verdict === 'unknown') summary.unknown++;
    else if (instance.verdict === 'not-applicable') summary.notApplicable++;
    else if (instance.kind === 'practice' && instance.verdict === 'present') summary.practicePresent++;
    else if (instance.kind === 'practice' && instance.verdict === 'absent') summary.practiceAbsent++;
    else if (instance.kind === 'anti-pattern' && instance.verdict === 'present') summary.antiPatternPresent++;
    else if (instance.kind === 'anti-pattern' && instance.verdict === 'absent') summary.antiPatternAbsent++;
  }
  return summary;
}

export function buildSitePatternActions(map) {
  const actions = [];
  for (const instance of map?.instances ?? []) {
    if (instance.kind === 'anti-pattern' && instance.verdict === 'present') {
      actions.push({
        instanceId: instance.id,
        action: 'remediate',
        target: instance.target,
        patternId: instance.pattern.id,
        reason: 'A reviewed anti-pattern instance is present on the declared target; use its catalog replacement and verify the deployed correction.'
      });
    } else if (instance.kind === 'practice' && instance.applicability === 'applicable' && instance.verdict === 'absent') {
      actions.push({
        instanceId: instance.id,
        action: 'consider-practice',
        target: instance.target,
        patternId: instance.pattern.id,
        reason: 'An applicable positive practice is absent on the observed target; decide whether its documented problem exists before implementing it.'
      });
    } else if (instance.verdict === 'unknown') {
      actions.push({
        instanceId: instance.id,
        action: 'review',
        target: instance.target,
        patternId: instance.pattern.id,
        reason: 'The current evidence does not support a present/absent verdict.'
      });
    }
  }
  return actions;
}

export function validateSitePatternMap(map, catalogs) {
  const errors = [];
  const warnings = [];
  if (!object(map)) return { valid: false, errors: ['Site Pattern Map must be an object.'], warnings, summary: summarizeSitePatternMap(null) };
  if (map.version !== SITE_PATTERN_MAP_VERSION) errors.push(`version must be ${SITE_PATTERN_MAP_VERSION}.`);
  if (!nonempty(map.generatedAt) || !Number.isFinite(Date.parse(map.generatedAt))) errors.push('generatedAt must be an ISO date-time.');
  if (!object(map.site) || !nonempty(map.site.canonicalUrl) || !/^https:\/\//.test(map.site.canonicalUrl) || !nonempty(map.site.repository)) errors.push('site requires an HTTPS canonicalUrl and repository.');
  if (!object(map.catalogs)) errors.push('catalogs are required.');
  if (map.catalogs?.discoverability?.path !== CANONICAL_CATALOGS.discoverability) errors.push(`discoverability catalog path must be ${CANONICAL_CATALOGS.discoverability}.`);
  if (map.catalogs?.antiPatterns?.path !== CANONICAL_CATALOGS.antiPatterns) errors.push(`antiPatterns catalog path must be ${CANONICAL_CATALOGS.antiPatterns}.`);
  if (!semver(map.catalogs?.discoverability?.version) || map.catalogs?.discoverability?.version !== catalogs?.discoverability?.version) errors.push('discoverability catalog version must match the loaded catalog.');
  if (!semver(map.catalogs?.antiPatterns?.version) || map.catalogs?.antiPatterns?.version !== catalogs?.antiPatterns?.version) errors.push('anti-pattern catalog version must match the loaded catalog.');
  if (!object(map.coverage) || !['sample', 'complete-known-set', 'unknown'].includes(map.coverage.mode) || !Number.isInteger(map.coverage.routesObserved) || !nonempty(map.coverage.note)) errors.push('coverage needs mode, routesObserved and a limitation note.');
  if (map.coverage?.mode === 'complete-known-set' && (!Number.isInteger(map.coverage.routesKnown) || map.coverage.routesKnown !== map.coverage.routesObserved)) errors.push('complete-known-set coverage requires routesKnown === routesObserved.');
  if (!array(map.instances) || map.instances.length === 0) errors.push('instances must contain at least one site-specific pattern binding.');
  if (!array(map.relations)) errors.push('relations must be an array.');
  if (!array(map.knownUnknowns) || map.knownUnknowns.length === 0 || !map.knownUnknowns.every(nonempty)) errors.push('knownUnknowns must remain a non-empty list.');

  const indexes = catalogIndexes(catalogs ?? {});
  const instanceIds = new Set();
  for (const [index, instance] of (map.instances ?? []).entries()) {
    if (!object(instance) || !nonempty(instance.id)) {
      errors.push(`instances[${index}] needs an id.`);
      continue;
    }
    if (instanceIds.has(instance.id)) errors.push(`${instance.id}: duplicate instance id.`);
    instanceIds.add(instance.id);
    if (!['practice', 'anti-pattern'].includes(instance.kind)) errors.push(`${instance.id}: unsupported kind.`);
    if (!object(instance.pattern) || !nonempty(instance.pattern.id) || !semver(instance.pattern.version)) errors.push(`${instance.id}: pattern needs id and semantic version.`);
    if (!object(instance.target) || !nonempty(instance.target.scope) || !nonempty(instance.target.value)) errors.push(`${instance.id}: target needs scope and value.`);
    if (!['applicable', 'not-applicable', 'unknown'].includes(instance.applicability)) errors.push(`${instance.id}: invalid applicability.`);
    if (!['present', 'absent', 'unknown', 'not-applicable'].includes(instance.verdict)) errors.push(`${instance.id}: invalid verdict.`);
    if (!['manual-reviewed', 'deterministic', 'provider-observation', 'heuristic-candidate'].includes(instance.basis)) errors.push(`${instance.id}: invalid basis.`);
    if (instance.basis === 'heuristic-candidate' && instance.verdict !== 'unknown') errors.push(`${instance.id}: heuristic candidates may only remain unknown.`);
    if (instance.applicability === 'not-applicable' && instance.verdict !== 'not-applicable') errors.push(`${instance.id}: not-applicable applicability requires a not-applicable verdict.`);
    if (instance.verdict === 'not-applicable' && instance.applicability !== 'not-applicable') errors.push(`${instance.id}: not-applicable verdict requires not-applicable applicability.`);
    validateEvidence(instance, errors);
    validateOutcome(instance, errors);
    if (!object(instance.remediation) || !nonempty(instance.remediation.state)) errors.push(`${instance.id}: remediation state is required.`);
    if (instance.remediation?.state === 'verified' && !nonempty(instance.remediation.receiptId)) errors.push(`${instance.id}: verified remediation needs a receiptId.`);

    const catalog = instance.kind === 'practice' ? indexes.practices.get(instance.pattern?.id) : indexes.antiPatterns.get(instance.pattern?.id);
    if (!catalog) {
      errors.push(`${instance.id}: unknown ${instance.kind} id ${instance.pattern?.id}.`);
      continue;
    }
    const catalogVersion = instance.kind === 'practice' ? (catalog.pattern_version ?? '1.0.0') : catalog.version;
    if (instance.pattern.version !== catalogVersion) errors.push(`${instance.id}: pattern version ${instance.pattern.version} does not match loaded catalog version ${catalogVersion}.`);
    if (instance.kind === 'practice' && catalog.lifecycle?.status && catalog.lifecycle.status !== 'active') warnings.push(`${instance.id}: referenced practice lifecycle is ${catalog.lifecycle.status}; inspect replacement_ids before new adoption.`);
    if (instance.kind === 'anti-pattern') {
      if (instance.verdict === 'present' && instance.falsePositiveBoundaryReviewed !== true) errors.push(`${instance.id}: a present anti-pattern requires falsePositiveBoundaryReviewed=true.`);
      if (catalog.review_status === 'manual-required' && ['present', 'absent'].includes(instance.verdict) && instance.basis !== 'manual-reviewed') errors.push(`${instance.id}: ${catalog.id} is manual-required; automated evidence may nominate it but cannot confirm presence or absence.`);
    }
  }

  for (const [index, relation] of (map.relations ?? []).entries()) {
    if (!object(relation) || !instanceIds.has(relation.from) || !instanceIds.has(relation.to)) errors.push(`relations[${index}] must reference existing instance ids.`);
    if (relation?.from === relation?.to) errors.push(`relations[${index}] cannot self-reference.`);
    if (!['reinforces', 'prerequisite-for', 'conflicts-with', 'replaces', 'co-occurs-with'].includes(relation?.type)) errors.push(`relations[${index}] has an invalid type.`);
    if (!nonempty(relation?.rationale)) errors.push(`relations[${index}] needs a rationale.`);
  }

  if (map.coverage?.mode !== 'complete-known-set') warnings.push('Coverage is not site-complete; absent means absent only within the declared target and evidence, not across the whole site.');
  return { valid: errors.length === 0, errors, warnings, summary: summarizeSitePatternMap(map), fingerprint: sitePatternMapFingerprint(map) };
}

export function summarizePatternPortfolio(maps) {
  const byPattern = new Map();
  for (const map of maps) {
    const site = map?.site?.canonicalUrl ?? 'unknown-site';
    for (const instance of map?.instances ?? []) {
      const key = `${instance.kind}:${instance.pattern?.id ?? 'unknown'}`;
      if (!byPattern.has(key)) byPattern.set(key, { kind: instance.kind, patternId: instance.pattern?.id, present: 0, absent: 0, unknown: 0, notApplicable: 0, sites: new Set() });
      const row = byPattern.get(key);
      row.sites.add(site);
      if (instance.verdict === 'present') row.present++;
      else if (instance.verdict === 'absent') row.absent++;
      else if (instance.verdict === 'not-applicable') row.notApplicable++;
      else row.unknown++;
    }
  }
  return {
    scope: 'Cross-site prevalence of reviewed pattern instances only. It is not causal evidence that a pattern improves rankings, citations, traffic or conversion.',
    sites: [...new Set(maps.map(map => map?.site?.canonicalUrl).filter(Boolean))],
    patterns: [...byPattern.values()].map(row => ({ ...row, sites: [...row.sites] })).sort((a, b) => `${a.kind}:${a.patternId}`.localeCompare(`${b.kind}:${b.patternId}`))
  };
}

export function buildPatternLearningSignals(maps, { minRepeat = 2 } = {}) {
  if (!Number.isInteger(minRepeat) || minRepeat < 2) throw new Error('minRepeat must be an integer >= 2 so one site cannot masquerade as a portfolio pattern.');
  const grouped = new Map();
  for (const map of maps ?? []) {
    const site = map?.site?.canonicalUrl ?? 'unknown-site';
    for (const instance of map?.instances ?? []) {
      const key = `${instance.kind}:${instance.pattern?.id ?? 'unknown'}`;
      if (!grouped.has(key)) grouped.set(key, {
        kind: instance.kind,
        patternId: instance.pattern?.id,
        versions: new Set(),
        sites: new Set(),
        instances: 0,
        present: 0,
        absent: 0,
        unknown: 0,
        notApplicable: 0,
        verifiedRemediations: 0,
        outcomes: 0
      });
      const row = grouped.get(key);
      row.instances++;
      row.sites.add(site);
      if (instance.pattern?.version) row.versions.add(instance.pattern.version);
      if (instance.verdict === 'present') row.present++;
      else if (instance.verdict === 'absent') row.absent++;
      else if (instance.verdict === 'not-applicable') row.notApplicable++;
      else row.unknown++;
      if (instance.remediation?.state === 'verified') row.verifiedRemediations++;
      row.outcomes += Array.isArray(instance.outcomes) ? instance.outcomes.length : 0;
    }
  }

  const signals = [];
  const add = (row, type, priority, reason, nextReview) => signals.push({
    id: `${type}:${row.kind}:${row.patternId}`,
    type,
    priority,
    kind: row.kind,
    patternId: row.patternId,
    sitesObserved: row.sites.size,
    instancesObserved: row.instances,
    reason,
    nextReview,
    causalClaim: false
  });

  for (const row of grouped.values()) {
    const crossSite = row.sites.size >= minRepeat;
    if (crossSite && row.unknown >= minRepeat && row.unknown / row.instances >= 0.5) add(
      row,
      'evidence-gap',
      'P1',
      `${row.unknown}/${row.instances} observed instances remain unknown across ${row.sites.size} sites.`,
      'Review whether the pattern needs a bounded deterministic detector, a clearer manual-review procedure, or owner/provider data that the current system cannot observe.'
    );
    if (crossSite && row.kind === 'practice' && row.absent >= minRepeat) add(
      row,
      'repeated-practice-gap',
      'P1',
      `${row.absent} applicable observations record the practice as absent across ${row.sites.size} sites.`,
      'Inspect problem fit by site archetype before proposing an adoption pack; repeated absence is not proof that implementing the practice will improve an outcome.'
    );
    if (crossSite && row.kind === 'anti-pattern' && row.present >= minRepeat) add(
      row,
      'repeated-anti-pattern',
      'P0',
      `${row.present} reviewed observations record the anti-pattern as present across ${row.sites.size} sites.`,
      'Review the shared implementation cause and consider a reusable remediation pack while preserving each anti-pattern false-positive boundary.'
    );
    if (row.verifiedRemediations >= minRepeat && row.outcomes === 0) add(
      row,
      'measurement-debt',
      'P1',
      `${row.verifiedRemediations} verified remediations have no later outcome observations in the supplied maps.`,
      'Attach an appropriate provider, user or business observation window. Keep implementation proof separate from outcome evidence.'
    );
    if (crossSite && row.notApplicable >= minRepeat && row.notApplicable / row.instances >= 0.6) add(
      row,
      'applicability-filter-candidate',
      'P2',
      `${row.notApplicable}/${row.instances} instances are not applicable across ${row.sites.size} sites.`,
      'Review whether site archetype or route-role filters can hide this pattern earlier without changing the pattern passport itself.'
    );
    if (crossSite && row.versions.size > 1) add(
      row,
      'version-fragmentation',
      'P2',
      `Observed site maps reference ${row.versions.size} pattern versions across ${row.sites.size} sites.`,
      'Preserve historical maps, but review whether active deployments should migrate to the current pattern version before portfolio comparison.'
    );
  }

  const order = { P0: 0, P1: 1, P2: 2 };
  signals.sort((a, b) => order[a.priority] - order[b.priority] || a.id.localeCompare(b.id));
  return {
    version: '0.1',
    generatedAt: new Date().toISOString(),
    minRepeat,
    sitesObserved: new Set((maps ?? []).map(map => map?.site?.canonicalUrl).filter(Boolean)).size,
    scope: 'Signals identify repeated portfolio observations and evidence-system debt. They do not infer ranking factors, causal effects, penalties or universal applicability.',
    signals
  };
}
