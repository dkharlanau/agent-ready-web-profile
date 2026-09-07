# ARWP Search Surface Blueprint

Ruleset `2026.09.07`, reviewed 2026-09-07.

The Search Surface Blueprint maps current Search/AI guidance to **conditional** site architecture. It models 44 checks, 18 useful page surfaces and 7 site archetypes. Missing optional surfaces are not SEO failures, and schema semantics do not imply Google rich-result support.

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

## Important current checks

The registry includes host-level site-name/favicon boundaries; page titles/descriptions/snippet controls; self-canonicals and sitemap alignment; crawlable internal links and descriptive anchors; fragment-only URL-state guardrails; JavaScript rendering boundaries; Googlebot's current 2 MB fetch limit; preferred images and Discover large-image eligibility; visible publication dates; Article/NewsArticle conditions; news-sitemap conditions; software version/release-note semantics; roadmap/changelog semantics; case-study/evidence/research/dataset/profile/about/event/comparison/topic/trust surfaces; Bing AI citation clarity/evidence/cross-format consistency; and FAQ anti-cargo-cult guidance.

## Guardrails

- News and Roadmap are not universal requirements.
- `NewsArticle` and news sitemap are used only for genuine news workflows.
- Roadmap and changelog can use `CollectionPage`/`ItemList`, but ARWP does not claim special Google rich results for them.
- `Service`/`OfferCatalog` semantics do not imply a Google rich-result feature.
- FAQ content is written for real user questions, not as a generic rich-result tactic.
- Structured data must match visible facts; ratings, reviews, prices, people, events and credentials are never invented.
- Passing checks never guarantees crawling, indexing, ranking, AI citation or recommendations.

Machine registry: `registry/search-surface-blueprint.json`.
CLI: `node bin/arwp-surfaces.mjs <https://site/>`.
