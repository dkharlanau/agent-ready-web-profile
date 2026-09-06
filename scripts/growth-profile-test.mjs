import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGrowthPlanFromObservations, loadGrowthRegistry, parseContentSignal } from '../lib/growth-profile.mjs';

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
assert.ok(minimalIds.has('growth:cloudflare-content-signals'));
assert.ok(minimalIds.has('growth:entity-identity'));
const contentAction = minimal.actions.find(item => item.id === 'growth:cloudflare-content-signals');
assert.match(contentAction.implementation.suggestedPolicy, /search=yes, ai-input=yes, ai-train=no, use=reference/);
assert.match(contentAction.implementation.note, /not a Google ranking signal/i);
assert.match(minimal.actions.find(item => item.id === 'growth:preferred-source-acquisition').implementation.url, /preferences\/source\?q=minimal\.example/);

for (const template of [
  'templates/growth/robots.ai-search-open-training-closed.txt',
  'templates/growth/organization.jsonld',
  'templates/growth/article.jsonld',
  'templates/growth/preferred-source.html',
  'templates/growth/content-quality-checklist.md'
]) assert.ok(fs.existsSync(path.join(root, template)), `${template} must exist`);

console.log('PASS ARWP Growth Profile turns source-backed audit evidence into prioritized, non-scored improvement actions and keeps provider-specific AI policy, editorial quality, measurement and deprecated SEO features correctly scoped');
