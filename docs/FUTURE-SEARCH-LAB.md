# ARWP Future Search Lab

Status: experimental layer on `main` · reviewed 2026-09-07

The Future Search Lab tracks mechanisms that may make a website easier for future search, retrieval and browser-agent systems to understand even when no current ranking benefit is documented.

The operating assumption is intentionally broader than a Google rich-result checklist:

> **If a mechanism improves truthful machine interpretation, stable identity, evidence traversal, change discovery or agent operability, it can be worth testing before a search platform publicly documents a ranking feature.**

That assumption does not convert experiments into ranking factors. ARWP keeps current platform requirements, platform guidance and Future Search experiments separate.

## Why this layer exists

Google's own structured-data documentation says Schema.org contains objects and properties that are not required by Google Search but may still be useful for other search engines, services, tools and platforms, and that some may be used for future Search features. Schema.org 30.0 also added equivalence annotations and exports involving adjacent vocabularies such as Dublin Core, GS1 and Open Graph.

ARWP therefore uses two structured-data questions instead of one:

1. **What is required or recommended for a documented current search feature?**
2. **What additional truthful semantics improve the open machine-readable model of this site?**

The second question belongs here.

## Registry

Canonical registry:

`registry/future-search-experiments.json`

Validation schema:

`schema/future-search-experiments.schema.json`

Every entry has:

- maturity: `foundation`, `experiment` or `watch`;
- confidence;
- applicability;
- implementation boundaries;
- verification;
- primary/open-standard sources.

`foundation` means ARWP considers the mechanism useful on its own merits when applicable, not that it is a ranking factor. `experiment` means the mechanism is reasonable to test with explicit evidence boundaries. `watch` means do not promote it to routine implementation yet.

## Current experiment families

### Schema.org beyond the current rich-result gallery

Use applicable Schema.org types and relations supported by real page/entity facts even when Google does not currently list them as a rich-result requirement.

Particularly useful relations include:

- `mainEntity`;
- `about` / `mentions`;
- `isPartOf` / `hasPart`;
- `subjectOf`;
- `citation` / `isBasedOn`;
- `sameAs` for real identity aliases;
- `author`, `publisher`, `provider`, `maintainer`.

This is not permission to add every possible property. The graph should become more accurate, not larger for its own sake.

### Semantic page/entity index

ARWP can compile the canonical page manifest and reusable entity catalog into one optional JSON-LD graph:

```bash
node bin/arwp-semantic-index.mjs build \
  registry/page-manifest.json \
  registry/entity-catalog.jsonld \
  --output=semantic-index.jsonld

node bin/arwp-semantic-index.mjs check semantic-index.jsonld
```

The generated graph contains:

- the existing canonical entity catalog;
- one stable page node per indexed canonical URL;
- `isPartOf` → WebSite;
- `mainEntity` → reusable site entity where known;
- an `ItemList` of canonical page nodes;
- one `CreativeWork` node describing the optional aggregate index.

The aggregate index is not a standard ranking/discovery file. Canonical HTML, visible navigation and page-local truthful structured data remain primary. The value is that a future crawler, retrieval layer or agent can consume a compact coherent graph if it chooses to.

### Evidence relation graph

For research, technical documentation and software pages, connect real supporting artifacts instead of leaving all evidence implicit in prose. Use relations such as `citation`, `isBasedOn`, `hasPart`, `subjectOf` and durable entity identifiers only where the relationship is real and inspectable.

Do not create decorative references or synthetic evidence nodes.

### Intent → page → evidence feedback

Bing AI Performance exposes sampled grounding queries and page-level citation activity. Joint Search Console query+page data provides a different owner-side view. ARWP treats those as feedback into one graph:

`observed intent → canonical answer page → answer section → first-party evidence asset → external outcome evidence`

The default response to a new query is **not** a new page. Strengthen the existing canonical answer unless a genuinely distinct user task warrants another URL.

### Browser-agent semantics

OpenAI documents that ChatGPT Agent in Atlas uses ARIA labels and roles to interpret interactive elements. ARWP therefore treats native semantic controls plus accurate role/name/state information as a future-search/agent foundation for interactive sites.

Static review does not prove runtime accessibility or agent success. Verify rendered behavior and actual browser-agent tasks.

### Truthful action semantics

Action-oriented Schema.org semantics are a `watch` item. Only describe an action when the user-visible capability truly exists, its target is accurate, and authorization/side effects are handled separately at runtime. Do not resurrect `SearchAction` merely for the retired sitelinks search box.

### Change notification mesh

Use truthful sitemap `lastmod`, IndexNow where supported, and provider-specific submission mechanisms as complementary freshness/discovery channels. Notification acceptance is not indexing proof, and timestamps must never be churned to simulate freshness.

## Agent Skill

Use:

`arwp-future-search`

when the job is specifically to explore and implement future-ready semantic/retrieval mechanisms after current eligibility foundations are sound.

The normal `arwp-growth-loop` remains the default orchestrator. Future Search experiments should not outrank P0/P1 crawl, canonical, content, identity or policy problems.

## Guardrails

- No universal schema bundle.
- No hidden facts that contradict visible content.
- No fabricated authors, ratings, reviews, identifiers, datasets, citations or actions.
- No machine file presented as a documented Google/OpenAI/Bing ranking requirement unless a platform explicitly says so.
- No query-variant page factories.
- No `dateModified`/`lastmod` churn.
- No static action metadata treated as authorization.
- No experiment promoted to `foundation` merely because it is new.

The goal is to make the website's public knowledge model easier to understand and operate, then observe whether future search systems reward that work.

## Primary references

- Google Search Central — structured data introduction: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- Google Search Central — structured data policies: https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- Schema.org 30.0: https://schema.org/version/latest/
- Schema.org releases: https://schema.org/docs/releases.html
- Bing Webmaster Tools AI Performance: https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview
- OpenAI Publishers and Developers FAQ: https://help.openai.com/en/articles/12627856-publishers-and-developers-faq
- IndexNow protocol: https://www.indexnow.org/documentation
