import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildSemanticIndex, semanticIndexSummary, validateSemanticIndex } from '../lib/semantic-index.mjs';

const registry = JSON.parse(fs.readFileSync('registry/future-search-experiments.json', 'utf8'));
const registrySchema = JSON.parse(fs.readFileSync('schema/future-search-experiments.schema.json', 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateRegistry = ajv.compile(registrySchema);
assert.equal(validateRegistry(registry), true, JSON.stringify(validateRegistry.errors));
assert.equal(registry.version, '0.1');
assert.equal(registry.methodology.noRankingClaimWithoutPlatformEvidence, true);
assert.equal(registry.methodology.noInventedFacts, true);
assert.equal(new Set(registry.experiments.map(item => item.id)).size, registry.experiments.length);
assert.ok(registry.experiments.some(item => item.id === 'schemaorg-beyond-current-google-gallery' && item.maturity === 'foundation'));
assert.ok(registry.experiments.some(item => item.id === 'semantic-page-entity-index' && item.maturity === 'experiment'));
assert.ok(registry.experiments.some(item => item.id === 'truthful-action-semantics' && item.maturity === 'watch'));
for (const item of registry.experiments) {
  assert.ok(item.sources.every(source => source.startsWith('https://')));
  assert.ok(item.verification.length > 0);
  assert.ok(item.implementation.length > 0);
}

const pageManifest = JSON.parse(fs.readFileSync('registry/page-manifest.json', 'utf8'));
const entityCatalog = JSON.parse(fs.readFileSync('registry/entity-catalog.jsonld', 'utf8'));
const semanticIndex = buildSemanticIndex(pageManifest, entityCatalog);
const summary = semanticIndexSummary(semanticIndex);
assert.equal(summary.valid, true, summary.issues.join('; '));
assert.equal(summary.guardrails.optionalAggregateSurface, true);
assert.equal(summary.guardrails.canonicalHtmlRemainsPrimary, true);
assert.equal(summary.guardrails.noRankingOrDiscoveryPromise, true);
const expectedPages = pageManifest.pages.filter(page => page.index !== false).length;
assert.equal(summary.counts.pages, expectedPages);

const graph = semanticIndex['@graph'];
const website = graph.find(node => (Array.isArray(node['@type']) ? node['@type'] : [node['@type']]).includes('WebSite'));
assert.ok(website);
const pageNodes = graph.filter(node => String(node['@id'] || '').endsWith('#page'));
assert.equal(pageNodes.length, expectedPages);
assert.ok(pageNodes.every(node => node.isPartOf?.['@id'] === website['@id']));
assert.ok(pageNodes.every(node => String(node.url || '').startsWith('https://')));
const itemList = graph.find(node => node['@type'] === 'ItemList' && String(node['@id'] || '').endsWith('#pages'));
assert.equal(itemList.numberOfItems, expectedPages);
assert.deepEqual(itemList.itemListElement.map(item => item.position), Array.from({ length: expectedPages }, (_, index) => index + 1));
assert.equal(graph.some(node => Object.hasOwn(node, 'aggregateRating')), false, 'semantic index must not fabricate ratings');
assert.equal(graph.some(node => Object.hasOwn(node, 'dateModified') && String(node['@id'] || '').includes('semantic-index')), false, 'semantic index build must not manufacture freshness');

const broken = structuredClone(semanticIndex);
broken['@graph'].push(structuredClone(broken['@graph'][0]));
const brokenResult = validateSemanticIndex(broken);
assert.equal(brokenResult.valid, false);
assert.ok(brokenResult.issues.some(issue => issue.startsWith('duplicate @id:')));

const missingEntityManifest = structuredClone(pageManifest);
missingEntityManifest.pages[0].mainEntity = `${website.url}#missing-entity`;
assert.throws(() => buildSemanticIndex(missingEntityManifest, entityCatalog), /missing internal mainEntity/);

console.log(`PASS Future Search Lab: ${registry.experiments.length} governed experiments and ${expectedPages} canonical pages compile into a valid optional semantic index without ranking claims or synthetic facts`);
