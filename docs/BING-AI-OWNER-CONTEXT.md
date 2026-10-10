# Bing AI Performance: observe what was cited, not a visibility score

Bing Webmaster Tools' AI Performance report exposes aggregated citations, pages, grouped grounding queries, and preview Intents, Topics, Citation Share and Compare. These are **publisher observations**, not ranking positions, traffic counts, exact user prompts or an independent explanation of why a model cited a page.

Source: [Microsoft's Bing AI Performance Help](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c) and [official Intents/Topics/Citation Share/Compare announcement](https://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/).

## Existing owner evidence only

This new offline adapter does **not** connect an account or claim to parse every native CSV variation. First export actual, privately authorized Bing AI Performance views, preserving the visible filters, report date range, data-state caveats and their untouched originals. The owner then prepares a local, versioned **normalized review input** from those exports.

[Example owner-normalized file](../templates/growth/bing-ai-owner-context.example.json). Every value there is **fictional**. It is intentionally `partial`; a test example is never real owner evidence.

Required contract:

- `site`: exact HTTPS owned property (not an inferred partner/brand);
- `period`: selected dates and `dataState` (`owner-final`, `partial` or `unknown`);
- `queries` / `topics`: owner-defined opaque IDs, **not original query or topic strings**;
- `pages`: stable IDs and canonical owned URLs (private input only);
- `queryContext`: provider-labeled preview intent/topic and query-scoped Citation Share percentage, **or null**;
- `pageQueryObservations`: each row carries the actual export direction, filter ID, cited page/query IDs and returned citation count;
- `timeline`: separately observed **site-level** daily citation totals; never add these to page/query counts;
- `sourceVerifiedByGoose:false`, `sampledNotComplete:true`, `notRankingOrTraffic:true`.

The **query→page** and **page→query** filtered projections are kept separately. Bing warns that sampling can produce different counts for the same query/page pair depending on filtering direction. They are not contradictory observations to average or merge. Empty/omitted query context means **unobserved**, not zero.

## Inspect locally

```bash
node bin/arwp-bing.mjs inspect \
  --input=/private/bing/normalized-2026-09.json \
  --output=/private/bing/review-2026-09.json
```

Use `--json` for a machine-readable derived report. It contains only the approved IDs, provider counts, filtered directions, preview classification and dates. **Raw query/topic text and source page URLs stay in the private input, not in the derived output.**

## Compare correctly

```bash
node bin/arwp-bing.mjs compare \
  --before=/private/bing/review-2026-09.json \
  --after=/private/bing/review-2026-10.json \
  --output=/private/bing/comparison.json
```

The comparison requires identical site and canonical page mapping, final owner-declared periods, equal window lengths, non-overlapping chronological order and stable owner query IDs. It reports Citation Share **point changes only for queries present on both sides**, together with citation counts and any intent/topic label change. Newly observed or missing queries are not treated as zero or gains/losses.

This review does **not** compute one AI-visibility score, competitor ranking, search CTR, attribution to a single edit, or cross-provider conversion. A query-specific Citation Share percentage is the site's share of citation appearances for that query within Bing's sampled set; it is not market share or search referrals.

## What should Goose actually do next?

For one confirmed real citation observation, check if the cited page truthfully answers the associated user job with a clear example, proof and next action. Fix one bounded weakness on the **existing canonical page**, verify the actual deployed change and only then review a later comparable Bing observation. Leave preview labels and thin samples as `partial` when uncertain; do not publish a page-per-topic SEO factory.

Relevant existing tools: [Measurement OS](MEASUREMENT-OS.md), [Controlled Cohorts](CONTROLLED-COHORTS.md), [Original Evidence Review](../templates/growth/original-evidence-review.md). The new analyzer **complements** the existing aggregate `arwp-visibility import --provider=bing`; it does not change that snapshot's schema, nor assume all Bing account exports expose these preview fields.
