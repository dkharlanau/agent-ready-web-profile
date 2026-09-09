import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'schema', 'winner-observation.schema.json');

export function loadWinnerObservationSchema() {
  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
}

export function createWinnerObservationValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(loadWinnerObservationSchema());
}

function normalizeUrl(value) {
  const url = new URL(value);
  url.hash = '';
  return url.toString();
}

function pairKey(queryId, url) {
  return `${queryId}\u0000${normalizeUrl(url)}`;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

export function validateWinnerObservation(snapshot) {
  const validate = createWinnerObservationValidator();
  const schemaValid = Boolean(validate(snapshot));
  const semanticErrors = [];
  const warnings = [];

  const queryIds = new Set();
  for (const query of snapshot?.queries || []) {
    if (queryIds.has(query.id)) semanticErrors.push(`Duplicate query id: ${query.id}`);
    queryIds.add(query.id);

    const urls = new Set();
    const ranks = new Set();
    for (const result of query.results || []) {
      let normalized = result.url;
      try {
        normalized = normalizeUrl(result.url);
      } catch {
        semanticErrors.push(`Invalid result URL in ${query.id}: ${result.url}`);
      }
      if (urls.has(normalized)) semanticErrors.push(`Duplicate result URL in ${query.id}: ${normalized}`);
      urls.add(normalized);
      if (Number.isInteger(result.rank)) {
        if (ranks.has(result.rank)) semanticErrors.push(`Duplicate rank ${result.rank} in ${query.id}`);
        ranks.add(result.rank);
      }
      if (result.paidAcquisitionStatus === 'none-observed') {
        warnings.push(`paidAcquisitionStatus=none-observed for ${normalized} is observational only; it does not prove zero paid acquisition.`);
      }
    }
  }

  return {
    valid: schemaValid && semanticErrors.length === 0,
    errors: validate.errors ?? [],
    semanticErrors,
    warnings
  };
}

function indexedPairs(snapshot, predicate = () => true) {
  const map = new Map();
  for (const query of snapshot.queries || []) {
    for (const result of query.results || []) {
      if (!predicate(result)) continue;
      map.set(pairKey(query.id, result.url), {
        queryId: query.id,
        queryText: query.text,
        url: normalizeUrl(result.url),
        rank: result.rank ?? null,
        citationState: result.citationState,
        mentionState: result.mentionState,
        role: result.role ?? 'unclassified',
        paidAcquisitionStatus: result.paidAcquisitionStatus
      });
    }
  }
  return map;
}

export function summarizeWinnerObservation(snapshot) {
  const validation = validateWinnerObservation(snapshot);
  if (!validation.valid) throw new Error(`Invalid Winner Observatory snapshot: ${[...validation.semanticErrors, ...validation.errors.map(error => error.message)].join('; ')}`);

  const pairs = indexedPairs(snapshot);
  const cited = indexedPairs(snapshot, result => result.citationState === 'observed');
  const mentioned = indexedPairs(snapshot, result => result.mentionState === 'observed');
  const ranked = indexedPairs(snapshot, result => Number.isInteger(result.rank));
  const domains = new Set([...pairs.values()].map(item => new URL(item.url).hostname.toLowerCase()));

  return {
    version: snapshot.version,
    cohortId: snapshot.cohortId,
    observedAt: snapshot.observedAt,
    surface: snapshot.surface,
    locale: snapshot.locale,
    queryCount: snapshot.queries.length,
    observedPairCount: pairs.size,
    rankedPairCount: ranked.size,
    citedPairCount: cited.size,
    mentionedPairCount: mentioned.size,
    uniqueDomainCount: domains.size,
    warnings: validation.warnings
  };
}

function assertComparable(before, after) {
  for (const snapshot of [before, after]) {
    const validation = validateWinnerObservation(snapshot);
    if (!validation.valid) throw new Error('Winner Observatory diff requires valid snapshots.');
  }
  if (before.cohortId !== after.cohortId) throw new Error('Snapshots have different cohortId values.');
  if (before.surface !== after.surface) throw new Error('Snapshots have different surfaces.');
  if (before.locale !== after.locale) throw new Error('Snapshots have different locales.');
  if (new Date(before.observedAt).getTime() >= new Date(after.observedAt).getTime()) {
    throw new Error('Before snapshot must be older than after snapshot.');
  }

  const beforeQueries = new Map(before.queries.map(query => [query.id, query.text]));
  const afterQueries = new Map(after.queries.map(query => [query.id, query.text]));
  const missingAfter = [...beforeQueries.keys()].filter(id => !afterQueries.has(id));
  const addedAfter = [...afterQueries.keys()].filter(id => !beforeQueries.has(id));
  if (missingAfter.length || addedAfter.length) {
    throw new Error(`Query cohort changed. Missing after: ${missingAfter.join(', ') || 'none'}; added after: ${addedAfter.join(', ') || 'none'}.`);
  }
  for (const [id, text] of beforeQueries) {
    if (afterQueries.get(id) !== text) throw new Error(`Query text changed for ${id}; use a new cohortId for a changed cohort.`);
  }
}

function diffMaps(beforeMap, afterMap) {
  const persisted = [];
  const entrants = [];
  const drops = [];

  for (const [key, item] of beforeMap) {
    if (afterMap.has(key)) persisted.push({ before: item, after: afterMap.get(key) });
    else drops.push(item);
  }
  for (const [key, item] of afterMap) {
    if (!beforeMap.has(key)) entrants.push(item);
  }
  return { persisted, entrants, drops };
}

export function diffWinnerObservations(before, after) {
  assertComparable(before, after);

  const allBefore = indexedPairs(before);
  const allAfter = indexedPairs(after);
  const all = diffMaps(allBefore, allAfter);

  const citedBefore = indexedPairs(before, result => result.citationState === 'observed');
  const citedAfter = indexedPairs(after, result => result.citationState === 'observed');
  const citations = diffMaps(citedBefore, citedAfter);

  const top10Before = indexedPairs(before, result => Number.isInteger(result.rank) && result.rank <= 10);
  const top10After = indexedPairs(after, result => Number.isInteger(result.rank) && result.rank <= 10);
  const top10 = diffMaps(top10Before, top10After);

  const rankMovements = all.persisted
    .filter(item => Number.isInteger(item.before.rank) && Number.isInteger(item.after.rank))
    .map(item => ({
      queryId: item.before.queryId,
      url: item.before.url,
      beforeRank: item.before.rank,
      afterRank: item.after.rank,
      delta: item.before.rank - item.after.rank
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    version: '0.1',
    cohortId: before.cohortId,
    surface: before.surface,
    locale: before.locale,
    beforeObservedAt: before.observedAt,
    afterObservedAt: after.observedAt,
    queryCount: before.queries.length,
    resultPersistence: {
      beforePairs: allBefore.size,
      persistedPairs: all.persisted.length,
      persistenceRate: rate(all.persisted.length, allBefore.size),
      entrants: all.entrants,
      drops: all.drops
    },
    citationPersistence: {
      beforeCitations: citedBefore.size,
      persistedCitations: citations.persisted.length,
      persistenceRate: rate(citations.persisted.length, citedBefore.size),
      newCitations: citations.entrants,
      lostCitations: citations.drops
    },
    top10Persistence: {
      beforeTop10Pairs: top10Before.size,
      persistedTop10Pairs: top10.persisted.length,
      persistenceRate: rate(top10.persisted.length, top10Before.size),
      entrants: top10.entrants,
      drops: top10.drops
    },
    rankMovements,
    interpretation: 'Entrants, drops and persistence are dated observations for a fixed cohort. They do not identify ranking factors, causality, or paid-acquisition absence.'
  };
}

export function formatWinnerSummary(summary) {
  return [
    `Goose Winner Observatory ${summary.version}`,
    `Cohort: ${summary.cohortId}`,
    `Observed: ${summary.observedAt}`,
    `Surface: ${summary.surface} (${summary.locale})`,
    `Queries: ${summary.queryCount}`,
    `Observed query/URL pairs: ${summary.observedPairCount}`,
    `Ranked: ${summary.rankedPairCount} · cited: ${summary.citedPairCount} · mentioned: ${summary.mentionedPairCount}`,
    `Unique domains: ${summary.uniqueDomainCount}`
  ].join('\n');
}

function percent(value) {
  return value == null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

export function formatWinnerDiff(diff) {
  return [
    `Goose Winner Observatory diff ${diff.version}`,
    `Cohort: ${diff.cohortId}`,
    `${diff.beforeObservedAt} -> ${diff.afterObservedAt}`,
    `Result persistence: ${percent(diff.resultPersistence.persistenceRate)} (${diff.resultPersistence.persistedPairs}/${diff.resultPersistence.beforePairs})`,
    `Result entrants/drops: ${diff.resultPersistence.entrants.length}/${diff.resultPersistence.drops.length}`,
    `Citation persistence: ${percent(diff.citationPersistence.persistenceRate)} (${diff.citationPersistence.persistedCitations}/${diff.citationPersistence.beforeCitations})`,
    `New/lost citations: ${diff.citationPersistence.newCitations.length}/${diff.citationPersistence.lostCitations.length}`,
    `Top-10 persistence: ${percent(diff.top10Persistence.persistenceRate)} (${diff.top10Persistence.persistedTop10Pairs}/${diff.top10Persistence.beforeTop10Pairs})`
  ].join('\n');
}
