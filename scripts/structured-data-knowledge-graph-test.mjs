import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  analyzeStructuredDataPages,
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

const documentation = fs.readFileSync('docs/STRUCTURED-DATA-KNOWLEDGE-GRAPH.md', 'utf8');
assert.match(documentation, /Physical locations and maps/i);
assert.match(documentation, /ProductGroup/);
assert.match(documentation, /DataDownload/);
assert.match(documentation, /areaServed/);
assert.match(documentation, /map embed is a user-interface aid/i);

console.log(`PASS structured data knowledge graph contract: ${good.summary.entitiesObserved} observed good-fixture entities, ${broken.gaps.length} explicit broken-fixture findings`);
