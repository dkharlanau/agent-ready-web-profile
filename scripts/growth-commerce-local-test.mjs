import assert from 'node:assert/strict';
import {
  analyzeVerticalEvidenceSiteExtended,
  allVerticalActions,
  verticalOwnerActions,
  applyVerticalOwnerDataEvidence,
  VERTICAL_OWNER_REQUIREMENTS
} from '../lib/growth-vertical-extended.mjs';
import { buildGrowthPlan } from '../lib/growth-plan-vertical.mjs';
import { buildSiteImprovementPlan } from '../lib/site-improvement-vertical.mjs';

const now = new Date('2026-09-07T10:00:00Z');

function ownerReceipt(site, records) {
  return {
    ok: true,
    url: `${site}ai/growth-owner-data.json`,
    text: JSON.stringify({
      version: '0.1',
      site,
      evidenceClass: 'owner-data',
      generatedAt: '2026-09-07T09:00:00Z',
      guardrails: {
        notIndependentEvidence: true,
        noRankingClaim: true,
        noCrossSurfaceInference: true,
        noProviderInference: true,
        sensitiveDataOmitted: true
      },
      records
    })
  };
}

function record({ actionId, provider, kind, value, observedAt = '2026-09-07T09:10:00Z' }) {
  return {
    actionId,
    evidenceType: 'owner-state',
    provider,
    kind,
    status: 'verified',
    observedAt,
    summary: 'Authenticated owner-side parity was reviewed.',
    scope: ['https://shop.example/'],
    evidence: ['https://support.google.com/merchants/answer/12157888'],
    value,
    sourceDigest: `sha256:${'b'.repeat(64)}`
  };
}

assert.equal(VERTICAL_OWNER_REQUIREMENTS['growth:vertical:commerce-feed-freshness'].provider, 'google-merchant-center');
assert.equal(VERTICAL_OWNER_REQUIREMENTS['growth:vertical:commerce-feed-freshness'].value, 'aligned');
assert.equal(VERTICAL_OWNER_REQUIREMENTS['growth:vertical:local-business-owner-profile'].provider, 'google-business-profile');
assert.equal(VERTICAL_OWNER_REQUIREMENTS['growth:vertical:local-business-owner-profile'].value, 'consistent');

const shop = 'https://shop.example/';
const commerceHtml = `<!doctype html><html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Widget","offers":{"@type":"Offer","price":"10.00","priceCurrency":"USD","availability":"https://schema.org/InStock"}}</script></head><body><h1>Widget</h1><a href="/shipping/">Shipping</a><a href="/returns/">Returns</a></body></html>`;
const ucpPayload = JSON.stringify({
  ucp: {
    version: '2026-01-11',
    services: {
      'dev.ucp.shopping': { version: '2026-01-11', spec: 'https://ucp.dev/specs/shopping' }
    },
    capabilities: [
      { name: 'dev.ucp.shopping.checkout', version: '2026-01-11' },
      { name: 'dev.ucp.shopping.fulfillment', version: '2026-01-11' }
    ]
  }
});
const commerce = await analyzeVerticalEvidenceSiteExtended(shop, {
  vertical: 'commerce',
  entryPage: { ok: true, url: shop, text: commerceHtml },
  sitemap: { ok: false, url: `${shop}sitemap.xml`, text: null, issue: 'fixture' },
  ucp: { ok: true, status: 200, url: 'https://shop.example/.well-known/ucp', text: ucpPayload }
});
assert.equal(commerce.registryVersion, '0.3');
assert.equal(commerce.checks.length, 4);
assert.equal(commerce.checks.find(item => item.id === 'commerce-feed-freshness').status, 'external-owner-data');
assert.equal(commerce.checks.find(item => item.id === 'commerce-ucp-discovery').status, 'observed');
assert.equal(commerce.ucpDiscovery.version, '2026-01-11');
assert.equal(commerce.ucpDiscovery.capabilities.length, 2);
const commerceOwnerActions = verticalOwnerActions(commerce);
assert.equal(commerceOwnerActions.length, 1);
assert.equal(commerceOwnerActions[0].id, 'growth:vertical:commerce-feed-freshness');
assert.equal(commerceOwnerActions[0].status, 'external-owner-data');
assert.equal(commerceOwnerActions[0].ownerDataCollection.requiredValue, 'aligned');
assert.equal(allVerticalActions(commerce).some(item => item.id === 'growth:vertical:commerce-ucp-discovery'), false, 'observed UCP must not create remediation');

const noUcp = await analyzeVerticalEvidenceSiteExtended(shop, {
  vertical: 'commerce',
  entryPage: { ok: true, url: shop, text: commerceHtml },
  sitemap: { ok: false, url: `${shop}sitemap.xml`, text: null, issue: 'fixture' },
  ucp: { ok: false, status: 404, url: 'https://shop.example/.well-known/ucp', text: null }
});
assert.equal(noUcp.checks.find(item => item.id === 'commerce-ucp-discovery').status, 'not-applicable-or-not-observed');
assert.equal(allVerticalActions(noUcp).some(item => item.id.includes('ucp')), false, 'UCP absence must not become a commerce requirement');

const malformedUcp = await analyzeVerticalEvidenceSiteExtended(shop, {
  vertical: 'commerce',
  entryPage: { ok: true, url: shop, text: commerceHtml },
  sitemap: { ok: false, url: `${shop}sitemap.xml`, text: null, issue: 'fixture' },
  ucp: { ok: true, status: 200, url: 'https://shop.example/.well-known/ucp', text: '{"ucp":{"version":"2026-01-11"}}' }
});
assert.equal(malformedUcp.checks.find(item => item.id === 'commerce-ucp-discovery').status, 'partial');
assert.equal(allVerticalActions(malformedUcp).some(item => item.id.includes('ucp')), false, 'malformed optional UCP evidence must not auto-create implementation work');

const commerceRecord = record({
  actionId: 'growth:vertical:commerce-feed-freshness',
  provider: 'google-merchant-center',
  kind: 'product-page-data-parity',
  value: 'aligned'
});
const resolvedCommerce = applyVerticalOwnerDataEvidence(commerceOwnerActions, ownerReceipt(shop, [commerceRecord]), { canonicalUrl: shop, now });
assert.equal(resolvedCommerce.actions.length, 0);
assert.deepEqual(resolvedCommerce.observation.matchedActionIds, ['growth:vertical:commerce-feed-freshness']);
assert.equal(resolvedCommerce.evidence[0].independentEvidence, false);
assert.equal(resolvedCommerce.evidence[0].crossSurfaceInference, false);
assert.equal(resolvedCommerce.evidence[0].rankingImpactClaimed, false);

const staleCommerce = { ...commerceRecord, observedAt: '2026-08-01T09:10:00Z' };
assert.equal(applyVerticalOwnerDataEvidence(commerceOwnerActions, ownerReceipt(shop, [staleCommerce]), { canonicalUrl: shop, now }).actions.length, 1, 'stale Merchant owner evidence must not close freshness work');
const mismatchCommerce = { ...commerceRecord, value: 'mismatch' };
assert.equal(applyVerticalOwnerDataEvidence(commerceOwnerActions, ownerReceipt(shop, [mismatchCommerce]), { canonicalUrl: shop, now }).actions.length, 1, 'verified mismatch is evidence but not completion of parity work');
const wrongProvider = { ...commerceRecord, provider: 'google-search-console' };
assert.equal(applyVerticalOwnerDataEvidence(commerceOwnerActions, ownerReceipt(shop, [wrongProvider]), { canonicalUrl: shop, now }).actions.length, 1, 'Search Console data must not masquerade as Merchant Center owner state');

const local = 'https://local.example/';
const localHtml = `<!doctype html><html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Example Cafe","address":{"@type":"PostalAddress","streetAddress":"1 Main St","addressLocality":"Example"},"telephone":"+1-555-0100","openingHours":"Mo-Fr 09:00-18:00"}</script></head><body><h1>Example Cafe</h1><a href="/location/">Location</a><img src="/cafe.jpg" alt="Example Cafe storefront"></body></html>`;
const localReport = await analyzeVerticalEvidenceSiteExtended(local, {
  vertical: 'local-business',
  entryPage: { ok: true, url: local, text: localHtml },
  sitemap: { ok: false, url: `${local}sitemap.xml`, text: null, issue: 'fixture' }
});
assert.equal(localReport.checks.find(item => item.id === 'local-business-identity').status, 'observed');
assert.equal(localReport.checks.find(item => item.id === 'local-business-owner-profile').status, 'external-owner-data');
const localOwnerActions = verticalOwnerActions(localReport);
assert.equal(localOwnerActions.length, 1);
assert.equal(localOwnerActions[0].ownerDataCollection.provider, 'google-business-profile');

const localRecord = {
  actionId: 'growth:vertical:local-business-owner-profile',
  evidenceType: 'owner-state',
  provider: 'google-business-profile',
  kind: 'profile-site-parity',
  status: 'verified',
  observedAt: '2026-09-07T09:15:00Z',
  summary: 'Business Profile name, address/service area, hours and category were checked against the real business and site.',
  scope: [local],
  evidence: ['https://support.google.com/business/answer/3038177'],
  value: 'consistent',
  sourceDigest: `sha256:${'c'.repeat(64)}`
};
const localResolved = applyVerticalOwnerDataEvidence(localOwnerActions, ownerReceipt(local, [localRecord]), { canonicalUrl: local, now });
assert.equal(localResolved.actions.length, 0);
assert.deepEqual(localResolved.observation.matchedActionIds, ['growth:vertical:local-business-owner-profile']);

const baseGrowth = {
  profile: '2026-09-06', canonicalUrl: shop, summary: { totalActions: 0, byPriority: {}, byLane: {} }, observations: {}, actions: [], refinements: {}, ownerDataEvidence: [], note: 'No guarantee.'
};
const builtCommerce = await buildGrowthPlan(shop, {
  vertical: 'commerce',
  now,
  baseBuildImpl: async () => structuredClone(baseGrowth),
  entryPage: { ok: true, url: shop, text: commerceHtml },
  sitemap: { ok: false, url: `${shop}sitemap.xml`, text: null, issue: 'fixture' },
  ucp: { ok: false, status: 404, url: 'https://shop.example/.well-known/ucp', text: null },
  ownerData: ownerReceipt(shop, [commerceRecord])
});
assert.equal(builtCommerce.actions.some(item => item.id === 'growth:vertical:commerce-feed-freshness'), false, 'valid Merchant owner receipt must resolve the commerce owner gate');
assert.equal(builtCommerce.refinements.verticalOwnerDataReceiptsApplied, 1);
assert.deepEqual(builtCommerce.observations.verticalOwnerData.matchedActionIds, ['growth:vertical:commerce-feed-freshness']);

function baseImprovement(site, kind) {
  return {
    $schema: 'https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/site-improvement-plan.schema.json',
    version: '0.1', generatedAt: '2026-09-07T09:20:00.000Z', site,
    scope: 'bounded-prioritized-improvement-plan-not-ranking-score',
    summary: { candidates: 0, selected: 0, suppressed: 0, byPriority: {}, byLane: {} },
    actions: [], sourceSummary: { growthActions: 0, pageGraphActions: 0, searchSurfaceActions: 0 },
    searchSurface: { siteKind: { kind }, surfacesObserved: ['home'], actions: 0, guardrails: {} },
    prioritization: { method: 'priority-then-evidence-then-actionability-with-lane-diversity-across-growth-entities-pages-and-search-surfaces', universalNumericScore: false, priorityOrder: ['P0','P1','P2','P3'], evidenceOrder: ['grounded-first-party','direct-observation','source-backed','manual-review','advisory'], maxActions: 25 },
    guardrails: { noRankingPromise: true, noUniversalReadinessScore: true, noAutomaticRepositoryMutation: true, noInventedFacts: true, measurementDoesNotProveCausality: true }
  };
}
const improveCommerce = await buildSiteImprovementPlan(shop, {
  siteKind: 'ecommerce',
  maxActions: 8,
  now,
  baseBuildImpl: async () => baseImprovement(shop, 'ecommerce'),
  entryPage: { ok: true, url: shop, text: commerceHtml },
  sitemap: { ok: false, url: `${shop}sitemap.xml`, text: null, issue: 'fixture' },
  ucp: { ok: false, status: 404, url: 'https://shop.example/.well-known/ucp', text: null },
  ownerData: { ok: false, url: `${shop}ai/growth-owner-data.json`, text: null, issue: 'not published' }
});
const ownerCandidate = improveCommerce.actions.find(item => item.id === 'vertical:growth:vertical:commerce-feed-freshness');
assert(ownerCandidate, 'unresolved commerce owner gate should appear in the unified backlog');
assert.equal(ownerCandidate.evidenceClass, 'manual-review');
assert.equal(ownerCandidate.proposal, null);
assert.ok(ownerCandidate.dependencies.includes('authenticated-owner-evidence-required'));
assert.equal(improveCommerce.guardrails.ucpDiscoveryNeverInvokesCommerceCapabilities, true);

console.log('PASS commerce/local vertical adapters preserve public-vs-owner evidence boundaries, treat UCP as optional discovery-only interoperability, and resolve Merchant/Business Profile gates only with fresh provider-scoped aligned owner evidence');
