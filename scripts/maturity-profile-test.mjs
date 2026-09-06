import assert from 'node:assert/strict';
import fs from 'node:fs';
import { auditMaturity, jsonLdNodes, safeRelativePath } from '../lib/maturity-profile.mjs';

const site = 'https://example.org/';
const creator = { '@id': `${site}#owner`, '@type': 'Person', name: 'Example Maintainer' };
const dataset = { '@id': `${site}#data`, '@type': 'Dataset', name: 'Fixture data', description: 'Synthetic test-only records for contract validation; not published research or evidence of adoption.', url: `${site}data/`, creator: { '@id': creator['@id'] }, license: 'https://creativecommons.org/licenses/by/4.0/', distribution: { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${site}data/rows.json` } };
const graph = { '@graph': [creator, { '@id': `${site}#site`, '@type': 'WebSite', url: site }, { '@id': `${site}#project`, '@type': 'SoftwareSourceCode', name: 'Fixture' }, dataset] };
const plan = { schemaVersion: '1.0', unknownIsZero: false, publicExport: 'aggregate-only', personalDataAllowed: false, metrics: [{ id: 'uses', definition: 'Completed example uses', source: 'Owner export', grain: 'week', limitation: 'Consent-limited', status: 'not-measured', baseline: null }] };
const profile = { schemaVersion: '1.0', site, stage: 'pre-stable', identity: { graph: 'graph.json', subjectId: `${site}#project`, ownerId: creator['@id'], websiteId: `${site}#site` }, policies: { license: 'LICENSE' }, datasets: [{ id: dataset['@id'], landingPage: 'data/index.html', distribution: 'data/rows.json', license: dataset.license, limitations: 'Synthetic unit fixture only', doi: { state: 'not-issued', value: null } }], citation: { file: 'CITATION.cff', doi: { state: 'not-issued', value: null } }, analytics: { plan: 'plan.json' } };
const files = { 'graph.json': JSON.stringify(graph), 'LICENSE': 'Fixture license', 'data/rows.json': '[{"value":1}]', 'data/index.html': `<script type="application/ld+json">${JSON.stringify(dataset)}</script>`, 'CITATION.cff': 'cff-version: 1.2.0\n', 'plan.json': JSON.stringify(plan) };
const run = (p = profile, f = files) => auditMaturity(p, { readText: name => { if (!(name in f)) throw new Error('Missing file'); return f[name]; } });
const clone = value => JSON.parse(JSON.stringify(value));
let cases = 0;
const test = (name, fn) => { fn(); cases++; console.log(`PASS ${name}`); };

test('valid inventory and reproducible hashes', () => { assert.equal(run().valid, true); assert.deepEqual(run(), run()); assert.ok(run().files.every(f => /^[a-f0-9]{64}$/.test(f.sha256))); });
test('no dataset obligation on sites without datasets', () => { const p = clone(profile); p.datasets = []; assert.equal(run(p).valid, true); });
test('missing dataset description is a failure', () => { const d = clone(dataset); delete d.description; assert.equal(run(profile, { ...files, 'data/index.html': `<script type="application/ld+json">${JSON.stringify(d)}</script>` }).valid, false); });
test('dataset descriptions respect documented length limits', () => { for (const description of ['too short', 'x'.repeat(5001)]) { const d = { ...dataset, description }; assert.equal(run(profile, { ...files, 'data/index.html': `<script type="application/ld+json">${JSON.stringify(d)}</script>` }).valid, false); } });
test('duplicate canonical identity is a failure', () => { const g = clone(graph); g['@graph'].push(creator); assert.equal(run(profile, { ...files, 'graph.json': JSON.stringify(g) }).valid, false); });
test('unissued DOI cannot contain a decorative value', () => { const p = clone(profile); p.datasets[0].doi.value = '10.1234/example'; assert.equal(run(p).valid, false); });
test('issued DOI requires publication evidence, not just syntax', () => { const p = clone(profile); p.citation.doi = { state: 'issued', value: '10.1234/example' }; assert.equal(run(p).valid, false); });
test('CFF cannot silently claim an unissued DOI', () => assert.equal(run(profile, { ...files, 'CITATION.cff': 'doi: 10.1234/example\n' }).valid, false));
test('unknown is not zero', () => { const p = clone(plan); p.metrics[0].baseline = 0; assert.equal(run(profile, { ...files, 'plan.json': JSON.stringify(p) }).valid, false); });
test('missing distribution is reported', () => { const f = { ...files }; delete f['data/rows.json']; assert.equal(run(profile, f).valid, false); });
test('identity/name drift is reported', () => { const d = clone(dataset); d.name = 'Unrelated dataset'; assert.equal(run(profile, { ...files, 'data/index.html': `<script type="application/ld+json">${JSON.stringify(d)}</script>` }).valid, false); });
test('path traversal and Windows absolute paths rejected', () => { for (const value of ['../secret', '/tmp/secret', 'a/../b', 'C:\\secret', 'a//b', './x']) assert.equal(safeRelativePath(value), false); });
test('malformed profiles do not crash', () => { for (const value of [null, [], {}, { ...profile, datasets: [null, 1] }, { ...profile, identity: null }, { ...profile, datasets: [{ distribution: 42 }] }]) assert.equal(run(value).valid, false); });
test('malformed JSON-LD is reported', () => assert.equal(run(profile, { ...files, 'data/index.html': '<script type="application/ld+json">{oops}</script>' }).valid, false));
test('empty policy artifacts fail', () => assert.equal(run(profile, { ...files, LICENSE: '' }).valid, false));
test('LD graph blocks can be parsed', () => assert.equal(jsonLdNodes(`<script type="application/ld+json">${JSON.stringify(graph)}</script>`).length, 4));

if (process.argv.includes('--site')) {
  const p = JSON.parse(fs.readFileSync('docs/maturity/profile.json', 'utf8'));
  const result = auditMaturity(p, { readText: file => fs.readFileSync(file, 'utf8') });
  assert.equal(result.valid, true, result.errors.join('\n'));
  const catalog = JSON.parse(fs.readFileSync('docs/datasets/catalog.jsonld', 'utf8'));
  const nodes = JSON.parse(fs.readFileSync(p.identity.graph, 'utf8'))['@graph'];
  for (const reference of catalog.dataset) assert.ok(nodes.some(n => n['@id'] === reference['@id'] && n['@type'] === 'Dataset'));
  const sitemap = fs.readFileSync('docs/sitemap.xml', 'utf8');
  for (const route of ['maturity/', 'datasets/', 'measurement/', 'trust/brand.html']) {
    const file = `docs/${route.endsWith('/') ? `${route}index.html` : route}`;
    const html = fs.readFileSync(file, 'utf8');
    assert.ok(html.includes(`href="${p.site}${route}"`), `${file}: canonical missing`);
    assert.ok(sitemap.includes(`${p.site}${route}</loc>`), `${file}: sitemap missing`);
    assert.ok(html.includes('<h1>') && html.includes('name="description"'), `${file}: empty landing page`);
    jsonLdNodes(html);
  }
  assert.match(fs.readFileSync('docs/trust/index.html', 'utf8'), /\.\.\/maturity\//);
  console.log(`PASS repository integration: ${result.files.length} observed artifacts, canonical dataset parity and four public routes`);
}
console.log(`PASS ${cases} maturity regression cases; no network or provider credentials used`);
