import assert from 'node:assert/strict';
import { analyzeDatasetPublication, auditDatasetPublication } from '../lib/dataset-publication.mjs';

const datasetHtml = `<!doctype html><html><head>
<script type="application/ld+json">{
  "@context":"https://schema.org",
  "@type":"Dataset",
  "name":"Example Corpus",
  "url":"https://example.org/dataset/",
  "version":"1.2.0",
  "license":"https://creativecommons.org/licenses/by/4.0/",
  "identifier":"https://doi.org/10.5281/zenodo.1234567",
  "distribution":{"@type":"DataDownload","contentUrl":"https://example.org/data/corpus.jsonl"}
}</script></head><body>
<a href="/methods/">Methodology and limitations</a>
<a href="https://doi.org/10.5281/zenodo.1234567">Cite dataset</a>
<a href="/data/corpus.jsonl">Download</a>
</body></html>`;
const good = analyzeDatasetPublication({ canonicalUrl: 'https://example.org/', html: datasetHtml });
assert.equal(good.version, '0.1');
assert.equal(good.applicability, 'dataset-bearing');
assert.equal(good.status, 'citable-dataset-observed');
assert.equal(good.checks.find(item => item.id === 'dataset-persistent-identifier').status, 'pass');
assert.ok(good.evidence.doiCandidates.includes('10.5281/zenodo.1234567'));

const cffOnly = `cff-version: 1.2.0\ntitle: "Corpus"\ntype: dataset\nversion: "0.1.0"\nlicense: CC-BY-4.0\n`;
const missingDoi = analyzeDatasetPublication({
  canonicalUrl: 'https://dataset.example/',
  html: '<html><body><a href="/data/a.json">A</a><a href="/data/b.jsonl">B</a><a href="/methodology/">Methods</a></body></html>',
  citationText: cffOnly
});
assert.equal(missingDoi.status, 'dataset-doi-missing');
assert.equal(missingDoi.checks.find(item => item.id === 'dataset-persistent-identifier').status, 'fail');
assert.ok(missingDoi.recommendations.some(item => item.id === 'dataset:dataset-persistent-identifier'));

const ordinary = analyzeDatasetPublication({
  canonicalUrl: 'https://ordinary.example/',
  html: '<html><body><h1>Normal website</h1><a href="/about/">About</a></body></html>'
});
assert.equal(ordinary.status, 'not-applicable-or-undetected');
assert.equal(ordinary.checks.length, 0);

const injected = await auditDatasetPublication('https://fixture.example/', {
  entryPage: { ok: true, url: 'https://fixture.example/', text: '<html><body><a href="/data/a.json">A</a><a href="/data/b.json">B</a></body></html>' },
  resources: {
    citation: { ok: true, text: cffOnly },
    datasetMetadata: { ok: true, text: JSON.stringify({ '@context':'https://schema.org', '@type':'Dataset', name:'Fixture', version:'0.1.0', license:'CC-BY-4.0' }) },
    manifest: { ok: true, text: JSON.stringify({ distributions:[{ url:'https://fixture.example/data/a.json', sha256:'abc' }] }) }
  },
  fetchImpl: async () => { throw new Error('network must not be used for injected fixtures'); }
});
assert.equal(injected.status, 'dataset-doi-missing');
assert.equal(injected.checks.find(item => item.id === 'dataset-release-integrity').status, 'pass');

console.log('PASS dataset publication audit distinguishes genuine dataset-bearing sites, DOI-backed releases, missing DOI debt, and non-dataset sites without inventing ranking claims');
