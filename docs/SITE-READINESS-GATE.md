# Site Readiness Gate

`arwp site-gate <url>` turns the ARWP Site Readiness checklist into a bounded public diagnostic and an experiment seed.

It is deliberately not another SEO or AI visibility score.

The command keeps four states separate:

- `pass` — the bounded public evidence satisfies the implemented check;
- `fail` — a directly observed contradiction blocks the stated Search/AI acquisition objective;
- `watch` — public automation can expose evidence, but a manual/semantic decision is still required;
- `owner-data` — the decision depends on authenticated provider analytics, first-party outcomes, logs or runtime receipts.

Missing owner data is never converted to zero.

## Usage

```bash
arwp site-gate https://example.com/ --json
arwp site-gate https://example.com/ --max-pages=30 --output=evidence/site-gate.json
arwp site-gate https://example.com/ --site-type=data-site --max-pages=40 --json
```

`--max-pages` accepts 1–50 and defaults to 30. For large sites, 20–50 is the intended operating range.

`--site-type` accepts:

- `auto`
- `general`
- `data-site`
- `research-dataset`
- `large-knowledge-site`

`auto` stays conservative. It selects `data-site` only when `Dataset` JSON-LD is observed, or `large-knowledge-site` when at least 50 sitemap candidates are observed. An explicit type is preferable when the publisher already knows the product shape.

## Priority cohort

The gate builds a deterministic public cohort from:

1. the start/canonical page;
2. same-scope homepage links;
3. bounded sitemap discovery, including a bounded sitemap index walk.

Candidates are ordered by source strength, path depth and route diversity. The cohort is reproducible through a SHA-256 digest.

This is a **public priority cohort**, not a demand ranking. Search Console query/page evidence, Bing grounding queries, conversions and other owner-only signals can later replace or refine the cohort.

## Public readiness versus outcome interpretation

The report separates two decisions.

`publicImplementationState` becomes `blocked` only when a directly observed P0 failure exists. Otherwise it is usually `provisional` while manual checks remain.

`outcomeInterpretationState` remains `blocked` while P0 manual review or owner evidence is missing. This prevents the common mistake of shipping a technical change and immediately calling later traffic movement causal.

## Experiment seed

Every report contains an `experimentSeed` with:

- bounded treatment URLs;
- an empty hypothesis list;
- an empty change timestamp;
- an empty dated baseline window;
- the Measurement OS stages `access → exposure → citation → visit → task`;
- explicit anti-pseudo-metric guardrails.

The empty values are intentional. They are owner inputs, not data the crawler may invent.

Recommended continuation:

```bash
arwp audit https://example.com/ --json
arwp-visibility merge google.json bing.json referrals.json crawl.json --json
arwp-visibility funnel merged.json --json
```

Then attach the provider-native snapshots, hypothesis IDs and change timestamp to the experiment record.

## Data-site specialization

For data/knowledge sites, the gate additionally checks or requests evidence for:

- page-value gating;
- explicit Index Worthiness review;
- curated sitemap publication instead of build-output dumping;
- scaled-content/template-family risk;
- deep discovery paths;
- deep-page contribution;
- crawl/index growth versus useful discovery.

Raw URL count, crawl count or index count is never treated as the success metric.

Run the operational publication gate after technical readiness:

```bash
node bin/arwp-index-worthiness.mjs review.json
node bin/arwp-index-worthiness.mjs review.json --json
```

Use `schema/index-worthiness-review.schema.json` for the review artifact.

Only pages in state `index-candidate` are sitemap-eligible under the ARWP Index Worthiness contract. `review`, `hold` and `exclude-from-search-candidate` remain outside the curated Search-facing cohort until the evidence or page changes.

This is not an automatic `noindex` system. The command never edits robots, sitemap, canonicals or page metadata.

## GitHub Pages identity scope

When a site lives under `owner.github.io/project/`, the project path does not have a separate hostname-level Google site-name or Search-favicon scope.

The gate therefore treats this as an identity/product decision, not a meta-tag defect:

- keep page-level title, description, canonical and visible purpose strong;
- do not keep adding metadata to force a separate project site name at path scope;
- use a custom domain or another independent hostname when a distinct brand/search identity materially matters;
- migrate canonicals, sitemap URLs, structured data and internal links coherently if the host changes.

A custom domain does not make weak content index-worthy; it only gives the project an independent hostname identity surface.

## Guardrails

The Site Readiness Gate does not:

- predict rankings or citations;
- claim a public crawl can see authenticated provider analytics;
- compute a synthetic readiness/AI score;
- divide unrelated provider populations;
- treat `llms.txt`, JSON-LD, MCP, A2A, WebMCP or ARWP metadata as ranking factors;
- infer that a generated cohort represents real demand without owner query/page evidence;
- treat sitemap inclusion as proof that a page deserves indexing;
- automatically exclude pages based on a text-length or similarity heuristic.

Canonical checklist: `registry/site-readiness-checklist.json`.

Index Worthiness: `docs/INDEX-WORTHINESS.md`.

Measurement model: `docs/MEASUREMENT-OS.md`.
