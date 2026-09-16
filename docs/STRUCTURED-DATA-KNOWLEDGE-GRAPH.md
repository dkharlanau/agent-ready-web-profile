# Structured Data & Knowledge Graph

ARWP treats structured data as a connected representation of real site entities, not as a bag of SEO snippets.

Canonical machine-readable contract:

- `registry/structured-data-knowledge-graph.json`
- page routing remains in `registry/page-semantics-profiles.json`
- whole-site coverage remains in `registry/comprehensive-site-audit.json`

The page-semantics layer answers **what kind of entity/page is this?** This layer answers **is the entity graph complete, truthful and connected for the facts that actually exist?**

## Operating model

Apply the layer in this order:

1. inventory canonical pages and reusable real-world entities;
2. classify each page before adding markup;
3. assign stable absolute `@id` values to reusable first-class entities;
4. populate only facts already supported by visible first-party content or other explicit public evidence;
5. connect entities with real relations instead of repeating disconnected objects;
6. evaluate provider-specific Search eligibility separately from Schema.org semantic validity;
7. validate built/deployed output and cross-page identity consistency;
8. keep missing owner facts as owner-data gates rather than placeholders.

A smaller coherent graph is preferable to a large contradictory graph.

## Core graph patterns

### Site and publisher

```text
WebSite (#website)
  publisher -> Organization / Person
```

Keep site name, canonical root, publisher identity and visible branding coherent. Use one reusable publisher identity rather than slightly different `Organization` objects on each page.

### Organization

```text
Organization (#organization)
  logo -> ImageObject / URL
  contactPoint -> ContactPoint
  address -> PostalAddress
  hasMerchantReturnPolicy -> MerchantReturnPolicy   [merchant only]
  hasShippingService -> ShippingService             [merchant only]
```

Google currently has no universal required-property set for `Organization`; ARWP's stable identity and name/url checks are graph-consistency requirements, not a claim about rich-result eligibility.

Use real identifiers such as legal name, tax/VAT/LEI/ISO 6523 or NAICS only when they are genuinely applicable and known.

### Services and service areas

```text
Service (#service)
  provider -> Organization / Person
  areaServed -> Place / AdministrativeArea / GeoShape / Text
  offers -> Offer / OfferCatalog
```

Use `areaServed` for a real geographic scope. Schema.org marks `serviceArea` as superseded by `areaServed`.

Do not turn a globally available online service into a `LocalBusiness` merely to obtain local-search semantics.

### Physical locations and maps

```text
LocalBusiness / Place (#place)
  address -> PostalAddress
  geo -> GeoCoordinates / GeoShape
  containedInPlace -> Place
```

A map embed is a user-interface aid. It is neither required by Schema.org nor a substitute for truthful location semantics.

When a site has a real physical location, verify:

- visible name/address/phone/hours where applicable;
- `LocalBusiness` or the most specific truthful subtype;
- `PostalAddress` parity;
- truthful coordinates when coordinates are published;
- service-area truth;
- a useful contact/location/map route when it helps users.

Never infer or fabricate latitude/longitude merely to complete a graph.

### Products, variants and offers

```text
ProductGroup (#product-group)
  hasVariant -> Product
  variesBy -> variant dimensions
  productGroupID -> stable group identity

Product (#product)
  isVariantOf -> ProductGroup
  brand -> Brand / Organization
  offers -> Offer

Offer
  seller -> Organization / Person
  hasMerchantReturnPolicy -> MerchantReturnPolicy   [override when real]
```

Use `ProductGroup` only for genuine variants. Variant URLs, price and availability must represent the selected variant.

Never create ratings, reviews, stock state, prices or offer data merely to satisfy a Search feature.

### Merchant policies

A merchant-wide return policy belongs under the seller/organization when that reflects the real policy. A product-specific `Offer` may override it when the business genuinely has an exception.

Shipping services and conditions must reflect real destinations, origins, rates and fulfillment behavior. Public markup does not replace Merchant Center owner-state checks when those are relevant.

### Datasets

```text
Dataset (#dataset)
  creator/publisher -> Person / Organization
  distribution -> DataDownload
  includedInDataCatalog -> DataCatalog
```

A mature dataset graph should preserve:

- canonical dataset identity;
- creator/publisher;
- version and identifier;
- license;
- methodology/provenance/limitations;
- distributions and formats;
- external persistent identifier only after it has actually been issued.

`citation` is for related publications, not the dataset's own identifier.

See `DATASET-PUBLICATION.md` for the publication lifecycle, DOI handling, Croissant/DCAT and archival guidance.

### Editorial content

```text
Article / BlogPosting / NewsArticle / TechArticle
  author -> Person / Organization
  publisher -> Organization / Person
  about -> reusable subject entity
```

Visible bylines and publication/update dates must agree with structured data. Do not invent biographies, credentials or reviewer identities.

### Events

```text
Event
  location -> Place / VirtualLocation
  organizer -> Organization / Person
```

Schema.org Event semantics are broader than Google's event Search feature. Publication/release events must not be represented as eligible physical public events unless they actually meet the provider requirements.

### Images

Use `ImageObject` when structured image identity, attribution or licensing adds value. Keep it aligned with the ARWP Image Quality & Attribution layer:

- meaningful stable file identity;
- `contentUrl`/`url`;
- creator/credit/license when applicable;
- truthful dimensions/format;
- visible attribution policy where required.

## Stable identity rules

Prefer stable absolute IDs, for example:

```text
https://example.com/#website
https://example.com/#organization
https://example.com/products/widget/#product
https://example.com/services/audit/#service
https://example.com/dataset/#dataset
https://example.com/locations/minsk/#place
```

Do not create a new ID for the same entity on every page. Do not reuse one ID for two materially different entities.

Nested value objects such as one-off `PostalAddress` or `GeoCoordinates` do not always need their own reusable `@id`.

## Completeness is contextual

ARWP deliberately separates three questions:

1. **Semantic completeness** — is the graph coherent and appropriately connected for facts that exist?
2. **Visible parity** — does markup agree with what users can verify on the page/site?
3. **Provider eligibility** — does a specific Google/Bing feature have additional required/recommended fields?

A page can be semantically valid without qualifying for a Google rich result. Conversely, adding more markup does not create legitimacy or relevance.

## Validation dimensions

A full structured-data pass checks:

- JSON-LD parseability;
- page-type fit;
- visible-fact parity;
- stable reusable identity;
- relationship resolution;
- cross-page identity consistency;
- canonical URL consistency;
- localized structured-data parity;
- provider-specific eligibility only when that feature is actually targeted;
- final deployed output.

Do not call a whole site complete from a small crawl sample. Use the comprehensive audit inventory/coverage contract to state the actual coverage level.

## Conditional packs

Activate only when real site evidence triggers them:

- `physical-location`: LocalBusiness, Place, PostalAddress, GeoCoordinates/GeoShape;
- `commerce`: Product, ProductGroup, Offer, MerchantReturnPolicy, ShippingService;
- `service-catalog`: Service, OfferCatalog, Offer;
- `dataset-publication`: Dataset, DataCatalog, DataDownload.

Absent applicability is `not-applicable`, not a defect.

## Severity

- **P0** — broken/deceptive graph or the same `@id` used for conflicting real entities.
- **P1** — missing identity/core relationship or contradiction between markup and visible facts.
- **P2** — important relationship/enrichment gap where the underlying fact is already known.
- **P3** — optional semantic enrichment supported by evidence.

These priorities are remediation priorities, not ranking scores.

## Anti-patterns

Do not:

- inject every Schema.org type into every page;
- manufacture an address, coordinates or service area;
- mark an online-only company as a local business without a real local presence;
- create `ProductGroup` without genuine variants;
- invent offers, price, availability, ratings or reviews;
- publish shipping/return markup that differs from the real policy;
- use `sameAs` for merely related links;
- treat an embedded map as structured-data completeness;
- treat a valid graph as proof of rich results, indexing, ranking or AI citation.

## Primary sources

The machine-readable registry records current source URLs. Key upstream references include Google Search structured-data policies, Organization, LocalBusiness, Product/Product variants, merchant return policy and Dataset documentation, plus Schema.org `Service`, `Place`, `areaServed` and `OfferCatalog`.

Upstream requirements remain authoritative and should be re-reviewed when a provider feature changes.
