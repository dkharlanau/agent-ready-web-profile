import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const graphPath = path.join(root, 'docs', 'knowledge', 'graph.json');
const pagePath = path.join(root, 'docs', 'knowledge', 'index.html');
const profilePath = path.join(root, 'ai', 'ai-search-profile.json');
const selfProfilePath = path.join(root, 'ai', 'site-profile.json');

for (const file of [graphPath, pagePath]) {
  assert.ok(fs.existsSync(file), `missing knowledge graph surface: ${path.relative(root, file)}`);
  assert.ok(fs.statSync(file).size > 200, `knowledge graph surface is unexpectedly empty: ${path.relative(root, file)}`);
}

const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
assert.equal(graph['@context']['@vocab'], 'https://schema.org/');
assert.ok(Array.isArray(graph['@graph']));
assert.ok(graph['@graph'].length >= 17);

const ids = graph['@graph'].map(node => node['@id']);
assert.equal(new Set(ids).size, ids.length, 'knowledge graph @id values must be unique');
assert.equal(ids.every(id => /^https:\/\/dkharlanau\.github\.io\/agent-ready-web-profile\/#/.test(id)), true, 'ARWP-owned graph entities must use stable canonical ARWP IDs');

const byId = suffix => graph['@graph'].find(node => node['@id'] === `https://dkharlanau.github.io/agent-ready-web-profile/#${suffix}`);
const maintainer = byId('maintainer');
const software = byId('software');
const website = byId('website');
const trust = byId('trust-center');
const observatory = byId('protocol-observatory');
const crawlerMatrix = byId('crawler-matrix');
const productClassification = byId('product-classification');
const alternativesMap = byId('alternatives-map');
const comparisonHub = byId('comparison-hub');
const claims = byId('claims-registry');
const vocabulary = byId('vocabulary');

assert.equal(maintainer['@type'], 'Person');
assert.equal(maintainer.name, 'Dzmitryi Kharlanau');
assert.equal(software['@type'], 'SoftwareSourceCode');
assert.equal(software.author['@id'], maintainer['@id']);
assert.equal(software.codeRepository, 'https://github.com/dkharlanau/agent-ready-web-profile');
assert.equal(software.sameAs.includes('https://www.npmjs.com/package/agent-ready-web-profile'), true);
assert.equal(software.about['@id'], byId('term-agentic-web-interoperability-resolver')['@id']);
assert.ok(software.keywords.includes('agentic web interoperability resolver'));
assert.ok(software.subjectOf.some(item => item['@id'] === productClassification['@id']));
assert.ok(software.subjectOf.some(item => item['@id'] === comparisonHub['@id']));
assert.equal(website['@type'], 'WebSite');
assert.equal(website.about['@id'], software['@id']);
assert.equal(trust.about['@id'], software['@id']);

for (const dataset of [observatory, crawlerMatrix, productClassification, alternativesMap]) {
  assert.equal(dataset['@type'], 'Dataset');
  assert.equal(dataset.creator['@id'], maintainer['@id']);
  assert.equal(dataset.license, 'https://creativecommons.org/licenses/by/4.0/');
  assert.ok(dataset.distribution.some(item => item['@type'] === 'DataDownload' && /^https:\/\//.test(item.contentUrl)));
}
assert.equal(alternativesMap.isPartOf['@id'], comparisonHub['@id']);
assert.equal(comparisonHub['@type'], 'TechArticle');
assert.equal(comparisonHub.mainEntity['@id'], alternativesMap['@id']);
assert.equal(comparisonHub.isPartOf['@id'], website['@id']);

assert.equal(claims['@type'], 'CollectionPage');
assert.deepEqual(claims.hasPart.map(item => item['@id']).sort(), [byId('claim-0001')['@id'], byId('claim-0002')['@id']].sort());
assert.equal(byId('claim-0001').identifier, 'ARWP-CLAIM-0001');
assert.equal(byId('claim-0002').identifier, 'ARWP-CLAIM-0002');
assert.equal(byId('claim-0001').isPartOf['@id'], claims['@id']);
assert.equal(byId('claim-0002').isPartOf['@id'], claims['@id']);

assert.equal(vocabulary['@type'], 'DefinedTermSet');
const termIds = vocabulary.hasDefinedTerm.map(item => item['@id']);
for (const suffix of ['term-agentic-web-interoperability-resolver', 'term-agentic-web-resolver', 'term-resolver-regret', 'term-discovery-conflict']) {
  const term = byId(suffix);
  assert.equal(term['@type'], 'DefinedTerm');
  assert.equal(term.inDefinedTermSet['@id'], vocabulary['@id']);
  assert.ok(termIds.includes(term['@id']));
}
assert.equal(byId('term-agentic-web-interoperability-resolver').termCode, 'agentic-web-interoperability-resolver');
assert.match(byId('term-agentic-web-interoperability-resolver').description, /Project-defined class/i);

const page = fs.readFileSync(pagePath, 'utf8');
assert.match(page, /One graph for the project’s identity and evidence/i);
assert.match(page, /Entity consistency is not authority by itself/i);
assert.match(page, /application\/ld\+json/);

const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
assert.equal(profile.surfaces.knowledgeGraph.status, 'active');
assert.equal(profile.surfaces.knowledgeGraph.mediaType, 'application/ld+json');
assert.equal(profile.modules.knowledgeGraph.status, 'active');
assert.ok(profile.modules.knowledgeGraph.machineReadable.includes('https://dkharlanau.github.io/agent-ready-web-profile/knowledge/graph.json'));

const selfProfile = JSON.parse(fs.readFileSync(selfProfilePath, 'utf8'));
assert.ok(selfProfile.data.distributions.some(item => item.url.endsWith('/knowledge/graph.json') && item.mediaType === 'application/ld+json'));
assert.equal(selfProfile.extensions['io.github.dkharlanau/ai-search-profile'].knowledgeGraph, 'https://dkharlanau.github.io/agent-ready-web-profile/knowledge/graph.json');

console.log('PASS ARWP knowledge graph links maintainer, software, site, trust, datasets, competitor evidence and the project-defined product class through stable canonical entities');
