import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  evaluateRegionalSearchSurfaces,
  listRegionalQueryTypes,
  loadRegionalSearchSurfaces,
  normalizeRegionalMarket,
  normalizeQueryType,
  validateRegionalSearchSurfaces
} from '../lib/regional-search-surfaces.mjs';

const registry = loadRegionalSearchSurfaces();
assert.equal(validateRegionalSearchSurfaces(registry).valid, true);
assert.equal(registry.reviewedAt, '2026-09-09');
assert.equal(registry.sourceLastUpdated, '2026-09-08');
assert.equal(registry.guardrails.regionalAvailabilityIsNotRankingFactor, true);
assert.equal(registry.guardrails.noUniversalRegionalScore, true);
assert.equal(registry.features.length, 9);
assert.equal(new Set(registry.features.map(item => item.id)).size, 9);

assert.equal(normalizeRegionalMarket('TR'), 'turkiye');
assert.equal(normalizeRegionalMarket('South Africa'), 'south-africa');
assert.equal(normalizeQueryType('local business'), 'local-businesses');
assert.equal(normalizeQueryType('car rental'), 'car-hire');
assert.ok(listRegionalQueryTypes(registry).includes('vacation-rentals'));

const eeaProduct = evaluateRegionalSearchSurfaces({ market: 'eea', queryTypes: ['products'] }, registry);
assert.equal(eeaProduct.valid, true);
assert.equal(eeaProduct.status, 'review');
assert.deepEqual(eeaProduct.matches.map(item => item.id), [
  'google-eea-aggregator-unit',
  'google-eea-supplier-unit',
  'google-eea-structured-data-carousel'
]);
assert.equal(eeaProduct.matches.find(item => item.id === 'google-eea-structured-data-carousel').requiresStructuredData, true);

const eeaAggregator = evaluateRegionalSearchSurfaces({ market: 'eea', queryTypes: 'products', roles: 'aggregator' }, registry);
assert.deepEqual(eeaAggregator.matches.map(item => item.id), [
  'google-eea-aggregator-unit',
  'google-eea-structured-data-carousel'
]);

const jobs = evaluateRegionalSearchSurfaces({ market: 'eea', queryTypes: 'jobs' }, registry);
assert.deepEqual(jobs.matches.map(item => item.id), ['google-eea-job-sites']);

const turkiye = evaluateRegionalSearchSurfaces({ market: 'turkey', queryTypes: 'hotel,local business' }, registry);
assert.deepEqual(turkiye.matches.map(item => item.id), [
  'google-turkiye-places-sites',
  'google-turkiye-structured-data-carousel'
]);

const southAfrica = evaluateRegionalSearchSurfaces({ market: 'za', queryTypes: 'car rental' }, registry);
assert.deepEqual(southAfrica.matches.map(item => item.id), [
  'google-south-africa-badge-refinement',
  'google-south-africa-structured-data-carousel'
]);

const other = evaluateRegionalSearchSurfaces({ market: 'other', queryTypes: 'products' }, registry);
assert.equal(other.status, 'not-applicable');
assert.equal(other.matches.length, 0);
assert.match(other.message, /does not mean ordinary Google Search/i);

const irrelevant = evaluateRegionalSearchSurfaces({ market: 'eea', queryTypes: 'voice-training' }, registry);
assert.equal(irrelevant.status, 'not-applicable');
assert.equal(irrelevant.matches.length, 0);

const invalid = evaluateRegionalSearchSurfaces({ market: 'mars', queryTypes: 'products' }, registry);
assert.equal(invalid.valid, false);
assert.match(invalid.errors[0], /Unknown market/);

const cli = fileURLToPath(new URL('../bin/arwp-regional-search.mjs', import.meta.url));
const checked = spawnSync(process.execPath, [cli, '--check', '--json'], { encoding: 'utf8' });
assert.equal(checked.status, 0, checked.stdout + checked.stderr);
assert.equal(JSON.parse(checked.stdout).valid, true);

const evaluated = spawnSync(process.execPath, [cli, '--market=eea', '--query=products', '--role=aggregator', '--json'], { encoding: 'utf8' });
assert.equal(evaluated.status, 0, evaluated.stdout + evaluated.stderr);
const evaluatedJson = JSON.parse(evaluated.stdout);
assert.equal(evaluatedJson.status, 'review');
assert.equal(evaluatedJson.matches.length, 2);
assert.equal('score' in evaluatedJson, false, 'regional Search review must not invent a score');

console.log('PASS regional Search surfaces remain provider-scoped, market/query/role bounded, source-backed and non-scoring');
