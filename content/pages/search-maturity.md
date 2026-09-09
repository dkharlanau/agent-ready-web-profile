# Search Maturity Benchmark

Canonical page: https://dkharlanau.github.io/agent-ready-web-profile/search-maturity/

Search Maturity is Goose ARWP's reference-cohort layer for comparing a target site with observable patterns on currently retrievable independent Search/AI pages.

The core chain is:

`intent → timestamped reference cohort → observable feature vector → repeated pattern → target gap → applicability review → implementation → verification → external outcome measurement`

## Pilot

The first reviewed pilot was frozen on 2026-09-07 and contains five independent pages observed during AI-search-related web research.

The pilot does not claim measured Google or Bing positions. Publication date plus retrieval time is treated only as age-at-observation, not time-to-index or time-to-rank.

The reviewed v0.1 dimensions include retrieval clarity, topical focus, answer-first structure, evidence density, first-party evidence, author/entity identity, site transparency, semantic structure, structured-data integrity, internal topical graph, freshness integrity, URL stability, multimodal evidence, external corroboration, utility surfaces and browser-agent accessibility.

Unmeasured dimensions remain `unknown`.

## Pilot pattern

In the five-page pilot:

- retrieval clarity: 5/5 strong;
- topical focus: 5/5 strong;
- answer-first: 5/5 present+, 4/5 strong+;
- evidence density: 5/5 present+, 4/5 strong+;
- first-party evidence: 5/5 present+, 3/5 strong+;
- site transparency: 5/5 present+, 3/5 strong+;
- semantic structure: 5/5 present+, 4/5 strong+.

These are observational candidate patterns from a small reviewed cohort, not ranking factors.

## Dogfood

ARWP's canonical answer for improving AI Search visibility was compared with the cohort before any change. Two repeated implementation gaps were observed: `evidenceDensity` and `firstPartyEvidence`.

The existing canonical answer was strengthened instead of creating a query-variant page. It now exposes the pilot aggregate, raw corpus and methodology. The post-change implementation profile closes those two cohort gaps.

That proves the benchmark can drive a bounded site improvement. It does not prove a Search ranking or AI-citation effect; external outcomes remain a later measurement gate.

## Evidence

- Public research page: https://dkharlanau.github.io/agent-ready-web-profile/search-maturity/
- Public pilot JSON: https://dkharlanau.github.io/agent-ready-web-profile/search-maturity/pilot-2026-09-07.json
- Methodology: https://github.com/dkharlanau/agent-ready-web-profile/blob/main/docs/SEARCH-MATURITY-BENCHMARK.md
- Corpus schema: https://github.com/dkharlanau/agent-ready-web-profile/blob/main/schema/search-maturity-corpus.schema.json
- Cohort engine: https://github.com/dkharlanau/agent-ready-web-profile/blob/main/lib/search-maturity.mjs

This repository Markdown file is a source/agent companion. The canonical Search surface is the HTML page above; do not publish this Markdown as a same-host duplicate.