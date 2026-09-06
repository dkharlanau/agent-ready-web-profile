# Search opportunities: a review queue, not another readiness score

Status: shipped offline planning tool. Source review: 2026-09-06. Ranking and conversion impact: unmeasured.

The Growth audit asks whether a site is technically ready. This planner asks **which user need and existing page deserve the next improvement**. Start from a small, editor-reviewed intent map. Add a joint Search Console query+page export when available. Produce tasks with verification gates, not pages or ranking promises.

## Run

From a repository checkout with Node.js 20 or later:

```bash
node bin/arwp-opportunities.mjs templates/growth/arwp-opportunity-map.json
node --test scripts/search-opportunities-test.mjs
node bin/arwp-opportunities.mjs my-map.json \
  --search-console=private/query-page.json --min-impressions=50 \
  --output=private/opportunity-review.json --json
```

The output directory must already exist, and the output file must be new. No network requests, API keys, LLM calls, target-site writes or automatic publishing occur. The CLI uses exclusive file creation and private file permissions where the OS supports them. The command is currently invoked as `node bin/arwp-opportunities.mjs`; it is not a separate npm bin alias.

## Map contract

Use `templates/growth/arwp-opportunity-map.json` as a worked example, not as a list of proven high-volume keywords. Its queries are editorial hypotheses; no owner Search Console data is included.

Every opportunity records one user intent, an explicit set of query variants, one preferred target URL, `existing` or `planned` page state, subjective business value and effort from 1 to 5, a useful next action, original assets and relevant internal-link sources. Sites and target URLs are scoped to the exact origin and path prefix. A GitHub Pages project cannot accidentally consume another project's pages.

Evidence types: `tool`, `dataset`, `case-study`, `benchmark`, `worked-example`, `primary-source`. Status: `available` or `planned`. These are declarations, not verified facts. External primary-source references alone are not counted as an original asset. The planner always emits a task to verify or create the actual contribution.

Normalize spelling variants into the same intent. A query cannot belong to multiple opportunities: ambiguous attribution fails validation. Different intents may share a broad, useful page. There is no requirement to create one page per query. Country/device segments and localization choices require editorial review; the tool does not infer them from a query's language.

## Owner export contract

The existing `arwp-visibility import` is for aggregate outcomes. Its snapshots do not preserve joint query+page dimensions and cannot substitute for this input. Neither can the separate Queries and Pages tabs of a default Search Console CSV export: joining those independent totals invents attribution.

Use a single final Search Analytics API query with `dimensions: ["query", "page"]`, `type: "web"`, and `aggregationType: "auto"`. Preserve its actual `responseAggregationType`; this tool requires `byPage`. Paginate without overlapping rows. For a subdirectory site, filter the page dimension to that prefix. Record the actual dates, country/device filters and resulting rows in this wrapper:

```json
{
  "schemaVersion": "1.0",
  "site": "https://example.com/project/",
  "period": {"start": "2026-08-01", "end": "2026-08-28"},
  "searchType": "web",
  "dimensions": ["query", "page"],
  "aggregationType": "byPage",
  "dataState": "final",
  "filters": {"country": null, "device": null},
  "rows": [
    {"keys": ["static website audit", "https://example.com/project/audit/"],
     "clicks": 5, "impressions": 100, "position": 10}
  ]
}
```

**The numbers above are synthetic fixture data, not ARWP results.** Use `null` filters only when no corresponding filter was applied. Keep one consistent segment, period and search surface per file. Do not combine daily, country, device or overlapping exports into this schema. API dates use the platform's Pacific time convention, not the operator's local timezone. The wrapper validates consistency; it cannot authenticate the provenance of numbers the owner supplies.

Inputs are limited to 5 MiB by the CLI. Unknown fields, duplicate query-page rows, invalid dates, out-of-scope URLs, preliminary data, property-level totals, impossible counts and missing positions for positive impressions are rejected. CTR is recomputed from clicks and impressions. Zero impressions require `position: null` rather than an invented rank of zero.

## Queue rules

1. Review meaningful observed query-page overlap before approving another page. Several URLs are a **review signal**, not a diagnosis of cannibalization or permission to merge/redirect/noindex them.
2. Review existing answers in the average-position band above 3 through 20 when the selected non-brand rows meet the configured impression threshold.
3. Review other observed existing coverage. For a planned URL, inspect pages already serving the need before creating another.
4. With missing or weak owner evidence, establish a baseline and inspect existing content. Planned pages remain `research-before-publish`.

The default minimum of 50 page impressions and position band are **project scheduling heuristics**, not Google recommendations, statistical significance thresholds or a predicted uplift. Within a priority bucket, ordering uses declared business value, observed non-brand page impressions, declared effort, then ID. No combined ranking, authority or readiness score is produced.

## Measurement discipline

`observed`, `nonBrandObserved` and `targetObserved` contain only aggregates for matched rows. Position is impression-weighted. Page impressions are not unique searches, keyword volume or property totals: multiple URLs may appear for the same query. Missing export rows remain unknown, not zero demand. Raw query rows are omitted from reports, but reports still contain owner aggregates and must stay private unless publication is explicitly reviewed.

Brand terms use normalized token-phrase matching. Maintain aliases manually and review multilingual results. The planner does not forecast CTR uplift, equate clicks with conversions, or infer a Google AI-only breakdown from `web` data. Bing citations and referral outcomes remain in the existing visibility-evidence workflow; they are not mixed into Search Console positions.

For each deployed change record the commit, hypothesis, changed URL, primary outcome, guardrails, equal complete before/after windows, unchanged segment filters and known confounders. Review effects using the existing Growth experiment/visibility tools. Keep neutral and negative results. `rankingImpact` and `conversionImpact` stay null until separate outcome evidence exists.

## Agent loop and first pilot

`inspect site → repair eligibility → map a small set of real needs → inspect owner evidence → choose one existing page → add an original useful asset → build/test → record change → review outcomes`

The self-pilot covers four existing ARWP destinations: this planner, static-site auditing, protocol selection and crawler policy. All demand and outcome baselines start unknown. The new public guide at `growth/opportunities/` supplies a runnable tool, input contract and tests rather than a generic SEO article. It is linked from Growth; no claim of search placement is made.

New reusable experiments for subsequent site rollouts:

- **Proof before prose:** use a working calculator, diagnostic, downloadable fixture, first-hand case or reproducible comparison as the reason to visit a page. Verify it before promoting it.
- **Intent ownership:** review which existing page serves a need before adding another article. Preserve distinct intents/locales; never merge from query overlap alone.
- **Useful next action:** connect a helpful answer to a real product task and measure task completion, not just visits or metadata coverage.
- **Citation feedback:** use owner-observed Bing intents/topics/citation evidence to choose a deeper worked example; keep those observations separate from Google positions and organic conversions.

These are project experiments, not platform promises. Apply them to another repository only after inspecting its actual routes, product capabilities and owner constraints.

## Primary sources

- [Search Analytics API: dimensions, aggregation, final data and row limits](https://developers.google.com/webmaster-tools/v1/searchanalytics/query).
- [Search Console metrics and aggregation](https://support.google.com/webmasters/answer/7576553?hl=en).
- [Google generative Search guidance: non-commodity content; no special AI files or query-variant page requirement](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).
- [Bing AI visibility: intents, topics, citation share and comparison](https://blogs.bing.com/search/June-2026/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare).
