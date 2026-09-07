import assert from 'node:assert/strict';
import { analyzeVerticalEvidence, verticalEvidenceActions } from '../lib/growth-vertical-evidence.mjs';
import { buildGrowthPlan } from '../lib/growth-plan-vertical.mjs';

const softwareHtml = `<!doctype html><html><head>
<script type="application/ld+json">{
  "@context":"https://schema.org",
  "@type":"SoftwareApplication",
  "name":"Example Product",
  "url":"https://software.example/",
  "softwareVersion":"2.4.0"
}</script></head><body>
<a href="/docs/">Documentation</a>
<a href="/examples/">Examples</a>
<a href="/trust/">Trust & security</a>
<a href="/changelog/">Changelog</a>
<a href="/api/">API</a>
</body></html>`;

const software = analyzeVerticalEvidence({
  vertical: 'software-product',
  canonicalUrl: 'https://software.example/',
  html: softwareHtml
});
assert.equal(software.version, '0.1');
assert.equal(software.registryVersion, '0.2');
assert.equal(software.coverage, 'audited-entry-page-public-evidence');
assert.equal(software.checks.length, 4);
assert.equal(software.checks.find(item => item.id === 'software-product-identity').status, 'observed');
assert.equal(software.checks.find(item => item.id === 'software-product-release-history').status, 'observed');
assert.equal(software.checks.find(item => item.id === 'software-product-docs-support').status, 'observed');
assert.equal(software.checks.find(item => item.id === 'software-product-agent-interfaces').status, 'observed');
assert.equal(verticalEvidenceActions(software).length, 0, 'complete entry-page software evidence should not create vertical remediation');

const weakSoftware = analyzeVerticalEvidence({
  vertical: 'software-product',
  canonicalUrl: 'https://weak-software.example/',
  html: '<!doctype html><html><head></head><body><h1>Example Product</h1><a href="/docs/">Docs</a></body></html>'
});
const weakSoftwareActions = verticalEvidenceActions(weakSoftware);
assert.ok(weakSoftwareActions.some(item => item.id === 'growth:vertical:software-product-identity'));
assert.ok(weakSoftwareActions.some(item => item.id === 'growth:vertical:software-product-release-history'));
assert.ok(weakSoftwareActions.some(item => item.id === 'growth:vertical:software-product-docs-support'));
assert.equal(weakSoftwareActions.some(item => item.id === 'growth:vertical:software-product-agent-interfaces'), false, 'absence of an agent/API interface must not cause ARWP to recommend inventing one');
assert.ok(weakSoftwareActions.every(item => /Entry-page evidence is partial by design/.test(item.reason)));
assert.ok(weakSoftwareActions.every(item => /Do not create thin pages, fake structured data or unsupported agent interfaces/.test(item.implementation.note)));

const researchHtml = `<!doctype html><html><head>
<script type="application/ld+json">{
  "@context":"https://schema.org",
  "@type":"Dataset",
  "name":"Example Corpus 2026",
  "url":"https://research.example/dataset/",
  "license":"https://creativecommons.org/licenses/by/4.0/",
  "version":"2026.09",
  "identifier":"doi:10.0000/example"
}</script></head><body>
<h1>Example Corpus 2026</h1>
<p>Methodology, sampling and limitations are published with the release. Preferred citation is provided below.</p>
<a href="/methodology/">Methodology and provenance</a>
<a href="/citation/">Citation</a>
<a href="/license/">License</a>
<a href="/releases/">Version history</a>
<a href="/downloads/example-2026.csv">Download CSV</a>
</body></html>`;
const research = analyzeVerticalEvidence({
  vertical: 'research-dataset',
  canonicalUrl: 'https://research.example/',
  html: researchHtml
});
assert.equal(research.checks.find(item => item.id === 'research-dataset-identity').status, 'observed');
assert.equal(research.checks.find(item => item.id === 'research-dataset-methodology-provenance').status, 'observed');
assert.equal(research.checks.find(item => item.id === 'research-dataset-citation-license').status, 'observed');
assert.equal(research.checks.find(item => item.id === 'research-dataset-access').status, 'observed');
assert.equal(verticalEvidenceActions(research).length, 0);

const docs = analyzeVerticalEvidence({
  vertical: 'documentation',
  canonicalUrl: 'https://docs.example/',
  html: '<!doctype html><html><body><a href="/guide/a/">A</a><a href="/guide/b/">B</a><a href="/guide/c/">C</a><a href="/versions/">Versions</a><a href="/examples/">Examples</a><pre><code>npm install example</code></pre></body></html>'
});
assert.equal(docs.checks.every(item => item.status === 'observed'), true);

const commerce = analyzeVerticalEvidence({
  vertical: 'commerce',
  canonicalUrl: 'https://shop.example/',
  html: '<!doctype html><html><body><a href="/shipping/">Shipping</a><a href="/returns/">Returns</a></body></html>'
});
assert.equal(commerce.checks.find(item => item.id === 'commerce-feed-freshness').status, 'external-owner-data');
assert.equal(verticalEvidenceActions(commerce).length, 0, 'first adapter release must not turn owner/feed checks into public-crawl remediation');

const basePlan = {
  profile: '2026-09-06',
  canonicalUrl: 'https://weak-software.example/',
  summary: { totalActions: 1, byPriority: { P1: 1 }, byLane: { search: 1 } },
  observations: {},
  actions: [{ id: 'audit:eligibility', priority: 'P1', lane: 'search', title: 'Fix eligibility', status: 'warn', reason: 'fixture' }],
  refinements: {},
  note: 'No guarantee.'
};
const wrapped = await buildGrowthPlan('https://weak-software.example/', {
  vertical: 'software-product',
  baseBuildImpl: async () => structuredClone(basePlan),
  entryPage: { ok: true, url: 'https://weak-software.example/', text: '<html><body><h1>Product</h1><a href="/docs/">Docs</a></body></html>' }
});
assert.equal(wrapped.observations.verticalEvidence.vertical, 'software-product');
assert.equal(wrapped.refinements.verticalEvidenceVersion, '0.1');
assert.equal(wrapped.refinements.verticalEvidenceEntryPageRefetch, false);
assert.ok(wrapped.actions.some(item => item.id === 'audit:eligibility'));
assert.ok(wrapped.actions.some(item => item.id === 'growth:vertical:software-product-release-history'));
assert.ok(wrapped.summary.totalActions > basePlan.summary.totalActions);

const unavailable = await buildGrowthPlan('https://software.example/', {
  vertical: 'software-product',
  baseBuildImpl: async () => ({ ...structuredClone(basePlan), canonicalUrl: 'https://software.example/' }),
  entryPage: { ok: false, url: 'https://software.example/', issue: 'fixture unavailable', text: null }
});
assert.equal(unavailable.observations.verticalEvidence.coverage, 'unavailable');
assert.equal(unavailable.observations.verticalEvidence.summary.unavailable, 4);
assert.equal(unavailable.actions.some(item => String(item.id).startsWith('growth:vertical:')), false, 'unavailable evidence must not become remediation');

assert.throws(() => analyzeVerticalEvidence({ vertical: 'magic-seo', canonicalUrl: 'https://example.com/', html: '' }), /Unknown Growth vertical/);

console.log('PASS vertical evidence adapters convert bounded public entry-page observations into explicit software, research and documentation evidence without turning unavailable, owner-only or absent agent-interface signals into false failures');
