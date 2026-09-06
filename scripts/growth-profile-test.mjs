import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGrowthPlanFromObservations, loadGrowthRegistry, parseContentSignal } from '../lib/growth-profile.mjs';
import { inferHostingContext, parseOwnerReviewReceipt, refineGrowthPlan } from '../lib/growth-plan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = loadGrowthRegistry();
assert.equal(registry.profile, '2026-09-06');
assert.equal(registry.guardrails.noRankingPromise, true);
assert.equal(registry.guardrails.noAiRecommendationPromise, true);
assert.equal(registry.guardrails.noUniversalQualityScore, true);
assert.ok(registry.opportunities.length >= 12);
assert.equal(new Set(registry.opportunities.map(item => item.id)).size, registry.opportunities.length);
for (const item of registry.opportunities) {
  assert.match(item.source, /^https:\/\//);
  assert.equal(item.sourceReviewedAt, '2026-09-06');
}

const policy = parseContentSignal('User-agent: *\nContent-Signal: search=yes, ai-input=yes, ai-train=no, use=reference\n');
assert.equal(policy.observed, true);
assert.equal(policy.values.search, 'yes');
assert.equal(policy.values['ai-input'], 'yes');
assert.equal(policy.values['ai-train'], 'no');
assert.equal(policy.values.use, 'reference');
assert.equal(parseContentSignal('User-agent: *\nAllow: /').observed, false);

const audit = {
  canonicalUrl: 'https://example.com/',
  checks: [
    { id: 'google-search-technical-eligibility', title: 'Search eligibility', layer: 'search', priority: 'required', status: 'pass', source: 'https://example.com/source', message: 'ok' },
    { id: 'openai-oai-searchbot-access', title: 'OAI Search access', layer: 'ai-search', priority: 'required-when-targeted', status: 'warn', source: 'https://example.com/source', message: 'robots could not be fully assessed', evidence: ['https://example.com/robots.txt'] },
    { id: 'google-read-more-deep-links', title: 'Deep links', layer: 'citation', priority: 'recommended', status: 'warn', source: 'https://example.com/source', message: 'no stable heading IDs observed' }
  ]
};

const homepage = {
  url: 'https://example.com/',
  text: `<!doctype html><html><head>
  <script type="application/ld+json">{
    "@context":"https://schema.org",
    "@graph":[
      {"@type":"Organization","@id":"https://example.com/#organization","name":"Example","url":"https://example.com/","logo":"https://example.com/logo.png"},
      {"@type":"Article","headline":"Example article","author":{"@type":"Person","name":"Ada"},"datePublished":"2026-09-01"},
      {"@type":"FAQPage","mainEntity":[]}
    ]
  }</script>
  </head><body><h1>Example</h1></body></html>`
};
const robots = { text: 'User-agent: *\nContent-Signal: search=yes, ai-input=yes, ai-train=no, use=reference\nAllow: /\n' };

const plan = buildGrowthPlanFromObservations({ audit, homepage, robots, registry });
assert.equal(plan.growthProfileVersion, '0.1');
assert.equal(plan.profile, '2026-09-06');
assert.equal(plan.canonicalUrl, 'https://example.com/');
assert.equal(plan.guardrails.noRankingPromise, true);
assert.equal(plan.observations.contentSignal.values['ai-train'], 'no');
assert.equal(plan.observations.entity.present, true);
assert.equal(plan.observations.entity.sameAs, 0);
assert.equal(plan.observations.article.count, 1);
assert.equal(plan.observations.article.missingAuthor, 0);
assert.equal(plan.observations.article.missingAuthorIdentity, 1);
assert.equal(plan.observations.article.missingDateModified, 1);
assert.equal(plan.observations.faq.faqPage, true);
assert.equal(plan.observations.media.images, 0);

const ids = new Set(plan.actions.map(item => item.id));
assert.ok(ids.has('audit:openai-oai-searchbot-access'));
assert.ok(ids.has('audit:google-read-more-deep-links'));
assert.ok(ids.has('growth:entity-sameas'));
assert.ok(ids.has('growth:article-authorship'));
assert.ok(ids.has('growth:article-dates'));
assert.ok(ids.has('growth:multiformat'));
assert.ok(ids.has('growth:faq-deprecation'));
assert.ok(ids.has('growth:non-commodity-review'));
assert.ok(ids.has('growth:site-reputation-policy'));
assert.ok(ids.has('growth:google-generative-ai-measurement-global'));
assert.ok(ids.has('growth:bing-ai-citation-measurement'));
assert.ok(ids.has('growth:google-platform-properties'));
assert.ok(ids.has('growth:preferred-source-acquisition'));
assert.equal(ids.has('growth:cloudflare-content-signals'), false, 'compatible permissive Content-Signal should not create a remediation action');
assert.equal(plan.actions[0].priority, 'P1');
assert.match(plan.note, /does not predict or guarantee ranking, citation, recommendation/i);

const minimal = buildGrowthPlanFromObservations({
  audit: { canonicalUrl: 'https://minimal.example/', checks: [] },
  homepage: { url: 'https://minimal.example/', text: '<html><head></head><body><h1>Hello</h1></body></html>' },
  robots: { text: 'User-agent: *\nAllow: /\n' },
  registry
});
const minimalIds = new Set(minimal.actions.map(item => item.id));
assert.ok(minimalIds.has('growth:cloudflare-content-signals'), 'base observation layer may surface provider-specific candidates before refinement');
assert.ok(minimalIds.has('growth:entity-identity'));
const contentAction = minimal.actions.find(item => item.id === 'growth:cloudflare-content-signals');
assert.match(contentAction.implementation.suggestedPolicy, /search=yes, ai-input=yes, ai-train=no, use=reference/);
assert.match(contentAction.implementation.note, /not a Google ranking signal/i);
assert.match(minimal.actions.find(item => item.id === 'growth:preferred-source-acquisition').implementation.url, /preferences\/source\?q=minimal\.example/);

assert.equal(inferHostingContext('https://cognitive-biases.github.io/').provider, 'github-pages');
assert.equal(inferHostingContext('https://example.pages.dev/').provider, 'cloudflare');
assert.equal(inferHostingContext('https://example.netlify.app/').provider, 'netlify');
assert.equal(inferHostingContext('https://example.vercel.app/').provider, 'vercel');
assert.equal(inferHostingContext('https://example.com/').provider, 'unknown');

const refinedUnknown = refineGrowthPlan(minimal);
assert.equal(refinedUnknown.actions.some(item => item.id === 'growth:cloudflare-content-signals'), false, 'unknown hosting must not receive an unsupported Cloudflare recommendation');
assert.equal(refinedUnknown.observations.hosting.provider, 'unknown');
assert.equal(refinedUnknown.refinements.providerSpecificActionsScoped, true);

const githubBase = structuredClone(minimal);
githubBase.canonicalUrl = 'https://cognitive-biases.github.io/';
const refinedGithub = refineGrowthPlan(githubBase);
assert.equal(refinedGithub.observations.hosting.provider, 'github-pages');
assert.equal(refinedGithub.actions.some(item => item.id === 'growth:cloudflare-content-signals'), false, 'direct GitHub Pages origins must not receive Cloudflare-only remediation');

const cloudflareBase = structuredClone(minimal);
cloudflareBase.canonicalUrl = 'https://example.pages.dev/';
const refinedCloudflare = refineGrowthPlan(cloudflareBase);
assert.equal(refinedCloudflare.observations.hosting.provider, 'cloudflare');
assert.equal(refinedCloudflare.actions.some(item => item.id === 'growth:cloudflare-content-signals'), true, 'Cloudflare Pages origins may receive the provider-specific Content-Signal opportunity');

const ownerReceiptPayload = {
  version: '0.1',
  site: 'https://minimal.example/',
  evidenceClass: 'owner-controlled',
  guardrails: {
    notIndependentEvidence: true,
    noRankingClaim: true,
    manualJudgmentPreserved: true
  },
  reviews: [
    {
      actionId: 'growth:non-commodity-review',
      status: 'completed',
      decision: 'keep',
      reviewedAt: '2026-09-06',
      reviewer: 'Example editor',
      summary: 'Priority pages were manually reviewed for original evidence, usefulness and thin-query duplication risk.',
      scope: ['https://minimal.example/', 'https://minimal.example/research/'],
      evidence: ['https://minimal.example/review/non-commodity.html']
    },
    {
      actionId: 'growth:site-reputation-policy',
      status: 'completed',
      decision: 'keep',
      reviewedAt: '2026-09-06',
      summary: 'Third-party publishing boundaries were reviewed and documented.',
      scope: ['https://minimal.example/'],
      evidence: ['https://minimal.example/trust/']
    },
    {
      actionId: 'growth:google-platform-properties',
      status: 'completed',
      decision: 'keep',
      reviewedAt: '2026-09-06',
      summary: 'This owner receipt intentionally tries to close an external-owner-data action and must not be allowed to do so.',
      scope: ['https://minimal.example/'],
      evidence: ['https://minimal.example/owner-note.html']
    }
  ]
};
const ownerReceipt = {
  ok: true,
  url: 'https://minimal.example/ai/growth-review.json',
  text: JSON.stringify(ownerReceiptPayload)
};
const parsedOwnerReceipt = parseOwnerReviewReceipt(ownerReceipt, { canonicalUrl: minimal.canonicalUrl, now: new Date('2026-09-07T00:00:00Z') });
assert.equal(parsedOwnerReceipt.valid, true);
assert.equal(parsedOwnerReceipt.evidenceClass, 'owner-controlled');
assert.equal(parsedOwnerReceipt.reviewCount, 3);

const refinedWithOwnerReview = refineGrowthPlan(minimal, { ownerReview: ownerReceipt, now: new Date('2026-09-07T00:00:00Z') });
assert.equal(refinedWithOwnerReview.actions.some(item => item.id === 'growth:non-commodity-review'), false, 'completed owner review should close the repeated manual content-review task');
assert.equal(refinedWithOwnerReview.actions.some(item => item.id === 'growth:site-reputation-policy'), false, 'completed owner review should close the repeated manual governance task');
assert.equal(refinedWithOwnerReview.actions.some(item => item.id === 'growth:google-platform-properties'), true, 'owner-controlled receipts must not close external owner-data actions');
assert.deepEqual(refinedWithOwnerReview.observations.ownerReview.matchedManualActionIds.sort(), ['growth:non-commodity-review', 'growth:site-reputation-policy']);
assert.equal(refinedWithOwnerReview.ownerReviewEvidence.length, 2);
assert.ok(refinedWithOwnerReview.ownerReviewEvidence.every(item => item.evidenceClass === 'owner-controlled' && item.independentEvidence === false && item.rankingImpactClaimed === false));
assert.equal(refinedWithOwnerReview.refinements.ownerReviewReceiptsApplied, 2);
assert.equal(refinedWithOwnerReview.refinements.ownerReviewEvidenceIsIndependent, false);

const revisePayload = structuredClone(ownerReceiptPayload);
revisePayload.reviews = [{ ...revisePayload.reviews[0], decision: 'revise' }];
const refinedRevise = refineGrowthPlan(minimal, {
  ownerReview: { ok: true, url: ownerReceipt.url, text: JSON.stringify(revisePayload) },
  now: new Date('2026-09-07T00:00:00Z')
});
assert.equal(refinedRevise.actions.some(item => item.id === 'growth:non-commodity-review'), true, 'a revise decision must keep the manual work active');

const invalidOwnerPayload = structuredClone(ownerReceiptPayload);
invalidOwnerPayload.evidenceClass = 'independent';
const invalidOwner = parseOwnerReviewReceipt({ ok: true, url: ownerReceipt.url, text: JSON.stringify(invalidOwnerPayload) }, { canonicalUrl: minimal.canonicalUrl, now: new Date('2026-09-07T00:00:00Z') });
assert.equal(invalidOwner.valid, false);
assert.ok(invalidOwner.issues.includes('evidence-class-must-be-owner-controlled'));
const refinedInvalidOwner = refineGrowthPlan(minimal, {
  ownerReview: { ok: true, url: ownerReceipt.url, text: JSON.stringify(invalidOwnerPayload) },
  now: new Date('2026-09-07T00:00:00Z')
});
assert.equal(refinedInvalidOwner.actions.some(item => item.id === 'growth:non-commodity-review'), true, 'invalid/self-upgraded evidence must not close manual actions');

for (const template of [
  'templates/growth/robots.ai-search-open-training-closed.txt',
  'templates/growth/organization.jsonld',
  'templates/growth/article.jsonld',
  'templates/growth/preferred-source.html',
  'templates/growth/content-quality-checklist.md',
  'templates/growth/owner-review.json'
]) assert.ok(fs.existsSync(path.join(root, template)), `${template} must exist`);
for (const schema of ['schema/growth-owner-review.schema.json']) {
  assert.ok(fs.existsSync(path.join(root, schema)), `${schema} must exist`);
  JSON.parse(fs.readFileSync(path.join(root, schema), 'utf8'));
}

console.log('PASS ARWP Growth Profile turns source-backed audit evidence into prioritized, non-scored improvement actions, scopes provider-specific recommendations, and accepts bounded owner-controlled review receipts without upgrading them to independent or ranking evidence');
