# Index Worthiness

**Status:** governed publication gate  
**Scope:** Search-facing pages, especially generated entity pages, data sites, knowledge libraries and GitHub Pages portfolios.

ARWP already separates crawling, indexing, Search presentation and measured outcomes. Index Worthiness adds one more decision:

> **A page can be technically indexable and still not be worth publishing into the indexable cohort.**

This is not a ranking score. It is a publication gate.

## Why this exists

Large data/knowledge sites have an easy failure mode:

```text
source rows
→ template
→ thousands of URLs
→ sitemap
→ hope that indexing creates demand
```

The safer model is:

```text
real user/information need
→ useful canonical page
→ unique contribution
→ evidence/provenance
→ meaningful internal relationships
→ index candidate
→ curated sitemap
→ Search/AI outcome measurement
```

GitHub Pages, static generation and low hosting cost make URL production cheap. They do not make every generated URL useful to a search engine or a person.

## Decision states

Index Worthiness uses four non-numeric states:

- `index-candidate` — all required page-value gates are explicitly satisfied; the page may enter the canonical sitemap/indexable cohort;
- `review` — important evidence is unknown or not yet reviewed;
- `hold` — the page has a blocking quality/identity/provenance problem that should be fixed before Search publication;
- `exclude-from-search-candidate` — demand or unique value explicitly failed; keep the product page if useful, but do not manufacture text merely to justify indexing it.

The tool does **not** mutate `noindex`, robots, sitemap or canonicals. It emits a review decision for a human/agent-controlled publication step.

## Gates

Every candidate page is reviewed independently across:

1. **Demand** — a real user/navigation/comparison/research/decision need exists.
2. **Unique value** — the page adds original, curated, calculated, normalized, first-hand or otherwise non-commodity information.
3. **Standalone utility** — a direct landing visitor gets a complete useful result.
4. **Provenance** — important claims/data expose sources, methodology, evidence boundaries or limitations.
5. **Connectivity** — the page participates in meaningful crawlable hubs/relations, not sitemap-only discovery.
6. **Canonical identity** — variants do not compete with the intended canonical URL/entity.
7. **Freshness integrity** — update signals reflect material change, not build time.
8. **Entity depth** — for data/knowledge sites, the entity has enough real attributes/relations/evidence to justify its own page.

`Demand` and `Unique value` are special. If either explicitly fails, ARWP recommends `exclude-from-search-candidate` rather than inventing generic copy.

## Sitemap policy

Treat `sitemap.xml` as a **curated canonical index cohort**, not a dump of build output.

A generated page should not enter the Search-facing sitemap merely because:

- a row exists;
- a route can be generated;
- a title/description can be filled;
- JSON-LD can be emitted;
- an AI paragraph can be produced.

Only `index-candidate` pages are sitemap-eligible under this contract. `review`, `hold` and `exclude-from-search-candidate` remain outside until their state changes.

This is a policy decision, not a claim that sitemap inclusion guarantees indexing.

## Scaled-content guardrail

The CLI reports cohort signals separately instead of collapsing them into a score:

- generated pages whose `uniqueValue` gate is not `pass`;
- declared variant pages;
- variants that are still marked `index-candidate`;
- generated cohort size versus reviewed index candidates.

These signals require review. They do not automatically prove spam or trigger automatic `noindex`.

## GitHub Pages identity boundary

For `owner.github.io/project/`, the project path is **not** an independent hostname-level Search identity. Site names and Search favicons are hostname-scoped.

Therefore:

- fix page-level title, description, canonical and visible purpose normally;
- do not keep adding metadata in an attempt to force a separate project site name/favicon at path scope;
- when a project is intended to become an independent brand/search property, use a custom domain or another independent hostname as a product decision, then migrate canonicals/sitemaps/structured data coherently.

This is separate from Index Worthiness: a valuable page can exist under a weak brand scope, and a custom domain does not make a weak page valuable.

## Review format

Use `schema/index-worthiness-review.schema.json`.

Example gate fragment:

```json
{
  "url": "https://example.com/entities/example/",
  "generated": true,
  "gates": {
    "demand": {"status": "pass", "evidence": ["Search Console query family or documented user need"]},
    "uniqueValue": {"status": "pass", "evidence": ["Curated attributes + derived comparison"]},
    "standaloneUtility": {"status": "pass"},
    "provenance": {"status": "pass"},
    "connectivity": {"status": "pass"},
    "canonicalIdentity": {"status": "pass"},
    "freshnessIntegrity": {"status": "pass"},
    "entityDepth": {"status": "pass"}
  }
}
```

Run:

```bash
node bin/arwp-index-worthiness.mjs review.json
node bin/arwp-index-worthiness.mjs review.json --json
```

## Evidence boundaries

Keep these distinct:

```text
crawl eligible
!= index worthy
!= indexed
!= ranking
!= cited/recommended
!= acquisition
```

A page may pass this publication gate and never rank. A page may also receive impressions while still being a poor long-term page. Owner-side Search Console/Bing/referral/task data remains the outcome layer.

## Relationship to existing ARWP gates

Use in this order for data/knowledge sites:

```text
Technical Integrity
→ Search Release identity/canonical checks
→ Site Readiness Gate
→ Index Worthiness publication review
→ bounded sitemap/indexable cohort
→ owner-side outcome measurement
```

For an existing large site, do not remove thousands of URLs mechanically from one heuristic run. Start with a bounded cohort, preserve evidence, review high-risk template families, then make reversible publication changes.

Canonical practice registry: `registry/index-worthiness-practices.json`.
