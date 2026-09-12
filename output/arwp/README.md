# Cite Goose / ARWP portfolio benchmarks

This private operating directory separates Google Search outcomes, public technical observations, actual AI recommendation observations, and verified deployment exposure. Do not publish private Search Console exports in a public repository.

## Run

```sh
cd /Users/dzmitryikharlanau/Documents/ChatGPT/SEO
python3 -m unittest -v test_arwp_benchmark.py
python3 arwp_benchmark.py
```

Live runs require `requests` and `google-auth`, with the existing shared credentials supplied only through `GOOGLE_APPLICATION_CREDENTIALS`. No credential path or credential material belongs in this directory, in an automation prompt, or in a repository. The runner requests only the Search Console read-only scope.

Each invocation creates a new UTC timestamp directory; it does not overwrite a previous run or the existing SEO dashboard. The Europe/Minsk observation date and Google Pacific date semantics are both explicit in the snapshot. Use the latest complete `*/snapshot.json`, not directory modification time or an incomplete run directory.

Artifacts in each run:

- `snapshot.json`: complete evidence, exact scopes, requests, timestamps, and comparison.
- `gsc.json`: final aggregate Web metrics for two adjacent 28-day windows, without a query dimension.
- `http.json`: bounded homepage, origin robots, sitemap, profile, and llms probes; public response fingerprints and parsed observations.
- `report.md`: readable per-scope outcome and technical report.
- `comparison.json`: comparison to the previous complete snapshot, with scope checks and semantic HTTP changes.
- `ai-prompt-suite.json`: 75 fixed unbranded discovery, comparison, and evidence prompts for 25 canonical targets. Three suggested surfaces; outcomes remain unmeasured.
- `ai-observations.json` and `ai-summary.json`: validated actual response evidence and rates within exact prompt/surface/model/mode/locale/country strata. Unknown evaluations are excluded from denominators.
- `deployment-exposure.json`: explicit verified exposure events, otherwise unknown. A profile responding today does not establish when it was deployed.

Optional controls:

```sh
python3 arwp_benchmark.py --compare output/arwp/EXISTING_RUN/snapshot.json
python3 arwp_benchmark.py --deployment-manifest output/arwp/verified-exposures.json
python3 arwp_benchmark.py --ai-observations output/arwp/ai-panel/manifest.json
python3 arwp_benchmark.py --reuse-snapshot output/arwp/EXISTING_RUN/snapshot.json --ai-observations output/arwp/ai-panel/manifest.json
python3 arwp_benchmark.py --skip-gsc --skip-http --output-root output/arwp/offline-smoke
```

## Trend export for dashboarding (stored in-repo)

Current trend artifacts without separate Bonihua legacy rows are published in:

- [output/arwp/no-bonihua-trends/](/Users/dzmitryikharlanau/Documents/ChatGPT/SEO/output/arwp/no-bonihua-trends/)

The folder contains:

- `seo-no-bonihua-trends.artifact.json`
- `seo-no-bonihua-trends.csv`
- `seo-no-bonihua-trends.md`
- `build-no-bonihua-trends.mjs`

Run to refresh:

```sh
node output/arwp/no-bonihua-trends/build-no-bonihua-trends.mjs
```

Note:
- Bonihua legacy properties are excluded from row-level display.
- Keep a single `Bonihua.com` aggregate row when needed in the dashboard build.

`--skip-*` marks the skipped source unavailable or skipped. It never substitutes zeros for unavailable sources. Running an offline smoke test under its own output root prevents it from becoming the default predecessor of a live run.

## Scope and interpretation

The registry contains 11 project properties and 16 project sub-sites. The runner adds an explicit `https://www.bonihua.com/` scope. Each dkharlanau project is filtered through an anchored full-URL regular expression under the parent GSC property. The parent property overlaps these children, so never sum all 28 rows. Page-filtered requests may use page aggregation while unfiltered parent requests use property aggregation; consult `response_aggregation` before comparing their numbers.

Non-www Bonihua metrics do not describe www Bonihua. A HTTP 403 GSC response for www is unknown, even when the public www website responds successfully. Legacy .ru/.by properties remain separate migration evidence and are never added to current-host demand as if they were independent users.

Current windows use `dataState=final`. Freshness accepts both Google's documented `first_incomplete_date` and its observed `firstIncompleteDate` response field. The earliest incomplete date minus one determines the common cutoff; missing freshness uses a conservative Pacific today minus three fallback. An absent date row does not establish missing collection or traffic by itself. A successful empty aggregate response is `no_rows`; successful explicit numeric zero rows are `observed`; failures have null metrics. CTR is undefined when impressions are zero, and relative change is undefined when the previous denominator is zero.

GSC Web metrics do not isolate recommendation or citation counts. Google's separate generative-AI performance report is a distinct owner-side source; never relabel ordinary Web `Impressions` as AI impressions. The product importer now requires explicit generative-AI columns or an owner assertion `--report-scope=generative-ai` for generic columns from that dedicated report. GSC average position is an observed aggregate across impressions, not a fixed universal rank. Changes between overlapping rolling windows are descriptive and cannot isolate profile impact. Technical availability, JSON-LD, custom profile presence, llms files, and sitemap validity do not prove Google indexing or AI recommendation.

## Actual owner UI observations — September 8, 2026

Private observations and hashed transcribed UI excerpts are under `owner-ui/2026-09-08/`. They are material excerpts of the authenticated interface, not downloaded CSV exports. These observations were made before the Bonihua and Ptichi profile releases:

- Bonihua www Web: 15 clicks and 956 impressions; the requested window is August 9–September 5, but the visible chart covers only August 31–September 5.
- Bonihua www separate Google generative-AI report: 31 impressions across 17 page rows; the same limited chart dates apply. Page-row totals reconcile to 31. No AI click or ranking metric was displayed.
- Ptichi apex separate Google generative-AI report: the interface displays zero impressions and no page data; its visible chart covers September 4–5 only. This is not a complete 28-day zero or absence from all AI surfaces.

Collection completeness remains unknown. Authenticated owner-UI access does not change the earlier service-account www Bonihua API 403. Keep both dated sources. These Google observations are also separate from the three neutral Codex + web-search answers, where each target was absent from its one corresponding response.

`reconciliation/native-measurements-owner-ui-20260908.json` preserves all 59 original native measurements and adds three UI records with source and excerpt hashes. See `reconciliation/native-owner-ui-reconciliation-20260908.md` for join validation. Ptichi apex observations must not be silently joined to an older `/en`-scoped graph. English's newly published unprefixed routing is a release change and a potential outcome confound, not permission to rewrite historical scopes.

## Published implementation evidence

The published [portfolio fleet guide](https://dkharlanau.github.io/agent-ready-web-profile/PORTFOLIO-FLEET.html) and [`arwp-portfolio-fleet` skill](https://dkharlanau.github.io/agent-ready-web-profile/skills/arwp-portfolio-fleet/SKILL.html) now provide one versioned workflow for many repositories. The private manifest is `portfolio-workspace.json`; the first receipts are `portfolio-fleet-inspection-2026-09-08.json` and `portfolio-fleet-live-2026-09-08.json`. The observed baseline was 25/25 valid public profiles; local inspection found one ready checkout and preserved 24 pre-existing dirty checkouts without running configured checks. PR 82 merged as `9f51042813347526c5fafc8b0db276d326780ac3`; Pages built that exact commit and the public guide, skill and 13-item catalogue were verified. See `reconciliation/portfolio-fleet-release-verification.json`. These observations do not establish indexing, ranking, AI citation or business impact.

The published [Cite Goose library](https://dkharlanau.github.io/agent-ready-web-profile/discoverability.html) now serves **corpus 1.2.0: 169 patterns, 91 sources and 16 categories**. Evidence classes are 49 documented, 108 inferred and 12 experimental. There are 53 actual agent-assisted source reviews with public section locators and support notes; the other 116 records explicitly retain unknown individual review dates. Review, evidence class, deployment and measured outcome are different states. All original 144 IDs and native mappings remain; native hypotheses and recommendation rules remain authoritative.

[PR 81](https://github.com/dkharlanau/agent-ready-web-profile/pull/81) merged at **2026-09-08 09:49:58 UTC**, as `1ddbc684c52f984f9e2e84eb9495b2c953cbc088`. Pages built that exact merge at 09:50:39 UTC. All 20 main check runs / 18 workflows succeeded, and 25/25 anonymous endpoints matched the merged bytes at 09:54 UTC, including all 169 patterns, 91 sources, passports, corpus fingerprint and immutable legacy release. [Current release receipt](/Users/dzmitryikharlanau/Documents/ChatGPT/SEO/output/arwp/reconciliation/cite-goose-release-verification.json).

The redesigned [homepage](https://dkharlanau.github.io/agent-ready-web-profile/) and library use the Cite Goose illustration, self-hosted licensed typography, source filters and readable practice passports. Actual public browser checks covered navigation, comparison/documented filtering, deep links, 390px mobile and desktop layouts without overflow or console errors. [Public browser evidence](/Users/dzmitryikharlanau/Documents/ChatGPT/SEO/output/arwp/design/cite-goose/public-browser-qa.json). Existing URLs and the `agent-ready-web-profile` package / `arwp` CLI remain compatible; package version 0.2.0 is unchanged and no npm registry release is claimed.

For a new bounded intervention, select applicable patterns and copy the selection JSON. It pins `corpus_version`, the corpus fingerprint and the selected `tactic_versions`; `arwp adoption-plan` rejects stale or incomplete supplied pins before writing. Old unpinned configurations remain supported. A real public clipboard payload was accepted unchanged by the final installed CLI, producing a `planned` plan with an `unmeasured` outcome. Direct browser file-download arrival remains unverified. [Public browser-to-CLI receipt](/Users/dzmitryikharlanau/Documents/ChatGPT/SEO/output/arwp/reconciliation/cite-goose-public-browser-export-cli.json), [clean package verification](/Users/dzmitryikharlanau/Documents/ChatGPT/SEO/output/arwp/reconciliation/builds/cite-goose-package-install.json), [versioning contract](https://github.com/dkharlanau/agent-ready-web-profile/blob/main/docs/DISCOVERABILITY-VERSIONING.md).

Historical corpus 1.1.0 contained 144 patterns / 60 sources and evidence classes 28 documented / 105 inferred / 11 experimental. Its exact bytes remain in [the immutable release](https://dkharlanau.github.io/agent-ready-web-profile/knowledge/releases/v1.1.0.json), with the earlier [PR 79 publication receipt](/Users/dzmitryikharlanau/Documents/ChatGPT/SEO/output/arwp/reconciliation/product-live-verification.json). The published importer correction has its own [PR 80 receipt](/Users/dzmitryikharlanau/Documents/ChatGPT/SEO/output/arwp/reconciliation/gsc-report-scope-release.json) (merge `28e3e93`, Pages/docs verified). Site-level release receipts are `reconciliation/release-verification.json` (static sites), `reconciliation/bonihua-release-verification.json` and `reconciliation/ptichi-release-verification.json`. `portfolio-adoption-results.json` and earlier local validation artifacts describe earlier stages and must not supersede later provider and HTTP receipts.

The adopting portfolio wave is complete: 22 static sites including CV, plus Bonihua and Ptichi, have separate commit/provider/live verification. CV reviewed merge `7a78bd5` is served by Pages at its timestamp-only descendant `839e0f7`; Bonihua is production `12628a7`, Ptichi is production `cd727f2`. The fresh complete snapshot is [2026-09-08T090443.340616Z](/Users/dzmitryikharlanau/Documents/ChatGPT/SEO/output/arwp/2026-09-08T090443.340616Z/snapshot.json): GSC acquired 09:04:56 UTC and HTTP 09:04:58 UTC, with no reused API/HTTP source snapshot. It covers 28 GSC scopes and 124 unique endpoints. Core plus 24 sites have 25/25 parseable profiles versus 7/25 previously, and 25 separate canonical-home checks found the expected discovery link. See [final reconciliation](/Users/dzmitryikharlanau/Documents/ChatGPT/SEO/output/arwp/reconciliation/portfolio-final-benchmark-verification.md). Same-window GSC outcomes did not change; both windows predate these releases. No new AI panel was run.

The 09:04 snapshot predates the Cite Goose release and does not verify its design or any growth effect. The two saved Bonihua/Ptichi plans also remain historical corpus 1.1.0 plans; do not rewrite their versions or hashes. Review the currently applicable revisions when starting a real change. **No new post-release outcome window or AI panel exists yet.** The next useful work remains one bounded existing-owner experiment: first Bonihua payment-reference, then Ptichi Explain Clearly when justified. See [additional research](/Users/dzmitryikharlanau/Documents/ChatGPT/SEO/output/arwp/research/2026-09-08-additional-patterns.md) and [the Russian operating handoff](/Users/dzmitryikharlanau/Documents/ChatGPT/SEO/output/arwp/FLAGSHIP-LOOP-2026-09-08.md).

The original dirty worktrees remain preserved. Publication used fresh isolated worktrees under `/Users/dzmitryikharlanau/Developments/arwp-adoption-20260908/`. Verify current origin and deployed commit before any follow-up change. Do not revive the obsolete preserved draft as the main product.

## AI observations

Use the saved identical prompt on a named surface in a clean session. Save the actual output to a new evidence artifact, hash it, and record the observation fields listed in the prompt suite. A search tool run is evidence for that search tool, not a substitute for a ChatGPT, Google AI Mode, or Bing Copilot response. Keep surface, model if exposed, search mode, locale, country, timestamp, and evaluator with every observation.

Record `target_recommended=false` only after inspecting the saved actual response; an absent observation remains unknown. A link citation and a positive recommendation are separate outcomes. For outcome summaries, collect at least three independent runs per surface and prompt, retain all responses, and preserve exact prompts over the comparison period. The runner verifies local artifact existence, SHA256, frozen prompt identity, exact source scope, timestamps, required context, and citation URLs appearing in the saved response. It labels evaluator assertions as not independently certified. Imported observations merge with previously recorded observations; IDs cannot be reused for changed evidence or evaluation. A null verdict is pending evaluation, not a negative outcome.

The import manifest has exactly this envelope: `{"schema_version": 1, "observations": [...]}`. Each row must have exactly the fields in the current runner's `prompt_suite(targets)["observation_fields"]` (older baseline prompt manifests precede the ingestion extension):

```json
{
  "observation_id": "unique-actual-run-id",
  "prompt_id": "exact ID from the prompt suite",
  "prompt_sha256": "exact hash from the prompt suite",
  "observed_at": "ISO timestamp with timezone from the actual run",
  "surface": "Codex + web search",
  "source_scope": "assistant_search_response",
  "model": "actual exposed model or not_exposed",
  "search_mode": "actual observed search mode",
  "locale": "actual locale or not_exposed",
  "country": "actual search country or not_exposed",
  "evaluator": "actual evaluator identity or role",
  "output_artifact": "relative/path/to/actual-response.md",
  "output_sha256": "SHA256 of actual saved bytes",
  "citation_urls": [],
  "target_recommended": null,
  "target_cited": null,
  "recommendation_position": null
}
```

The template is not evidence and must not be imported as an actual observation. The artifact path must remain within the manifest directory and be at most 10 MB. Citation URLs must be HTTPS, literally present in the saved response, and consistent with the target citation verdict for the exact target hostname/path. Surface `Codex + web search` requires `assistant_search_response`; `ChatGPT Search`, `Google AI Mode`, and `Bing Copilot` require `native_ai_surface`. A Codex browsing answer must never be labeled as an observation of those native surfaces. `--reuse-snapshot` imports new AI observations without repeating live GSC/HTTP requests; original source retrieval timestamps and the reused snapshot ID stay explicit.

## Exposure and attribution

An optional exposure manifest is a JSON array of events with `target_id` from `snapshot.json`, a submitter assertion `status: "verified_live"`, `deployed_at` as a nonfuture ISO timestamp with timezone, and `evidence_url` using HTTPS within that exact target hostname/path. Include deployed commit and verification details when available. Only provide dates supported by release evidence, never local edit timestamps or a guessed historic date. The runner normalizes all accepted events to `supplied_evidence_pending_verification`, retains `claimed_deployed_at`, and leaves verified `deployed_at` null: URL syntax and a submitted date cannot independently prove deployment. Use independently verified exposure dates with comparable post-release windows and an unchanged holdout before making causal claims.

## Recurring operation

The active **Cite Goose discovery and search benchmarks** heartbeat runs Monday–Friday at 09:15 Europe/Minsk; its [configuration](/Users/dzmitryikharlanau/.codex/automations/arwp-discovery-and-search-benchmarks/automation.toml) refers to this README, the operating handoff and current receipts. Run the same absolute benchmark command and read `report.md`, `comparison.json`, and source availability. Notify only on a meaningful new failure, change in evidence, measured outcome, or required owner action; stay quiet on unchanged repeated observations. Keep unavailable access explicit. The benchmark command itself does not submit sitemaps, change permissions, commit, push, deploy, publish, or purchase anything. Any separately authorized implementation follows the site's own release gates. A partial source failure is preserved in a completed snapshot, so process exit success is not a claim that all properties were accessible.

The first live baseline is `2026-09-08T072428.400899Z`: 28 scopes, 124 unique public endpoints, Google final windows August 9–September 5 versus July 12–August 8. It includes actual first reported Ptichi activity in this window (2 clicks, 4 impressions) and inaccessible www Bonihua GSC evidence. The 16 project URL prefixes returned explicit aggregate zeros; the benchmark does not infer why.
