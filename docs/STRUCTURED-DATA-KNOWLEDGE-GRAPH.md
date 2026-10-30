# Structured Data & Knowledge Graph

ARWP treats structured data as a connected representation of real site entities, not as a bag of SEO snippets.

Canonical machine-readable contract:

- `registry/structured-data-knowledge-graph.json`
- page routing remains in `registry/page-semantics-profiles.json`
- whole-site coverage remains in `registry/comprehensive-site-audit.json`

The page-semantics layer answers **what kind of entity/page is this?** This layer answers **is the entity graph complete, truthful and connected for the facts that actually exist?**

For a bounded cross-page review, supply up to five explicit public HTTPS pages:

```sh
node bin/arwp-structured-data.mjs https://example.com/ https://example.com/product/ --json
```

Each page uses the existing public-host, redirect, response-size and timeout
checks. The batch stops on an unavailable page or duplicate final URL instead
of presenting an incomplete set as a complete observation. Identity references
can resolve across the supplied pages, but the sample does not establish
whole-site completeness or provider eligibility. The existing one-URL and
single local `--file` modes remain available.

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

Within a recognized Schema.org context, the bounded analyzer recognizes both
literal type names and absolute Schema.org type IRIs, such as `Organization`
and `https://schema.org/Organization`. It retains the original assertion in
the report and treats those spellings as the same type for identity review,
following [Schema.org's guidance](https://schema.org/docs/developers.html) to
accept both HTTP and HTTPS vocabulary representations.
This limited normalization does not expand custom contexts, compact IRIs or
property aliases; those still require a standards-aware JSON-LD processor.
The bounded inventory accepts both a single node object and an array under
`@graph`; this does not make it a JSON-LD validity check.

Core-property findings describe each page's own default graph. When an
explicitly typed description of the same absolute `@id` and entity family on
another sampled document directly contains the property, a finding also lists
that document in `propertyObservedOnOtherDocuments`. This is a review clue,
not a merged page-local value, a provider eligibility decision, or proof the
property is correct. Blank nodes, named graphs, unknown contexts and typed
identity-only links do not supply this clue. Old reports retain their original
analyzer behavior and source dates.

### Identity links and bounded observations

A nested object containing only `@id`, `@type` and optional `@context` is
reported as an `identity-reference`. It asserts an identity and type; it is not
a complete description on which to demand name, publisher or licence facts.
The analyzer retains its type for conflict checks. A reference alone does not
count as observing the entity definition: if the definition is outside the
supplied pages, relationship resolution remains an unverified bounded-sample
finding. Supply the appropriate canonical page before prescribing a correction.
String-valued relation properties are retained as `unexpanded-string`, without
an inferred target: a string can be a literal or may be coerced to an IRI by a
JSON-LD context. This extractor does not expand arbitrary contexts, so it does
not flag such strings as missing entity IDs; use a standards-aware processor
when their interpretation matters. Explicit object `@id` references are still
checked against the supplied pages. See [JSON-LD type coercion](https://www.w3.org/TR/json-ld11/#type-coercion).
Top-level sparse entities, anonymous typed objects and objects containing other
properties still receive ordinary completeness checks. This classification is
an ARWP audit convention, not a new JSON-LD validity or Google eligibility rule.

### Repeated visible-name observations

Within one captured HTML document, identical name-parity findings for the same
explicit non-blank entity ID, exact type assertion and name in the recognized
Schema.org default graph are reported once. When repeated, `occurrences` records
the number of source assertions; priority totals count findings, not copies.
Different documents, named graphs, nested or ambiguous graph scopes, IDs, types,
names and anonymous or blank-node identities remain separate. This is report deduplication, not a claim that the
name is visible or that the underlying markup is valid. JSON-LD distinguishes
[default and named graphs](https://www.w3.org/TR/json-ld11/#data-model).

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

A repeated ID may carry a short name in one block and a longer name in another
when `alternateName` explicitly connects those names. The consistency check
accepts exact declared aliases, including text arrays; it does not infer aliases
from similar spelling, substrings or a shared generic label. A third unconnected
name and differing type assertions still require review. Unconnected names and
different type sets are reported separately as P1 review signals: JSON-LD can
represent multiple names, including translations, and several types for one
node. The difference alone is not a P0 conflict. Inspect the language, labels,
asserted types and real entity rather than assuming compatibility or contradiction. Alias
agreement does not verify the entity's truth, visible parity or provider eligibility.
See [Schema.org alternateName](https://schema.org/alternateName) and the
[JSON-LD rule for combining script blocks](https://www.w3.org/TR/json-ld11/#embedding-json-ld-in-html-documents).
The name review accepts simple JSON-LD `@value` strings, but it does not expand
language maps or custom contexts. A true collision between different real
entities remains a serious issue when established by additional evidence.
Identity comparison requires an explicit `@id`; matching `url` properties do
not by themselves assert the same JSON-LD node. A nested object with a `url`
and no `@id` remains an embedded node: its declared URL is recorded separately
and does not resolve a different object's explicit identifier. An entity's
display ID can fall back to its URL; `explicitStableId` distinguishes that
fallback from an actual `@id`. Blank-node labels such as
`_:item` are compared only within the observed document, not across pages.

Nested value objects such as one-off `PostalAddress` or `GeoCoordinates` do not always need their own reusable `@id`.

## Completeness is contextual

ARWP deliberately separates three questions:

1. **Semantic completeness** — is the graph coherent and appropriately connected for facts that exist?
2. **Visible parity** — does markup agree with what users can verify on the page/site?
3. **Provider eligibility** — does a specific Google/Bing feature have additional required/recommended fields?

A page can be semantically valid without qualifying for a Google rich result. Conversely, adding more markup does not create legitimacy or relevance.

The `visible-name-parity` detector is a bounded literal-text check, not a
semantic comparison or a browser visibility test. It parses source HTML and
excludes head metadata, comments, scripts, styles, templates, `noscript`, and
subtrees marked by the HTML `hidden` attribute from eligible text. If the name
matches only inside a `hidden` subtree, it emits a P2 rendered-review signal:
streaming frameworks may later reveal or move that content. A P1 finding means
the declared name was not found as a normalized substring in either eligible or
hidden-designated source text; it does not by itself prove a contradiction, a
Google policy violation or a need to rename the entity. CSS, JavaScript,
conditional rendering and overriding the `hidden` attribute can change actual
visibility; a match is not proof of rendered visibility. Review the rendered
context, supported aliases and the actual entity before changing markup. A
truthful descriptive label and a shorter visible label may name the same entity.
Hidden or genuinely misleading facts still require correction. See the [HTML
hidden attribute](https://html.spec.whatwg.org/multipage/interaction.html#the-hidden-attribute).

For ARWP core-property checks, repeated explicit IDs in the default graph of one
observed HTML document can contribute properties across JSON-LD script blocks
when they use the simple `https://schema.org` or `http://schema.org` context,
including an untyped fragment. Context arrays and nested contexts retain that
interpretation only for bounded additions of `@base`, `@language`, `@direction`
and `@version`, or an explicit Schema.org `@vocab`; a reset, unknown context or
term redefinition is not assumed compatible. This follows the JSON-LD model in which a node's
properties can be spread across objects. The audit does not borrow properties
from another supplied page or from a named graph to satisfy that page's check.
It uses literal property names and is not a full JSON-LD expansion or provider
eligibility validator; custom contexts, aliases and more complex graph shapes
still need a standards-aware review. See the [JSON-LD 1.1 node-object rules](https://www.w3.org/TR/json-ld11/#node-objects).

For these bounded presence checks, a property whose value is null, an empty
array, or an array containing only nulls does not supply a fact. Other values,
including zero and false, remain present; their suitability is not verified by
this check. This is not a general value validator or full JSON-LD expansion.
See the [JSON-LD expansion algorithm](https://www.w3.org/TR/json-ld11-api/#expansion-algorithm).

The same context boundary applies to family classification, literal property
checks, relations and name/type comparisons: a familiar spelling does not prove
that a custom or absent context means Schema.org. Typed nodes with an unexpanded
context remain in the report with `contextInterpretation: unexpanded`; page and
summary node counts expose this limitation. Because custom contexts can also
alias `@type`, the node count cannot measure all unrecognized entities. The
separate `unexpandedContextBlocks` count marks each parsed JSON-LD script block
once if it contains an object outside the bounded context model, including an
untyped object or one with an aliased type. A nested unsupported context marks
the containing block; parse failures are counted separately. No family or
relation is inferred for unexpanded nodes. Neither count is a count of errors,
and a low gap count does not establish graph completeness.
Expand or independently review the context before acting on its semantics. This
conservative model can also leave valid Schema.org constructs unclassified.
The CLI exit code follows reported P0/P1 findings; exit code zero does not mean
the context was fully interpreted. Check the context coverage counts as well.
See [JSON-LD contexts](https://www.w3.org/TR/json-ld11/#the-context).

For relative entity IDs and relation targets, the analyzer uses the observed
document URL and its first HTML `base` with an `href`, not the page's canonical
link. Local JSON-LD `@base` overrides, including `null`, are handled within the
bounded literal-key model. Canonical URLs remain page-identification evidence,
not a replacement for the document base. Source text, inline JSON-LD scripts,
and `base` and canonical `link` elements are selected from parsed HTML rather
than text that merely resembles markup. Attribute character references are
decoded by the parser. Comments, raw text and inert templates are not treated
as elements; conditional `noscript` contents are excluded. JSON-LD inside a
`hidden` element is still selected. The canonical value is an observed HTML
declaration, including a link found outside `head`; it is not proof that a
search engine accepts it. Metadata extraction remains bounded, and none of
these checks run a browser or a full JSON-LD processor.
Scripts inserted or moved after execution and complex contexts require an
independent rendered or standards-aware review. See the
[JSON-LD HTML base rule](https://www.w3.org/TR/json-ld11/#inheriting-base-iri-from-html-s-base-element).

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
