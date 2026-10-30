import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  analyzeStructuredDataPages,
  analyzeStructuredDataHtml,
  analyzeStructuredDataUrl,
  analyzeStructuredDataUrls,
  formatStructuredDataReport,
  structuredDataKnowledgeGraphContract
} from '../lib/structured-data-knowledge-graph.mjs';

const contract = structuredDataKnowledgeGraphContract;
assert.equal(contract.version, '0.1');
assert.equal(contract.reviewedAt, '2026-09-16');
assert.ok(contract.validationDimensions.includes('relationship-resolution'));
assert.ok(contract.validationDimensions.includes('provider-feature-eligibility'));
assert.ok(contract.truthBoundaries.some(item => /map embed/i.test(item)));

const family = id => contract.entityFamilies.find(item => item.id === id);
assert(family('organization'));
assert(family('local-business'));
assert(family('place'));
assert(family('service'));
assert(family('product'));
assert(family('product-group'));
assert(family('offer'));
assert(family('merchant-return-policy'));
assert(family('shipping-service'));
assert(family('dataset'));
assert(family('data-catalog'));
assert(family('data-download'));
assert(family('image'));
assert.ok(family('service').recommendedWhenKnown.includes('areaServed'));
assert.ok(family('product-group').coreProperties.includes('hasVariant'));
assert.ok(family('dataset').coreProperties.includes('creator|publisher'));
assert.ok(contract.relationshipChecks.some(item => item.property === 'areaServed' && item.target.includes('Place')));
assert.ok(contract.relationshipChecks.some(item => item.property === 'hasVariant' && item.target.includes('Product')));
assert.ok(contract.relationshipChecks.some(item => item.property === 'distribution' && item.target.includes('DataDownload')));

const goodPage = `<!doctype html>
<html><head>
<link rel="canonical" href="https://example.com/">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://example.com/#website",
      "name": "Example Knowledge Shop",
      "url": "https://example.com/",
      "publisher": {"@id": "https://example.com/#organization"}
    },
    {
      "@type": "Organization",
      "@id": "https://example.com/#organization",
      "name": "Example Knowledge Shop",
      "url": "https://example.com/",
      "hasMerchantReturnPolicy": {
        "@type": "MerchantReturnPolicy",
        "applicableCountry": "US",
        "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
        "merchantReturnDays": 30
      },
      "hasShippingService": {
        "@type": "ShippingService",
        "@id": "https://example.com/#shipping",
        "name": "US shipping"
      }
    },
    {
      "@type": "LocalBusiness",
      "@id": "https://example.com/#local-business",
      "name": "Example Knowledge Shop Downtown",
      "url": "https://example.com/location/",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "1 Main St",
        "addressLocality": "Example City",
        "addressCountry": "US"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 40.0,
        "longitude": -111.0
      }
    },
    {
      "@type": "Place",
      "@id": "https://example.com/#service-area",
      "name": "Example City"
    },
    {
      "@type": "Service",
      "@id": "https://example.com/#service",
      "name": "Data Quality Audit",
      "provider": {"@id": "https://example.com/#organization"},
      "areaServed": {"@id": "https://example.com/#service-area"}
    },
    {
      "@type": "ProductGroup",
      "@id": "https://example.com/products/widget/#group",
      "name": "Widget",
      "productGroupID": "widget",
      "variesBy": "https://schema.org/color",
      "hasVariant": {"@id": "https://example.com/products/widget/blue/#product"}
    },
    {
      "@type": "Product",
      "@id": "https://example.com/products/widget/blue/#product",
      "name": "Widget Blue",
      "isVariantOf": {"@id": "https://example.com/products/widget/#group"},
      "offers": {
        "@type": "Offer",
        "@id": "https://example.com/products/widget/blue/#offer",
        "price": "10.00",
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock",
        "seller": {"@id": "https://example.com/#organization"}
      }
    },
    {
      "@type": "Dataset",
      "@id": "https://example.com/dataset/#dataset",
      "name": "Example Cases Dataset",
      "creator": {"@id": "https://example.com/#organization"},
      "license": "https://creativecommons.org/licenses/by/4.0/",
      "distribution": {
        "@type": "DataDownload",
        "contentUrl": "https://example.com/data/cases.csv",
        "encodingFormat": "text/csv"
      }
    },
    {
      "@type": "TechArticle",
      "@id": "https://example.com/guide/#article",
      "headline": "Structured Data Guide",
      "author": {"@id": "https://example.com/#organization"}
    }
  ]
}
</script>
</head><body>
<h1>Example Knowledge Shop</h1>
<p>Example Knowledge Shop Downtown, 1 Main St, Example City.</p>
<p>Data Quality Audit.</p>
<p>Widget and Widget Blue.</p>
<p>Example Cases Dataset.</p>
<article><h2>Structured Data Guide</h2></article>
</body></html>`;

const good = analyzeStructuredDataPages([{ url: 'https://example.com/', html: goodPage }]);
assert.equal(good.reportVersion, '0.1');
assert.equal(good.contractVersion, '0.1');
assert.equal(good.scope, 'observed-structured-data-knowledge-graph-not-search-score');
assert.equal(good.summary.gaps.P0, 0);
assert.equal(good.summary.gaps.P1, 0);
assert.ok(good.summary.familiesObserved >= 10);
assert.equal(good.guardrails.mapEmbedDoesNotSubstituteForPlaceSemantics, true);
assert.match(formatStructuredDataReport(good), /Structured Data & Knowledge Graph/);
assert.match(formatStructuredDataReport(good), /not a ranking, rich-result, Knowledge Panel or AI-citation score/i);

const brokenPage = `<!doctype html><html><head>
<link rel="canonical" href="https://broken.example/">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
  {"@type":"Service","name":"Invisible Service"},
  {"@type":"ProductGroup","@id":"https://broken.example/#group","name":"Broken Product Group"},
  {"@type":"GeoCoordinates","latitude":40.0},
  {"@type":"Dataset","@id":"https://broken.example/#dataset","name":"Broken Dataset"}
]}</script>
<script type="application/ld+json">{"@type":"Organization",</script>
</head><body><h1>Broken example</h1></body></html>`;

const broken = analyzeStructuredDataPages([{ url: 'https://broken.example/', html: brokenPage }]);
assert.ok(broken.summary.gaps.P0 >= 1, 'malformed JSON-LD must be P0');
assert.ok(broken.gaps.some(item => item.code === 'stable-id-missing' && item.family === 'service'));
assert.ok(broken.gaps.some(item => item.code === 'core-property-missing:provider' && item.family === 'service'));
assert.ok(broken.gaps.some(item => item.code === 'core-property-missing:productGroupID' && item.family === 'product-group'));
assert.ok(broken.gaps.some(item => item.code === 'core-property-missing:longitude' && item.family === 'geo'));
assert.ok(broken.gaps.some(item => item.code === 'core-property-missing:creator|publisher' && item.family === 'dataset'));
assert.ok(broken.gaps.some(item => item.code === 'core-property-missing:license' && item.family === 'dataset'));
assert.ok(broken.gaps.some(item => item.code === 'visible-name-parity'));

const inertFixtures = [
  '<!-- <script type="application/ld+json">{invalid}</script> -->',
  '<template><script type="application/ld+json">{invalid}</script></template>',
  '<textarea><script type="application/ld+json">{invalid}</script></textarea>',
  '<noscript><script type="application/ld+json">{invalid}</script></noscript>'
];
for (const body of inertFixtures) {
  const report=analyzeStructuredDataHtml(`<h1>Example</h1>${body}`,{url:'https://inert.example.test/'});
  assert.equal(report.pages[0].jsonLdBlocks,0, 'commented and inert source text is not an active data script');
  assert.equal(report.summary.parseErrors,0);
}
const activeInvalid=analyzeStructuredDataHtml('<script data-example="a > b" type="APPLICATION/LD+JSON">{invalid}</script>',{url:'https://inert.example.test/'});
assert.equal(activeInvalid.pages[0].jsonLdBlocks,1);
assert.equal(activeInvalid.summary.parseErrors,1, 'actual malformed JSON-LD remains a parse error');
const hiddenData=analyzeStructuredDataHtml(`<div hidden><script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'WebPage','@id':'https://inert.example.test/#page',name:'Hidden page'})}</script></div>`,{url:'https://inert.example.test/'});
assert.equal(hiddenData.pages[0].jsonLdBlocks,1, 'a data script under hidden content is still in the document');
assert.equal(hiddenData.entities.length,1);
console.log('PASS JSON-LD HTML extraction: comments, templates and raw-text controls stay separate from active scripts');

const descriptiveName = analyzeStructuredDataPages([{url:'https://vocab.example.test/words',html:`
<h1>Words we use</h1><p>Example vocabulary</p>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"DefinedTermSet","@id":"https://vocab.example.test/words#terms","name":"Example public project vocabulary","url":"https://vocab.example.test/words"}</script>`}]);
const nameFinding = descriptiveName.gaps.find(item => item.code === 'visible-name-parity');
assert.equal(nameFinding?.priority, 'P1');
assert.match(nameFinding.problem, /literal text match/);
assert.match(nameFinding.recommendation, /different wording alone is not a confirmed contradiction/);
assert.equal(descriptiveName.summary.gaps.P0, 0);

const parityName = 'Invisible Dataset';
const parityJson = `<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'Dataset','@id':'https://parity.example.test/#data',name:parityName,description:'Example',license:'https://parity.example.test/license',publisher:{'@id':'https://parity.example.test/#publisher'}})}</script>`;
const parityReport = body => analyzeStructuredDataHtml(`${body}${parityJson}`, {url:'https://parity.example.test/'});
const hasParityGap = report => report.gaps.some(g=>g.code==='visible-name-parity');
for (const body of [
  `<body><div hidden><span>${parityName}</span></div><p>Other content</p></body>`,
  `<body><div hidden="false"><div><b>${parityName}</b></div></div><p>Other content</p></body>`,
  `<body><div hidden="until-found">${parityName}</div><p>Other content</p></body>`
]) {
  const report=parityReport(body);
  assert.ok(!hasParityGap(report), 'hidden-designated source cannot establish a visible match or a P1 contradiction');
  assert.ok(report.gaps.some(g=>g.code==='visible-name-render-review'&&g.priority==='P2'),
    'hidden-designated text requires a rendered review, including streamed content');
}
for (const body of [`<head><title>${parityName}</title></head><body><p>Other content</p></body>`,
  `<body><!-- ${parityName} --><template>${parityName}</template><p>Other content</p></body>`])
  assert.ok(hasParityGap(parityReport(body)), 'metadata and templates do not establish source parity');
assert.ok(!hasParityGap(parityReport(`<body><div hidden>${parityName}</div><h1>${parityName}</h1></body>`)),
  'the same name outside a hidden subtree remains a valid source-text match');
assert.ok(!hasParityGap(parityReport(`<body><h1 title="a > b">Invisible &#68;ataset</h1></body>`)),
  'quoted greater-than signs and character references are parsed as HTML');
console.log('PASS source-text parity: head, comments, templates and nested hidden text cannot create a false match');

const documentation = fs.readFileSync('docs/STRUCTURED-DATA-KNOWLEDGE-GRAPH.md', 'utf8');
assert.match(documentation, /Physical locations and maps/i);
assert.match(documentation, /ProductGroup/);
assert.match(documentation, /DataDownload/);
assert.match(documentation, /areaServed/);
assert.match(documentation, /map embed is a user-interface aid/i);

console.log(`PASS structured data knowledge graph contract: ${good.summary.entitiesObserved} observed good-fixture entities, ${broken.gaps.length} explicit broken-fixture findings`);

const referencePage = graph => ({
  url: 'https://graph.example.test/work',
  html: `<h1>Work guide</h1><script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@graph': graph
  })}</script>`
});
const guide = {
  '@type': 'WebPage', '@id': 'https://graph.example.test/work#page',
  name: 'Work guide', url: 'https://graph.example.test/work',
  about: { '@type': 'Dataset', '@id': 'https://graph.example.test/data#dataset' }
};
const refs = analyzeStructuredDataPages([referencePage([guide])]);
assert.equal(refs.entities.find(e => e.family === 'dataset').observationRole, 'identity-reference');
assert.ok(!refs.gaps.some(g => g.family === 'dataset' && g.code.startsWith('core-property-missing:')));
assert.ok(refs.gaps.some(g => g.code === 'unresolved-internal-relation:about'),
  'a typed identity link must not resolve its own unseen definition');
const definition = {
  '@type': 'Dataset', '@id': 'https://graph.example.test/data#dataset',
  name: 'Shared data', description: 'A synthetic public dataset',
  url: 'https://graph.example.test/data', license: 'https://graph.example.test/rights',
  publisher: { '@type': 'Organization', '@id': 'https://graph.example.test/#publisher',
    name: 'Shared data', url: 'https://graph.example.test/' }
};
const resolved = analyzeStructuredDataPages([
  referencePage([guide]),
  {url: 'https://graph.example.test/data', html: `<h1>Shared data</h1><script type="application/ld+json">${JSON.stringify(definition)}</script>`}
]);
assert.ok(!resolved.gaps.some(g => g.code === 'unresolved-internal-relation:about'));
assert.ok(!resolved.gaps.some(g => g.code === 'reused-id-name-review'));
for (const sparse of [
  {'@type': 'Dataset', '@id': 'https://graph.example.test/data#dataset'},
  {'@type': 'Dataset', name: 'Work guide'}
]) {
  const report = analyzeStructuredDataPages([referencePage([sparse])]);
  assert.ok(report.gaps.some(g => g.family === 'dataset' && g.code.startsWith('core-property-missing:')),
    'standalone or anonymous sparse nodes remain incomplete definitions');
}
const embeddedDefinition = structuredClone(guide);
embeddedDefinition.about.description = 'A partial definition, not only an identity link';
assert.ok(analyzeStructuredDataPages([referencePage([embeddedDefinition])]).gaps.some(g =>
  g.family === 'dataset' && g.code === 'core-property-missing:name'));
const conflictingGuide = structuredClone(guide);
conflictingGuide.about['@type'] = 'Organization';
assert.ok(analyzeStructuredDataPages([referencePage([conflictingGuide, definition])]).gaps.some(g =>
  g.code === 'reused-id-type-review' && g.priority === 'P1'), 'typed references retain differing type assertions for review');
console.log('PASS identity references: unresolved, resolved, sparse-definition and type-conflict boundaries');

const termId = 'https://identity.example.test/term#entity';
const term = (name, extra = {}) => ({'@type': 'DefinedTerm', '@id': termId, name, ...extra});
const aliasPage = nodes => ({url: 'https://identity.example.test/term',
  html: '<h1>Evidence review</h1><p>Evidence review — a decision aid</p>' + nodes.map(node =>
    '<script type="application/ld+json">' + JSON.stringify({'@context': 'https://schema.org', ...node}) + '</script>').join('')});
const conflicts = pages => analyzeStructuredDataPages(pages).gaps.filter(g => g.code === 'reused-id-name-review');
const longName = 'Evidence review — a decision aid';
assert.equal(conflicts([aliasPage([term(longName), term('Evidence review', {alternateName: longName})])]).length, 0,
  'an explicit alternateName connects the two primary names across script blocks');
assert.equal(conflicts([aliasPage([term(longName)]), {...aliasPage([term('Evidence review', {alternateName: ['Another label', longName]})]),
  url: 'https://identity.example.test/catalog'}]).length, 0, 'declared text arrays work across observed pages');
assert.equal(conflicts([aliasPage([term(' Evidence REVIEW '), term('Evidence review')])]).length, 0);
assert.equal(conflicts([aliasPage([term(longName), term('Evidence review')])]).length, 1,
  'a matching prefix is not an explicit alias');
assert.equal(conflicts([aliasPage([term('First term', {alternateName: 'Common label'}),
  term('Second term', {alternateName: 'Common label'})])]).length, 1,
  'a shared alias alone cannot hide unrelated primary names');
assert.equal(conflicts([aliasPage([term(longName), term('Evidence review', {alternateName: longName}), term('Unrelated term')])]).length, 1,
  'a declared pair cannot hide an unconnected third primary name');
const differingTypes = analyzeStructuredDataPages([aliasPage([term(longName), term('Evidence review', {alternateName: longName, '@type': 'Organization'})])]);
assert.ok(differingTypes.gaps.some(g => g.code === 'reused-id-type-review' && g.priority === 'P1'),
  'alias agreement never suppresses review of differing type assertions');
assert.ok(!differingTypes.gaps.some(g => g.code === 'reused-id-name-review'), 'explicitly connected names do not trigger name review');
const multiType = analyzeStructuredDataPages([aliasPage([
  term('Evidence review', {'@type':['DefinedTerm','CreativeWork']}), term('Evidence review')
])]);
assert.ok(multiType.gaps.some(g => g.code === 'reused-id-type-review' && g.priority === 'P1'));
assert.ok(!multiType.gaps.some(g => g.code === 'reused-id-name-review'));
const expandedType = analyzeStructuredDataPages([aliasPage([
  term('Evidence review', {'@type':'https://schema.org/Organization'})
])]);
assert.equal(expandedType.entities[0].family, 'organization', 'an absolute Schema.org type identifies its family');
assert.deepEqual(expandedType.entities[0].types, ['https://schema.org/Organization'], 'reports preserve the original type assertion');
assert.ok(expandedType.gaps.some(g => g.code === 'core-property-missing:url'), 'expanded types receive the same core-property diagnostics');
const equivalentTypes = analyzeStructuredDataPages([aliasPage([
  term('Evidence review', {'@type':['Organization','https://schema.org/Organization']}),
  term('Evidence review', {'@type':'http://schema.org/Organization'})
])]);
assert.ok(!equivalentTypes.gaps.some(g => g.code === 'reused-id-type-review'), 'equivalent Schema.org type spellings do not create a conflict');
const foreignType = analyzeStructuredDataPages([aliasPage([
  term('Evidence review', {'@type':'https://schema.org.example.test/Organization'})
])]);
assert.equal(foreignType.entities[0].family, null, 'other hosts do not become Schema.org types');
const unknownTypeContext = analyzeStructuredDataPages([aliasPage([
  term('Evidence review', {'@context':{'@vocab':'https://other.example.test/'}, '@type':'https://schema.org/Organization'})
])]);
assert.equal(unknownTypeContext.entities[0].family, null, 'an expanded type alone does not authorize interpreting other properties in a custom context');
assert.equal(conflicts([aliasPage([term(longName), term('Evidence review', {alternateName: {'@value': longName, '@language':'en'}})])]).length, 0,
  'a simple JSON-LD value object may explicitly connect names');
assert.equal(conflicts([aliasPage([term(longName), term('Evidence review', {alternateName: {'@value': longName, 'unexpected': 'field'}})])]).length, 1,
  'unsupported alias objects are not coerced into text or guessed');
assert.equal(conflicts([aliasPage([term('Shared spelling', {alternateName: [' ', null, 12]}), term('Different spelling')])]).length, 1);
const multilingual=analyzeStructuredDataPages([aliasPage([
  term('Knowledge Library', {'@context':['https://schema.org',{'@language':'en'}]}),
  term('Bibliothèque des connaissances', {'@context':['https://schema.org',{'@language':'fr'}]})
])]);
const nameReview=multilingual.gaps.find(g=>g.code==='reused-id-name-review');
assert.equal(nameReview?.priority,'P1', 'different language labels warrant review rather than a critical conflict');
assert.match(nameReview.recommendation,/language and aliases/);
assert.ok(!multilingual.gaps.some(g=>g.code==='conflicting-reused-id'));
const conflictingObjects=conflicts([aliasPage([term({'@value':'First', '@language':'en'}),term({'@value':'Unrelated', '@language':'en'})])]);
assert.equal(conflictingObjects.length,1, 'different value-object labels stay visible for review');
assert.equal(conflictingObjects[0].priority,'P1');
const commonUrl='https://identity.example.test/landing';
const noId=(name)=>({'@type':'DefinedTerm',url:commonUrl,name});
assert.equal(conflicts([aliasPage([noId('First'),noId('Second')])]).length,0,
  'sharing a url property alone does not assert a common @id');
const blank=(name)=>({'@type':'DefinedTerm','@id':'_:item',name});
assert.equal(analyzeStructuredDataPages([aliasPage([blank('One')])]).entities[0].id,'_:item',
  'a blank-node identifier is not converted into a relative URL');
assert.equal(conflicts([aliasPage([blank('One')]),{...aliasPage([blank('Two')]),url:'https://identity.example.test/other'}]).length,0,
  'blank-node labels are scoped to their own HTML document');
assert.equal(conflicts([aliasPage([blank('One'),blank('Two')])]).length,1,
  'the same blank-node label in one document is still reviewed');
console.log('PASS explicit aliases: same/cross-page, array, normalization, unconnected third name, type and no-inference boundaries');

// JSON-LD can describe the same entity in several blocks, including untyped
// fragments. Check properties within one observed document without borrowing
// facts from another page or a named graph.
const datasetId = 'https://split.example.test/data#dataset';
const ld = value => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
const splitTyped = {'@context':'https://schema.org', '@type':'Dataset', '@id':datasetId, name:'Split data'};
const splitFacts = {'@context':'https://schema.org', '@id':datasetId,
  description:'Synthetic dataset', license:'https://split.example.test/license',
  publisher:{'@id':'https://split.example.test/#publisher'}};
const splitPage = {url:'https://split.example.test/data', html:`<h1>Split data</h1>${ld(splitTyped)}${ld(splitFacts)}`};
const missingDatasetCore = report => report.gaps.filter(g => g.family === 'dataset' && g.code.startsWith('core-property-missing:'));
assert.equal(missingDatasetCore(analyzeStructuredDataPages([splitPage])).length, 0,
  'an untyped fragment on the same page supplies missing properties');
const sameGraph = {url:splitPage.url, html:`<h1>Split data</h1>${ld({'@context':'https://schema.org','@graph':[splitTyped, splitFacts]})}`};
assert.equal(missingDatasetCore(analyzeStructuredDataPages([sameGraph])).length, 0);
const separate = analyzeStructuredDataPages([
  {url:splitPage.url,html:`<h1>Split data</h1>${ld(splitTyped)}`},
  {url:'https://split.example.test/other',html:ld(splitFacts)}
]);
assert.ok(missingDatasetCore(separate).some(g => g.code === 'core-property-missing:license'),
  'a different supplied page does not satisfy page-local completeness');
const fullTyped = {...splitTyped, license:'https://split.example.test/license'};
const otherDoc = {url:'https://split.example.test/other',html:ld(fullTyped)};
const annotated = analyzeStructuredDataPages([{url:splitPage.url,html:ld(splitTyped)},otherDoc]);
const licenseGap = missingDatasetCore(annotated).find(g=>g.page===splitPage.url && g.code==='core-property-missing:license');
assert.ok(licenseGap, 'other-page evidence never suppresses the page-local gap');
assert.deepEqual(licenseGap.propertyObservedOnOtherDocuments,[otherDoc.url]);
assert.match(formatStructuredDataReport(annotated),/Same entity and property observed on another sampled document/);
for(const alternative of [
  {...fullTyped,'@id':'https://split.example.test/other#dataset'},
  {...fullTyped,'@context':{'@vocab':'https://other.example.test/'}},
  {...fullTyped,'@type':'Organization'},
  {'@context':'https://schema.org','@id':'https://split.example.test/#named','@graph':[fullTyped]},
  {'@context':'https://schema.org','@type':'WebPage',about:{'@id':datasetId,'@type':'Dataset'}}
]){
  const result=analyzeStructuredDataPages([{url:splitPage.url,html:ld(splitTyped)},{...otherDoc,html:ld(alternative)}]);
  const finding=missingDatasetCore(result).find(g=>g.page===splitPage.url && g.code==='core-property-missing:license');
  assert.ok(finding);
  assert.equal(finding.propertyObservedOnOtherDocuments,undefined,'unrelated, unknown-context, named or reference-only sources are not evidence');
}
const blankTyped={'@context':'https://schema.org','@type':'Dataset','@id':'_:shared',name:'Blank data'};
const blankFull={...blankTyped,license:'https://split.example.test/license'};
const blankReport=analyzeStructuredDataPages([{url:splitPage.url,html:ld(blankTyped)},{...otherDoc,html:ld(blankFull)}]);
const blankGap=missingDatasetCore(blankReport).find(g=>g.page===splitPage.url && g.code==='core-property-missing:license');
assert.ok(blankGap);
assert.equal(blankGap.propertyObservedOnOtherDocuments,undefined,'blank-node labels do not cross documents');
const named = {'@context':'https://schema.org','@id':'https://split.example.test/#named','@graph':[splitFacts]};
assert.ok(missingDatasetCore(analyzeStructuredDataPages([{...splitPage,html:`<h1>Split data</h1>${ld(splitTyped)}${ld(named)}`}]))
  .some(g => g.code === 'core-property-missing:license'), 'named graph facts do not fill the default graph');
const customContextFacts = {...splitFacts, '@context':{'@vocab':'https://other.example.test/'}};
assert.ok(missingDatasetCore(analyzeStructuredDataPages([{...splitPage,html:`<h1>Split data</h1>${ld(splitTyped)}${ld(customContextFacts)}`}]))
  .some(g => g.code === 'core-property-missing:license'), 'custom-context properties are not assumed to mean schema.org properties');
const arrayContext = {'@context':['https://schema.org',{'@language':'en'}], '@graph':[
  {'@type':'Dataset','@id':datasetId,name:'Split data'},
  {'@id':datasetId,description:'Synthetic dataset',license:'https://split.example.test/license',publisher:{'@id':'https://split.example.test/#publisher'}}
]};
assert.equal(missingDatasetCore(analyzeStructuredDataPages([{...splitPage,html:`<h1>Split data</h1>${ld(arrayContext)}`}])).length, 0,
  'a language-only context preserves the Schema.org vocabulary across fragments');
const nestedLanguage = {'@context':'https://schema.org','@graph':[
  {'@type':'Dataset','@id':datasetId,name:'Split data'},
  {'@context':{'@language':'en'},'@id':datasetId,description:'Synthetic dataset',license:'https://split.example.test/license',publisher:{'@id':'https://split.example.test/#publisher'}}
]};
assert.equal(missingDatasetCore(analyzeStructuredDataPages([{...splitPage,html:`<h1>Split data</h1>${ld(nestedLanguage)}`}])).length, 0,
  'a nested language-only context inherits the vocabulary');
const remapped = structuredClone(arrayContext);
remapped['@context'].push({license:'https://other.example.test/license'});
const remappedReport = analyzeStructuredDataPages([{...splitPage,html:ld(remapped)}]);
assert.equal(remappedReport.summary.unexpandedContextNodes,1);
assert.equal(missingDatasetCore(remappedReport).length,0, 'unknown term overrides are not interpreted as Schema.org completeness');
const remappedThenVocab = structuredClone(remapped);
remappedThenVocab['@context'].push({'@vocab':'https://schema.org/'});
assert.equal(analyzeStructuredDataPages([{...splitPage,html:ld(remappedThenVocab)}]).summary.unexpandedContextNodes,1,
  'a later vocabulary default does not erase unknown term overrides');
const reset = structuredClone(nestedLanguage);
reset['@graph'][1]['@context'] = null;
assert.ok(missingDatasetCore(analyzeStructuredDataPages([{...splitPage,html:ld(reset)}]))
  .some(g => g.code === 'core-property-missing:license'), 'a null context cannot inherit the vocabulary');
const vocab = structuredClone(arrayContext);
vocab['@context'] = {'@vocab':'https://schema.org/','@language':'en'};
assert.equal(missingDatasetCore(analyzeStructuredDataPages([{...splitPage,html:ld(vocab)}])).length, 0,
  'a literal Schema.org vocabulary can join same-document fragments');
const repeatedIncomplete = analyzeStructuredDataPages([{...splitPage,html:`<h1>Split data</h1>${ld(splitTyped)}${ld(splitTyped)}`}]);
assert.equal(missingDatasetCore(repeatedIncomplete).filter(g => g.code === 'core-property-missing:license').length, 1,
  'a repeated incomplete definition yields one finding per page and entity');
console.log('PASS split entity completeness: same document, separate pages, named graph and duplicate findings');

const nullCore = license => ({'@context':'https://schema.org','@type':'Dataset','@id':'https://null.example.test/#dataset',
  name:'Synthetic data',publisher:{'@id':'https://null.example.test/#owner'},license});
const nullCoreGaps = value => analyzeStructuredDataPages([{url:'https://null.example.test/',html:`<h1>Synthetic data</h1>${ld(nullCore(value))}`}]).gaps;
for (const missing of [null, [], [null], [null,null]]) {
  assert.ok(nullCoreGaps(missing).some(g => g.code === 'core-property-missing:license'), 'null-only values do not satisfy a core property');
}
for (const present of [[null,'https://null.example.test/license'], 0, false, '']) {
  assert.ok(!nullCoreGaps(present).some(g => g.code === 'core-property-missing:license'), 'a non-null value remains present; this is not value validation');
}
const splitNull = {'@context':'https://schema.org','@graph':[
  nullCore([null]), {'@id':'https://null.example.test/#dataset',license:'https://null.example.test/license'}
]};
assert.ok(!analyzeStructuredDataPages([{url:'https://null.example.test/',html:ld(splitNull)}]).gaps.some(g=>g.code==='core-property-missing:license'),
  'a non-null same-graph fragment supplies the property');
console.log('PASS null-only core properties do not count as facts; non-null values and same-graph fragments remain distinct');

const stringRelations = analyzeStructuredDataPages([{url:'https://relations.example.test/',html:ld({
  '@context':'https://schema.org','@type':'WebPage','@id':'https://relations.example.test/#page',name:'Example',
  about:['Learning resources','https://relations.example.test/topic',{'@id':'https://relations.example.test/#explicit'}]
})}]);
const pageRelations = stringRelations.entities.find(e=>e.id==='https://relations.example.test/#page').relations.filter(r=>r.property==='about');
assert.equal(pageRelations.filter(r=>r.interpretation==='unexpanded-string' && r.target===null).length,2,
  'text and URL-shaped strings are not assumed to be node identifiers');
assert.deepEqual(stringRelations.gaps.filter(g=>g.code==='unresolved-internal-relation:about').map(g=>g.problem.includes('#explicit')), [true],
  'an explicit @id remains a bounded unresolved reference');
assert.match(stringRelations.gaps.find(g=>g.code==='unresolved-internal-relation:about').recommendation,/absence from this sample does not prove it is missing/);
const coercion = analyzeStructuredDataPages([{url:'https://relations.example.test/',html:ld({
  '@context':{'about':{'@id':'https://schema.org/about','@type':'@id'}},'@type':'WebPage',
  '@id':'https://relations.example.test/#page',about:'#topic'
})}]);
assert.equal(coercion.entities[0].contextInterpretation,'unexpanded');
assert.equal(coercion.entities[0].relations.length,0,
  'an unexpanded custom property mapping cannot be classified as a Schema.org relation');
assert.ok(!coercion.gaps.some(g=>g.code==='unresolved-internal-relation:about'));
console.log('PASS relation strings: literal, URL-shaped and custom coercion remain separate from explicit @id');

// Terms and their property mappings can differ even when their literal spelling
// resembles Schema.org. Preserve the observation and expose the coverage limit.
const otherVocab = {'@context':{'@vocab':'https://other.example.test/'},'@type':'Dataset',
  '@id':'https://context.example.test/#item',name:'Different vocabulary',publisher:{'@id':'#publisher'}};
const unknownContext = analyzeStructuredDataPages([{url:'https://context.example.test/',html:ld(otherVocab)}]);
assert.equal(unknownContext.entities[0].family,null);
assert.equal(unknownContext.entities[0].contextInterpretation,'unexpanded');
assert.equal(unknownContext.pages[0].unexpandedContextNodes,1);
assert.equal(unknownContext.summary.unexpandedContextNodes,1);
assert.equal(unknownContext.pages[0].unexpandedContextBlocks,1);
assert.equal(unknownContext.entities[0].relations.length,0);
assert.ok(!unknownContext.gaps.some(g=>g.code.startsWith('core-property-missing:') || g.code.startsWith('unresolved-internal-relation:')));
const unknownUrl = analyzeStructuredDataPages([{url:'https://context.example.test/',html:ld({
  '@context':{'@vocab':'https://other.example.test/'},'@type':'Dataset',url:'https://other.example.test/not-an-id'
})}]);
assert.notEqual(unknownUrl.entities[0].id,'https://other.example.test/not-an-id',
  'an unexpanded url term cannot supply an assumed Schema.org URL');
const ambiguousSameId = analyzeStructuredDataPages([{url:'https://context.example.test/',html:
  ld(otherVocab)+ld({'@context':'https://schema.org','@type':'Dataset','@id':otherVocab['@id'],name:'A different name'})}]);
assert.ok(!ambiguousSameId.gaps.some(g=>g.code.startsWith('reused-id-')),
  'unexpanded type and name terms cannot establish a Schema.org identity conflict');
const recognized = analyzeStructuredDataPages([{url:'https://context.example.test/',html:ld({...otherVocab,'@context':'https://schema.org'})}]);
assert.equal(recognized.entities[0].family,'dataset');
assert.equal(recognized.summary.unexpandedContextNodes,0);
assert.ok(recognized.gaps.some(g=>g.code==='core-property-missing:license'));
const aliasedType = {'@context':{'type':'@type','@vocab':'https://schema.org/'},type:'Dataset',name:'Data'};
const aliasedReport = analyzeStructuredDataPages([{url:'https://context.example.test/',html:ld(aliasedType)}]);
assert.equal(aliasedReport.summary.entitiesObserved,0, 'an aliased @type is not guessed');
assert.equal(aliasedReport.summary.unexpandedContextNodes,0, 'node count covers literal typed nodes only');
assert.equal(aliasedReport.summary.unexpandedContextBlocks,1, 'block count exposes the missed alias');
assert.match(formatStructuredDataReport(aliasedReport),/JSON-LD blocks with unexpanded context: 1/);
assert.match(formatStructuredDataReport(aliasedReport),/Context interpretation is incomplete/);
const nestedUnknown = {'@context':'https://schema.org','@type':'WebPage',name:'Page',
  about:{'@context':{'type':'@type','@vocab':'https://schema.org/'},type:'Dataset',name:'Data'}};
const mixedContexts = analyzeStructuredDataPages([{url:'https://context.example.test/',
  html:ld(nestedUnknown)+ld(aliasedType)+ld({'@context':'https://schema.org','@type':'WebPage',name:'Page'})}]);
assert.equal(mixedContexts.pages[0].jsonLdBlocks,3);
assert.equal(mixedContexts.pages[0].unexpandedContextBlocks,2,
  'nested unknown contexts mark the containing block once and safe blocks remain clear');
const multiPage = analyzeStructuredDataPages([
  {url:'https://context.example.test/one',html:ld(aliasedType)},
  {url:'https://context.example.test/two',html:ld(nestedUnknown)+ld(aliasedType)}
]);
assert.equal(multiPage.summary.unexpandedContextBlocks,3, 'summary aggregates block counts across observed pages');
const bare = analyzeStructuredDataPages([{url:'https://context.example.test/',html:ld({type:'Dataset'})}]);
assert.equal(bare.summary.unexpandedContextBlocks,1, 'a context-free object is not silently considered covered');
const invalidJson = analyzeStructuredDataPages([{url:'https://context.example.test/',html:'<script type="application/ld+json">{</script>'}]);
assert.equal(invalidJson.summary.parseErrors,1);
assert.equal(invalidJson.summary.unexpandedContextBlocks,0, 'parse failures are reported separately from context coverage');
console.log('PASS unexpanded contexts: no invented Schema.org family, relation or identity conflict; coverage remains visible');

const urlIsNotId = analyzeStructuredDataPages([referencePage([
  {'@type':'WebPage','@id':'https://graph.example.test/work#page',name:'Work guide',
    about:[{'@id':'https://graph.example.test/resource'}, {'@type':'WebPage',url:'https://graph.example.test/resource',name:'Resource'}]},
])]);
assert.ok(urlIsNotId.gaps.some(g=>g.code==='unresolved-internal-relation:about' && g.problem.includes('https://graph.example.test/resource')),
  'a separate object with only a matching url cannot resolve an explicit @id');
const embedded = urlIsNotId.entities.find(e=>e.id==='https://graph.example.test/work#page').relations.find(r=>r.interpretation==='embedded-node-without-id');
assert.equal(embedded.target,null);
assert.equal(embedded.declaredUrl,'https://graph.example.test/resource');
assert.deepEqual(embedded.targetTypes,['WebPage']);
const explicitDefinition = analyzeStructuredDataPages([referencePage([
  {'@type':'WebPage','@id':'https://graph.example.test/work#page',about:{'@id':'https://graph.example.test/resource'}},
  {'@type':'WebPage','@id':'https://graph.example.test/resource',url:'https://graph.example.test/resource',name:'Resource'}
])]);
assert.ok(!explicitDefinition.gaps.some(g=>g.code==='unresolved-internal-relation:about'),
  'an actual explicit definition continues to resolve the reference');
console.log('PASS url property: embedded nodes are preserved without asserting an @id');

const baseDoc = 'https://base.example.test/old/page?view=1';
const baseGraph = { '@context':'https://schema.org', '@graph':[
  {'@type':'WebPage','@id':'#page',name:'Base page',url:baseDoc,about:{'@id':'#item'}},
  {'@type':'Dataset','@id':'#item',name:'Base page',description:'Data',license:'https://base.example.test/license',
    publisher:{'@id':'https://base.example.test/#org'}}
]};
const noncanonical = analyzeStructuredDataPages([{url:baseDoc,html:`<link rel="canonical" href="/canonical/"><h1>Base page</h1>${ld(baseGraph)}`}]);
assert.equal(noncanonical.pages[0].canonicalUrl,'https://base.example.test/canonical/');
const basePage = noncanonical.entities.find(e => e.types.includes('WebPage'));
assert.equal(basePage.id,`${baseDoc}#page`, 'relative IDs resolve against the observed document, not its canonical');
assert.equal(basePage.page,'https://base.example.test/canonical/', 'report ownership retains the canonical URL');
assert.equal(basePage.relations.find(r => r.property === 'about').target,`${baseDoc}#item`);
assert.ok(!noncanonical.gaps.some(g => g.code === 'unresolved-internal-relation:about'));

const baseElementHtml = `<!-- <base href="https://wrong.example/"> -->
<script>const text = '<base href="https://wrong.example/">';</script>
<base href="/assets/"><base href="/ignored/"><link rel="canonical" href="guide?x=1&amp;y=2">
<h1>Base page</h1>${ld(baseGraph)}`;
const htmlBase = analyzeStructuredDataPages([{url:baseDoc,html:baseElementHtml}]);
assert.equal(htmlBase.pages[0].canonicalUrl,'https://base.example.test/assets/guide?x=1&y=2');
const htmlBasePage = htmlBase.entities.find(e => e.types.includes('WebPage'));
assert.equal(htmlBasePage.id,'https://base.example.test/assets/#page');
assert.equal(htmlBasePage.relations.find(r => r.property === 'about').target,'https://base.example.test/assets/#item');
assert.ok(!htmlBase.gaps.some(g => g.code === 'unresolved-internal-relation:about'));
const emptyBase = analyzeStructuredDataPages([{url:baseDoc,html:`<base href=""><base href="/ignored/">${ld(baseGraph)}`}]);
assert.equal(emptyBase.entities.find(e => e.types.includes('WebPage')).id,`${baseDoc}#page`);
const invalidBase = analyzeStructuredDataPages([{url:baseDoc,html:`<base href="javascript:alert(1)"><base href="/ignored/">${ld(baseGraph)}`}]);
assert.equal(invalidBase.entities.find(e => e.types.includes('WebPage')).id,`${baseDoc}#page`, 'an invalid first base falls back to the document URL');

const fakeMetadata = `<textarea><base href="https://wrong.example/"><link rel="canonical" href="https://wrong.example/"></textarea>
<template><base href="https://template.example/"><link rel="canonical" href="https://template.example/"></template>
<base href="/real/&copy;/" data-note="1 > 0"><link rel="alternate CANONICAL" href="guide?x=1&amp;y=2" data-note="1 > 0">
<h1>Base page</h1>${ld(baseGraph)}`;
const parsedMetadata = analyzeStructuredDataPages([{url:baseDoc,html:fakeMetadata}]);
assert.equal(parsedMetadata.pages[0].canonicalUrl, 'https://base.example.test/real/%C2%A9/guide?x=1&y=2',
  'text and inert template markup cannot impersonate canonical metadata; HTML entities are decoded');
assert.equal(parsedMetadata.entities.find(e => e.types.includes('WebPage')).id, 'https://base.example.test/real/%C2%A9/#page',
  'text and inert template markup cannot replace the real document base');
const quotedBoundary = analyzeStructuredDataPages([{url:baseDoc,html:`<base data-note="a > b" href="/actual/"><link data-note="a > b" rel="canonical" href="page"><h1>Base page</h1>${ld(baseGraph)}`}]);
assert.equal(quotedBoundary.pages[0].canonicalUrl,'https://base.example.test/actual/page', 'quoted angle brackets do not truncate attributes');
assert.equal(quotedBoundary.entities.find(e => e.types.includes('WebPage')).id,'https://base.example.test/actual/#page');
const textOnlyMetadata = analyzeStructuredDataPages([{url:baseDoc,html:`<textarea><base href="https://wrong.example/"><link rel="canonical" href="https://wrong.example/"></textarea><h1>Base page</h1>${ld(baseGraph)}`}]);
assert.equal(textOnlyMetadata.pages[0].canonicalUrl,baseDoc, 'text-only links are not canonical elements');
assert.equal(textOnlyMetadata.entities.find(e => e.types.includes('WebPage')).id,`${baseDoc}#page`, 'text-only bases are not elements');

const overridden = {'@context':['https://schema.org',{'@base':'/override/'}], '@type':'WebPage',
  '@id':'#page',name:'Base page',about:{'@context':{'@base':'/nested/'},'@id':'#item'}};
const customBase = analyzeStructuredDataPages([{url:baseDoc,html:`<h1>Base page</h1>${ld(overridden)}`}]);
assert.equal(customBase.entities[0].id,'https://base.example.test/override/#page');
assert.equal(customBase.entities[0].relations.find(r => r.property === 'about').target,'https://base.example.test/nested/#item');
const noBase = analyzeStructuredDataPages([{url:baseDoc,html:ld({'@context':{'@base':null},'@type':'WebPage','@id':'#page',name:'Base page',about:{'@id':'#item'}})}]);
assert.equal(noBase.entities[0].explicitStableId,false, 'a null JSON-LD base does not turn a relative ID into an absolute one');
assert.equal(noBase.entities[0].relations.length,0, 'a relative reference remains unresolved with a null base');
const emptyId = analyzeStructuredDataPages([{url:baseDoc,html:ld({'@context':'https://schema.org','@type':'WebPage','@id':'',name:'Base page'})}]);
assert.equal(emptyId.entities[0].id,baseDoc, 'an empty @id resolves to the document base');

const sameCanonicalPages = analyzeStructuredDataPages([
  {url:'https://base.example.test/first',html:`<link rel="canonical" href="/shared"><h1>First label</h1>${ld({'@context':'https://schema.org','@type':'Dataset','@id':'https://base.example.test/#first',name:'First label'})}`},
  {url:'https://base.example.test/second',html:`<link rel="canonical" href="/shared"><h1>Second label</h1>${ld({'@context':'https://schema.org','@type':'Dataset','@id':'https://base.example.test/#second',name:'Second label'})}`}
]);
assert.ok(!sameCanonicalPages.gaps.some(g => g.code === 'visible-name-parity'), 'visible names are checked against their own observed document');
console.log('PASS document and context bases: canonical difference, HTML base, nested override, null, empty ID and same-canonical pages');

{
  const origin='https://graph.example.test/';
  const home=`<h1>Home</h1>${ld({'@context':'https://schema.org','@type':'WebPage','@id':origin+'#page',name:'Home',about:{'@id':origin+'#data'}})}`;
  const data=`<h1>Data</h1>${ld({'@context':'https://schema.org','@type':'Dataset','@id':origin+'#data',name:'Data',license:origin+'license',publisher:{'@id':origin+'#publisher'}})}`;
  const bodies=new Map([[origin,home],[origin+'data',data]]), calls=[];
  const fetchImpl=async url=>{calls.push(url);return bodies.has(url)?new Response(bodies.get(url),{status:200,headers:{'content-type':'text/html'}}):new Response('',{status:404});};
  const resolveImpl=async()=>[{address:'93.184.216.34',family:4}];
  const single=await analyzeStructuredDataUrl(origin,{fetchImpl,resolveImpl});
  assert.ok(single.gaps.some(g=>g.code==='unresolved-internal-relation:about'));
  assert.equal(single.discovery.input,origin, 'the existing single-page discovery shape is preserved');
  const combined=await analyzeStructuredDataUrls([origin,origin+'data'],{fetchImpl,resolveImpl});
  assert.equal(combined.summary.pagesObserved,2);
  assert.ok(!combined.gaps.some(g=>g.code==='unresolved-internal-relation:about'));
  assert.deepEqual(combined.discovery.pages.map(p=>p.finalUrl),[origin,origin+'data']);
  await assert.rejects(analyzeStructuredDataUrls([origin,origin+'missing'],{fetchImpl,resolveImpl}),/HTTP 404/,
    'a failed page must fail the batch instead of returning a misleading partial graph');
  const prior=calls.length;
  await assert.rejects(analyzeStructuredDataUrls([origin,origin+'#fragment'],{fetchImpl,resolveImpl}),/Duplicate/);
  await assert.rejects(analyzeStructuredDataUrls(Array(6).fill(origin),{fetchImpl,resolveImpl}),/between 1 and 5/);
  assert.equal(calls.length,prior,'invalid batches make no network requests');
  await assert.rejects(analyzeStructuredDataUrls([origin,origin+'data'],{fetchImpl,resolveImpl:async()=>[{address:'127.0.0.1',family:4}]}),/private or reserved/i);
  await assert.rejects(analyzeStructuredDataUrls([origin,origin+'data'],{resolveImpl,fetchImpl:async()=>new Response('',{status:302,headers:{location:'https://private.local/'}})}),/Local hostname/i,
    'redirects retain the public-host boundary');
  await assert.rejects(analyzeStructuredDataUrls([origin,origin+'data'],{resolveImpl,fetchImpl:async url=>url===origin
    ?new Response('',{status:302,headers:{location:origin+'data'}}):new Response(data,{status:200})}),/same final URL/i);
  console.log('PASS multi-page fetch: cross-page identity, bounded scope, failures, duplicate destinations and public-host safeguards');
}

{
  const cli=path.resolve('bin/arwp-structured-data.mjs');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'arwp-structured-cli-'));
  try {
    const file=path.join(temp,'page.html');fs.writeFileSync(file,'<h1>Example</h1>');
    const run=args=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
    const one=run(['--timeout','8000','--file',file,'--url','https://graph.example.test/','--json']);
    assert.equal(one.status,0,one.stderr);
    assert.equal(JSON.parse(one.stdout).pages[0].url,'https://graph.example.test/');
    assert.equal(run(['--file',file,'https://graph.example.test/']).status,2,'file and URLs cannot be mixed');
    assert.equal(run(['https://graph.example.test/','https://graph.example.test/#same']).status,2,'duplicate inputs are rejected');
    assert.equal(run(Array.from({length:6},(_,i)=>`https://graph.example.test/${i}`)).status,2,'the CLI enforces the page cap');
  } finally { fs.rmSync(temp,{recursive:true,force:true}); }
  console.log('PASS structured-data CLI: single-file compatibility, option parsing and bounded invalid batches');
}

// JSON-LD 1.1 permits one node object as well as an array under @graph.
{
  const url = 'https://singleton-graph.example.test/data';
  const render = value => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
  const entity = {'@type':'Dataset','@id':`${url}#data`,name:'Sample data',description:'Synthetic dataset',license:'https://singleton-graph.example.test/license'};
  const input = graph => ({'@context':'https://schema.org','@graph':graph});
  const one = analyzeStructuredDataHtml(`<h1>Sample data</h1>${render(input(entity))}`,{url});
  const many = analyzeStructuredDataHtml(`<h1>Sample data</h1>${render(input([entity]))}`,{url});
  assert.equal(one.summary.entitiesObserved,1,'a singleton graph node is not omitted');
  assert.deepEqual(one.entities,many.entities,'single and array graph forms inventory the same entity');
  assert.deepEqual(one.gaps,many.gaps,'single and array graph forms produce the same findings');

  const typed = {'@context':'https://schema.org','@type':'Dataset','@id':`${url}#data`,name:'Sample data'};
  const fragment = {'@id':`${url}#data`,license:'https://singleton-graph.example.test/license'};
  const named = graph => ({'@context':'https://schema.org','@id':`${url}#named`,'@graph':graph});
  const report = graph => analyzeStructuredDataHtml(`${render(typed)}${render(named(graph))}`,{url});
  const singleNamed = report(fragment), arrayNamed = report([fragment]);
  assert.deepEqual(singleNamed.gaps,arrayNamed.gaps,'named singleton and array graphs keep the same isolation');
  assert.ok(singleNamed.gaps.some(g=>g.code==='core-property-missing:license'),
    'named graph properties do not complete a default graph entity');
  console.log('PASS singleton JSON-LD graph: entity inventory and named graph isolation');
}

// Repeated default-graph descriptions of the same explicit entity must not
// crowd out other bounded review findings; distinct contexts stay distinct.
{
  const base='https://repeat.example.test/',id=base+'#editorial',name='Example editorial team';
  const entity=(changes={})=>({'@type':'Organization','@id':id,name,...changes});
  const block=nodes=>ld({'@context':'https://schema.org','@graph':nodes});
  const findings=report=>report.gaps.filter(g=>['visible-name-parity','visible-name-render-review'].includes(g.code));
  const page=(url,html)=>({url,html});
  const repeated=analyzeStructuredDataPages([page(base,block(Array.from({length:80},()=>entity())))]);
  const unique=findings(repeated);assert.equal(unique.length,1);assert.equal(unique[0].occurrences,80);
  assert.match(formatStructuredDataReport(repeated),/Repeated identical assertions in this document: 80/);
  const hidden=analyzeStructuredDataPages([page(base,`<div hidden>${name}</div>${block([entity(),entity()])}`)]);
  assert.equal(findings(hidden).length,1);assert.equal(findings(hidden)[0].code,'visible-name-render-review');assert.equal(findings(hidden)[0].occurrences,2);
  const names=analyzeStructuredDataPages([page(base,block([entity(),entity({name:'Another label'})]))]);
  assert.equal(findings(names).length,2,'different names remain separately reviewable');
  const ids=analyzeStructuredDataPages([page(base,block([entity(),entity({'@id':base+'#other'})]))]);
  assert.equal(findings(ids).length,2,'different explicit IDs are not combined');
  const types=analyzeStructuredDataPages([page(base,block([entity(),entity({'@type':'https://schema.org/Organization'})]))]);
  assert.equal(findings(types).length,2,'distinct type spellings remain separately represented');
  const separatePages=analyzeStructuredDataPages([page(base,block([entity()])),page(base+'other',block([entity()]))]);
  assert.equal(findings(separatePages).length,2,'different observed documents stay separate');
  const namedGraph=ld({'@context':'https://schema.org','@id':base+'#graph','@graph':[entity(),entity()]});
  assert.equal(findings(analyzeStructuredDataPages([page(base,namedGraph)])).length,2,'named graph occurrences are not combined');
  const nestedAnonymous=ld({'@context':'https://schema.org','@type':'Thing','subjectOf':{'@graph':[entity(),entity()]}});
  assert.equal(findings(analyzeStructuredDataPages([page(base,nestedAnonymous)])).length,2,'nested anonymous graph scope stays separate');
  const rootArray=ld([{'@context':'https://schema.org','@graph':[entity(),entity()]}]);
  assert.equal(findings(analyzeStructuredDataPages([page(base,rootArray)])).length,2,'graph objects inside root arrays remain conservatively separate');
  const blank=block([entity({'@id':'_:editorial'}),entity({'@id':'_:editorial'})]);
  assert.equal(findings(analyzeStructuredDataPages([page(base,blank)])).length,2,'blank nodes are not combined');
  const anonymous=block([{'@type':'Organization',name},{'@type':'Organization',name}]);
  assert.equal(findings(analyzeStructuredDataPages([page(base,anonymous)])).length,2,'anonymous nodes are not combined');
  console.log('PASS repeated visible-name findings: bounded dedupe and graph context isolation');
}
