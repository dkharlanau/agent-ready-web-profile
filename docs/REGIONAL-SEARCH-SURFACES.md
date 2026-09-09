# Regional Search Surface Review

Status: source-backed planning gate. Reviewed: 2026-09-09. Ranking/traffic impact: unmeasured.

Google documents Search experiences that are available only for particular company-base regions and query types. Goose treats this as an applicability problem before it treats it as an implementation problem.

The question is not “which extra markup can we add?” It is:

> Is there a provider-documented regional Search surface that actually applies to this company, business role and query type, and if so what must be verified before implementation?

## Run

```bash
node bin/arwp-regional-search.mjs --check
node bin/arwp-regional-search.mjs --list
node bin/arwp-regional-search.mjs --market=eea --query=products
node bin/arwp-regional-search.mjs --market=turkiye --query=hotels,local-businesses --role=aggregator --json
node scripts/regional-search-surfaces-test.mjs
```

Supported market groups in the current registry:

- `eea`
- `turkiye`
- `south-africa`
- `other` — explicit negative scope for the regional additions represented here

Use the **company base** required by the provider documentation, not the operator's current IP address, browser locale or the language of a page. If company base or business role is uncertain, keep the result at owner review rather than guessing.

## What the gate currently knows

The canonical source is `registry/regional-search-surfaces.json`. It captures the regional feature matrix documented by Google on 2026-09-08:

| Market | Search experience | Query types |
| --- | --- | --- |
| EEA | Aggregator unit | hotels, flights, ground transportation, products |
| EEA | Supplier unit | hotels, flights, ground transportation, products |
| EEA | Ecosystem carousel | weather, sports, finance, translate |
| EEA | Job sites features | jobs |
| Türkiye | Places sites features | hotels, local businesses |
| South Africa | badge and refinement chip | travel, products, car hire, food delivery, ground transportation |
| EEA | structured data carousels | hotels, local businesses, things to do, products, ground transportation, flights, vacation rentals |
| South Africa | structured data carousels | hotels, things to do, flights, products, food delivery, car hire, vacation rentals, ground transportation |
| Türkiye | structured data carousels | hotels, local businesses, vacation rentals |

Source: https://developers.google.com/search/docs/appearance/aggregator-features

## Decision order

Use this gate after ordinary Search eligibility and Site Focus are understood.

1. Confirm the real company-base market.
2. Confirm the query type is materially relevant to the product/business.
3. Confirm the business role. Aggregator, direct supplier, data/content provider and ordinary publisher are not interchangeable labels.
4. Select only matching regional surfaces.
5. Follow the linked feature-specific provider instructions. The registry deliberately does not pretend that one generic ARWP recipe replaces them.
6. For structured-data carousels, require visible-fact parity, canonical/indexable host pages and feature-specific valid markup. Do not manufacture entities or list pages to qualify.
7. Verify the public implementation and later measure the relevant Search outcome separately.

A `not-applicable` result is useful. It means Goose should stop spending implementation time on that regional surface for the declared scope. It does **not** mean ordinary Google Search, AI Overviews/AI Mode, Discover or global rich-result features are unavailable.

## Why this is separate from hreflang

Regional Search surface availability and localization are different problems.

`hreflang` helps Google understand genuine localized/regional URL variants. It does not make a company eligible for a regional Aggregator unit, Supplier unit, Places sites feature or regional carousel. Conversely, a regional Search feature does not justify creating localized URL variants without a real localized experience.

Keep these decisions separate:

- company base / Search feature availability;
- language and regional page variants;
- business/service availability;
- structured-data eligibility;
- Search outcome measurement.

## Measurement boundary

The registry is an eligibility/participation router, not a ranking model. A matching feature record means “review this provider path,” not “implement this and traffic will rise.”

For an accepted intervention, preserve:

- declared market, query type and business role;
- exact feature and provider source reviewed;
- before/after public implementation state;
- Search Console country/query/page evidence where valid owner data exists;
- feature-specific validation or participation receipts where the provider exposes them;
- known confounders and neutral/negative outcomes.

Do not infer causality from a later impression increase. Do not create a cross-feature or cross-provider regional score.

## Freshness rule

This registry is intentionally small and provider-scoped. Regional Search experiences can change. Re-check the primary source before adding a new market, removing a feature, or turning a feature into an automated target-site transformation.

Google added the consolidated regional-differences documentation on 2026-09-08 specifically to help publishers, businesses and aggregators understand country-specific availability, eligibility and participation. That is the evidence boundary for this first registry version; it is not a claim that the listed mechanisms are new ranking systems.
