#!/usr/bin/env node

import assert from 'node:assert/strict';
import { buildPublicBenchmarkReport, sanitizePublicationUrl } from './publication-report.mjs';

assert.equal(
  sanitizePublicationUrl('https://user:pass@example.com/api?public=1&token=sekret&X-Amz-Signature=abc#fragment'),
  'https://example.com/api?public=1&token=%5BREDACTED%5D&X-Amz-Signature=%5BREDACTED%5D'
);

const raw = {
  benchmarkVersion: '0.2',
  generatedAt: '2026-08-26T00:00:00.000Z',
  corpus: '/home/runner/work/repo/benchmarks/corpus',
  evidencePolicy: 'reviewed',
  metricPolicy: 'resolver only',
  sitesSelected: 2,
  independentSites: 2,
  resolvedIndependentSites: 1,
  failedIndependentSites: 1,
  resolutionCoverage: 0.5,
  aggregate: { 'resolver-union': { correct: 4, total: 10, accuracy: 0.4 } },
  resolvedOnlyAggregate: { 'resolver-union': { correct: 4, total: 5, accuracy: 0.8 } },
  results: [
    {
      id: 'resolved',
      url: 'https://example.com/?token=sekret',
      ownership: 'independent',
      reviewedAt: '2026-08-26',
      evidence: [{ url: 'https://example.com/evidence?X-Amz-Signature=abc&public=1', note: 'public evidence' }],
      status: 'resolved',
      canonicalUrl: 'https://example.com/docs?session=abc123',
      resolverObservation: { sources: [{ issue: 'Bearer should-not-publish' }] },
      strategyResults: {
        'resolver-union': {
          intents: {
            read: {
              selected: {
                url: 'https://user:pass@example.com/content?api_key=secret&lang=en',
                protocol: 'HTML',
                kind: 'html',
                transport: null,
                sourceId: 'html-base',
                sourceAuthority: 'observed-web'
              },
              accepted: ['https://example.com/content?code=abc&lang=en'],
              correct: true,
              classification: 'correct-interface'
            }
          },
          correct: 1,
          total: 1,
          metrics: {
            resolverRequestsAfterScan: 2,
            resolverBytesAfterScan: 1200,
            networkScope: 'post-scan-resolver-discovery-only',
            durationMs: 50,
            durationScope: 'complete-resolveSite-call-including-bounded-base-scan',
            sourcesResolved: 1,
            sourcesAttempted: 2,
            conflicts: 0,
            authorization: 'Bearer should-not-publish'
          },
          metricScope: 'selection metric'
        }
      }
    },
    {
      id: 'failed',
      url: 'https://failed.example/',
      ownership: 'independent',
      reviewedAt: '2026-08-26',
      evidence: [],
      status: 'failed',
      error: 'request failed: https://failed.example/?token=secret'
    }
  ]
};

const published = buildPublicBenchmarkReport(raw);
assert.equal(published.corpus, 'benchmarks/corpus');
assert.equal(published.results.length, 2);
assert.equal(published.results[0].strategyResults['resolver-union'].metrics.authorization, undefined);
assert.equal(published.results[0].resolverObservation, undefined);
assert.equal(published.results[1].error, undefined);
assert.match(published.results[0].url, /token=%5BREDACTED%5D/);
assert.match(published.results[0].evidence[0].url, /public=1/);
assert.match(published.results[0].canonicalUrl, /session=%5BREDACTED%5D/);
assert.match(published.results[0].strategyResults['resolver-union'].intents.read.selected.url, /lang=en/);
assert.match(published.results[0].strategyResults['resolver-union'].intents.read.selected.url, /api_key=%5BREDACTED%5D/);
assert.match(published.results[0].strategyResults['resolver-union'].intents.read.accepted[0], /code=%5BREDACTED%5D/);
const serialized = JSON.stringify(published);
for (const secret of ['sekret', 'abc123', 'should-not-publish', 'user:pass', '/home/runner/work']) {
  assert.equal(serialized.includes(secret), false, `publication report leaked ${secret}`);
}

console.log('publication-report tests: ok');
