# Page semantics routing

Use this reference when the target site needs structured data, author identity, events, datasets, terms, localization or canonical cleanup.

Canonical registries:

- page classification and route semantics: `registry/page-semantics-profiles.json`;
- graph completeness and entity relationships: `registry/structured-data-knowledge-graph.json`;
- whole-site coverage: `registry/comprehensive-site-audit.json`.

If the skill is installed without the full repository, use the published page-semantics copy at `https://dkharlanau.github.io/agent-ready-web-profile/recommendations/page-semantics.json` and do not invent missing structured-data requirements from memory.

## Decision order

1. Inventory actual routes/content types before editing metadata.
2. Identify the canonical site/publisher entities.
3. Assign each important route one primary page-semantics profile.
4. Inventory reusable first-class entities and their existing relationships across pages.
5. Inspect visible first-party facts available to populate each profile.
6. Add only applicable JSON-LD/protocol metadata.
7. Build a coherent entity graph with stable reusable `@id` values instead of disconnected repeated objects.
8. Activate only applicable structured-data packs: physical location, commerce, service catalog, dataset publication, editorial/media/event semantics.
9. Create a missing user-facing page only when the source data is real and the page has independent user value.
10. Align canonical, sitemap, indexability and hreflang.
11. Verify the built/deployed HTML, not only source templates.
12. Report provider-specific rich-result eligibility separately from Schema.org/graph completeness.

## Entity IDs

Prefer stable absolute identities, for example:

- `https://example.com/#website`
- `https://example.com/#organization`
- `https://example.com/authors/jane/#person`
- `https://example.com/products/widget/#product`
- `https://example.com/services/audit/#service`
- `https://example.com/dataset/#dataset`
- `https://example.com/locations/store/#place`
- `https://example.com/terms/example/#term`

Reuse them. Do not generate slightly different Organization/Person/Product/Service/Dataset/Place objects across templates.

Nested value objects such as a one-off `PostalAddress` or `GeoCoordinates` object do not automatically need a reusable `@id`.

## Structured-data relationship checks

Do not stop after detecting a type. Where applicable, verify graph relationships such as:

```text
WebSite -> publisher -> Organization / Person
Service -> provider -> Organization / Person
Service -> areaServed -> Place / AdministrativeArea / GeoShape / Text
LocalBusiness / Place -> address -> PostalAddress
LocalBusiness / Place -> geo -> GeoCoordinates / GeoShape
ProductGroup -> hasVariant -> Product
Product -> isVariantOf -> ProductGroup
Product -> offers -> Offer
Organization -> hasMerchantReturnPolicy -> MerchantReturnPolicy
Organization -> hasShippingService -> ShippingService
Dataset -> distribution -> DataDownload
Dataset -> includedInDataCatalog -> DataCatalog
Article -> author -> Person / Organization
Event -> location -> Place / VirtualLocation
```

A map embed is a user-facing utility, not structured-data completeness. When a real physical location exists, verify visible address/contact/location facts plus applicable `LocalBusiness`/`Place`/`PostalAddress`/`geo` semantics. Never invent coordinates or a service area.

Use `areaServed` for real service geography; Schema.org marks `serviceArea` as superseded.

For commerce, handle genuine product variants through `ProductGroup`/`Product`, and treat return/shipping policy markup as conditional on the real merchant policy. Never fabricate offers, stock, prices, ratings or reviews.

For dataset-shaped assets, connect `Dataset` to creator/publisher, license, version/identifier, `DataDownload` distributions and `DataCatalog` when applicable. Do not fabricate a DOI or use `citation` as the dataset's own identifier.

## Executable check

For a live page:

```bash
node bin/arwp-structured-data.mjs https://example.com/page --json
```

For built HTML:

```bash
node bin/arwp-structured-data.mjs --file=dist/page.html --url=https://example.com/page --json
```

This page-level check supplements the whole-site inventory. A green result on one page is not whole-site coverage.

## Autofix boundary

Safe automation requires grounded data already present in the repo or public page. Never invent:

- author/reviewer biography or credentials;
- publication history;
- organization/legal/contact facts;
- address, coordinates or service area;
- event dates/location/ticket status;
- price, availability, rating or review data;
- shipping or return policy terms;
- dataset identifiers, licenses or provenance.

If the required fact is missing, emit an owner-data gate instead of a placeholder.

## Remediation output

For each meaningful finding record:

- `problem`
- `evidence`
- `risk`
- `recommendedChange`
- `files`
- `autofix`
- `verification`
- `source`

This gives Codex a bounded implementation task rather than an SEO suggestion.

## Important anti-patterns

- universal JSON-LD bundle;
- invisible or contradictory markup;
- unstable or conflicting `@id` reuse;
- `LocalBusiness` or geo markup invented for an online-only business;
- map embed treated as location structured data;
- `ProductGroup` without real variants;
- `SearchAction` kept only for the retired Google sitelinks search box;
- FAQ/HowTo schema sprayed across normal editorial pages;
- fake reviews/ratings/offers/prices/availability;
- fake shipping/return policy metadata;
- build-time timestamp churn;
- non-canonical/noindex URLs in the canonical sitemap;
- thin author/event/glossary/entity pages made only for bots;
- valid Schema.org treated as proof of rich results, ranking or AI citation.
