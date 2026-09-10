import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectSearchAppearance, MAX_HTML_BYTES, SOURCES } from '../lib/search-appearance.mjs';

let cases = 0;
function test(name, run) { run(); cases += 1; console.log(`PASS ${name}`); }
const rootUrl = 'https://example.com/';
const website = { '@context': 'https://schema.org', '@type': 'WebSite', '@id': '#website', name: 'Example', alternateName: ['EX'], url: rootUrl };
const script = value => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
const page = (head = '', body = '') => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
const inspect = (html, url = rootUrl) => inspectSearchAppearance({ html, url });
const check = (report, id) => report.checks.find(item => item.id === `appearance:${id}`);
const identityHead = '<title>Example: useful reference</title><meta name="description" content="A clear reference for people looking for Example resources."><meta content="EX" property="og:site_name">';
const valid = page(identityHead + script(website) + '<link sizes="64x64" href="/icon.png" rel="icon">');

test('root site identity is observed, not a ranking or live-asset pass', () => {
  const report = inspect(valid);
  assert.equal(report.scope, 'hostname-root');
  assert.equal(check(report, 'page-title').status, 'observed');
  assert.equal(check(report, 'meta-description').status, 'observed');
  assert.equal(check(report, 'site-name').status, 'observed');
  assert.equal(check(report, 'name-consistency').status, 'observed');
  assert.equal(check(report, 'title-name-consistency').status, 'observed');
  assert.equal(check(report, 'favicon-dimensions').status, 'not-assessed');
  assert.equal(report.guardrails.noRankingClaim, true);
  assert.equal(report.coverage.actualSearchAppearance, 'not-assessed');
  assert.equal(report.actions.length, 0);
});
test('project and localized paths never get hostname-brand remediation', () => {
  for (const url of ['https://owner.github.io/project/', 'https://example.com/de/', 'https://example.com/index.html', 'https://example.com/?lang=de']) {
    const report = inspect(page(), url);
    assert.equal(report.scope, 'non-root');
    assert.equal(check(report, 'site-scope').status, 'not-applicable');
    assert.equal(check(report, 'site-name'), undefined);
    assert.equal(check(report, 'favicon-link'), undefined);
    assert.equal(check(report, 'page-title').status, 'not-observed');
    assert.equal(check(report, 'meta-description').status, 'not-observed');
    assert.ok(report.actions.every(action => !action.id.includes('site-name') && !action.id.includes('favicon')));
  }
});
test('title and description are observed without character-count folklore', () => {
  const report = inspect(page('<title>Example — a deliberately descriptive title without a numeric SEO gate</title><meta name="description" content="This description is assessed for presence only; snippet selection remains outside static coverage.">'));
  assert.equal(check(report, 'page-title').status, 'observed');
  assert.equal(check(report, 'meta-description').status, 'observed');
  assert.deepEqual(report.observations.pageTitles, ['Example — a deliberately descriptive title without a numeric SEO gate']);
});
test('missing or duplicate title and description produce review actions', () => {
  const missing = inspect(page());
  assert.equal(check(missing, 'page-title').status, 'not-observed');
  assert.equal(check(missing, 'meta-description').status, 'not-observed');
  const duplicate = inspect(page('<title>Example</title><title>Other</title><meta name="description" content="One"><meta name="description" content="Two">'));
  assert.equal(check(duplicate, 'page-title').status, 'review');
  assert.equal(check(duplicate, 'meta-description').status, 'review');
});
test('root title should visibly carry the declared site name', () => {
  const report = inspect(page('<title>Generic decision tools</title><meta name="description" content="Useful tools."><meta property="og:site_name" content="Example">' + script(website)));
  assert.equal(check(report, 'title-name-consistency').status, 'review');
});
test('missing og site name is a hostname identity review, not a ranking claim', () => {
  const report = inspect(page('<title>Example</title><meta name="description" content="Useful tools.">' + script(website)));
  assert.equal(check(report, 'name-consistency').status, 'review');
});
test('subdomain roots have their own inspectable scope', () => {
  const url = 'https://news.example.com/';
  assert.equal(check(inspect(page(script({ ...website, url })), url), 'site-name').status, 'observed');
});
test('missing JSON-LD is not proof all structured data is missing', () => {
  const report = inspect(page('<div itemscope itemtype="https://schema.org/WebSite"></div>'));
  assert.equal(check(report, 'site-name').status, 'not-observed');
  assert.equal(report.coverage.microdataAndRdfa, 'not-assessed');
  assert.ok(report.actions.every(action => action.implementation.autofix === false));
});
test('malformed JSON-LD survives beside valid blocks and also on leaf pages', () => {
  for (const url of [rootUrl, 'https://example.com/docs/']) {
    const report = inspect(page(script(website) + '<script type="application/ld+json">{"broken":</script>'), url);
    assert.equal(check(report, 'jsonld-syntax').status, 'fail');
    assert.ok(report.actions.some(action => action.id === 'growth:appearance:jsonld-syntax'));
  }
});
test('comments, templates, styles and script examples are not live metadata', () => {
  const fake = script(website) + '<link rel="icon" href="/fake.png">';
  for (const wrapper of [`<!--${fake}-->`, `<template><template>${fake}</template></template>`, `<noscript>${fake}</noscript>`, `<style>${fake}</style>`, `<textarea>${fake}</textarea>`]) {
    const report = inspect(page(wrapper));
    assert.equal(report.observations.websites.length, 0);
    assert.equal(report.observations.faviconDeclarations.length, 0);
  }
  const report = inspect(page('<script>const demo = \'<link rel="icon" href="/fake.png">\';</script>'));
  assert.equal(report.observations.faviconDeclarations.length, 0);
});
test('JSON-LD in body is read but icon links in body are not promoted to head', () => {
  const report = inspect(page('', script(website) + '<link rel="icon" href="/fake.png">'));
  assert.equal(check(report, 'site-name').status, 'observed');
  assert.equal(check(report, 'favicon-link').status, 'not-observed');
});
test('graph arrays and split same-id nodes merge without invented conflicts', () => {
  const report = inspect(page(script({ '@context': 'https://schema.org/', '@graph': [
    { '@id': '#website', '@type': ['WebSite'], name: 'Example' }, { '@id': '#website', url: rootUrl }
  ] })));
  assert.equal(check(report, 'site-name').status, 'observed');
  assert.equal(check(inspect(page(script([website]))), 'site-name').status, 'observed');
});
test('conflicting names remain visible rather than last-write-wins', () => {
  const report = inspect(page(script({ '@context': 'https://schema.org', '@graph': [website, { '@id': '#website', name: 'Different' }] })));
  assert.equal(check(report, 'site-name').status, 'review');
  assert.deepEqual(report.observations.websites[0].names, ['Example', 'Different']);
});
test('unsupported context never pretends to be Schema.org', () => {
  const report = inspect(page(script({ ...website, '@context': 'https://unrelated.example/' })));
  assert.equal(report.coverage.unsupportedJsonLdContext, true);
  assert.equal(check(report, 'site-name').status, 'not-assessed');
});
test('expanded Schema.org type IRI works inside supported context', () => {
  assert.equal(check(inspect(page(script({ ...website, '@type': 'https://schema.org/WebSite' }))), 'site-name').status, 'observed');
});
test('missing names, missing URLs, relative URLs and cross-origin identities need review', () => {
  for (const change of [{ name: '' }, { url: '' }, { url: '/' }, { url: 'https://other.example/' }, { url: 'https://example.com/project/' }, { url: 'https://example.com/#id' }]) {
    assert.equal(check(inspect(page(script({ ...website, ...change }))), 'site-name').status, 'review');
  }
});
test('duplicate WebSite declarations are reviewed, not auto-replaced', () => {
  assert.equal(check(inspect(page(script([website, { ...website, '@id': '#another' }]))), 'site-name').status, 'review');
});
test('name consistency accepts genuine alternateName and flags mismatches', () => {
  const report = inspect(page(script(website) + '<meta property="og:site_name" content="Other">'));
  assert.equal(check(report, 'name-consistency').status, 'review');
});
test('relative/CDN icons, first base, attribute order and entity decoding work', () => {
  const report = inspect(page('<BASE href="https://cdn.example/assets/"><base href="https://ignored.example/"><link HREF="icon.png?a=1&amp;b=2" sizes="64x64" REL="shortcut ICON">'));
  assert.equal(report.observations.faviconDeclarations[0].url, 'https://cdn.example/assets/icon.png?a=1&b=2');
  assert.equal(check(report, 'favicon-link').status, 'observed');
  for (const rel of ['apple-touch-icon', 'apple-touch-icon-precomposed']) assert.equal(check(inspect(page(`<link rel="${rel}" href="/icon.png">`)), 'favicon-link').status, 'observed');
});
test('non-HTTP icons and unsafe bases are not usable fetch declarations', () => {
  for (const href of ['data:image/png;base64,AA', 'javascript:alert(1)', 'https://user:pass@example.com/icon.png', '']) {
    assert.equal(check(inspect(page(`<link rel="icon" href="${href}">`)), 'favicon-link').status, 'review');
  }
  assert.equal(check(inspect(page('<base href="data:text/plain,hello"><link rel="icon" href="icon.png">')), 'favicon-link').status, 'review');
});
test('SVG-only declaration triggers dated format review, a raster alternative removes it', () => {
  assert.equal(check(inspect(page('<link rel="icon" href="/icon.svg" type="image/svg+xml">')), 'favicon-format').status, 'review');
  assert.equal(check(inspect(page('<link rel="icon" href="/icon.svg"><link rel="icon" href="/icon.png">')), 'favicon-format').status, 'not-assessed');
});
test('no fabricated multiple-of-48 rule or byte-level size pass', () => {
  for (const size of ['8x8', '32x32', '48x48', '64x64', '128x128', 'any', '']) {
    assert.equal(check(inspect(page(`<link rel="icon" href="/icon.png" sizes="${size}">`)), 'favicon-dimensions').status, 'not-assessed');
  }
  for (const size of ['4x4', '16x32']) assert.equal(check(inspect(page(`<link rel="icon" href="/icon.png" sizes="${size}">`)), 'favicon-dimensions').status, 'review');
});
test('headless fragments, extensionless icons and invalid sizes stay unassessed', () => {
  assert.equal(check(inspect('<link rel="icon" href="/icon.png">'), 'favicon-link').status, 'not-assessed');
  const report = inspect(page('<link rel="icon" href="/icon" sizes="nonsense">'));
  assert.equal(check(report, 'favicon-format').status, 'not-assessed');
  assert.equal(check(report, 'favicon-dimensions').status, 'not-assessed');
});
test('input bounds, URL validation and deterministic output', () => {
  assert.throws(() => inspect(null), /html must/);
  assert.throws(() => inspect('x'.repeat(MAX_HTML_BYTES + 1)), /1 MiB/);
  assert.throws(() => inspect('', 'file:///etc/passwd'), /HTTP/);
  assert.throws(() => inspect('', 'https://u:p@example.com/'), /HTTP/);
  assert.deepEqual(inspect(valid), inspect(valid));
  assert.ok(inspect(valid).checks.every(item => Object.values(SOURCES).includes(item.source)));
});
test('large graphs stay bounded and expose incomplete coverage', () => {
  const report = inspect(page(script({ '@context': 'https://schema.org', '@graph': Array.from({ length: 2200 }, () => ({ '@type': 'Thing' })) })));
  assert.equal(report.coverage.graphLimitReached, true);
  assert.equal(check(report, 'site-name').status, 'not-assessed');
});

test('wide JSON arrays cannot exhaust the call stack before traversal limits', () => {
  const report = inspect(page(script(Array.from({ length: 150000 }, () => null))));
  assert.equal(report.coverage.graphLimitReached, true);
  assert.equal(check(report, 'site-name').status, 'not-assessed');
});

test('unclosed raw-text sequences stay bounded and cannot expose fake tags', () => {
  const report = inspect('<html><head>' + '<script>'.repeat(30000) + '<link rel=icon href=/fake.png>');
  assert.equal(report.coverage.incompleteRawText, true);
  assert.equal(report.observations.faviconDeclarations.length, 0);
  assert.equal(check(report, 'site-name').status, 'not-assessed');
  assert.equal(check(report, 'favicon-link').status, 'not-assessed');
  assert.equal(check(report, 'page-title').status, 'not-assessed');
});

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'arwp-appearance-'));
const cli = fileURLToPath(new URL('../bin/arwp-search-appearance.mjs', import.meta.url));
try {
  const input = path.join(directory, 'index.html');
  fs.writeFileSync(input, valid);
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  test('CLI emits valid JSON and strict success without network', () => {
    const result = run(input, `--url=${rootUrl}`, '--strict');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).guardrails.noNetworkRequests, true);
  });
  test('CLI strict review status differs from invalid invocation', () => {
    fs.writeFileSync(input, page(script(website) + '<link rel="icon" href="/icon.svg">'));
    assert.equal(run(input, `--url=${rootUrl}`, '--strict').status, 1);
    assert.equal(run(input, `--url=${rootUrl}`).status, 0);
    for (const args of [[], [input], [input, '--unknown'], [input, `--url=${rootUrl}`, `--url=${rootUrl}`]]) assert.equal(run(...args).status, 2);
  });
  test('CLI writes a new report without overwriting input or existing output', () => {
    const output = path.join(directory, 'report.json');
    assert.equal(run(input, `--url=${rootUrl}`, `--output=${output}`).status, 0);
    assert.equal(JSON.parse(fs.readFileSync(output, 'utf8')).searchAppearanceVersion, '0.2');
    assert.equal(run(input, `--url=${rootUrl}`, `--output=${output}`).status, 2);
    const before = fs.readFileSync(input);
    assert.equal(run(input, `--url=${rootUrl}`, `--output=${input}`).status, 2);
    assert.deepEqual(fs.readFileSync(input), before);
  });
  test('CLI rejects oversize, directories and invalid UTF-8', () => {
    fs.writeFileSync(input, Buffer.alloc(MAX_HTML_BYTES + 1));
    assert.equal(run(input, `--url=${rootUrl}`).status, 2);
    assert.equal(run(directory, `--url=${rootUrl}`).status, 2);
    fs.writeFileSync(input, Buffer.from([0xff, 0xfe]));
    assert.equal(run(input, `--url=${rootUrl}`).status, 2);
    assert.equal(run('--help').status, 0);
  });
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
console.log(`PASS ${cases} Search appearance cases; static observations never become ranking, rendered-DOM or live-asset claims.`);
