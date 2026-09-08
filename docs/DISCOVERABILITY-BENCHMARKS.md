# Discoverability measurement protocol

ARWP separates resolver regression fixtures, observed reference cohorts, browser-agent evaluations and owner-side growth measurements. This protocol covers publisher experiments within the existing [Growth Experiment workflow](GROWTH-EXPERIMENTS.md). Use the same site identity and BraidGraph measurement lineage; do not replace those contracts with a disconnected benchmark graph.

| Layer | Evidence | What it does not establish |
| --- | --- | --- |
| Technical access | Timestamped HTTP response, rendered page, canonical, robots, profile validation | Indexing, ranking or recommendations |
| Search visibility | Search Console property and exact page scope, complete dates, clicks, impressions, CTR, position | Users, conversions or a separate Google AI share |
| AI citation | Exact prompt and answer, surface/model, date, locale, cited URLs | Recommendation preference or causal uplift |
| AI recommendation | Neutral task prompt, cited answer, inclusion/order and explicit recommendation rubric | A stable universal rank |
| Useful action | Consent-compatible event definition and aggregate observations | Revenue or retention unless measured directly |

Google documents dedicated owner-side generative-AI reports alongside overall performance totals. Aggregate Web exports cannot reconstruct those separate metrics; inspect the actual report and available export/API fields before labeling data. [Google generative-AI performance reports](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports). Bing's AI Performance report exposes citations across supported surfaces; citations do not indicate placement or importance. [Bing AI Performance](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview).

## Freeze an experiment

Record the hypothesis, audience, useful action, treatment URLs, control URLs if available, tactic IDs and corpus version/hash. Record `deployed_at` only after the actual public page shows the change; use `null` before then. Preserve a baseline snapshot before release, a release receipt, and a decision date after sufficient complete data accrues.

Use equal 28-day windows by default, with Search Console's Pacific date boundary and incomplete-data metadata. Query aggregate totals independently from query tables. Compute CTR as clicks divided by impressions, and keep missing or inaccessible data distinct from observed zero. Weight aggregate position by impressions only within comparable scopes. Do not sum a parent property and its project-prefix children.

A URL-prefix property for a bare domain is not evidence about its `www` hostname. For a shared GitHub Pages hostname, isolate each project path rather than assigning the parent's total to every project. Keep legacy migration domains separate from the destination.

## Freeze an AI prompt panel

Choose neutral prompts from genuine audience tasks before reading model responses. Cover category recommendation, constrained comparison, how-to citation and a negative-control task. Run brand-seeded identity prompts separately. Keep the same prompts, locale and evaluation rubric across rounds; record surface/model changes rather than silently mixing them.

For every run preserve prompt ID, full prompt, actual answer artifact, timestamp, model or UI surface, language/locale, cited URLs and rubric judgments. Count mention, citation and recommendation separately. A missing run is `not_measured`, not an absent recommendation. Repeat observations because answers vary. Never fill an answer with a generated expected result and count it as a benchmark.

## Interpret and decide

Before/after movement is observational. Seasonality, index changes, migration recovery, query mix and other releases can explain it. Report effect sizes and denominators; use control cohorts when the volume permits. At low volume, show the observations and uncertainty without a growth percentage that hides a near-zero baseline.

Retain, revise or revert the experiment using search relevance, useful actions and regressions together. A technically valid profile can be worth keeping even when a ranking hypothesis has no measurable support. Null and negative results belong in the record.

## Continuous operation

Keep credentials and detailed account exports in a private operating workspace. Refresh bounded HTTP and read-only API snapshots on a regular schedule. Notify on meaningful changes, measurement failures or decisions that require action; do not generate a success report simply because a scheduled run executed.
