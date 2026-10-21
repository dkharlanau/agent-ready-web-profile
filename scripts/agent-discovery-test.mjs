import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { reviewRepresentations, captureRepresentations, representationSurfaceObservation } from '../lib/agent-representations.mjs';
import { reviewAiAccess } from '../lib/ai-access-review.mjs';
import { createBingTopicsTemplate, reviewBingTopicsPortfolio } from '../lib/bing-topics-portfolio.mjs';

const url = 'https://synthetic.example.test/lesson';
const htmlText = '<html><head><link rel="canonical" href="'+url+'"><script type="application/ld+json">{"@id":"'+url+'#resource"}</script></head><body><nav>Noise</nav><main><h1>Try a useful lesson</h1><p>Evidence is limited.</p><a href="/source">Source</a></main></body></html>';
const mdText = '# Try a useful lesson\n\nEvidence is limited.\n\n[Canonical]('+url+')\n[Source](https://synthetic.example.test/source)\n\n```json\n{"@id":"'+url+'#resource"}\n```\n';
const captured = (text, contentType, target = url) => ({ ok: true, url: target, text, status: 200, contentType, headers: { vary: 'Accept' }, observedAt: '2026-10-21T12:00:00Z' });
const base = { url, html: captured(htmlText, 'text/html'), markdown: captured(mdText, 'text/markdown'),
  contract: { requiredText: [{ role: 'answer', text: 'Try a useful lesson' }, { role: 'limits', text: 'Evidence is limited.' }], requiredLinks: ['https://synthetic.example.test/source'], requiredEntityIds: [url+'#resource'] } };
assert.equal(reviewRepresentations(base).state, 'pass');
assert.equal(representationSurfaceObservation(reviewRepresentations(base), 'page-markdown').state, 'present');
const facts = structuredClone(base);
facts.html.text = facts.html.text.replace('#resource"}', '#resource","name":"Source name"}');
facts.markdown.text = facts.markdown.text.replace('#resource"}', '#resource","name":"Different claim"}');
assert.equal(reviewRepresentations(facts).state, 'fail', 'Preserved ID must not hide changed entity facts.');
assert.equal(reviewRepresentations({ ...base, markdown: captured(mdText.replace('Evidence is limited.', ''), 'text/markdown') }).state, 'fail');
assert.equal(reviewRepresentations({ ...base, markdown: captured(htmlText, 'text/html') }).state, 'unknown');
assert.equal(reviewRepresentations({ ...base, html: { ok: false, status: 429 } }).state, 'unknown');
assert.equal(reviewRepresentations({ ...base, contract: { requiredText: [{ role: 'limits', text: 'Stale expected sentence' }] } }).state, 'unknown');
assert.equal(reviewRepresentations({ ...base, contract: {} }).state, 'watch');
assert.equal(reviewRepresentations({ ...base, markdown: captured(mdText.replace('/source)', '/different)'), 'text/markdown') }).state, 'fail');
assert.equal(reviewRepresentations({ ...base, markdown: captured(mdText.replace('#resource', '#other'), 'text/markdown') }).state, 'fail');
assert(!JSON.stringify(reviewRepresentations(base)).includes('Evidence is limited.'), 'Report retains hashes/check results, not original owner passages.');
const cookies = structuredClone(base); cookies.html.headers['set-cookie'] = 'private-session';
assert(!JSON.stringify(reviewRepresentations(cookies)).includes('private-session'), 'Unrelated capture headers must not leak.');
assert.equal(reviewRepresentations({ ...base, markdown: { ...base.markdown, headers: {} } }).state, 'watch');
assert.equal(reviewRepresentations({ ...base, contract: { markdownRequired: true }, markdown: { ok: false, status: 404 } }).state, 'fail');
await assert.rejects(captureRepresentations({ url, markdownUrl: 'https://other.example.test/file.md' }), /same origin/);
let requests = 0;
const capturedPair = await captureRepresentations({ url }, { resolveImpl: async () => [{ address: '8.8.8.8' }], fetchImpl: async (_url, options) => {
  requests++;
  const md = options.headers.Accept === 'text/markdown';
  return new Response(md ? mdText : htmlText, { status: 200, headers: { 'content-type': md ? 'text/markdown' : 'text/html', vary: 'Accept', 'content-signal': 'ai-train=no, search=yes' } });
} });
assert.equal(requests, 2);
assert.equal(capturedPair.markdown.headers.contentSignal, 'ai-train=no, search=yes');
assert(capturedPair.html.requestedAt && capturedPair.html.observedAt);
const robots = { ok: true, text: 'User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: OAI-SearchBot\nDisallow: /private\nAllow: /private/public\n', observedAt: base.html.observedAt };
let access = reviewAiAccess({ ...base, robots });
assert.equal(access.crawlerPolicies.find(x => x.id === 'openai-training').status, 'blocked');
assert.equal(access.crawlerPolicies.find(x => x.id === 'openai-search').status, 'allowed');
assert.equal(access.googleGenerativeAi.state, 'unknown');
assert.equal(access.ordinaryHttp.actualProviderVisitVerified, false);
assert.equal(reviewAiAccess({ ...base, robots: { ok: false, status: 403 } }).crawlerPolicies[0].status, 'unknown');
assert.equal(reviewAiAccess({ ...base, html: { ok: false, status: 403 }, robots }).pageDirectives.genericNoindex, null);
const ownerControls = { version: '0.1', site: 'https://synthetic.example.test/', googleSearchGenerativeAi: { value: 'inherit', effectiveValue: null,
  observedAt: '2026-10-21T11:00:00Z', source: 'owner-observation', evidenceSha256: 'a'.repeat(64) } };
assert.equal(reviewAiAccess({ ...base, robots, ownerControls }).googleGenerativeAi.effectiveValue, null);
assert.throws(() => reviewAiAccess({ ...base, robots, ownerControls: { ...ownerControls, site: 'https://other.example.test/' } }), /exact site/);
assert.throws(() => reviewAiAccess({ ...base, robots, ownerControls: { ...ownerControls, googleSearchGenerativeAi: { value: 'include' } } }), /dated owner/);

const scaffold = createBingTopicsTemplate('https://synthetic.example.test/');
assert.equal(reviewBingTopicsPortfolio(scaffold).state, 'not-measured');
assert.equal(reviewBingTopicsPortfolio(scaffold).capturedAt, null);
const portfolio = { ...scaffold, availability: 'available', capturedAt: '2026-10-21T12:00:00Z',
  period: { start: '2026-09-20', end: '2026-10-17', dataState: 'partial' }, sourceEvidence: { sourceClass: 'owner-normalized', sha256: 'b'.repeat(64) },
  topics: [{ id: 'topic01', topicSizeApprox: 1000, sitesCitedApprox: 30, queriesApprox: null, ownCitations: 2 }],
  pages: [{ id: 'page01', canonicalUrl: url }],
  opportunities: [{ id: 'query01', topicId: 'topic01', citationRange: { lowerBound: 100, upperBound: 499 }, relevance: 'brand-conflict', pageId: 'page01', intentMatch: 'confirmed' }] };
assert.equal(reviewBingTopicsPortfolio(portfolio).nextReview, null);
const accepted = structuredClone(portfolio); accepted.opportunities[0].relevance = 'relevant';
const review = reviewBingTopicsPortfolio(accepted);
assert.deepEqual(review.opportunities[0].citationRange, { lowerBound: 100, upperBound: 499 });
assert.equal(review.nextReview.pageId, 'page01');
assert.equal(review.topics[0].queriesApprox, null);
assert(!JSON.stringify(review).includes(url));
const changed = edit => { const copy = structuredClone(portfolio); edit(copy); return copy; };
assert.throws(() => reviewBingTopicsPortfolio(changed(x => { x.opportunities[0].citationRange.upperBound = 1; })), /ordered bounds/);
assert.throws(() => reviewBingTopicsPortfolio(changed(x => { x.topics[0].topicSizeApprox = -1; })), /nonnegative/);
assert.throws(() => reviewBingTopicsPortfolio(changed(x => { x.availability = 'insufficient-data'; })), /Unavailable data/);
assert.throws(() => reviewBingTopicsPortfolio(changed(x => { x.pages[0].canonicalUrl = 'https://other.example.test/'; })), /exact owner/);
assert.throws(() => reviewBingTopicsPortfolio(changed(x => { x.opportunities[0].query = 'private query'; })), /raw opportunity/);
assert.throws(() => reviewBingTopicsPortfolio(changed(x => { x.sourceEvidence.sha256 = 'missing'; })), /hash/);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-discovery-'));
try {
  const run = (...args) => spawnSync(process.execPath, ['bin/arwp.mjs', ...args], { encoding: 'utf8' });
  const file = path.join(tmp, 'captures.json'); fs.writeFileSync(file, JSON.stringify({ version: '0.1', site: scaffold.site, pages: [base] }));
  let r = run('representations', '--input='+file); assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).pages[0].state, 'pass');
  r = run('bing', 'topics-template', '--site='+scaffold.site, '--json'); assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).availability, 'not-exported');
  const output = path.join(tmp, 'owner.json'); fs.writeFileSync(output, JSON.stringify(scaffold));
  r = run('bing', 'topics-inspect', '--input='+output, '--json'); assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).state, 'not-measured');
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log('PASS agent representations, AI access, Bing Topics Portfolio and offline CLI negative cases');
