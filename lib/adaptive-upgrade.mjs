import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildGrowthPlan as buildVerticalGrowthPlan } from './growth-plan-vertical.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const registryPath = path.join(root, 'registry', 'adaptive-upgrade-packs.json');
const schemaPath = path.join(root, 'schema', 'adaptive-upgrade-graph.schema.json');

export const ADAPTIVE_UPGRADE_VERSION = '0.1';
const GAP_STATUSES = new Set(['partial', 'not-observed', 'manual', 'external-owner-data']);
const PRIORITY_ORDER = ['P0', 'P0-when-targeted', 'P1', 'P2', 'P3'];
const DEFAULT_GOALS = ['search', 'generative-search', 'ai-citations', 'measurement'];

export function loadAdaptiveUpgradeRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function createValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

export function validateAdaptiveUpgradeGraph(graph) {
  const validate = createValidator();
  const valid = Boolean(validate(graph));
  return { valid, errors: validate.errors || [] };
}

function arrays(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function unique(values) {
  return [...new Set(values.filter(value => value != null && String(value).trim()).map(value => String(value)))];
}

function iso(value = null) {
  const date = value == null ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date/time: ${value}`);
  return date.toISOString();
}

function dateOnly(value) {
  return String(value || '').slice(0, 10);
}

function ageDays(date, now) {
  const start = Date.parse(`${dateOnly(date)}T00:00:00Z`);
  if (Number.isNaN(start)) return Infinity;
  return Math.floor((new Date(now).getTime() - start) / 86400000);
}

function targetVerticals(plan, options) {
  const explicit = unique(options.verticals || (options.vertical ? [options.vertical] : []));
  if (explicit.length) return explicit;
  const observed = plan?.observations?.verticalEvidence?.vertical;
  return observed ? [observed] : ['general'];
}

function targetGoals(options) {
  const explicit = unique(options.goals || []);
  return explicit.length ? explicit : [...DEFAULT_GOALS];
}

function appliesTo(pack, verticals) {
  const allowed = new Set(arrays(pack.appliesTo));
  if (allowed.has('all')) return true;
  return verticals.some(vertical => allowed.has(vertical));
}

function matchesGoals(pack, goals) {
  const wanted = new Set(arrays(pack.goals));
  if (!wanted.size) return true;
  return goals.some(goal => wanted.has(goal));
}

function unresolvedVerticalChecks(plan) {
  return arrays(plan?.observations?.verticalEvidence?.checks).filter(item => GAP_STATUSES.has(item?.status));
}

function matchedActionIds(pack, actions) {
  const exact = new Set(arrays(pack?.trigger?.actionIds));
  const prefixes = arrays(pack?.trigger?.actionPrefixes);
  return unique(actions
    .map(action => String(action?.id || ''))
    .filter(id => exact.has(id) || prefixes.some(prefix => id.startsWith(prefix))));
}

function matchedCheckIds(pack, checks) {
  const exact = new Set(arrays(pack?.trigger?.verticalCheckIds));
  const prefixes = arrays(pack?.trigger?.verticalCheckPrefixes);
  if (!exact.size && !prefixes.length) return [];
  return unique(checks
    .map(check => String(check?.id || ''))
    .filter(id => exact.has(id) || prefixes.some(prefix => id.startsWith(prefix))));
}

function packState(pack, { goalMatch, debtMatch }) {
  const mode = pack?.trigger?.mode || 'debt';
  if (mode === 'debt') return debtMatch ? 'recommended' : null;
  if (mode === 'goal') return goalMatch ? 'recommended' : null;
  if (mode === 'applicable') {
    if (debtMatch) return 'recommended';
    return pack.condition ? 'conditional' : 'recommended';
  }
  if (mode === 'hybrid') {
    if (debtMatch) return 'recommended';
    return goalMatch ? 'conditional' : null;
  }
  throw new Error(`Unsupported adaptive-upgrade trigger mode: ${mode}`);
}

function actionEvidence(actions, ids) {
  const wanted = new Set(ids);
  const evidence = [];
  for (const action of actions) {
    if (!wanted.has(String(action?.id || ''))) continue;
    for (const item of arrays(action?.evidence)) evidence.push(typeof item === 'string' ? item : JSON.stringify(item));
    if (action?.source) evidence.push(action.source);
  }
  return unique(evidence).slice(0, 20);
}

function reasonFor(pack, state, matchedActions, matchedChecks, verticals, goals) {
  const causes = [];
  if (matchedActions.length) causes.push(`unresolved actions: ${matchedActions.join(', ')}`);
  if (matchedChecks.length) causes.push(`vertical evidence gaps: ${matchedChecks.join(', ')}`);
  if (causes.length) return `Selected from current ARWP evidence because of ${causes.join('; ')}.`;
  if (state === 'conditional') return `Applicable opportunity for vertical(s) ${verticals.join(', ')} and goal(s) ${goals.join(', ')}; activate only when its stated condition is true.`;
  return `Selected as a current best-practice capability for vertical(s) ${verticals.join(', ')} and goal(s) ${goals.join(', ')}.`;
}

function recommendationFromPack(pack, context) {
  const matchedActions = matchedActionIds(pack, context.actions);
  const matchedChecks = matchedCheckIds(pack, context.checks);
  const debtMatch = matchedActions.length > 0 || matchedChecks.length > 0;
  const goalMatch = matchesGoals(pack, context.goals);
  const state = packState(pack, { goalMatch, debtMatch });
  if (!state) return null;

  const due = ageDays(pack.sourceReviewedAt, context.now) > Number(pack.reviewAfterDays || 45);
  const evidence = actionEvidence(context.actions, matchedActions);
  for (const check of context.checks) {
    if (!matchedChecks.includes(String(check?.id || ''))) continue;
    for (const item of arrays(check?.evidence)) evidence.push(typeof item === 'string' ? item : JSON.stringify(item));
  }

  return {
    id: pack.id,
    title: pack.title,
    priority: pack.priority,
    lane: pack.lane,
    state,
    knowledgeState: due ? 'review-due' : 'current',
    authority: pack.authority,
    reason: reasonFor(pack, state, matchedActions, matchedChecks, context.verticals, context.goals),
    ...(pack.condition ? { condition: pack.condition } : { condition: null }),
    sources: unique(pack.sources),
    change: {
      automationClass: pack.change.automationClass,
      targets: unique(pack.change.targets),
      recipe: arrays(pack.change.recipe).map(String)
    },
    verification: {
      checks: arrays(pack.verification.checks).map(String),
      successState: String(pack.verification.successState)
    },
    measurement: {
      signals: arrays(pack.measurement?.signals).map(String),
      ownerDataRequired: Boolean(pack.measurement?.ownerDataRequired)
    },
    dependencies: unique(pack.dependencies || []),
    addresses: {
      actionIds: matchedActions,
      verticalCheckIds: matchedChecks
    },
    evidence: unique(evidence).slice(0, 20)
  };
}

function summary(recommendations) {
  const out = {
    recommended: 0,
    conditional: 0,
    reviewDue: 0,
    byPriority: {},
    byAutomationClass: {}
  };
  for (const item of recommendations) {
    out[item.state] += 1;
    if (item.knowledgeState === 'review-due') out.reviewDue += 1;
    out.byPriority[item.priority] = (out.byPriority[item.priority] || 0) + 1;
    out.byAutomationClass[item.change.automationClass] = (out.byAutomationClass[item.change.automationClass] || 0) + 1;
  }
  return out;
}

function waves(recommendations) {
  const groups = new Map();
  for (const item of recommendations.filter(item => item.state === 'recommended')) {
    if (!groups.has(item.priority)) groups.set(item.priority, []);
    groups.get(item.priority).push(item.id);
  }
  const rank = priority => {
    const index = PRIORITY_ORDER.indexOf(priority);
    return index < 0 ? 99 : index;
  };
  return [...groups.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
    .map(([priority, ids]) => ({ priority, recommendationIds: unique(ids).sort() }));
}

function sourceDebt(plan) {
  return {
    actionIds: unique(arrays(plan?.actions).map(item => item?.id)),
    verticalCheckIds: unique(unresolvedVerticalChecks(plan).map(item => item?.id))
  };
}

export function compileAdaptiveUpgradeGraph(plan, options = {}) {
  if (!plan || !Array.isArray(plan.actions)) throw new Error('A Growth plan with actions is required.');
  if (!/^https:\/\//.test(String(plan.canonicalUrl || ''))) throw new Error('Growth plan canonicalUrl must be a public HTTPS URL.');

  const registry = options.registry || loadAdaptiveUpgradeRegistry();
  const now = options.now || new Date();
  const verticals = targetVerticals(plan, options);
  const goals = targetGoals(options);
  const actions = plan.actions;
  const checks = unresolvedVerticalChecks(plan);
  const recommendations = arrays(registry.packs)
    .filter(pack => appliesTo(pack, verticals))
    .map(pack => recommendationFromPack(pack, { actions, checks, verticals, goals, now }))
    .filter(Boolean)
    .sort((a, b) => {
      const left = PRIORITY_ORDER.indexOf(a.priority);
      const right = PRIORITY_ORDER.indexOf(b.priority);
      const lr = left < 0 ? 99 : left;
      const rr = right < 0 ? 99 : right;
      return lr - rr || a.state.localeCompare(b.state) || a.id.localeCompare(b.id);
    });

  const graph = {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/adaptive-upgrade-graph.schema.json',
    version: ADAPTIVE_UPGRADE_VERSION,
    generatedAt: iso(now),
    site: plan.canonicalUrl,
    context: { verticals, goals },
    knowledge: {
      registryVersion: String(registry.version),
      ruleset: String(registry.ruleset),
      reviewedAt: String(registry.reviewedAt),
      current: recommendations.filter(item => item.knowledgeState === 'current').length,
      reviewDue: recommendations.filter(item => item.knowledgeState === 'review-due').length
    },
    summary: summary(recommendations),
    sourceDebt: sourceDebt(plan),
    recommendations,
    waves: waves(recommendations),
    guardrails: {
      noRankingGuarantee: true,
      noInventedFacts: true,
      ownerDataSeparate: true,
      productionMutationAuthorized: false,
      staleKnowledgeNeedsReview: true,
      negativeResultsPreserved: true
    }
  };
  const validation = validateAdaptiveUpgradeGraph(graph);
  if (!validation.valid) {
    throw new Error(`Generated adaptive upgrade graph is invalid: ${validation.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')}`);
  }
  return graph;
}

export async function buildAdaptiveUpgradeGraph(input, options = {}) {
  const vertical = options.vertical || options.verticals?.[0] || 'general';
  const plan = options.plan || await (options.buildGrowthImpl || buildVerticalGrowthPlan)(input, {
    ...options,
    vertical
  });
  return compileAdaptiveUpgradeGraph(plan, { ...options, verticals: options.verticals || [vertical] });
}

export function simulateAdaptiveUpgrade(graph, acceptedRecommendationIds = []) {
  const accepted = new Set(unique(acceptedRecommendationIds));
  const selected = arrays(graph?.recommendations).filter(item => accepted.has(item.id));
  const addressedActions = unique(selected.flatMap(item => arrays(item?.addresses?.actionIds)));
  const addressedChecks = unique(selected.flatMap(item => arrays(item?.addresses?.verticalCheckIds)));
  const remainingActions = arrays(graph?.sourceDebt?.actionIds).filter(id => !addressedActions.includes(id));
  const remainingChecks = arrays(graph?.sourceDebt?.verticalCheckIds).filter(id => !addressedChecks.includes(id));
  return {
    version: '0.1',
    site: graph?.site || null,
    acceptedRecommendationIds: [...accepted],
    addressed: {
      actionIds: addressedActions,
      verticalCheckIds: addressedChecks
    },
    remaining: {
      actionIds: remainingActions,
      verticalCheckIds: remainingChecks
    },
    interpretation: {
      expectedImplementationDebtMayClose: addressedActions.length + addressedChecks.length > 0,
      rankingOrCitationUpliftPredicted: false,
      note: 'Simulation models which known ARWP implementation gaps are addressed by accepted recipes. It does not predict Search ranking, AI citation, traffic or conversion uplift.'
    }
  };
}

export function formatAdaptiveUpgradeGraph(graph) {
  const lines = [
    `ARWP Adaptive Site Upgrade ${graph.version}`,
    `Target: ${graph.site}`,
    `Verticals: ${graph.context.verticals.join(', ')}`,
    `Goals: ${graph.context.goals.join(', ')}`,
    `Recommendations: ${graph.summary.recommended} recommended; ${graph.summary.conditional} conditional; ${graph.summary.reviewDue} knowledge review due`,
    ''
  ];
  for (const wave of graph.waves) {
    lines.push(wave.priority);
    for (const id of wave.recommendationIds) {
      const item = graph.recommendations.find(entry => entry.id === id);
      lines.push(`- ${item.title} [${item.change.automationClass}; ${item.knowledgeState}]`);
      lines.push(`  Targets: ${item.change.targets.join(', ')}`);
      lines.push(`  Verify: ${item.verification.checks.join('; ')}`);
    }
    lines.push('');
  }
  const conditional = graph.recommendations.filter(item => item.state === 'conditional');
  if (conditional.length) {
    lines.push('Conditional opportunities');
    for (const item of conditional) lines.push(`- ${item.title}: ${item.condition || item.reason}`);
    lines.push('');
  }
  lines.push('The upgrade graph is an evidence-to-change plan. It does not authorize production mutation and does not predict ranking or AI citation uplift.');
  return lines.join('\n');
}
