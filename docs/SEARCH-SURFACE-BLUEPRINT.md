# ARWP Search Surface Blueprint

Ruleset `2026.09.07`, reviewed 2026-09-07.

The Search Surface Blueprint maps current Search/AI guidance to **conditional** site architecture and technical checks. It models **69 checks, 18 useful page surfaces and 7 site archetypes**. Missing optional surfaces are not SEO failures, schema semantics do not imply Google rich-result support, and only checks with observable applicability are promoted into automatic findings.

## Site archetypes

- **Software product:** core `home`, `product`, `docs`; usually useful `changelog`, `updates`, `profile`, `evidence`; optional `roadmap`, `research`, `comparison`.
- **Service business:** core `home`, `services`; usually useful `about`, `profile`, `case-study`, `updates`.
- **Editorial/news:** core `home`, `updates`, `profile`; usually useful `topic-hub`, `trust`, `media`.
- **Documentation/research:** core `home`, `docs`; usually useful `research`, `dataset`, `profile`, `updates`.
- **E-commerce:** core `home`, specific `product` leaves.
- **Portfolio:** core `home`, `profile`; products/research/updates are conditional.
- **Local business:** core `home`, `services`; about/trust/update surfaces are conditional.

## Modeled surfaces

`home`, `product`, `services`, `docs`, `updates`, `changelog`, `roadmap`, `case-study`, `evidence`, `research`, `dataset`, `profile`, `about`, `events`, `comparison`, `trust`, `media`, `topic-hub`.

## Check layers

The initial 44 checks cover host identity; titles/descriptions/snippet controls; self-canonicals and sitemap alignment; crawlable internal links and descriptive anchors; URL-state and JavaScript boundaries; Googlebot's current 2 MB fetch limit; preferred images and Discover large-image eligibility; visible publication dates; Article/NewsArticle conditions; news sitemaps; software product/version/release-note semantics; roadmap/changelog semantics; case-study/evidence/research/dataset/profile/about/event/comparison/topic/trust surfaces; Bing AI citation clarity/evidence/cross-format consistency; and FAQ anti-cargo-cult guidance.

A second deep-technical layer adds 25 conditional checks for:

- mobile-first content and metadata parity;
- lazy loading without required user interaction;
- infinite scroll and pagination with persistent crawlable URLs;
- filter/sort URL index control;
- `noindex` pages remaining crawlable until the directive can be seen;
- state-changing/action URLs and HTTPS foundations;
- localized variants, `hreflang` and conditional `x-default`;
- real HTML image discovery, useful alt text, stable image URLs and image sitemaps;
- dedicated video watch pages, `VideoObject`, video sitemaps and load-without-user-action behavior;
- structured-data parity with visible content;
- scaled-content, doorway, site-reputation and third-party-content abuse guardrails;
- crawl-budget optimization only when site scale makes it relevant.

## Automation model

The registry is deliberately broader than the current automatic crawler. Checks are classified by evidence availability:

1. **Automatic observations** — for example missing canonical/title, page size, article authorship/date, preferred images or sitemap coverage.
2. **Conditional automatic checks** — only after relevant page/surface evidence exists, such as video or localized variants.
3. **Owner-data checks** — require authenticated Search Console/platform state or deployment knowledge.
4. **Manual/policy review** — for editorial quality, scaled-content abuse, third-party content ownership or business semantics.

ARWP does not manufacture failures for categories that were not observed.

## Guardrails

- News and Roadmap are not universal requirements.
- `NewsArticle` and news sitemap are used only for genuine news workflows.
- Roadmap and changelog can use `CollectionPage`/`ItemList`, but ARWP does not claim special Google rich results for them.
- `Service`/`OfferCatalog` semantics do not imply a Google rich-result feature.
- FAQ content is written for real user questions, not as a generic rich-result tactic.
- Structured data must match visible facts; ratings, reviews, prices, people, events and credentials are never invented.
- Large-site crawl-budget recommendations do not apply by default to ordinary sites.
- Passing checks never guarantees crawling, indexing, ranking, AI citation or recommendations.

Machine registry: `registry/search-surface-blueprint.json`.
CLI: `node bin/arwp-surfaces.mjs <https://site/>`.
