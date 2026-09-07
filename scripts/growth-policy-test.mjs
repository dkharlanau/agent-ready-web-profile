import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { compileGrowthPolicy, validateGrowthPolicy } from '../lib/growth-policy.mjs';
import { refineGrowthPlan } from '../lib/growth-plan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schema', 'growth-policy.schema.json'), 'utf8'));
const example = JSON.parse(fs.readFileSync(path.join(root, 'examples', 'growth-policy.example.json'), 'utf8'));
const verticals = JSON.parse(fs.readFileSync(path.join(root, 'registry', 'growth-verticals.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
assert.equal(validateSchema(example), true, JSON.stringify(validateSchema.errors));
assert.equal(validateGrowthPolicy(example).valid, true);
assert.ok(Object.keys(verticals.verticals).includes(example.siteClass));
assert.equal(verticals.version, '0.3');
assert.equal(Object.values(verticals.verticals).every(vertical => Array.isArray(vertical.checks) && vertical.checks.length >= 3), true, 'every vertical should provide actionable evidence checks');
assert.ok(verticals.verticals.commerce.checks.some(item => item.id === 'commerce-ucp-discovery' && /\.well-known\/ucp/.test(item.evidence)));
assert.ok(verticals.verticals['local-business'].checks.some(item => item.id === 'local-business-owner-profile' && /Business Profile/.test(item.title)));

const noisyPlan = {
  canonicalUrl: 'https://example.com/docs/',
  profile: '2026-09-06',
  summary: {},
  observations: {},
  actions: [
    { id: 'audit:google-search-technical-eligibility', priority: 'P0', lane: 'search', status: 'fail', title: 'Fix eligibility' },
    { id: 'audit:google-generative-ai-measurement', priority: 'P2', lane: 'measurement', status: 'not-assessed', title: 'Old duplicate measurement' },
    { id: 'audit:webmcp-runtime-tools', priority: 'P2', lane: 'agent-web', status: 'not-assessed', title: 'Runtime only' },
    { id: 'audit:google-sitemap-lastmod', priority: 'P2', lane: 'freshness', status: 'warn', title: 'Root sitemap warning' },
    { id: 'growth:google-generative-ai-measurement-global', priority: 'P1', lane: 'measurement', status: 'external-owner-data', title: 'Measure Google AI' },
    { id: 'growth:bing-ai-citation-measurement', priority: 'P1', lane: 'measurement', status: 'external-owner-data', title: 'Measure Bing AI' },
    { id: 'growth:google-platform-properties', priority: 'P2', lane: 'measurement', status: 'external-owner-data', title: 'Social/video properties' },
    { id: 'growth:preferred-source-acquisition', priority: 'P2', lane: 'citation', status: 'opportunity', title: 'Preferred Sources' },
    { id: 'growth:non-commodity-review', priority: 'P1', lane: 'content-quality', status: 'manual', title: 'Content quality review' }
  ],
  note: 'No guarantee.'
};

const refined = refineGrowthPlan(noisyPlan, {
  localSitemap: {
    ok: true,
    url: 'https://example.com/docs/sitemap.xml',
    text: '<urlset><url><loc>https://example.com/docs/</loc><lastmod>2026-09-06</lastmod></url></urlset>'
  }
});
const refinedIds = new Set(refined.actions.map(item => item.id));
assert.ok(refinedIds.has('audit:google-search-technical-eligibility'));
assert.equal(refinedIds.has('audit:google-generative-ai-measurement'), false);
assert.equal(refinedIds.has('audit:webmcp-runtime-tools'), false);
assert.equal(refinedIds.has('audit:google-sitemap-lastmod'), false, 'healthy canonical-path sitemap resolves a root-scope sitemap warning');
assert.equal(refined.observations.localSitemap.usedToResolveRootScopeWarning, true);
assert.equal(refined.summary.totalActions, 6);

const manifest = compileGrowthPolicy(refined, example);
assert.equal(manifest.siteClass, 'software-product');
assert.match(manifest.desiredState.robotsIntent, /User-agent: OAI-SearchBot/);
assert.match(manifest.desiredState.robotsIntent, /User-agent: GPTBot\nDisallow: \//);
assert.equal(manifest.desiredState.contentSignal, 'Content-Signal: search=yes, ai-input=yes, ai-train=no, use=reference');
assert.equal(manifest.desiredState.preferredSourcesUrl, 'https://www.google.com/preferences/source?q=example.com');
assert.ok(manifest.desiredState.structuredData.verticalRecommended.includes('SoftwareApplication'));
assert.equal(manifest.desiredState.vertical.registryVersion, '0.3');
assert.equal(manifest.desiredState.vertical.reviewedAt, '2026-09-07');
assert.ok(manifest.desiredState.vertical.checks.some(item => item.id === 'software-product-release-history' && item.priority === 'P1'));
assert.ok(manifest.desiredState.vertical.checks.some(item => item.id === 'software-product-agent-interfaces'));
assert.ok(manifest.actions.some(item => item.id === 'growth:google-generative-ai-measurement-global'));
assert.ok(manifest.actions.some(item => item.id === 'growth:preferred-source-acquisition'));
assert.equal(manifest.guardrails.noRankingGuarantee, true);
assert.equal(manifest.guardrails.noAiRecommendationGuarantee, true);

const noChatGpt = structuredClone(example);
noChatGpt.goals.chatgptSearch = false;
noChatGpt.preferredSources.enabled = false;
noChatGpt.measurement.socialVideoProperties = false;
const filtered = compileGrowthPolicy(refined, noChatGpt);
assert.equal(filtered.actions.some(item => item.id.includes('preferred-source')), false);
assert.equal(filtered.actions.some(item => item.id.includes('platform-properties')), false);
assert.equal(filtered.desiredState.preferredSourcesUrl, null);

const bad = structuredClone(example);
bad.siteClass = 'magic-seo';
assert.equal(validateGrowthPolicy(bad).valid, false);
assert.throws(() => compileGrowthPolicy(refined, bad), /Invalid Growth Policy/);

console.log('PASS Growth Policy schema and compiler expose actionable vertical evidence modules, keep owner goals explicit, suppress irrelevant actions, and compile rights/search intent without producing ranking guarantees');
