import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildIndexWorthinessReport, evaluateIndexWorthinessPage, formatIndexWorthinessReport } from '../lib/index-worthiness.mjs';

const registry = JSON.parse(fs.readFileSync('registry/index-worthiness-practices.json', 'utf8'));
const schema = JSON.parse(fs.readFileSync('schema/index-worthiness-review.schema.json', 'utf8'));
assert.equal(registry.version, '1.0');
assert.equal(registry.methodology.noCompositeScore, true);
assert.equal(registry.methodology.sitemapIsCuratedIndexCohort, true);
assert.equal(registry.methodology.githubPagesPathIdentityLimitExplicit, true);
assert.equal(registry.methodology.automaticNoindexMutationForbidden, true);
assert.equal(schema.properties.version.const, '1.0');
assert.ok(registry.gates.some(gate => gate.id === 'demand'));
assert.ok(registry.gates.some(gate => gate.id === 'uniqueValue'));
assert.ok(registry.gates.some(gate => gate.id === 'entityDepth'));

const pass = status => ({ status, evidence: status === 'pass' ? ['reviewed evidence'] : [] });
const completeGates = {
  demand: pass('pass'),
  uniqueValue: pass('pass'),
  standaloneUtility: pass('pass'),
  provenance: pass('pass'),
  connectivity: pass('pass'),
  canonicalIdentity: pass('pass'),
  freshnessIntegrity: pass('pass'),
  entityDepth: pass('pass')
};

const indexable = evaluateIndexWorthinessPage({
  url: 'https://example.com/entity/a/',
  generated: true,
  gates: completeGates
}, 'data-site');
assert.equal(indexable.state, 'index-candidate');
assert.equal(indexable.sitemapEligible, true);

const thin = evaluateIndexWorthinessPage({
  url: 'https://example.com/entity/b/',
  generated: true,
  gates: { ...completeGates, uniqueValue: pass('fail') }
}, 'data-site');
assert.equal(thin.state, 'exclude-from-search-candidate');
assert.equal(thin.sitemapEligible, false);
assert.ok(thin.signals.includes('generated-without-unique-value-pass'));

const uncertain = evaluateIndexWorthinessPage({
  url: 'https://example.com/entity/c/',
  gates: { ...completeGates, demand: pass('unknown') }
}, 'data-site');
assert.equal(uncertain.state, 'review');

const canonicalFailure = evaluateIndexWorthinessPage({
  url: 'https://example.com/entity/d/',
  gates: { ...completeGates, canonicalIdentity: pass('fail') }
}, 'data-site');
assert.equal(canonicalFailure.state, 'hold');

const report = buildIndexWorthinessReport({
  version: '1.0',
  site: 'https://example.com/',
  siteType: 'data-site',
  reviewedAt: '2026-09-11',
  pages: [
    { url: 'https://example.com/entity/a/', generated: true, gates: completeGates },
    { url: 'https://example.com/entity/b/', generated: true, gates: { ...completeGates, uniqueValue: pass('fail') } },
    { url: 'https://example.com/entity/c/', variantOf: 'https://example.com/entity/a/', gates: completeGates }
  ]
});

assert.equal(report.summary.pages, 3);
assert.equal(report.summary.sitemapEligiblePages, 2);
assert.equal(report.summary.states['exclude-from-search-candidate'], 1);
assert.equal(report.scaledContentSignals.generatedPages, 2);
assert.equal(report.scaledContentSignals.generatedWithoutUniqueValuePass, 1);
assert.equal(report.scaledContentSignals.variantPages, 1);
assert.equal(report.scaledContentSignals.variantIndexCandidates, 1);
assert.equal(report.guardrails.noCompositeScore, true);
assert.equal('score' in report, false);
assert.match(formatIndexWorthinessReport(report), /No composite SEO\/index-worthiness score/);

console.log('index-worthiness tests passed');
