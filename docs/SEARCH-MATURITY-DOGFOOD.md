# Search Maturity dogfood: ARWP AI-search visibility answer

Status: **source intervention defined · outcome windows pending · 2026-09-07**

This is the first end-to-end dogfood path for the Search Maturity Benchmark.

It demonstrates two things the benchmark must do before it can be considered operational:

1. a reference-vs-target gap can enter the existing Growth → Adaptive Upgrade architecture without creating a parallel SEO planner;
2. an implemented source change can enter the Search Intervention Ledger with future outcome windows without being mislabeled as ranking or citation success.

## 1. Target and observed gap

Target:

`https://dkharlanau.github.io/agent-ready-web-profile/answers/how-to-improve-ai-search-visibility.html`

Relevant cohort: the reviewed `ai-search-optimization` pilot in `benchmarks/search-maturity/pilot-2026-09-07.json`.

The preserved pre-change target profile is:

`benchmarks/search-maturity/targets/arwp-ai-search-visibility-before-2026-09-07.json`

Its cohort diff contains two gaps:

- `evidenceDensity`;
- `firstPartyEvidence`.

The implementation commit `5df6dcb1b6d0d4e74bfb1665b5ab3a7e644b1191` strengthened the existing answer with the reviewed pilot table, raw-corpus link, methodology link and source-backed context. It did not create a query-variant page.

The preserved post-change implementation profile is:

`benchmarks/search-maturity/targets/arwp-ai-search-visibility-after-2026-09-07.json`

Those two implementation-profile gaps are closed there. The profile explicitly says that this is **not** a Search outcome.

## 2. Benchmark → Growth → Adaptive Upgrade bridge

`lib/search-maturity-adaptive-bridge.mjs` is intentionally narrow.

The benchmark first emits `manual-review` actions with `proposal: null`. Nothing routes automatically.

Only action IDs explicitly accepted by a caller are considered by the bridge. For v0.1, only the two reviewed mappings needed by the dogfood case exist:

```text
search-maturity:evidenceDensity      ┐
                                     ├─> growth:non-commodity-review
search-maturity:firstPartyEvidence   ┘
                                             ↓
                                  Adaptive Upgrade registry
                                             ↓
                                  citation-ready-content
```

This reuse is deliberate. Search Maturity does not create another recommendation engine and does not bypass the existing Growth/Adaptive evidence and production-authorization boundaries.

If a dimension has no reviewed mapping, it remains `unroutable` with `no-reviewed-growth-route`. The bridge fails closed rather than inventing a target-site change.

Regression: `benchmarks/search-maturity-adaptive-bridge-test.mjs` proves that:

- zero accepted actions produce zero Growth actions;
- the two ARWP gaps require explicit acceptance;
- both reuse one existing `growth:non-commodity-review` action;
- Adaptive Upgrade then emits the existing `citation-ready-content` recommendation;
- production mutation remains unauthorized;
- an unmapped dimension remains unroutable.

## 3. Longitudinal Search Intervention

The experiment record is:

`benchmarks/search-intervention/arwp-ai-search-visibility-2026-09-07.json`

It links:

- the pre-change owner-evidence profile;
- the independent reference cohort;
- the exact implementation commit;
- the post-change implementation profile;
- the exact changed URL and dimensions.

State is deliberately only `source-implemented`. The record does not claim deployment verification or external Search effect merely because the source changed.

Future windows are fixed from the implementation timestamp:

| Window | Due |
| --- | --- |
| 7 days | 2026-09-14T13:42:34Z |
| 14 days | 2026-09-21T13:42:34Z |
| 28 days | 2026-10-05T13:42:34Z |

The initial outcome observation list is empty. Missing Search/AI outcomes are unknown, not zero.

When evidence becomes available, observations must remain separated by the Search Intervention Ledger channels:

- crawl/index;
- classic-search visibility;
- AI retrieval;
- AI citation;
- answer absorption;
- referral;
- useful action;
- product continuation;
- conversion.

No aggregate success score is created from these channels.

## 4. Confounders and interpretation

The intervention remains `inconclusive` with `low` confidence until follow-up evidence exists.

Known confounders include result volatility, crawl/index lag, unrelated ARWP changes, provider/model changes, the deliberately small reference cohort and the absence of a stable unchanged control for this exact intent.

Even a later positive observation would not by itself prove that `evidenceDensity` or `firstPartyEvidence` is a ranking factor. The record can support or weaken a practical hypothesis only within its evidence quality.

## 5. What this proves

This dogfood proves an implementation architecture, not a Search win:

```text
independent observations
        ↓
Search Maturity cohort
        ↓
target diff
        ↓
manual review gate
        ↓
existing Growth action
        ↓
existing Adaptive Upgrade recommendation
        ↓
source implementation
        ↓
Search Intervention Ledger
        ↓
future separated outcome observations
```

That is the intended benchmark boundary: learn from observable reference patterns, strengthen a real target when the change is useful and justified, then measure what happens without converting correlation into a platform claim.
