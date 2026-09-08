import fs from 'node:fs';
import { createHash } from 'node:crypto';

export const CORPUS_URL = new URL('../knowledge/discoverability-corpus.json', import.meta.url);
const HYPOTHESES_URL = new URL('../registry/growth-hypotheses.json', import.meta.url);
const RECOMMENDATIONS_URL = new URL('../registry/search-agent-recommendations.json', import.meta.url);
const LEVELS = new Set(['documented', 'inferred', 'experimental']);
// An append-only, code-reviewed checksum anchor for published corpus bytes.
// A release file and its caller-supplied checksum cannot validate each other.
export const DISCOVERABILITY_RELEASES = Object.freeze({
  '1.7.0': 'f7f90f0814ac7bbd502595ae6fe07ac40963e81dc8f50a9bec8b2a68f48bb755',
  '1.6.0': '85d6c848282cf7434a6ae325de592208735b30688a4c1f56412eb11b15dc498c',
  '1.5.0': '8fff92c8669fb171a18bb22ad9597baf4e200f2c82656c5598670b5be073f47b',
  '1.4.0': 'f127fa37bdf1052c71000df0b197e7dc49d2d3353b1ca6edd0a7215b24ad6925',
  '1.3.0': 'f13051a3da5d7fd72c8be6857b480edf8e5e5bafada3dfb40f9510d164d8c205',
  '1.2.0': 'a0d59f486794686021b615069169d80f4f03c1a55a54ac5614298055fe6c8a82',
  '1.1.0': '88d4583c696c981a174270131bd0504aaf00909d32f9524920923aff04f9c641'
});
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const strings = value => Array.isArray(value) && value.length > 0 && value.every(nonempty);
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
function https(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const upstreamVersion = value => nonempty(value) && !/^(latest|current|unknown|unversioned|living|n\/a)$/i.test(value.trim());
const stableVersion = value => typeof value === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value) && value.split('.').every(part => Number.isSafeInteger(Number(part)));
const compareVersion = (a, b) => {
  const aa = a.split('.').map(Number), bb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (aa[i] !== bb[i]) return aa[i] > bb[i] ? 1 : -1;
  return 0;
};
const bumped = (before, after, minimum) => {
  if (!stableVersion(before) || !stableVersion(after) || compareVersion(after, before) <= 0) return false;
  const a = before.split('.').map(Number), b = after.split('.').map(Number);
  return b[0] > a[0] || (minimum !== 'major' && (b[1] > a[1] || (minimum === 'patch' && b[2] > a[2])));
};
const ordered = value => Array.isArray(value) ? value.map(ordered) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
const equal = (a, b) => JSON.stringify(ordered(a)) === JSON.stringify(ordered(b));
const without = (value, fields) => Object.fromEntries(Object.entries(value).filter(([key]) => !fields.includes(key)));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const legacyReview = () => ({ reviewed_at: null, scope: 'not-individually-reviewed', method: null });
const activeLifecycle = () => ({ status: 'active', replacement_ids: [], reason: null });

// Kept compatible with existing exported plans: hash compact JSON in stored key
// order, not file whitespace. Historical release hashes instead cover raw bytes.
export const corpusFingerprint = corpus => sha256(JSON.stringify(corpus));

export function validateReleaseBytes(bytes, descriptor) {
  const errors = [];
  if (!object(descriptor) || !stableVersion(descriptor.version) || descriptor.path !== `knowledge/releases/v${descriptor.version}.json`) errors.push('previous_release must identify a canonical knowledge/releases/vX.Y.Z.json snapshot.');
  const anchored = DISCOVERABILITY_RELEASES[descriptor?.version];
  if (!anchored || descriptor?.sha256 !== anchored) errors.push('previous_release checksum must match the immutable published release anchor.');
  if (sha256(bytes) !== anchored) errors.push('Historical release bytes do not match their immutable checksum.');
  let corpus;
  try { corpus = JSON.parse(String(bytes)); } catch { errors.push('Historical release is not valid JSON.'); }
  if (corpus?.version !== descriptor?.version) errors.push('Historical release version differs from its descriptor.');
  return { valid: errors.length === 0, errors, corpus };
}

export function loadPreviousDiscoverabilityRelease(descriptor) {
  // Validate path before opening a file: neither absolute paths nor traversal are accepted.
  if (!object(descriptor) || !stableVersion(descriptor.version) || descriptor.path !== `knowledge/releases/v${descriptor.version}.json`) throw new Error('Invalid previous_release path.');
  const versions = Object.keys(DISCOVERABILITY_RELEASES).sort(compareVersion);
  const latest = versions.at(-1);
  if (descriptor.version !== latest) throw new Error(`previous_release must identify the latest anchored release ${latest}, not skip later published history.`);
  const read = entry => {
    if (!object(entry) || !stableVersion(entry.version) || entry.path !== `knowledge/releases/v${entry.version}.json`) throw new Error('Invalid historical release path.');
    const bytes = fs.readFileSync(new URL(`../${entry.path}`, import.meta.url));
    const result = validateReleaseBytes(bytes, entry);
    if (!result.valid) throw new Error(result.errors.join('; '));
    const index = versions.indexOf(entry.version);
    if (index > 0) {
      if (result.corpus.previous_release?.version !== versions[index - 1]) throw new Error(`${entry.version}: historical chain must retain its immediate anchored predecessor ${versions[index - 1]}.`);
      read(result.corpus.previous_release);
    }
    return result.corpus;
  };
  return read(descriptor);
}

export function validateCorpusVersioning(corpus, previous) {
  const errors = [];
  if (!stableVersion(corpus?.version) || !stableVersion(previous?.version)) return { valid: false, errors: ['Corpus release versions must be stable SemVer X.Y.Z.'] };
  const oldTactics = new Map((previous.tactics ?? []).map(row => [row.id, row]));
  const current = new Map((corpus.tactics ?? []).map(row => [row.id, row]));
  const oldSources = new Map((previous.sources ?? []).map(row => [row.id, row]));
  const sources = new Map((corpus.sources ?? []).map(row => [row.id, row]));
  let corpusMinimum = 'patch';
  for (const [id, before] of oldTactics) {
    const after = current.get(id);
    if (!after) { errors.push(`${id}: preserve published stable IDs; retain a retired tombstone instead of deleting a pattern.`); continue; }
    const beforeVersion = before.pattern_version ?? '1.0.0';
    if (!stableVersion(after.pattern_version)) continue;
    const lifecycleChanged = !equal(before.lifecycle ?? activeLifecycle(), after.lifecycle);
    const operationalChanged = !equal(without(before, ['pattern_version', 'review', 'lifecycle']), without(after, ['pattern_version', 'review', 'lifecycle']));
    const sourceChanged = (before.source_ids ?? []).some(sourceId => {
      const oldSource = oldSources.get(sourceId), newSource = sources.get(sourceId);
      if (!oldSource || !newSource) return true;
      // First passport adoption adds an honest upstream declaration without
      // rewriting the old pattern. Later upstream changes do affect its support.
      const ignored = oldSource.upstream === undefined ? ['checked_at', 'upstream'] : ['checked_at'];
      return !equal(without(oldSource, ignored), without(newSource, ignored));
    });
    const reviewChanged = !equal(before.review ?? legacyReview(), after.review);
    const minimum = lifecycleChanged ? 'major' : operationalChanged || sourceChanged ? 'minor' : reviewChanged ? 'patch' : null;
    if (minimum && !bumped(beforeVersion, after.pattern_version, minimum)) errors.push(`${id}: ${minimum} pattern_version bump required for ${lifecycleChanged ? 'lifecycle' : operationalChanged || sourceChanged ? 'operational or supporting-source' : 'review metadata'} changes since ${beforeVersion}.`);
    if (compareVersion(after.pattern_version, beforeVersion) < 0) errors.push(`${id}: pattern_version must not go backwards.`);
    if (minimum === 'major') corpusMinimum = 'major';
    else if (minimum === 'minor' && corpusMinimum !== 'major') corpusMinimum = 'minor';
  }
  for (const [id, tactic] of current) if (!oldTactics.has(id)) {
    if (tactic.pattern_version !== '1.0.0') errors.push(`${id}: a newly published pattern starts at pattern_version 1.0.0.`);
    if (!day(tactic.review?.reviewed_at)) errors.push(`${id}: a newly published pattern needs a recorded individual source-support-and-implementation review.`);
    if (corpusMinimum !== 'major') corpusMinimum = 'minor';
  }
  for (const field of ['sources', 'categories']) {
    const ids = new Set((corpus[field] ?? []).map(row => row.id));
    for (const row of previous[field] ?? []) if (!ids.has(row.id)) errors.push(`${field}: preserve historical reference ${row.id}.`);
    if ((corpus[field] ?? []).length > (previous[field] ?? []).length && corpusMinimum !== 'major') corpusMinimum = 'minor';
  }
  if (!equal(corpus.integration, previous.integration) && corpusMinimum !== 'major') corpusMinimum = 'minor';
  if (!bumped(previous.version, corpus.version, corpusMinimum)) errors.push(`Corpus version requires a ${corpusMinimum} bump after release ${previous.version}.`);
  if (day(corpus.updated_at) && day(previous.updated_at) && corpus.updated_at < previous.updated_at) errors.push('Corpus updated_at must not precede the previous release.');
  return { valid: errors.length === 0, errors };
}

function validatePassports(corpus) {
  const errors = [], today = new Date().toISOString().slice(0, 10);
  if (!stableVersion(corpus.version)) errors.push('Corpus version must be stable SemVer X.Y.Z.');
  if (corpus.updated_at > today) errors.push('Corpus updated_at must not be in the future.');
  const tactics = new Map(corpus.tactics.map(row => [row.id, row]));
  for (const source of corpus.sources) {
    if (source.checked_at > today || source.checked_at > corpus.updated_at) errors.push(`${source.id}: checked_at cannot be in the future or after corpus updated_at.`);
    const upstream = source.upstream;
    if (!object(upstream) || !['living-document', 'versioned-release'].includes(upstream.kind) || (upstream.kind === 'living-document' ? upstream.version !== null : !upstreamVersion(upstream.version))) errors.push(`${source.id}: upstream needs living-document with null version, or versioned-release with its publisher-stated version.`);
  }
  for (const row of corpus.tactics) {
    if (!stableVersion(row.pattern_version)) errors.push(`${row.id}: pattern_version must be stable SemVer X.Y.Z.`);
    const review = row.review;
    if (!object(review)) errors.push(`${row.id}: review passport is required.`);
    else if (review.reviewed_at === null) {
      if (review.scope !== 'not-individually-reviewed' || review.method !== null) errors.push(`${row.id}: an unreviewed pattern has null date/method and not-individually-reviewed scope.`);
    } else if (!day(review.reviewed_at) || review.reviewed_at > today || review.reviewed_at > corpus.updated_at || review.scope !== 'source-support-and-implementation' || !['agent-assisted', 'human'].includes(review.method)) errors.push(`${row.id}: review requires an actual date, source-support-and-implementation scope, and agent-assisted or human method; it does not prove outcomes.`);
    if (object(review) && Object.hasOwn(review, 'support')) {
      if (review.reviewed_at === null || !Array.isArray(review.support) || review.support.length === 0) errors.push(`${row.id}: review.support needs a nonempty source trace on a recorded individual review.`);
      const seen = new Set();
      for (const support of Array.isArray(review.support) ? review.support : []) {
        const key = JSON.stringify([support?.source_id, support?.locator]);
        if (!object(support) || !Array.isArray(row.source_ids) || !row.source_ids.includes(support.source_id) || !corpus.sources.some(source => source.id === support.source_id) || !nonempty(support.locator) || !nonempty(support.note)) errors.push(`${row.id}: each review support trace needs a referenced source_id, locator and bounded support note.`);
        if (seen.has(key)) errors.push(`${row.id}: duplicate review support source and locator.`);
        seen.add(key);
      }
    }
    const lifecycle = row.lifecycle;
    if (!object(lifecycle) || !['active', 'deprecated', 'retired'].includes(lifecycle.status) || !Array.isArray(lifecycle.replacement_ids)) { errors.push(`${row.id}: lifecycle needs status and replacement_ids.`); continue; }
    if (lifecycle.status === 'active' ? lifecycle.reason !== null || lifecycle.replacement_ids.length !== 0 : !nonempty(lifecycle.reason)) errors.push(`${row.id}: active patterns have no retirement reason/replacements; inactive patterns need a reason.`);
    if (new Set(lifecycle.replacement_ids).size !== lifecycle.replacement_ids.length) errors.push(`${row.id}: duplicate replacement_ids.`);
    for (const id of lifecycle.replacement_ids) if (id === row.id || !tactics.has(id)) errors.push(`${row.id}: replacement must identify another existing pattern: ${id}.`);
  }
  const visit = (id, path = new Set()) => {
    if (path.has(id)) { errors.push(`${id}: lifecycle replacements contain a cycle.`); return; }
    const nextPath = new Set(path).add(id);
    const replacements = tactics.get(id)?.lifecycle?.replacement_ids;
    for (const next of Array.isArray(replacements) ? replacements : []) if (tactics.has(next)) visit(next, nextPath);
  };
  for (const id of tactics.keys()) visit(id);
  return errors;
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
  errors.push(...validatePassports(corpus));
  try {
    const previous = loadPreviousDiscoverabilityRelease(corpus.previous_release);
    errors.push(...validateCorpusVersioning(corpus, previous).errors);
  } catch (error) { errors.push(`Release history: ${error.message}`); }
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
    if (tactic.lifecycle?.status && tactic.lifecycle.status !== 'active') throw new Error(`Tactic ${id} is ${tactic.lifecycle.status}; review its lifecycle and replacement_ids before selecting another active pattern.`);
    return tactic;
  });
  if (Object.hasOwn(config, 'corpus_version') && (!stableVersion(config.corpus_version) || config.corpus_version !== corpus.version)) throw new Error(`Stale or invalid corpus_version pin; expected ${corpus.version}.`);
  const fingerprint = corpusFingerprint(corpus);
  if (Object.hasOwn(config, 'corpus_sha256') && (typeof config.corpus_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(config.corpus_sha256) || config.corpus_sha256 !== fingerprint)) throw new Error('Stale or invalid corpus_sha256 pin; review the current corpus before updating the pin.');
  if (Object.hasOwn(config, 'tactic_versions')) {
    if (!object(config.tactic_versions) || Object.keys(config.tactic_versions).length !== tactics.length || Object.keys(config.tactic_versions).some(id => !config.tactic_ids.includes(id))) throw new Error('tactic_versions must pin exactly the selected tactic_ids.');
    for (const tactic of tactics) if (!Object.hasOwn(config.tactic_versions, tactic.id) || !stableVersion(config.tactic_versions[tactic.id]) || config.tactic_versions[tactic.id] !== tactic.pattern_version) throw new Error(`Stale or invalid tactic_versions pin for ${tactic.id}; expected ${tactic.pattern_version}.`);
  }
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
    corpus_sha256: fingerprint,
    tactic_versions: Object.fromEntries(tactics.map(tactic => [tactic.id, tactic.pattern_version ?? '1.0.0'])),
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
