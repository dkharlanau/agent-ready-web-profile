import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceRedirectNeedsReview } from '../lib/trend-source-watch.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const sourcePath = 'research/product/2026-10-10-search-geo-deep-run.json';
const docPath = 'research/product/2026-10-10-search-geo-deep-run.md';
const report = json(sourcePath);
const markdown = read(docPath);
const sources = json('registry/trend-watch-sources.json');

assert.equal(report.version, '0.1');
assert.equal(report.reviewDate, '2026-10-10');
assert.equal(report.method.candidateNotRecommendation, true);
assert.equal(report.method.noAutomaticActivation, true);
assert.equal(report.method.noChangesToTargetSites, true);
assert.ok(report.opportunities.length >= 20, 'A Deep Run must qualify at least twenty distinct practical opportunities.');
assert.match(report.title, new RegExp(String(report.opportunities.length)));
assert.match(markdown, new RegExp(report.opportunities.length + ' researched'));
assert.match(markdown, /not a public content farm|public content farm/);
assert.match(markdown, /not automatically active/i);

const ids = new Set();
const titles = new Set();
const allowedPriority = new Set(['P0', 'P1', 'P2']);
const sourceHostnames = ['developers.google.com', 'support.google.com', 'blogs.bing.com', 'developers.openai.com',
  'help.openai.com', 'developers.cloudflare.com', 'developer.chrome.com', 'datatracker.ietf.org',
  'www.indexnow.org'];
const count = { P0: 0, P1: 0, P2: 0 };
for (let i = 0; i < report.opportunities.length; i++) {
  const item = report.opportunities[i];
  assert.equal(item.rank, i + 1, 'Rank must be stable and explicit.');
  assert.match(item.id, /^[a-z0-9][a-z0-9-]{5,}$/);
  assert(!ids.has(item.id), 'Duplicate recommendation ID: ' + item.id);
  assert(!titles.has(item.title.toLowerCase()), 'Duplicate recommendation title: ' + item.title);
  ids.add(item.id);
  titles.add(item.title.toLowerCase());
  assert(allowedPriority.has(item.priority), 'Unknown priority: ' + item.priority);
  count[item.priority]++;
  for (const field of ['status', 'area', 'title', 'insight', 'action', 'check', 'measure', 'skip']) {
    assert.equal(typeof item[field], 'string', item.id + ' lacks ' + field);
    assert(item[field].trim().length >= (field === 'status' || field === 'area' ? 3 : 25), item.id + ' has a generic or absent ' + field);
  }
  assert(Array.isArray(item.primarySources) && item.primarySources.length > 0, item.id + ' lacks primary sources.');
  for (const url of item.primarySources) {
    const parsed = new URL(url);
    assert.equal(parsed.protocol, 'https:');
    assert(sourceHostnames.includes(parsed.hostname), item.id + ' has a non-primary or unreviewed source host: ' + parsed.hostname);
    assert(markdown.includes('](' + url + ')'), item.id + ' is missing its evidence link in the human review.');
  }
  assert(Array.isArray(item.existingCoverage), item.id + ' must distinguish implemented existing work.');
  assert(markdown.includes('id="' + item.id + '"'), item.id + ' has no stable review anchor.');
  assert(markdown.includes('#### ' + item.rank + '. ' + item.title), item.id + ' has no readable card.');
  assert(markdown.includes('| ' + item.rank + ' | [' + item.title + '](#' + item.id + ')'), item.id + ' has no index entry.');
}
assert.deepEqual(count, { P0: 7, P1: 19, P2: 8 });
assert.deepEqual(count, Object.fromEntries(Object.keys(count).map(k => [k, report.opportunities.filter(x => x.priority === k).length])));

const byId = id => report.opportunities.find(x => x.id === id);
for (const id of ['ugc-fresh-data-qualification', 'acp-stable-schema-variants',
  'acp-inventory-freshness-delta', 'openai-paid-ads-feed-separation',
  'webmcp-real-form-progressive', 'ietf-ai-preference-header-watch',
  'eea-vss-aggregator-eligibility']) {
  assert(byId(id), 'Missing gated program: ' + id);
  assert.match(byId(id).skip, /Do not|Don't|Never|Skip|Not applicable/i);
}
assert.match(byId('ugc-fresh-data-qualification').insight, /UGC/i);
assert.equal(byId('ugc-fresh-data-qualification').priority, 'P2');
assert.equal(byId('webmcp-real-form-progressive').priority, 'P2');
assert.match(byId('webmcp-real-form-progressive').measure, /not indexing or ranking/i);
assert.match(byId('openai-paid-ads-feed-separation').insight, /different from ACP organic/i);
assert.match(byId('october-ai-copy-editorial-gate').title, /generated-looking|inspected/i);
assert.match(markdown, /current M1 proof-before-expansion gate stays intact/i);

const currentBots = 'https://developers.openai.com/api/docs/bots';
const oldFaq = 'https://help.openai.com/en/articles/12627856-publishers-and-developers-faq';
const old = sources.sources.find(s => s.id === 'openai-publishers-developers');
const active = sources.sources.find(s => s.id === 'openai-current-crawler-docs');
assert.equal(old.url, oldFaq, 'Historical source remains reviewable, not rewritten into a false claim.');
assert.equal(active.url, currentBots);
assert.equal(active.provider, 'openai');
assert.equal(active.reviewedThrough, '2026-10-10');
assert.match(active.note, /does not support previous Atlas ARIA/);
assert.equal(sources.guardrails.noAutomaticAdoptPromotion, true);
assert.equal(sources.guardrails.promotionRequiresReview, true);
assert.equal(sourceRedirectNeedsReview(oldFaq, 'https://help.openai.com/en/articles/20001371-chatgpt-atlas-retirement'), true);
assert.equal(sourceRedirectNeedsReview(currentBots, currentBots), false);

const controls = read('docs/OPENAI-CHATGPT-SEARCH-CONTROLS.md');
assert.match(controls, /Source-integrity note, reviewed 10 October 2026/);
assert(controls.includes(currentBots));
assert(controls.includes(oldFaq));
assert.match(controls, /separate current topic-matching source review/);
assert.match(markdown, /An increase in indexed-state classifications|indexed-state classifications|Indexed URL counts/i);
console.log('PASS 34 research recommendations: primary sources, applicability, privacy/stop gates, historical watch sources and publication boundaries');
