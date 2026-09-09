#!/usr/bin/env node

import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const fail = message => { throw new Error(message); };

const product = JSON.parse(read('registry/product-line.json'));
if (product.version !== '0.2') fail('Product line must use the proof-first v0.2 contract.');
if (product.brand !== 'Goose ARWP') fail('Canonical product brand must remain Goose ARWP.');
if (product.tagline !== 'Get Found.') fail('Canonical tagline must remain Get Found.');
if (!/evidence-backed Search and AI discoverability operations/i.test(product.category)) fail('Product category drifted away from evidence-backed Search and AI discoverability operations.');
if (product.proofFirstMilestone?.priority !== 'P0') fail('Proof-before-more-product milestone must remain P0 until explicitly reviewed.');
if (product.proofFirstMilestone?.deploymentParityRequiredBeforeObservationClock !== true) fail('Deployment parity must remain a hard observation-clock gate.');
if (product.proofFirstMilestone?.negativeAndNeutralEvidenceMustRemainVisible !== true) fail('Negative/neutral evidence retention is mandatory.');

const expectedJourney = ['goal', 'inspect', 'decide', 'change', 'prove', 'watch'];
const actualJourney = product.publicJourney?.map(step => step.id) || [];
if (JSON.stringify(actualJourney) !== JSON.stringify(expectedJourney)) {
  fail(`Public journey drift: expected ${expectedJourney.join(' -> ')}, got ${actualJourney.join(' -> ')}`);
}

const expectedFunnel = ['access', 'index-or-eligibility', 'exposure', 'citation-or-reference', 'brand-mention', 'visit', 'useful-action'];
if (JSON.stringify(product.evidenceFunnel) !== JSON.stringify(expectedFunnel)) fail('Evidence funnel order drifted.');
if (product.guardrails?.noUniversalScore !== true || product.guardrails?.providerNativeMetricsStayDistinct !== true) fail('Provider-native/no-score guardrails must stay explicit.');
if (product.guardrails?.ownerDeclaredIsNotIndependentEvidence !== true) fail('Owner-declared context must not become independent evidence.');
if (product.modules?.some(module => module.visibility !== 'internal-advanced')) fail('Internal modules must not silently become first-run product choices.');
if (JSON.stringify(product).includes('SignalBraid')) fail('Current product registry must not restore SignalBraid as an active product identity.');

const roadmap = read('ROADMAP.md');
for (const needle of ['# Goose ARWP Roadmap', 'M1 — Proof before more product', 'provider-native', 'Ptichi stays measurement-hold', 'real site evidence loop > new capability breadth']) {
  if (!roadmap.includes(needle)) fail(`ROADMAP.md missing proof-first strategy marker: ${needle}`);
}
if (/^# ARWP Roadmap/m.test(roadmap)) fail('Resolver-era ARWP roadmap title returned.');

const productLine = read('docs/PRODUCT-LINE.md');
for (const needle of ['# Goose ARWP — Product Line', 'Public product journey', 'Proof before more product', 'Provider-native measurement hardening']) {
  if (!productLine.includes(needle)) fail(`docs/PRODUCT-LINE.md missing current Goose strategy marker: ${needle}`);
}

const currentProductSurfaces = [
  'content/pages/product.md',
  'docs/product/index.html',
  'content/pages/search-maturity.md',
  'docs/search-maturity/index.html',
  'docs/PRODUCT-LINE.md'
];
for (const file of currentProductSurfaces) {
  const text = read(file);
  if (text.includes('SignalBraid · ARWP')) fail(`${file} restores SignalBraid · ARWP as a current product-facing identity.`);
  if (!text.includes('Goose')) fail(`${file} does not expose current Goose identity.`);
}

const historicalSignalBraid = read('docs/BRAND-SIGNALBRAID.md');
if (!historicalSignalBraid.includes('SignalBraid')) fail('Historical SignalBraid brand reference unexpectedly disappeared.');

const selfInterview = read('research/product/2026-09-09-goose-self-interview.md');
for (const role of ['Architect', 'CEO', 'GEO / Search strategist', 'AI Search specialist', 'Product Manager', 'Site owner', 'Investor / skeptic']) {
  if (!selfInterview.includes(role)) fail(`Self-interview record missing role: ${role}`);
}
if (!selfInterview.includes('Proof before more product')) fail('Self-interview synthesis lost the proof-first decision.');

console.log('PASS Goose product strategy contract: public journey is goal -> inspect -> decide -> change -> prove -> watch, proof-before-more-product remains P0, provider-native evidence stays non-composite, active product surfaces are Goose-first, and SignalBraid remains historical only.');
