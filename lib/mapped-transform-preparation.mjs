import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateAdaptiveUpgradeGraph } from './adaptive-upgrade.mjs';
import { validateSiteStateGraph, resolveUpgradeOwnership } from './repository-mapper.mjs';
import { canonicalJson, sha256 } from './transformation-engine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'mapped-transform-preparation.schema.json');

export const MAPPED_TRANSFORM_PREPARATION_VERSION = '0.1';
const EXECUTABLE_CLASSES = new Set(['mechanical', 'grounded-template']);
const BLOCKED_MUTATION_CLASSES = new Set(['editorial', 'policy-gated', 'runtime', 'owner-platform', 'blocked']);
const OPERATION_CHOICES = ['replace-file', 'replace-exact', 'insert-before-exact', 'insert-after-exact'];

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

export function validateMappedTransformationPreparation(value) {
  const validate = validator();
  return { valid: Boolean(validate(value)), errors: validate.errors || [] };
}

function arrays(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function unique(values = []) {
  return [...new Set(values.filter(value => value != null && String(value).trim()).map(value => String(value)))];
}

function canonicalSiteFromMap(map) {
  const base = map.site.basePath || '/';
  const url = new URL(base, `${map.site.origin}/`);
  return url.href;
}

function normalizeSite(value) {
  const url = new URL(String(value));
  if (url.protocol !== 'https:') throw new Error(`Site must use HTTPS: ${value}`);
  return url.href;
}

function recommendationBlockers(recommendation) {
  const blockers = [];
  if (recommendation.state !== 'recommended') blockers.push('recommendation-not-active');
  if (recommendation.knowledgeState !== 'current') blockers.push('knowledge-review-due');
  if (!EXECUTABLE_CLASSES.has(recommendation.change?.automationClass)) blockers.push('automation-class-not-executable');
  return blockers;
}

function fileForPath(map, pathname) {
  return map.files.find(file => file.path === pathname) || null;
}

function pathEvidence(hint, pathname) {
  const targets = arrays(hint?.targets).filter(target => target.state === 'resolved' && target.ownerPath === pathname);
  return {
    surfaceKeys: unique(targets.flatMap(target => arrays(target.matches).filter(match => match.ownerPath === pathname).map(match => match.surfaceKey))),
    targetLabels: unique(targets.map(target => target.target))
  };
}

function blockedCandidate(recommendation, hint, blockers) {
  return {
    recommendationId: recommendation.id,
    automationClass: recommendation.change?.automationClass || null,
    path: null,
    state: 'blocked',
    blockers: unique(blockers),
    currentSha256: null,
    surfaceKeys: unique(arrays(hint?.targets).flatMap(target => arrays(target.matches).map(match => match.surfaceKey))),
    targetLabels: unique(arrays(hint?.targets).map(target => target.target)),
    operationChoices: [],
    requiresBeforeContent: true,
    requiresAfterState: true,
    requiresGrounding: recommendation.change?.automationClass === 'grounded-template',
    verification: unique(recommendation.verification?.checks || [])
  };
}

export function prepareMappedTransformationSpec(upgradeGraph, siteStateGraph, options = {}) {
  const upgradeValidation = validateAdaptiveUpgradeGraph(upgradeGraph);
  if (!upgradeValidation.valid) throw new Error(`Invalid Adaptive Upgrade graph: ${upgradeValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  const mapValidation = validateSiteStateGraph(siteStateGraph);
  if (!mapValidation.valid) throw new Error(`Invalid Site State Graph: ${mapValidation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);

  const upgradeSite = normalizeSite(upgradeGraph.site);
  const mappedSite = normalizeSite(canonicalSiteFromMap(siteStateGraph));
  if (upgradeSite !== mappedSite) throw new Error(`Adaptive Upgrade site ${upgradeSite} does not match Repository Map site ${mappedSite}.`);

  const requested = unique(options.recommendationIds || []);
  const knownIds = new Set(upgradeGraph.recommendations.map(item => item.id));
  for (const id of requested) if (!knownIds.has(id)) throw new Error(`Unknown recommendationId requested for mapped preparation: ${id}`);
  const selected = requested.length ? new Set(requested) : null;

  const ownership = resolveUpgradeOwnership(upgradeGraph, siteStateGraph);
  const hintById = new Map(ownership.recommendations.map(item => [item.recommendationId, item]));
  const candidates = [];
  let recommendationsConsidered = 0;

  for (const recommendation of upgradeGraph.recommendations) {
    if (selected && !selected.has(recommendation.id)) continue;
    recommendationsConsidered += 1;
    const hint = hintById.get(recommendation.id) || null;
    const baseBlockers = recommendationBlockers(recommendation);
    const safePaths = unique(hint?.safeCandidatePaths || []);

    if (!safePaths.length) {
      const blockers = [...baseBlockers];
      if (!hint) blockers.push('repository-map-hint-missing');
      else if (hint.ambiguousTargets > 0) blockers.push('ownership-ambiguous');
      else if (hint.unresolvedTargets > 0) blockers.push('ownership-unresolved');
      else blockers.push('no-safe-resolved-owner');
      candidates.push(blockedCandidate(recommendation, hint, blockers));
      continue;
    }

    for (const pathname of safePaths) {
      const mappedFile = fileForPath(siteStateGraph, pathname);
      const blockers = [...baseBlockers];
      if (!mappedFile) blockers.push('mapped-file-missing');
      else if (BLOCKED_MUTATION_CLASSES.has(mappedFile.mutationClass)) blockers.push(`mapped-file-${mappedFile.mutationClass}`);
      const evidence = pathEvidence(hint, pathname);
      candidates.push({
        recommendationId: recommendation.id,
        automationClass: recommendation.change?.automationClass || null,
        path: pathname,
        state: blockers.length ? 'blocked' : 'ready',
        blockers: unique(blockers),
        currentSha256: mappedFile?.sha256 || null,
        surfaceKeys: evidence.surfaceKeys,
        targetLabels: evidence.targetLabels,
        operationChoices: blockers.length ? [] : [...OPERATION_CHOICES],
        requiresBeforeContent: true,
        requiresAfterState: true,
        requiresGrounding: recommendation.change?.automationClass === 'grounded-template',
        verification: unique(recommendation.verification?.checks || [])
      });
    }
  }

  candidates.sort((a, b) => a.recommendationId.localeCompare(b.recommendationId) || String(a.path || '').localeCompare(String(b.path || '')));
  const allowedPaths = unique(candidates.filter(item => item.state === 'ready' && item.path).map(item => item.path)).sort();
  const preparation = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/mapped-transform-preparation.schema.json',
    version: MAPPED_TRANSFORM_PREPARATION_VERSION,
    generatedAt: new Date(options.generatedAt || Date.now()).toISOString(),
    site: upgradeSite,
    repository: structuredClone(siteStateGraph.repository),
    sourceEvidence: {
      adaptiveUpgradeDigest: sha256(canonicalJson(upgradeGraph)),
      siteStateDigest: sha256(canonicalJson(siteStateGraph))
    },
    specSkeleton: {
      repository: {
        fullName: siteStateGraph.repository.fullName,
        baseRef: siteStateGraph.repository.baseRef,
        baseCommitSha: siteStateGraph.repository.baseCommitSha
      },
      allowedPaths,
      operations: []
    },
    candidates,
    summary: {
      recommendationsConsidered,
      readyCandidates: candidates.filter(item => item.state === 'ready').length,
      blockedCandidates: candidates.filter(item => item.state === 'blocked').length,
      allowedPaths: allowedPaths.length,
      productionBasePinned: Boolean(siteStateGraph.repository.baseCommitSha)
    },
    guardrails: {
      mapEvidenceDoesNotAuthorizeMutation: true,
      ambiguousOwnershipBlocked: true,
      policyEditorialRuntimeOwnerBlocked: true,
      afterStateNotInvented: true,
      groundingStillRequired: true,
      transformationEngineRevalidatesPreconditions: true,
      noRankingGuarantee: true
    }
  };

  const validation = validateMappedTransformationPreparation(preparation);
  if (!validation.valid) throw new Error(`Generated mapped transformation preparation is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  return preparation;
}

export function formatMappedTransformationPreparation(preparation) {
  const lines = [
    `SignalBraid mapped transform preparation ${preparation.version}`,
    `Site: ${preparation.site}`,
    `Repository: ${preparation.repository.fullName}@${preparation.repository.baseRef}`,
    `Ready candidates: ${preparation.summary.readyCandidates}`,
    `Blocked candidates: ${preparation.summary.blockedCandidates}`,
    `Allowed path hints: ${preparation.summary.allowedPaths}`,
    `Production base pinned: ${preparation.summary.productionBasePinned ? 'yes' : 'no'}`,
    ''
  ];
  for (const item of preparation.candidates) {
    lines.push(`- ${item.recommendationId}: ${item.state}${item.path ? ` -> ${item.path}` : ''}`);
    if (item.currentSha256) lines.push(`  Current: ${item.currentSha256}`);
    if (item.blockers.length) lines.push(`  Blockers: ${item.blockers.join(', ')}`);
  }
  lines.push('');
  lines.push('This artifact resolves repository ownership only. Fill operation content/grounding deliberately, then compile through the Transformation Engine, which revalidates exact preconditions and authorization.');
  return lines.join('\n');
}
