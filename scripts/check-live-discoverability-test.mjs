import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkDiscoverabilityLayout, checkEvidenceHubs, checkSourceEvidenceHubs, checkSourceProductionAlignment } from './check-live-discoverability.mjs';

const base = 'https://example.com/project/';
const libraryUrl = `${base}discoverability.html`;
const hubUrl = `${base}discoverability/access.html`;
const index = { categories: [{ id: 'access', title: 'Crawl access', url: hubUrl }] };
const html = `<!doctype html><html><head><link rel="canonical" href="${libraryUrl}"></head><body>
<header><a class="goose-brand" href="./">Goose</a><nav aria-label="Primary"><a href="#library">Patterns</a><a href="#categories">Categories</a><a href="#evidence-guide">Evidence</a></nav></header>
<main><section id="categories" class="goose-shell category-hubs"><div class="category-grid"><a class="category-card" href="./discoverability/access.html"><strong>Access</strong></a></div></section>
<section id="library"></section><section id="evidence-guide"></section></main></body></html>`;

assert.deepEqual(checkDiscoverabilityLayout(html, index, base), [hubUrl]);
assert.throws(() => checkDiscoverabilityLayout(html.replace('category-hubs', 'legacy-hubs'), index, base), /category hubs section/);
assert.throws(() => checkDiscoverabilityLayout(html.replace('category-grid', 'missing-grid'), index, base), /category grid/);
assert.throws(() => checkDiscoverabilityLayout(html.replace('./discoverability/access.html', './discoverability/missing.html'), index, base), /differ from routing index/);
assert.throws(() => checkDiscoverabilityLayout(html.replace('href="#evidence-guide"', 'href="#not-evidence"'), index, base), /Primary navigation/);
assert.throws(() => checkDiscoverabilityLayout(html.replace('id="library"', 'id="not-library"'), index, base), /#library target/);
assert.throws(() => checkDiscoverabilityLayout(html, { categories: [{ id: 'access', title: 'Crawl access', url: 'https://offsite.example/hub.html' }] }, base), /same-origin/);
assert.throws(() => checkDiscoverabilityLayout('STATIC EVIDENCE HUBS', index, base), /canonical link/);
assert.throws(() => checkDiscoverabilityLayout(html, { categories: [{ ...index.categories[0], url: `${base}discoverability/architecture.html` }] }, base), /route does not match category id/);
assert.throws(() => checkDiscoverabilityLayout(html.replace(`href="${libraryUrl}"`, 'href="https://example.com/wrong.html"'), index, base), /canonical to its live URL/);
assert.throws(() => checkDiscoverabilityLayout(html.replace('id="evidence-guide"', 'id="missing-guide"'), index, base), /#evidence-guide target/);

const unpublishedUrl = `${base}discoverability/new-guide.html`;
assert.deepEqual(checkSourceProductionAlignment([hubUrl], [hubUrl], 'schedule'), []);
assert.deepEqual(checkSourceProductionAlignment([hubUrl, unpublishedUrl], [hubUrl], 'pull_request'), [unpublishedUrl]);
assert.throws(() => checkSourceProductionAlignment([hubUrl, unpublishedUrl], [hubUrl], 'schedule'), /Production missing source evidence hubs/);
assert.throws(() => checkSourceProductionAlignment([unpublishedUrl], [hubUrl], 'pull_request'), /Previously published evidence hubs missing from source/);

const hubHtml = `<!doctype html><html><head><link rel="canonical" href="${hubUrl}"></head><body><header><a href="../discoverability.html">Back to patterns</a></header><main><h1>Crawl access</h1></main></body></html>`;
const mockedFetch = (status, body = hubHtml, finalUrl = hubUrl, contentType = 'text/html') => async () => ({
  status, url: finalUrl, headers: { get: name => name === 'content-type' ? contentType : null }, text: async () => body
});
await checkEvidenceHubs(index.categories, base, mockedFetch(200));
await assert.rejects(checkEvidenceHubs(index.categories, base, mockedFetch(404)), /unavailable/);
await assert.rejects(checkEvidenceHubs(index.categories, base, mockedFetch(200, hubHtml, `${base}other.html`)), /redirected/);
await assert.rejects(checkEvidenceHubs(index.categories, base, mockedFetch(200, hubHtml.replace('rel="canonical"', 'rel="alternate"'))), /canonical link/);
await assert.rejects(checkEvidenceHubs(index.categories, base, mockedFetch(200, hubHtml.replace('<h1>Crawl access</h1>', ''))), /no heading/);
await assert.rejects(checkEvidenceHubs(index.categories, base, mockedFetch(200, hubHtml, hubUrl, 'application/json')), /Not HTML/);
await assert.rejects(checkEvidenceHubs(index.categories, base, mockedFetch(200, hubHtml.replace('<h1>Crawl access</h1>', '<h1>Incorrect topic</h1>'))), /heading does not match routing index/);
await assert.rejects(checkEvidenceHubs(index.categories, base, mockedFetch(200, hubHtml.replace('../discoverability.html', '../missing-library.html'))), /no navigation back to library/);
await assert.rejects(checkEvidenceHubs(index.categories, base, mockedFetch(200, hubHtml.replace('href="${hubUrl}"', 'href="https://example.com/wrong.html"'))), /canonical mismatch/);

await checkSourceEvidenceHubs(index.categories, base, async () => hubHtml);
await assert.rejects(checkSourceEvidenceHubs(index.categories, base, async () => { const error = new Error('ENOENT'); error.code = 'ENOENT'; throw error; }), /Missing local source evidence hub/);
await assert.rejects(checkSourceEvidenceHubs(index.categories, base, async () => hubHtml.replace('<h1>Crawl access</h1>', '<h1>Incorrect topic</h1>')), /heading does not match routing index/);

const realHtml = readFileSync('docs/discoverability.html', 'utf8');
const realIndex = JSON.parse(readFileSync('docs/discoverability/index.json', 'utf8'));
const realBase = 'https://dkharlanau.github.io/agent-ready-web-profile/';
const found = checkDiscoverabilityLayout(realHtml, realIndex, realBase);
assert.equal(found.length, realIndex.categories.length);
await checkSourceEvidenceHubs(realIndex.categories, realBase);
console.log(`Live discoverability verifier regression passed; ${found.length} source evidence hubs validated.`);
