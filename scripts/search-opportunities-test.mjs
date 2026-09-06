import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateOpportunityMap, validateSearchConsoleExport, planSearchOpportunities, formatOpportunityPlan } from '../lib/search-opportunities.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const site = 'https://example.com/project/';
const map = () => ({ schemaVersion: '1.0', site, brandTerms: ['ARWP'], opportunities: [{
  id: 'search-audit', intent: 'Audit a static website', queries: ['static website audit', 'ARWP audit'],
  targetUrl: `${site}audit/`, pageState: 'existing', businessValue: 5, effort: 2,
  conversion: 'Complete an audit', evidence: [{ type: 'tool', status: 'available', reference: 'bin/audit.mjs' }], internalLinksFrom: [site]
}] });
const row = (query, page, clicks, impressions, position) => ({ keys: [query, page], clicks, impressions, position });
const owner = () => ({ schemaVersion: '1.0', site, period: { start: '2026-08-01', end: '2026-08-28' }, searchType: 'web',
  dimensions: ['query', 'page'], aggregationType: 'byPage', dataState: 'final', filters: { country: null, device: null },
  rows: [row('static website audit', `${site}audit/`, 5, 100, 10), row('static website audit', `${site}old/`, 1, 300, 20), row('ARWP audit', `${site}audit/`, 50, 100, 1)] });
const first = (m = map(), e = null, o = {}) => planSearchOpportunities(m, e, o).opportunities[0];

test('no owner data stays null, with explicit outcome gates', () => {
  const result = planSearchOpportunities(map());
  assert.equal(result.period, null); assert.equal(result.opportunities[0].observed, null);
  assert.equal(result.opportunities[0].demandStatus, 'no-owner-data');
  assert.equal(result.outcome.rankingImpact, null); assert.equal(result.policy.automaticPublication, false);
  assert.match(formatOpportunityPlan(result), /unknown/);
});
test('weighted position, recomputed CTR and non-brand counts', () => {
  const item = first(map(), owner());
  assert.equal(item.nonBrandObserved.pageImpressions, 400); assert.equal(item.nonBrandObserved.averagePosition, 17.5);
  assert.equal(item.nonBrandObserved.ctr, 6 / 400); assert.equal(item.observed.pageImpressions, 500);
  assert.equal(item.targetObserved.pageImpressions, 200);
});
test('overlap is review-only, never a merge directive', () => {
  const item = first(map(), owner());
  assert.equal(item.overlapQueryCount, 1); assert.equal(item.queue, 'review-query-page-overlap');
  assert.ok(item.tasks.every(task => task.authority === 'review-required'));
  assert.ok(item.tasks.some(task => /do not automatically merge/.test(task.verification)));
});
test('no matched rows is not zero demand', () => {
  const e = owner(); e.rows = [row('an unrelated private query', `${site}audit/`, 1, 1, 1)];
  const report = planSearchOpportunities(map(), e);
  assert.equal(report.opportunities[0].observed, null);
  assert.equal(report.opportunities[0].demandStatus, 'no-matching-export-rows');
  assert.ok(!JSON.stringify(report).includes('an unrelated private query'));
});
test('zero impressions preserves observed zero but unknown CTR/position', () => {
  const e = owner(); e.rows = [row('static website audit', `${site}audit/`, 0, 0, null)];
  const item = first(map(), e); assert.equal(item.observed.pageImpressions, 0);
  assert.equal(item.observed.ctr, null); assert.equal(item.observed.averagePosition, null);
});
test('brand traffic alone cannot trigger non-brand opportunity priority', () => {
  const e = owner(); e.rows = [row('ARWP audit', `${site}audit/`, 100, 1000, 8)];
  assert.equal(first(map(), e).priority, 3);
});
test('brand terms match token phrases, not incidental substrings', () => {
  const m = map(); m.brandTerms = ['art'];
  const e = owner(); e.rows = [row('static website audit', `${site}audit/`, 5, 100, 8)];
  assert.equal(first(m, e).nonBrandObserved.pageImpressions, 100);
});
test('query matching supports Unicode normalization, whitespace and case', () => {
  const m = map(); m.opportunities[0].queries = ['  Проверка   САЙТА  '];
  const e = owner(); e.rows = [row('проверка сайта', `${site}audit/`, 5, 100, 8)];
  assert.equal(first(m, e).queue, 'review-near-visibility');
});
test('planned page with observed demand must review incumbent coverage', () => {
  const m = map(); m.opportunities[0].pageState = 'planned';
  assert.ok(first(m, owner()).tasks.some(task => task.kind === 'review-existing-coverage-before-new-page'));
});
test('planned pages without evidence and demand remain research', () => {
  const m = map(); m.opportunities[0].pageState = 'planned'; m.opportunities[0].evidence = []; m.opportunities[0].internalLinksFrom = [];
  const item = first(m); assert.equal(item.queue, 'research-before-publish');
  assert.ok(item.tasks.some(task => task.kind === 'produce-original-asset'));
  assert.ok(item.tasks.some(task => task.kind === 'add-relevant-internal-link'));
});
test('external references alone do not count as original assets', () => {
  const m = map(); m.opportunities[0].evidence[0].type = 'primary-source';
  assert.equal(first(m).originalAssetDeclared, false);
});
test('priority threshold is explicit and configurable', () => {
  const e = owner(); e.rows = e.rows.slice(0, 1);
  assert.equal(first(map(), e).priority, 1);
  assert.equal(first(map(), e, { minImpressions: 101 }).priority, 3);
});
test('equal inputs produce deterministic reports and do not mutate inputs', () => {
  const m = map(), e = owner(), before = JSON.stringify([m, e]);
  assert.deepEqual(planSearchOpportunities(m, e), planSearchOpportunities(m, e));
  assert.equal(JSON.stringify([m, e]), before);
});
test('query strings remain distinct page identifiers', () => {
  const e = owner(); e.rows[1].keys[1] = `${site}audit/?edition=2`;
  assert.equal(first(map(), e).overlapQueryCount, 1);
});
test('raw query strings and row arrays are omitted from report', () => {
  const encoded = JSON.stringify(planSearchOpportunities(map(), owner()));
  assert.ok(!encoded.includes('static website audit')); assert.ok(!encoded.includes('"rows"'));
});

const invalidMaps = [
  ['unknown map fields', m => { m.searchVolume = 1000; }],
  ['wrong version', m => { m.schemaVersion = '2.0'; }],
  ['non-http site', m => { m.site = 'file:///tmp/'; }],
  ['missing site slash', m => { m.site = site.slice(0, -1); }],
  ['scope prefix escape', m => { m.opportunities[0].targetUrl = 'https://example.com/project-other/audit/'; }],
  ['cross-origin target', m => { m.opportunities[0].targetUrl = 'https://elsewhere.example/audit/'; }],
  ['URL credentials', m => { m.opportunities[0].targetUrl = 'https://secret@example.com/project/audit/'; }],
  ['fragment target', m => { m.opportunities[0].targetUrl += '#section'; }],
  ['duplicate query', m => { m.opportunities[0].queries.push(' STATIC website AUDIT '); }],
  ['ambiguous mapping', m => { const other = structuredClone(m.opportunities[0]); other.id = 'other'; m.opportunities.push(other); }],
  ['missing conversion', m => { m.opportunities[0].conversion = ''; }],
  ['invalid business value', m => { m.opportunities[0].businessValue = 6; }],
  ['invalid effort', m => { m.opportunities[0].effort = 0; }],
  ['control character', m => { m.opportunities[0].intent = '\u001b[0m'; }],
  ['empty map', m => { m.opportunities = []; }]
];
for (const [name, mutate] of invalidMaps) test(`reject map: ${name}`, () => { const m = map(); mutate(m); assert.throws(() => validateOpportunityMap(m)); });
const invalidExports = [
  ['wrong site', e => { e.site = 'https://another.example/'; }],
  ['wrong dimensions', e => { e.dimensions = ['page', 'query']; }],
  ['query-only data', e => { e.dimensions = ['query']; }],
  ['by-property aggregation', e => { e.aggregationType = 'byProperty'; }],
  ['mixed surface', e => { e.searchType = 'discover'; }],
  ['preliminary data', e => { e.dataState = 'all'; }],
  ['impossible date', e => { e.period.start = '2026-02-30'; }],
  ['reversed window', e => { e.period.start = '2026-09-01'; }],
  ['duplicate rows', e => { e.rows.push(structuredClone(e.rows[0])); }],
  ['negative count', e => { e.rows[0].clicks = -1; }],
  ['clicks above impressions', e => { e.rows[0].clicks = 101; }],
  ['missing count', e => { delete e.rows[0].impressions; }],
  ['non-finite position', e => { e.rows[0].position = Infinity; }],
  ['missing position', e => { e.rows[0].position = null; }],
  ['zero position', e => { e.rows[0].position = 0; }],
  ['out-of-scope page', e => { e.rows[0].keys[1] = 'https://example.com/project2/'; }],
  ['invalid CTR', e => { e.rows[0].ctr = 2; }],
  ['unexplained segment', e => { delete e.filters; }],
  ['unknown row field', e => { e.rows[0].email = 'private@example.com'; }]
];
for (const [name, mutate] of invalidExports) test(`reject export: ${name}`, () => { const e = owner(); mutate(e); assert.throws(() => validateSearchConsoleExport(e, site)); });
test('aggregated counts cannot silently lose precision', () => {
  const e = owner(); e.rows[0].impressions = Number.MAX_SAFE_INTEGER; e.rows[1].impressions = Number.MAX_SAFE_INTEGER;
  assert.throws(() => first(map(), e), /safe integer/);
});
test('CLI JSON, immutable output and invalid option behavior', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-opportunities-'));
  try {
    const input = path.join(dir, 'map.json'), exported = path.join(dir, 'owner.json'), output = path.join(dir, 'report.json');
    fs.writeFileSync(input, JSON.stringify(map())); fs.writeFileSync(exported, JSON.stringify(owner()));
    const run = (...args) => spawnSync(process.execPath, [path.join(root, 'bin/arwp-opportunities.mjs'), ...args], { encoding: 'utf8' });
    assert.equal(run('--help').status, 0);
    const result = run(input, `--search-console=${exported}`, `--output=${output}`, '--json');
    assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).opportunities[0].priority, 1);
    const original = fs.readFileSync(output, 'utf8');
    assert.equal(run(input, `--output=${output}`).status, 2); assert.equal(fs.readFileSync(output, 'utf8'), original);
    assert.equal(run(input, '--unknown').status, 2); assert.equal(run(input, '--json', '--json').status, 2);
    assert.equal(run(input, '--min-impressions=NaN').status, 2);
    fs.writeFileSync(input, '{invalid private contents');
    const broken = run(input); assert.equal(broken.status, 2); assert.ok(!broken.stderr.includes('private contents'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('published self-pilot retains unknown owner outcomes for every opportunity', () => {
  const m = JSON.parse(fs.readFileSync(path.join(root, 'templates/growth/arwp-opportunity-map.json'), 'utf8'));
  const result = planSearchOpportunities(m);
  assert.equal(result.opportunities.length, 4);
  assert.ok(result.opportunities.every(item => item.observed === null && item.demandStatus === 'no-owner-data'));
  assert.equal(result.outcome.rankingImpact, null);
});
test('public guide is linked from Growth, canonicalized and listed in the sitemap', () => {
  const page = fs.readFileSync(path.join(root, 'docs/growth/opportunities/index.html'), 'utf8');
  assert.match(page, /<html lang="en">/);
  assert.equal((page.match(/<h1>/g) ?? []).length, 1);
  assert.match(page, /rel="canonical" href="https:\/\/dkharlanau.github.io\/agent-ready-web-profile\/growth\/opportunities\/"/);
  assert.match(page, /not yet measured/);
  assert.ok(fs.readFileSync(path.join(root, 'docs/growth/index.html'), 'utf8').includes('href="./opportunities/"'));
  assert.ok(fs.readFileSync(path.join(root, 'docs/sitemap.xml'), 'utf8').includes('<loc>https://dkharlanau.github.io/agent-ready-web-profile/growth/opportunities/</loc>'));
});
