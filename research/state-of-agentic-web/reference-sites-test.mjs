import assert from 'node:assert/strict';
import { buildReferenceSummary, loadReferenceSites, validateReferenceSites } from './reference-sites.mjs';

const cohort = loadReferenceSites();
const validation = validateReferenceSites(cohort);
assert.equal(validation.valid, true, validation.errors.join('\n'));
assert.equal(cohort.aggregatePolicy.ownerControlled, true);
assert.equal(cohort.aggregatePolicy.includedInIndependentAggregate, false);
assert.equal(cohort.aggregatePolicy.comparisonOnly, true);
assert.equal(cohort.sites.length, 7);

const ptichi = cohort.sites.find(site => site.id === 'ptichi-fresh-site');
assert.ok(ptichi, 'Ptichi must be present in the owner reference cohort');
assert.equal(ptichi.canonicalUrl, 'https://ptichi.com/');
assert.equal(ptichi.repository, 'dkharlanau/ptichi-site');
assert.equal(ptichi.baselineClass, 'new-site');
assert.equal(ptichi.firstPublicEvidenceAt, '2026-09-05');

const summary = buildReferenceSummary(cohort);
assert.equal(summary.sites, 7);
assert.equal(summary.independentAggregateSites, 0);
assert.equal(summary.byBaselineClass['new-site'], 1);
assert.equal(summary.byBaselineClass['existing-site'], 6);
assert.deepEqual(summary.newSites.map(site => site.id), ['ptichi-fresh-site']);

const invalid = structuredClone(cohort);
invalid.sites[1].canonicalUrl = invalid.sites[0].canonicalUrl;
assert.equal(validateReferenceSites(invalid).valid, false, 'duplicate canonical URLs must fail');

const leaked = structuredClone(cohort);
leaked.aggregatePolicy.includedInIndependentAggregate = true;
assert.equal(validateReferenceSites(leaked).valid, false, 'owner references must never enter the independent aggregate');

console.log('PASS owner-controlled comparison cohort contains 7 sites, keeps Ptichi as the sole new-site baseline, and cannot enter the independent aggregate');
