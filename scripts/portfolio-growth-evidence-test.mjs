import assert from 'node:assert/strict';
import { createPortfolioGrowthRun, diffPortfolioGrowthRuns, portfolioRunId, validatePortfolioGrowthRun } from '../lib/portfolio-growth-evidence.mjs';

const portfolio = {
  $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/portfolio-sites.schema.json',
  version: '0.1',
  updatedAt: '2026-09-06',
  description: 'fixture',
  guardrails: {
    ownerControlledEvidence: true,
    watchIsNotDefaultRollout: true,
    siteAuditRequiredBeforeMutation: true,
    noProductionMutation: true,
    noRankingInference: true
  },
  sites: [
    {
      id: 'site-a', name: 'Site A', canonicalUrl: 'https://a.example/', repository: 'acme/a',
      verticals: ['software-product'], goals: ['search'], rollout: { enabled: true, mode: 'managed-issue' }
    },
    {
      id: 'site-b', name: 'Site B', canonicalUrl: 'https://b.example/', repository: 'acme/b',
      verticals: ['editorial'], goals: ['search'], rollout: { enabled: true, mode: 'proposal-only' }
    },
    {
      id: 'site-disabled', name: 'Disabled', canonicalUrl: 'https://disabled.example/', repository: 'acme/disabled',
      verticals: ['general'], goals: ['search'], rollout: { enabled: false, mode: 'proposal-only' }
    }
  ]
};

function plan(url, vertical, version = 1) {
  const actions = version === 1
    ? [
        { id: 'growth:a', priority: 'P1', lane: 'identity', status: 'recommended', title: 'Fix identity', reason: 'fixture' },
        { id: 'growth:b', priority: 'P2', lane: 'freshness', status: 'recommended', title: 'Improve freshness', reason: 'fixture' }
      ]
    : [
        { id: 'growth:b', priority: 'P2', lane: 'freshness', status: 'recommended', title: 'Improve freshness', reason: 'fixture' }
      ];
  return {
    profile: '2026-09-07',
    canonicalUrl: url,
    actions,
    observations: {
      entity: { present: version > 1, sameAs: 1, types: ['organization'] },
      localSitemap: { ok: true, validLastmodCount: 3 },
      contentSignal: { observed: false, values: {} },
      article: { count: vertical === 'editorial' ? 2 : 0, missingAuthor: 0, missingDateModified: 0 },
      media: { images: 2, videos: 0, openGraphImage: true },
      verticalEvidence: { coverage: 'bounded-relevant-surface-public-evidence', pagesObserved: 3, summary: { observed: 2, partial: 1 } },
      ownerData: { observed: false, valid: false, recordCount: 0 }
    }
  };
}

assert.equal(portfolioRunId('2026-09-07T10:11:12.345Z'), '20260907T101112Z');

let calls = 0;
const first = await createPortfolioGrowthRun(portfolio, {
  observedAt: '2026-09-07T10:00:00Z',
  concurrency: 2,
  buildGrowthImpl: async (url, options) => {
    calls += 1;
    if (url === 'https://b.example/') throw new Error('fixture site unavailable');
    return plan(url, options.vertical, 1);
  }
});
assert.equal(calls, 2, 'disabled sites must not be captured');
assert.equal(first.runId, '20260907T100000Z');
assert.equal(first.evidenceClass, 'owner-controlled-public-observation');
assert.deepEqual(first.summary, { enabledSites: 2, captured: 1, unavailable: 1, awaitingOwnerMeasurement: 2 });
assert.equal(first.sites.find(site => site.siteId === 'site-a').vertical, 'software-product');
assert.equal(first.sites.find(site => site.siteId === 'site-a').measurementState, 'awaiting-owner-measurement');
assert.equal(first.sites.find(site => site.siteId === 'site-a').snapshot.debt.p1, 1);
assert.equal(first.sites.find(site => site.siteId === 'site-a').verticalEvidence.pagesObserved, 3);
assert.equal(first.sites.find(site => site.siteId === 'site-b').status, 'unavailable');
assert.match(first.sites.find(site => site.siteId === 'site-b').error, /fixture site unavailable/);
assert.equal(first.guardrails.noMissingMetricZeros, true);
assert.equal(first.guardrails.noIndependentAdoptionInference, true);
assert.equal(validatePortfolioGrowthRun(first).valid, true);

const second = await createPortfolioGrowthRun(portfolio, {
  observedAt: '2026-09-14T10:00:00Z',
  buildGrowthImpl: async (url, options) => plan(url, options.vertical, 2)
});
assert.deepEqual(second.summary, { enabledSites: 2, captured: 2, unavailable: 0, awaitingOwnerMeasurement: 2 });
const diff = diffPortfolioGrowthRuns(first, second);
assert.equal(diff.summary.sites, 2);
assert.equal(diff.summary.comparable, 1, 'only sites captured in both runs are implementation-state comparable');
assert.equal(diff.summary.implementationDebtImproved, 1);
assert.equal(diff.summary.awaitingOwnerMeasurement, 2);
const siteA = diff.sites.find(site => site.siteId === 'site-a');
assert.equal(siteA.comparisonState, 'comparable-public-implementation-state');
assert.equal(siteA.growthDiff.summary.highPriorityDebtDelta, -1);
assert.equal(siteA.growthDiff.interpretation.implementationStateImproved, true);
const siteB = diff.sites.find(site => site.siteId === 'site-b');
assert.equal(siteB.comparisonState, 'unavailable-to-captured');
assert.equal(siteB.growthDiff, null);
assert.equal(diff.interpretation.ownerOutcomeEvidenceIncluded, false);
assert.match(diff.interpretation.note, /does not establish Search ranking/i);

const invalid = structuredClone(first);
invalid.guardrails.noMissingMetricZeros = false;
assert.equal(validatePortfolioGrowthRun(invalid).valid, false, 'run schema must forbid synthetic missing-metric zeros');

console.log('PASS portfolio longitudinal Growth evidence preserves owner-controlled public observations, unavailable sites, immutable implementation snapshots, comparable diffs and explicit awaiting-owner-measurement state without fabricated outcome metrics');
