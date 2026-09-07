import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { analyzeSearchSurfacePages, loadSearchSurfaceBlueprint } from '../lib/search-surface.mjs';
import { mergeSearchSurfacePlan } from '../lib/site-improvement-deep.mjs';

const rootPath=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const registry=loadSearchSurfaceBlueprint();
assert.equal(registry.checks.length,69);
assert.equal(Object.keys(registry.siteKinds).length,7);
assert.equal(Object.keys(registry.surfaceDefinitions).length,18);
assert.equal(registry.methodology.newsAndRoadmapAreNotUniversalRequirements,true);
assert.equal(registry.methodology.schemaSemanticsDoNotImplyGoogleRichResults,true);
assert.equal(registry.methodology.automationIsEvidenceDependent,true);
assert.equal(registry.methodology.manualAndOwnerDataChecksRemainExplicit,true);
assert.equal(new Set(registry.checks.map(item=>item.id)).size,69);
for(const check of registry.checks) assert.match(check.source,/^https:\/\//,`${check.id} must retain a primary source`);
for(const id of [
  'google-mobile-first-content-parity','google-lazy-load-no-user-action','google-infinite-scroll-persistent-urls',
  'google-noindex-must-be-crawlable','google-hreflang-localized-variants','google-image-alt-text-quality',
  'google-video-dedicated-watch-page','google-structured-data-visible-parity','google-scaled-content-abuse-guardrail',
  'google-site-reputation-abuse-guardrail','google-doorway-abuse-guardrail','google-crawl-budget-large-site-only'
]) assert.ok(registry.checks.some(item=>item.id===id),`missing deep technical/policy check ${id}`);

const root='https://example.com/project/';
const home=`<!doctype html><html lang="en"><head><title>Acme App</title><link rel="canonical" href="${root}"><meta name="description" content="Product overview"><meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:image" content="${root}hero.png"><script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","@id":"${root}#software","name":"Acme App","offers":{"@type":"Offer","price":"0"}}</script></head><body><h1>Acme App</h1><a href="product/">Product</a><a href="docs/">Docs</a></body></html>`;
const product=`<!doctype html><html lang="en"><head><title>Acme App product</title><link rel="canonical" href="${root}product/"><meta name="description" content="Product detail"></head><body><h1>Acme App product</h1></body></html>`;
const docs=`<!doctype html><html lang="en"><head><title>Acme App docs</title><link rel="canonical" href="${root}docs/"><meta name="description" content="Documentation"></head><body><h1>Docs</h1></body></html>`;
const sitemap=`<urlset><url><loc>${root}</loc></url><url><loc>${root}product/</loc></url><url><loc>${root}docs/</loc></url></urlset>`;
const report=analyzeSearchSurfacePages([{url:root,html:home},{url:`${root}product/`,html:product},{url:`${root}docs/`,html:docs}],{canonicalUrl:root,kind:'software-product',sitemapXml:sitemap,sitemapUrl:`${root}sitemap.xml`});
assert.equal(report.scope,'bounded-conditional-search-surface-architecture-not-ranking-score');
assert.equal(report.siteKind.kind,'software-product');
assert.equal(report.registrySummary.checks,69);
assert.equal(report.guardrails.newsAndRoadmapAreNotUniversalRequirements,true);
assert.equal('score' in report,false);
const ids=new Set(report.actions.map(x=>x.id));
for(const id of ['surface:missing:software-product:changelog','surface:missing:software-product:updates','surface:missing:software-product:profile','surface:missing:software-product:roadmap',`surface:site-name-boundary:${root}`,`surface:software-version:${root}`,`surface:release-notes:${root}`]) assert.ok(ids.has(id),`missing expected action ${id}`);
assert.equal([...ids].some(id=>id.includes('news-sitemap')),false,'software product must not receive a news-only requirement');
assert.equal([...ids].some(id=>id.includes('hreflang')),false,'registry-only conditional checks must not auto-fire without observed applicability evidence');
assert.equal([...ids].some(id=>id.includes('video')),false,'video-only checks must not auto-fire on a site with no observed video surface');

const editorial='https://news.example/';
const articleUrl=`${editorial}updates/story`;
const article=`<!doctype html><html lang="en"><head><title>Original research update</title><link rel="canonical" href="${articleUrl}"><meta name="description" content="Deep update"><script type="application/ld+json">{"@context":"https://schema.org","@type":"NewsArticle","headline":"Original research update"}</script></head><body><h1>Original research update</h1><p>2026-09-07</p></body></html>`;
const editorialReport=analyzeSearchSurfacePages([{url:editorial,html:'<!doctype html><html lang="en"><head><title>News</title><link rel="canonical" href="https://news.example/"><meta name="description" content="News"></head><body><h1>News</h1></body></html>'},{url:articleUrl,html:article}],{canonicalUrl:editorial,kind:'editorial-news'});
const eids=new Set(editorialReport.actions.map(x=>x.id));
assert.ok(eids.has(`surface:image:${articleUrl}`));
assert.ok(eids.has(`surface:article-author:${articleUrl}`));
assert.ok(eids.has(`surface:article-date:${articleUrl}`));
assert.ok(!eids.has(`surface:visible-date:${articleUrl}`));
assert.ok(!eids.has('surface:missing:editorial-news:roadmap'));

const schema=JSON.parse(fs.readFileSync(path.join(rootPath,'schema','search-surface-report.schema.json'),'utf8'));
const ajv=new Ajv2020({strict:true,allErrors:true}); addFormats(ajv);
const validate=ajv.compile(schema);
assert.equal(validate(report),true,JSON.stringify(validate.errors));
const illegal={...report,score:99};
assert.equal(validate(illegal),false,'schema must reject a universal numeric score');

const basePlan={version:'0.1',site:root,scope:'bounded-prioritized-improvement-plan-not-ranking-score',summary:{},actions:[{order:1,id:'growth:existing',sourceKind:'growth',priority:'P1',lane:'technical-search',title:'Existing technical action',reason:'fixture',evidenceClass:'source-backed',evidence:[],target:{url:root},proposal:null,verification:['verify'],measurement:['measure'],dependencies:[]}],sourceSummary:{growthActions:1},prioritization:{universalNumericScore:false},guardrails:{noRankingPromise:true,noUniversalReadinessScore:true,noAutomaticRepositoryMutation:true,noInventedFacts:true,measurementDoesNotProveCausality:true}};
const merged=mergeSearchSurfacePlan(basePlan,report,{maxActions:4});
assert.equal(merged.actions.length,4);
assert.ok(merged.actions.some(item=>item.sourceKind==='search-surface'));
assert.equal(merged.sourceSummary.searchSurfaceChecks,69);
assert.equal(merged.guardrails.newsAndRoadmapAreNotUniversalRequirements,true);
assert.equal(merged.prioritization.universalNumericScore,false);

console.log('PASS Search Surface Blueprint: 69 source-backed/conditional checks, 18 surfaces, 7 site archetypes, with deep technical/policy registry checks and evidence-dependent automation');
