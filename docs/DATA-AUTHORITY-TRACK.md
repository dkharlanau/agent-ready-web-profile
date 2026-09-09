# Data Authority Track

**Status:** experimental Growth Loop track  
**Scope:** data-rich, entity-rich and graph-backed websites that want measurable Search, generative Search, AI-citation and acquisition outcomes.

The Data Authority Track extends the normal ARWP Growth Loop. It does **not** claim that a dataset, knowledge graph, JSON-LD, DOI, GitHub Pages deployment or large page count is a ranking factor. The working hypothesis is narrower: a site can become a stronger source when it publishes useful original data as stable, human-readable, evidence-bearing pages that are easy to discover, understand, verify and cite.

## Product hypothesis

A data site should not be treated as `dataset -> thousands of pages -> traffic`.

Use this model instead:

```text
REAL USER / INFORMATION NEED
          ↓
CURATED OR ORIGINAL DATA
          ↓
STABLE ENTITIES + RELATIONSHIPS
          ↓
USEFUL HUMAN PAGE
          ↓
MACHINE-READABLE REPRESENTATION
          ↓
PROVENANCE + VERSION + EVIDENCE
          ↓
INTERNAL GRAPH / RELATED ENTITIES
          ↓
SEARCH + AI DISCOVERY
          ↓
OWNER-SIDE OUTCOME MEASUREMENT
```

The page is the public evidence surface. JSON, CSV, JSON-LD, schema, graph exports and APIs complement it; they do not substitute for useful visible content.

## Data Page Value Gate

Do not use a single readiness or ranking score. Before allowing a generated entity page into the indexable cohort, review these gates separately:

1. **Demand** — there is a real query, navigation, comparison, research or decision need for the entity/topic.
2. **Unique value** — the record contains original, curated, calculated, normalized or otherwise non-commodity information.
3. **Standalone usefulness** — a person landing directly on the URL gets a complete useful answer, not a database row wrapped in HTML.
4. **Evidence** — factual or research claims expose appropriate sources, methodology, provenance or limitations.
5. **Extractability** — the important answer and attributes are directly present in accessible HTML; machine-readable forms remain consistent with the visible page.
6. **Connectivity** — the entity has meaningful visible relationships to parent collections, related entities, comparisons or next steps; it is not an orphan.
7. **Canonical identity** — stable canonical URL and stable entity identifiers exist; duplicate/filter/query variants do not create competing copies.
8. **Freshness integrity** — update/version signals change only when the underlying record materially changes.

If **Demand** or **Unique value** fails, default to not creating an indexable page. If a page exists for product functionality but has little independent Search value, consider keeping it usable while excluding it from Search rather than manufacturing text to justify indexation.

## Supported data-site surfaces

Use only when the underlying capability is real:

- human-readable entity/detail pages;
- collection and taxonomy pages with actual browsing value;
- comparison pages derived from meaningful attributes;
- Dataset / DataCatalog / DataDownload structured data for genuine datasets;
- JSON/CSV/JSONL or API distributions;
- stable entity IDs and relationship graphs;
- methodology, provenance, limitations and release/version pages;
- citation metadata and persistent identifiers for frozen research releases where appropriate;
- sitemaps and internal links that expose priority pages;
- answer-first summaries, tables, definitions and derived facts that can be cited without reading an entire corpus.

Google documents `Dataset`, `DataCatalog` and `DataDownload` for dataset discovery. Treat that as dataset-discovery guidance, not as a general Web Search ranking promise.

## Anti-patterns

Reject or quarantine these patterns:

- generating every possible row/filter/query combination as an indexable URL;
- adding generic AI-written introductions to otherwise thin records;
- creating a fake dataset only to qualify for structured-data checks;
- repeating the same description across thousands of entities with token substitutions;
- adding schema properties not supported by visible facts;
- publishing private, personal or user-generated data as a Search acquisition tactic;
- setting fake `dateModified`, synthetic changelogs or meaningless releases;
- assuming DOI, JSON-LD, `llms.txt`, an API or a knowledge graph proves authority;
- measuring success only by number of generated pages or number indexed.

Google's spam policies explicitly cover scaled content created primarily to manipulate rankings and recommend excluding low-value scaled content from Search. ARWP therefore treats page-generation scale as a risk to govern, not a success metric.

## Experiment design

Data Authority experiments must use the normal ARWP evidence boundary:

```text
implementation evidence != indexing evidence != ranking evidence != citation evidence != acquisition evidence
```

For each experiment:

1. define an intent family before creating the cohort;
2. capture a baseline before the intervention where owner data exists;
3. choose a bounded treatment cohort rather than changing every page at once when practical;
4. keep comparable unchanged pages as a control/reference cohort where the site allows it;
5. record the exact intervention: new unique data, page structure, relations, source exposure, machine-readable parity, internal links or publication metadata;
6. verify crawl/index eligibility independently from Search outcomes;
7. measure Search impressions/clicks/query coverage and AI citations/referrals separately;
8. preserve neutral and negative results;
9. stop expanding the template if new pages remain thin, duplicate, unqueried or uncited.

Recommended first cohort: **20–50 priority entity pages** per site, not thousands.

## Primary outcome signals

Use owner-side evidence where available:

- indexed priority URLs;
- Google Search impressions and clicks for treatment pages;
- number and diversity of non-brand queries reaching treatment pages;
- query-to-page match quality;
- Bing AI Performance citations and cited pages;
- observed citations/supporting links in other generative Search surfaces where measurement is trustworthy;
- Search/AI referral sessions;
- conversion or next-step events for product/commercial sites;
- crawl waste / duplicate URL growth as a guardrail metric.

Do not infer a ranking gain from a technical pass or from a third-party visibility score alone.

## Owner-controlled proof portfolio

The public portfolio registry remains `registry/portfolio-sites.json`. The first Data Authority lab uses these roles:

| Site | Experiment role | Initial data/entity opportunity |
| --- | --- | --- |
| Ptichi | primary acquisition proof | voice exercises, goals, techniques, progressions, relations and evidence |
| MetalHatsCats | commercial / professional proof | systems, workflows, architectures, operational patterns and published datasets |
| Metkagram | language-pattern proof | language patterns, examples, annotations, relations and corpus provenance |
| CBT Cards | structured-practice proof | reviewed practices, situations, exclusions, relationships and evidence boundaries |
| Cognitive Biases | entity-library proof | biases, examples, mechanisms, related concepts and evidence |
| Brali | large knowledge-library proof | practical knowledge entities, relationships and reusable structured records |
| dkharlanau.github.io | mixed-domain baseline | SAP knowledge, datasets and professional knowledge surfaces |

These are **project-reference / owner-controlled** sites. Their results may validate ARWP implementation patterns and generate product hypotheses, but they are not independent proof that a mechanism is a universal ranking factor.

## What we want to learn

The lab should answer concrete questions rather than prove a preferred narrative:

- Do data-rich entity pages gain more long-tail query coverage than matched generic pages?
- Which attributes or evidence units are actually associated with impressions and citations?
- Does exposing the same canonical record in HTML plus structured/download formats improve discoverability or agent retrieval?
- Do meaningful entity relationships help deep pages get crawled and discovered?
- Where is the point at which adding more pages stops adding value and starts creating index/crawl noise?
- Which verticals respond differently: voice training, language learning, psychology knowledge, professional systems, practical knowledge?
- Can the experiment create measurable acquisition, not only technical cleanliness?

## Commercial interpretation

ARWP should not position this as "generate programmatic SEO pages" or "guaranteed GEO".

A stronger future product hypothesis is:

> **Turn real company or expert data into a governed public evidence layer that Search and AI systems can discover, understand and cite — then measure whether it creates acquisition.**

Potential packaging can later include data ingestion, entity normalization, page generation, provenance, machine-readable distributions, graph linking, quality gates, owner-data measurement and continuous maintenance. Commercial claims stay gated until the proof portfolio produces repeatable outcome evidence.

## Primary references

- Google Search Central — Dataset structured data: https://developers.google.com/search/docs/appearance/structured-data/dataset
- Google Search Central — AI optimization guide: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Google Search Central — Spam policies / scaled content abuse: https://developers.google.com/search/docs/essentials/spam-policies
- Bing Webmaster — AI Performance: https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview
- ARWP dataset publication policy: `registry/dataset-publication-policy.json`
- ARWP portfolio registry: `registry/portfolio-sites.json`
