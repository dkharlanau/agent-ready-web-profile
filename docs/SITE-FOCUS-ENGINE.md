# Cite Goose Site Focus Engine

The Site Focus Engine turns the `arwp-site-focus` product/design gate into an executable, reviewable report. It is deliberately **not** a ranking score, readiness score or automated content-pruning system.

## Why it exists

A technically sophisticated site can still be hard to understand because it serves too many problem territories, mixes audiences, exposes internal technologies as primary navigation, publishes near-duplicate routes or accumulates pages with no distinct job.

Search, AI-search and agent-readiness tooling should not hide that product problem by adding more metadata or content.

The engine answers a narrower operational question:

> What does this sampled site appear to be about, how wide is its first-order architecture, which page contracts are unclear or overlapping, and which pages deserve human review before more optimization work is added?

## Run it

From the repository checkout:

```bash
node bin/arwp-focus.mjs https://example.com
node bin/arwp-focus.mjs https://example.com --max-pages=30 --json
node bin/arwp-focus.mjs https://example.com/project/ --repo-root=. --output=site-focus.json
```

The packaged binary is `arwp-focus` once installed from a release that includes this engine.

### Live mode

Without `--repo-root`, the engine uses bounded public discovery:

1. fetch the supplied HTTPS start page;
2. inspect same-scope homepage links;
3. inspect a same-scope `sitemap.xml` when available;
4. fetch at most `--max-pages` HTML pages;
5. retain candidate discovery sources in the report.

A bounded sample is not a complete inventory unless its discovery evidence establishes coverage.

### Repository mode

With `--repo-root`, the engine looks for generated/static HTML under the first available conventional public root:

`docs/` → `public/` → `dist/` → `build/` → `_site/` → repository root fallback.

Repository mode is useful before deployment because page contracts can be mapped back to local files. It does not establish that the generated files are live.

## Report structure

### Observed site thesis

The engine records homepage title, H1 and meta description plus a normalized token set. This is **observed wording**, not a model-generated brand strategy.

### Transparent metrics

The report publishes independent counts rather than one composite score:

- pages observed;
- primary navigation destinations;
- sampled route territories;
- explicit audience signals;
- pages without a clear job signal;
- duplicate-intent pairs;
- orphan candidates in the sampled graph;
- low-thesis-overlap / out-of-scope candidates;
- pages without proof signals;
- pages without useful-action candidates;
- technology-labeled primary navigation destinations.

A count is a diagnostic input. It is not evidence of ranking impact.

### Page Contract Map

Every sampled page receives a compact contract:

- URL and local file when repository mode can resolve one;
- title and H1;
- `pageJobSignal`;
- parent route territory;
- proof signals;
- action candidates;
- sampled inbound-link count;
- lexical similarity to the observed homepage thesis;
- review disposition and explicit reasons.

## Review dispositions

The engine currently emits four bounded dispositions:

- `KEEP` — no sampled focus conflict exceeded the current heuristic thresholds;
- `NARROW` — page-job/action evidence is incomplete and the page should be clarified before expansion;
- `MERGE` — another sampled page has a substantially overlapping title/H1/description signature;
- `DEFER` — lexical overlap with the observed homepage thesis is very low and the page deserves scope review.

`DEFER` does **not** mean delete.

`REMOVE` is never emitted automatically. `SPLIT` is never emitted automatically. Both decisions require product/editorial review, traffic/history evidence, redirect implications and the real business boundary.

## Current heuristics

The engine intentionally exposes simple heuristics that can be challenged and improved:

- lexical token overlap uses Jaccard similarity over title, H1 and description tokens;
- duplicate-intent review currently starts at `0.62` signature similarity;
- low-thesis-overlap review currently starts below `0.08` for pages with at least three meaningful signature tokens;
- the Cite Goose house rule flags primary navigation above five destinations for review;
- a technology-led navigation finding appears when at least 40% of sampled primary navigation labels are implementation terms such as API/MCP/schema/protocol/benchmark.

These thresholds are **project heuristics**, not Search/AI platform requirements. They belong in experiments and dogfood review, not in marketing claims.

## Proof and action detection

A page gets a lightweight `proof.present` signal when the sampled HTML contains one or more observable indicators such as external source links, code blocks, tables, figures or explicit evidence/method/data language.

This does not assess whether the evidence is correct.

Action candidates are visible links whose labels contain action verbs such as `start`, `try`, `find`, `download`, `contact`, `compare`, `run`, `check` or `use`. This is only a page-contract heuristic; a page can have a valid job without one of those literal verbs.

## Orphan candidates

Inbound links are calculated only within the sampled page graph. A page with zero sampled inbound links is an **orphan candidate**, not a confirmed orphan. Full-site crawl coverage or repository routing evidence is required for a stronger claim.

## Dogfood protocol

Before changing thresholds:

1. freeze the engine version and target-site sample;
2. run the report on Cite Goose itself and at least two materially different sites;
3. manually review each `MERGE`, `DEFER`, navigation and audience finding;
4. record false positives and false negatives;
5. change one heuristic at a time;
6. preserve prior reports when comparing revisions.

Recommended first external dogfood targets are a focused content/product site and a broader technical/project site. The goal is not to maximize the number of warnings; it is to make scope-review decisions more accurate.

## Relationship to the rest of Cite Goose

```text
FOCUS
  ↓
MAP
  ↓
PLAN
  ↓
PATCH
  ↓
VERIFY
  ↓
MEASURE
```

Focus should run before broad content/discoverability expansion when the site thesis, audience or information architecture is unclear. It does not replace technical Search eligibility, source review, BraidGraph provenance, Target Transformation, owner-side measurements or the Growth Loop.

A future integration may allow accepted `MERGE`, `NARROW` or manually approved `SPLIT` decisions to compile into Target Transformation recipes. That integration must preserve redirect/history requirements and must not make destructive changes from a focus heuristic alone.