import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const eventSchemaPath = path.join(root, 'schema', 'recommendation-review-events.schema.json');
const registryPath = path.join(root, 'registry', 'search-agent-recommendations.json');

export function loadRecommendationReviewSchema() {
  return JSON.parse(fs.readFileSync(eventSchemaPath, 'utf8'));
}

export function loadRecommendationRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

export function createRecommendationReviewValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(loadRecommendationReviewSchema());
}

export function validateRecommendationReviewEvents(batch, registry = loadRecommendationRegistry()) {
  const validate = createRecommendationReviewValidator();
  const schemaValid = Boolean(validate(batch));
  const semanticErrors = [];
  const ids = new Set();
  const knownRuleIds = new Set((registry.rules || []).map(rule => rule.id));

  for (const event of batch?.events || []) {
    if (ids.has(event.id)) semanticErrors.push(`Duplicate event id: ${event.id}`);
    ids.add(event.id);
    if (!knownRuleIds.has(event.ruleId)) semanticErrors.push(`Unknown recommendation rule: ${event.ruleId}`);
  }

  return {
    valid: schemaValid && semanticErrors.length === 0,
    errors: validate.errors ?? [],
    semanticErrors
  };
}

function daysBetween(dateA, dateB) {
  const a = new Date(`${dateA}T00:00:00Z`);
  const b = new Date(dateB);
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function severity(state) {
  return {
    fresh: 0,
    'review-due': 1,
    challenged: 2,
    contradicted: 3,
    'retire-candidate': 4
  }[state] ?? 0;
}

function eventState(kind) {
  if (kind === 'manual-retire-proposal') return 'retire-candidate';
  if (kind === 'provider-contradiction') return 'contradicted';
  if (kind === 'source-changed') return 'review-due';
  if (kind === 'independent-challenge' || kind === 'winner-counterexample' || kind === 'experiment-negative') return 'challenged';
  return 'fresh';
}

function maxState(states) {
  return states.reduce((current, candidate) => severity(candidate) > severity(current) ? candidate : current, 'fresh');
}

export function buildRecommendationReviewQueue(batch, {
  registry = loadRecommendationRegistry(),
  asOf = new Date().toISOString(),
  staleAfterDays = 90
} = {}) {
  const validation = validateRecommendationReviewEvents(batch, registry);
  if (!validation.valid) {
    throw new Error(`Invalid recommendation review events: ${[...validation.semanticErrors, ...validation.errors.map(error => error.message)].join('; ')}`);
  }
  if (!Number.isInteger(staleAfterDays) || staleAfterDays < 1) throw new Error('staleAfterDays must be a positive integer.');
  const asOfDate = new Date(asOf);
  if (Number.isNaN(asOfDate.getTime())) throw new Error('asOf must be a valid date/time.');

  const eventsByRule = new Map();
  for (const event of batch.events) {
    if (!eventsByRule.has(event.ruleId)) eventsByRule.set(event.ruleId, []);
    eventsByRule.get(event.ruleId).push(event);
  }

  const rows = (registry.rules || []).map(rule => {
    const events = (eventsByRule.get(rule.id) || []).slice().sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    const sourceAgeDays = rule.sourceReviewedAt ? daysBetween(rule.sourceReviewedAt, asOfDate.toISOString()) : null;
    const reasons = [];
    const candidateStates = [];

    if (sourceAgeDays == null) {
      candidateStates.push('review-due');
      reasons.push({ kind: 'missing-source-review-date', detail: 'Rule has no sourceReviewedAt date.' });
    } else if (sourceAgeDays > staleAfterDays) {
      candidateStates.push('review-due');
      reasons.push({ kind: 'source-age', detail: `Source review is ${sourceAgeDays} days old; threshold is ${staleAfterDays}.` });
    }

    if (['retired', 'deprecated'].includes(rule.upstreamStatus)) {
      candidateStates.push('retire-candidate');
      reasons.push({ kind: 'upstream-status', detail: `Registry upstreamStatus=${rule.upstreamStatus}.` });
    }

    for (const event of events) {
      const state = eventState(event.kind);
      candidateStates.push(state);
      if (state !== 'fresh') {
        reasons.push({
          kind: event.kind,
          eventId: event.id,
          observedAt: event.observedAt,
          evidenceUri: event.evidenceUri,
          ...(event.note ? { detail: event.note } : {})
        });
      }
    }

    const state = maxState(candidateStates);
    return {
      ruleId: rule.id,
      title: rule.title,
      priority: rule.priority,
      upstreamStatus: rule.upstreamStatus,
      source: rule.source,
      sourceReviewedAt: rule.sourceReviewedAt ?? null,
      sourceAgeDays,
      state,
      reasons,
      supportingEventCount: events.filter(event => event.kind === 'experiment-positive').length,
      neutralEventCount: events.filter(event => event.kind === 'experiment-neutral').length,
      challengingEventCount: events.filter(event => ['independent-challenge', 'winner-counterexample', 'experiment-negative'].includes(event.kind)).length,
      mutationAllowed: false
    };
  });

  const attention = rows.filter(row => row.state !== 'fresh').sort((a, b) => {
    const severityDelta = severity(b.state) - severity(a.state);
    if (severityDelta) return severityDelta;
    return a.ruleId.localeCompare(b.ruleId);
  });

  return {
    version: '0.1',
    generatedAt: asOfDate.toISOString(),
    registryVersion: registry.version,
    registryRuleset: registry.ruleset,
    staleAfterDays,
    summary: {
      totalRules: rows.length,
      fresh: rows.filter(row => row.state === 'fresh').length,
      reviewDue: rows.filter(row => row.state === 'review-due').length,
      challenged: rows.filter(row => row.state === 'challenged').length,
      contradicted: rows.filter(row => row.state === 'contradicted').length,
      retireCandidate: rows.filter(row => row.state === 'retire-candidate').length,
      attention: attention.length
    },
    attention,
    rules: rows,
    guardrails: {
      registryMutationAllowed: false,
      causalityInferred: false,
      positiveExperimentDoesNotProveRule: true,
      neutralOrNegativeEvidencePreserved: true,
      humanReviewRequiredForLifecycleChange: true
    }
  };
}

export function formatRecommendationReviewQueue(report) {
  const lines = [
    `Goose Recommendation Review ${report.version}`,
    `Ruleset: ${report.registryRuleset}`,
    `As of: ${report.generatedAt}`,
    `Attention: ${report.summary.attention}/${report.summary.totalRules}`,
    `review-due=${report.summary.reviewDue} challenged=${report.summary.challenged} contradicted=${report.summary.contradicted} retire-candidate=${report.summary.retireCandidate}`
  ];
  for (const row of report.attention.slice(0, 30)) {
    lines.push(`- [${row.state}] ${row.ruleId}: ${row.reasons.map(reason => reason.kind).join(', ')}`);
  }
  return lines.join('\n');
}
