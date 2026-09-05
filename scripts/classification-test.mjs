import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const registryClassification = readJson('registry/product-classification.json');
const publicClassification = readJson('docs/ai/product-classification.json');
assert.deepEqual(publicClassification, registryClassification, 'public classification must match packaged registry source');
assert.equal(registryClassification.preferredClass.id, 'agentic-web-interoperability-resolver');
assert.equal(registryClassification.preferredClass.status, 'project-defined');
assert.ok(registryClassification.notEquivalentTo.some(item => /AI visibility/i.test(item.class)));
assert.ok(registryClassification.closestAdjacentClasses.some(item => item.representative === 'AgentReady / Ora'));
assert.equal(registryClassification.guardrails.noUniversalBestClaim, true);
assert.equal(registryClassification.guardrails.unknownCompetitorCapabilityIsNotAssumedAbsent, true);

const alternatives = readJson('docs/compare/alternatives.json');
assert.equal(alternatives.subject.preferredClass, 'Agentic web interoperability resolver');
assert.ok(alternatives.alternatives.length >= 7, 'comparison must cover multiple direct and adjacent categories');
const ora = alternatives.alternatives.find(item => item.id === 'agentready-ora');
assert.equal(ora.relationship, 'closest-adjacent');
assert.ok(ora.sources.includes('https://www.agentready.org/'));
assert.ok(ora.sources.includes('https://ora.ai/docs'));
assert.ok(alternatives.alternatives.some(item => item.id === 'cloudflare-ai-crawl-control'));
assert.ok(alternatives.alternatives.some(item => item.id === 'ahrefs-brand-radar'));
assert.ok(alternatives.alternatives.some(item => item.id === 'semrush-ai-visibility'));
assert.ok(alternatives.alternatives.some(item => item.id === 'peec-ai'));
for (const item of alternatives.alternatives) {
  for (const source of item.sources || []) assert.match(source, /^https:\/\//, `${item.id} sources must be public HTTPS URLs`);
}
assert.equal(alternatives.guardrails.comparisonIsNotRanking, true);
assert.equal(alternatives.guardrails.unknownCapabilityIsNotAssumedAbsent, true);

const product = readJson('docs/ai/product.jsonld');
assert.equal(product['@context'], 'https://schema.org');
const software = product['@graph'].find(item => Array.isArray(item['@type']) && item['@type'].includes('SoftwareApplication'));
assert.ok(software, 'Schema.org graph must describe ARWP as software');
assert.equal(software.applicationSubCategory, 'Agentic Web Interoperability Resolver');
assert.equal(software.softwareVersion, '0.2.0');
assert.ok(software.featureList.includes('source authority and conflict preservation'));
assert.ok(software.about.some(item => item.name === 'agentic web interoperability resolver'));

const compareHtml = read('docs/compare/index.html');
assert.match(compareHtml, /<meta name="description"/);
assert.match(compareHtml, /<link rel="canonical" href="https:\/\/dkharlanau\.github\.io\/agent-ready-web-profile\/compare\/">/);
assert.match(compareHtml, /<meta property="og:title"/);
assert.match(compareHtml, /<meta name="twitter:card" content="summary">/);
assert.match(compareHtml, /type="application\/ld\+json"/);
assert.match(compareHtml, /AgentReady \/ Ora/);
assert.match(compareHtml, /Cloudflare AI Crawl Control/);
assert.match(compareHtml, /Semrush AI Visibility/);
assert.match(compareHtml, /Ahrefs Brand Radar/);
assert.match(compareHtml, /Peec AI/);
assert.match(compareHtml, /project-defined/i);
assert.match(compareHtml, /No winner table/i);
assert.doesNotMatch(compareHtml, /<meta name="keywords"/i, 'do not add obsolete meta keywords; structured keywords live in JSON-LD');

const compareLlms = read('docs/compare/llms.txt');
assert.match(compareLlms, /Preferred classification/i);
assert.match(compareLlms, /AgentReady \/ Ora/);
assert.match(compareLlms, /category map, not a winner ranking/i);

const sitemap = read('docs/sitemap.xml');
assert.match(sitemap, /https:\/\/dkharlanau\.github\.io\/agent-ready-web-profile\/compare\//);
assert.match(sitemap, /https:\/\/dkharlanau\.github\.io\/agent-ready-web-profile\/recommendations\//);
assert.ok((sitemap.match(/<lastmod>2026-09-05<\/lastmod>/g) || []).length >= 10, 'sitemap should carry explicit reviewed freshness for canonical pages');

const aiSearch = readJson('ai/ai-search-profile.json');
const publicAiSearch = readJson('docs/ai/ai-search-profile.json');
assert.deepEqual(publicAiSearch, aiSearch, 'public AI Search profile must match repository source');
assert.equal(aiSearch.surfaces.sitemap.status, 'active');
assert.equal(aiSearch.surfaces.robots.status, 'not-applicable');
assert.match(aiSearch.surfaces.robots.notes, /origin-root \/robots\.txt/);
assert.ok(aiSearch.objective.targetQuestions.some(value => /AgentReady\/Ora/.test(value)));
assert.ok(aiSearch.vocabulary.some(item => item.term === 'agentic web interoperability resolver'));
assert.ok(aiSearch.modules.comparisonPages.machineReadable.some(url => url.endsWith('/compare/alternatives.json')));

const profile = readJson('ai/site-profile.json');
const publicProfile = readJson('docs/ai/site-profile.json');
assert.deepEqual(publicProfile, profile, 'public self-profile must match repository source');
assert.equal(profile.web.sitemap, 'https://dkharlanau.github.io/agent-ready-web-profile/sitemap.xml');
assert.ok(profile.data.distributions.some(item => item.url.endsWith('/ai/product-classification.json')));
assert.ok(profile.data.distributions.some(item => item.url.endsWith('/ai/product.jsonld')));
assert.ok(profile.data.distributions.some(item => item.url.endsWith('/compare/alternatives.json')));
assert.ok(profile.data.distributions.some(item => item.url.endsWith('/recommendations/registry.json')));

console.log('PASS ARWP publishes a source-backed competitor map, explicit machine-readable product class, Schema.org metadata and canonical sitemap without inventing rankings or fake robots authority');
