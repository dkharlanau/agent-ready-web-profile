import fs from 'node:fs';
import { createHash } from 'node:crypto';

export const CORPUS_URL = new URL('../knowledge/discoverability-corpus.json', import.meta.url);
const HYPOTHESES_URL = new URL('../registry/growth-hypotheses.json', import.meta.url);
const RECOMMENDATIONS_URL = new URL('../registry/search-agent-recommendations.json', import.meta.url);
const LEVELS = new Set(['documented', 'inferred', 'experimental']);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const strings = value => Array.isArray(value) && value.length > 0 && value.every(nonempty);
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
function https(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}

export function loadDiscoverabilityRegistries() {
  return {
    hypotheses: JSON.parse(fs.readFileSync(HYPOTHESES_URL, 'utf8')),
    recommendations: JSON.parse(fs.readFileSync(RECOMMENDATIONS_URL, 'utf8'))
  };
}

// Resolve IDs against the maintained native registries; do not copy their
// evidence classes, check modes, applicability, or outcome state into a new graph.
export function validateCorpusMappings(corpus, registries = loadDiscoverabilityRegistries()) {
  const errors = [];
  const hypothesisIds = new Set((registries.hypotheses?.hypotheses ?? []).map(row => row.id));
  const ruleIds = new Set((registries.recommendations?.rules ?? []).map(row => row.id));
  if (corpus?.integration?.growth_hypotheses?.path !== 'registry/growth-hypotheses.json' || !nonempty(corpus?.integration?.growth_hypotheses?.snapshot)) errors.push('Identify the existing Growth Hypotheses registry and reviewed snapshot.');
  if (corpus?.integration?.recommendations?.path !== 'registry/search-agent-recommendations.json' || !nonempty(corpus?.integration?.recommendations?.revision)) errors.push('Identify the existing recommendation registry and reviewed revision.');
  if (!nonempty(corpus?.integration?.scope)) errors.push('Explain the scope of the native routing references.');
  for (const tactic of Array.isArray(corpus?.tactics) ? corpus.tactics : []) {
    if (!strings(tactic?.growth_hypothesis_ids)) errors.push(`${tactic?.id}: growth_hypothesis_ids must contain native routing references.`);
    if (!Array.isArray(tactic?.recommendation_rule_ids)) errors.push(`${tactic?.id}: recommendation_rule_ids must be an array, empty when no current rule applies.`);
    for (const [field, allowed] of [['growth_hypothesis_ids', hypothesisIds], ['recommendation_rule_ids', ruleIds]]) {
      const refs = Array.isArray(tactic?.[field]) ? tactic[field] : [];
      if (new Set(refs).size !== refs.length) errors.push(`${tactic?.id}: duplicate ${field}.`);
      for (const id of refs) if (!allowed.has(id)) errors.push(`${tactic?.id}: unknown native ${field} reference ${id}.`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateCorpus(corpus) {
  const errors = [];
  if (!corpus || !nonempty(corpus.version) || !day(corpus.updated_at)) errors.push('Corpus needs version and a valid updated_at date.');
  const categories = corpus?.categories ?? [];
  const sources = corpus?.sources ?? [];
  const tactics = corpus?.tactics ?? [];
  for (const [label, rows] of Object.entries({ categories, sources, tactics })) {
    if (!Array.isArray(rows) || !rows.length) { errors.push(`${label} must be a nonempty array.`); continue; }
    const ids = new Set();
    for (const row of rows) {
      if (!row || !nonempty(row.id) || ids.has(row.id)) errors.push(`${label} has a missing or duplicate id.`);
      ids.add(row?.id);
    }
  }
  if (errors.length) return { valid: false, errors };
  const categoryIds = new Set(categories.map(row => row.id));
  const sourceIds = new Set(sources.map(row => row.id));
  for (const row of categories) if (!nonempty(row.title)) errors.push(`${row.id}: category title required.`);
  for (const row of sources) {
    if (!https(row.url) || !day(row.checked_at)) errors.push(`${row.id}: source needs HTTPS URL and valid checked_at.`);
    for (const field of ['title', 'publisher', 'authority', 'notes']) if (!nonempty(row[field])) errors.push(`${row.id}: ${field} required.`);
  }
  const titles = new Set();
  for (const row of tactics) {
    for (const field of ['title', 'problem', 'impact_hypothesis', 'anti_pattern', 'measurement']) if (!nonempty(row[field])) errors.push(`${row.id}: ${field} required.`);
    for (const field of ['implementation', 'verification', 'applicability', 'source_ids']) if (!strings(row[field])) errors.push(`${row.id}: ${field} needs nonempty strings.`);
    if (!categoryIds.has(row.category)) errors.push(`${row.id}: unknown category.`);
    if (!LEVELS.has(row.evidence_level)) errors.push(`${row.id}: unknown evidence level.`);
    if (!['small', 'medium', 'large'].includes(row.effort)) errors.push(`${row.id}: unknown effort.`);
    for (const id of Array.isArray(row.source_ids) ? row.source_ids : []) if (!sourceIds.has(id)) errors.push(`${row.id}: unknown source ${id}.`);
    const title = String(row.title).trim().toLowerCase();
    if (titles.has(title)) errors.push(`${row.id}: duplicate title.`);
    titles.add(title);
  }
  errors.push(...validateCorpusMappings(corpus).errors);
  return { valid: errors.length === 0, errors };
}

export function loadCorpus() {
  const corpus = JSON.parse(fs.readFileSync(CORPUS_URL, 'utf8'));
  const result = validateCorpus(corpus);
  if (!result.valid) throw new Error(`Invalid discoverability corpus: ${result.errors.join('; ')}`);
  return corpus;
}

export function searchTactics(corpus, { category, evidence, hypothesis, rule, search, limit = 20 } = {}) {
  if (category && !corpus.categories.some(row => row.id === category)) throw new Error(`Unknown category: ${category}`);
  if (evidence && !LEVELS.has(evidence)) throw new Error(`Unknown evidence level: ${evidence}`);
  const registries = loadDiscoverabilityRegistries();
  if (hypothesis && !registries.hypotheses.hypotheses.some(row => row.id === hypothesis)) throw new Error(`Unknown growth hypothesis: ${hypothesis}`);
  if (rule && !registries.recommendations.rules.some(row => row.id === rule)) throw new Error(`Unknown recommendation rule: ${rule}`);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('limit must be an integer from 1 to 500.');
  const words = String(search || '').toLowerCase().split(/\s+/).filter(Boolean);
  const matches = corpus.tactics.filter(row => {
    if (category && row.category !== category) return false;
    if (evidence && row.evidence_level !== evidence) return false;
    if (hypothesis && !row.growth_hypothesis_ids.includes(hypothesis)) return false;
    if (rule && !row.recommendation_rule_ids.includes(rule)) return false;
    const text = [row.id, row.title, row.problem, ...row.applicability, ...row.implementation].join(' ').toLowerCase();
    return words.every(word => text.includes(word));
  });
  const tactics = matches.slice(0, limit);
  const sourceIds = new Set(tactics.flatMap(row => row.source_ids));
  return {
    corpus_version: corpus.version, updated_at: corpus.updated_at,
    total: matches.length, returned: tactics.length, categories: corpus.categories, integration: corpus.integration,
    scope: 'Practice selection, not a ranking prediction. Documented support does not establish a ranking effect.',
    tactics, sources: corpus.sources.filter(row => sourceIds.has(row.id))
  };
}

export function createAdoptionPlan(config, corpus) {
  if (!config || !https(config.site_url)) throw new Error('site_url must be an absolute public HTTPS URL without credentials.');
  if (!nonempty(config.audience) || !nonempty(config.useful_action)) throw new Error('audience and useful_action are required.');
  if (!strings(config.tactic_ids) || config.tactic_ids.length > 25) throw new Error('Choose 1–25 explicit tactic_ids; a plan is a bounded experiment.');
  if (new Set(config.tactic_ids).size !== config.tactic_ids.length) throw new Error('tactic_ids must be unique.');
  const tactics = config.tactic_ids.map(id => {
    const tactic = corpus.tactics.find(row => row.id === id);
    if (!tactic) throw new Error(`Unknown tactic id: ${id}`);
    return tactic;
  });
  const pageUrls = config.page_urls ?? [];
  if (!Array.isArray(pageUrls) || pageUrls.some(url => !https(url))) throw new Error('page_urls must contain HTTPS URLs.');
  const base = new URL(config.site_url);
  const prefix = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`;
  for (const value of pageUrls) {
    const page = new URL(value);
    if (page.origin !== base.origin || (page.pathname !== base.pathname && !page.pathname.startsWith(prefix))) throw new Error(`Page is outside the site scope: ${value}`);
  }
  if (base.search || base.hash) throw new Error('site_url must not contain a query or fragment.');
  const ids = new Set(tactics.flatMap(t => t.source_ids));
  return {
    plan_version: '1.0', corpus_version: corpus.version,
    corpus_sha256: createHash('sha256').update(JSON.stringify(corpus)).digest('hex'),
    site_url: config.site_url, audience: config.audience, useful_action: config.useful_action,
    page_urls: pageUrls, stage: 'planned', deployed_at: null,
    scope: 'Owner-selected engineering and editorial experiments. No measured search or AI uplift is asserted.',
    growth_loop: {
      kind: 'practice-selection',
      hypothesis_ids: [...new Set(tactics.flatMap(tactic => tactic.growth_hypothesis_ids))],
      recommendation_rule_ids: [...new Set(tactics.flatMap(tactic => tactic.recommendation_rule_ids))],
      integration: structuredClone(corpus.integration),
      next_step: 'Run the existing arwp-growth site audit and carry applicable selections into its site adoption record. Native applicability, manual/runtime checks and owner-data gates still apply; this selection does not create verified site actions.'
    },
    baseline: { technical: 'not_measured', search: 'not_measured', ai_recommendations: 'not_measured', useful_actions: 'not_measured' },
    experiment: {
      comparison: 'Freeze query/page scope, language, device, geography and complete equal-length windows. Record rollout exposure before evaluating change.',
      interpretation: 'A before/after change is observational; control pages and deployment history help assess confounding.',
      decision: 'Retain, revise or revert on evidence. An unavailable measurement is not zero.'
    },
    tasks: tactics.map(tactic => ({ ...structuredClone(tactic), status: 'planned', evidence_receipts: [] })),
    sources: structuredClone(corpus.sources.filter(source => ids.has(source.id)))
  };
}

// Checks receipt consistency only. It cannot prove that a cited source supports a claim.
export function validateEditorialReceipt(receipt) {
  const errors = [];
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return { valid: false, errors: ['Receipt must be an object.'], scope: 'Receipt consistency only.' };
  if (!https(receipt.page_url)) errors.push('page_url needs an HTTPS canonical URL.');
  if (!day(receipt.reviewed_at)) errors.push('reviewed_at needs a valid date.');
  for (const field of ['audience', 'question', 'direct_answer', 'original_contribution', 'useful_action']) if (!nonempty(receipt[field])) errors.push(`${field} is required.`);
  if (!Array.isArray(receipt.claims)) errors.push('claims must be an array (empty when no external factual claims).');
  if (!Array.isArray(receipt.sources)) errors.push('sources must be an array.');
  if (errors.length) return { valid: false, errors, scope: 'Receipt consistency only; human source support and rendered-content review still required.' };
  const sources = new Map();
  for (const source of receipt.sources) {
    if (!source || !nonempty(source.id) || sources.has(source.id) || !https(source.url) || !day(source.checked_at) || !nonempty(source.support)) errors.push('Each source needs unique id, HTTPS URL, checked_at and precise support.');
    if (source) sources.set(source.id, source);
  }
  const claimIds = new Set();
  for (const claim of receipt.claims) {
    if (!claim || !nonempty(claim.id) || claimIds.has(claim.id) || !nonempty(claim.text) || !nonempty(claim.anchor) || !LEVELS.has(claim.evidence_level)) errors.push('Each claim needs a unique id, text, visible anchor and evidence_level.');
    claimIds.add(claim?.id);
    if (!strings(claim?.source_ids)) errors.push(`${claim?.id}: link factual claims to source_ids.`);
    for (const id of Array.isArray(claim?.source_ids) ? claim.source_ids : []) if (!sources.has(id)) errors.push(`${claim?.id}: unknown source ${id}.`);
  }
  if (receipt.comparison !== undefined) {
    const comparison = receipt.comparison;
    if (!comparison || !strings(comparison.criteria) || !nonempty(comparison.methodology) || !day(comparison.as_of)) errors.push('comparison needs criteria, methodology and as_of.');
    if (!Array.isArray(comparison?.products) || comparison.products.length < 2) errors.push('comparison needs at least two products.');
    for (const product of Array.isArray(comparison?.products) ? comparison.products : []) {
      if (!product || !nonempty(product.name) || !nonempty(product.best_for) || !nonempty(product.limitation) || !strings(product.source_ids)) errors.push('Every comparison product needs name, best_for, limitation and sources.');
      for (const id of Array.isArray(product?.source_ids) ? product.source_ids : []) if (!sources.has(id)) errors.push(`Comparison product references unknown source ${id}.`);
    }
  }
  return { valid: errors.length === 0, errors, scope: 'Receipt consistency only; verify each source supports the visible claim and markup matches rendered content.' };
}
