# Goose Controlled Cohorts

Controlled Cohorts are the bridge between a plausible Search/AI recommendation and evidence from an owned site.

The contract freezes three things **before post-change outcomes are reviewed**:

1. treatment pages/entities;
2. comparable unchanged controls;
3. a stable query/prompt panel.

It also refuses to start the observation clock until a production receipt proves that the frozen implementation is actually live.

## Why this exists

A common failure mode in website experiments is to compare “before” with “after” while changing the cohort, query set or deployment state along the way. That makes a positive screenshot easy to obtain and hard to interpret.

Goose instead keeps the cohort explicit and versioned. Small or negative experiments remain useful evidence.

## Contract

`schema/controlled-cohort.schema.json` records:

- exact site and repository;
- frozen repository implementation ref;
- source experiment/evidence artifact;
- treatment and control members;
- fixed query panel and target entities;
- baseline owner/public/deployment evidence;
- production measurement gate;
- declared observation windows and outcomes;
- decision rules and anti-causality guardrails.

A site-specific cohort is allowed to be smaller than a generic playbook target when the real published universe, safety boundary or expansion policy makes a larger cohort artificial.

## CLI

```bash
node bin/arwp-cohort.mjs validate cohort.json
node bin/arwp-cohort.mjs summarize cohort.json
node bin/arwp-cohort.mjs gate cohort.json \
  --production-ref=<exact-live-commit-sha>
```

`gate` returns exit code `0` only when the independently observed production ref exactly matches the frozen implementation ref. A mismatch returns `2` and the observation clock stays stopped.

This deliberately separates:

```text
repository implementation
        !=
verified live deployment
        !=
Search exposure
        !=
ranking/citation
        !=
acquisition/product outcome
```

## Cohort integrity rules

Validation rejects:

- the same entity/source in treatment and control;
- duplicate member or query IDs;
- query targets outside the frozen cohort;
- non-increasing observation windows;
- `ready-to-observe` or `observing` state while the production gate is HOLD;
- a ready production gate whose production SHA does not match the implementation SHA.

Changing query text or treatment/control membership after outcomes are visible should create a new cohort/version rather than rewriting the old freeze.

A later verified deployment must also not be retrofitted into an older frozen implementation when treatment content changed before publication. Preserve the old freeze and create a new revision that:

- keeps the already-frozen assignment/query panel unchanged;
- binds to the exact implementation that was actually verified live;
- records why the earlier freeze never entered observation;
- is created before post-deployment outcomes are used to alter the design.

## First dogfood: Ptichi PTI-DA-001

The original artifact, `knowledge/experiments/2026-09-09-ptichi-cohort-freeze.json`, imported the existing owner-reviewed Ptichi Data Authority experiment rather than inventing a parallel design.

The authoritative site-specific design contains:

- 12 existing treatment entities;
- 6 comparable unchanged controls;
- 12 fixed English Search queries;
- no new indexable URLs;
- 14/28/56-day review windows.

The generic earlier Goose plan suggested 20–50 treatment pages. Ptichi overrides that because its binding expansion gate and current published universe make 20–50 artificial. The smaller real cohort is preferable to manufacturing extra pages for statistical appearance.

### Historical freeze — 2026-09-09

At the first freeze, Ptichi source `main` contained the treatment implementation, but the preserved production receipt pointed to an older commit. The artifact therefore remains immutable `measurement-hold` evidence. Its exact frozen implementation was not later rewritten merely to match a newer deployment.

### Current revision — r2

`knowledge/experiments/2026-09-15-ptichi-cohort-refreeze-r2.json` is the current observation-bearing revision.

Before the first later exact-SHA production publication, several treatment pages changed. The English control membership and the fixed 12-query panel did not change. Ptichi's reviewed operating evidence records `13b49e9a5faa9256b5bbded049caf33327abc240` as the exact source revision verified live on 2026-09-13, while later source commits are explicitly not treated as deployed.

R2 therefore:

- preserves the same 12 treatment / 6 control assignment;
- preserves the same 12 query texts and target entities;
- binds both `implementationRef` and `productionRef` to `13b49e9a...`;
- carries the authenticated pre-publication Google Search Console baseline captured on 2026-09-12 with final data through 2026-09-09;
- is `ready-to-observe`, not a measured win.

`ready-to-observe` proves only that the production gate is satisfied for the refrozen implementation. It does not prove indexing, ranking, citation, traffic, conversion or treatment causality. Post-deployment owner evidence must still mature and be reviewed against treatment, controls, confounders and missing evidence.

## Put an observation window to work — without changing the experiment

The next operational job is not another SEO checklist. It is to obtain comparable, **actual owner evidence** for the already-frozen treatment and control pages. Goose now supports two read-only helpers in the existing `arwp-cohort` CLI:

- `plan` calculates when each frozen observation window can be reviewed and whether the owner has confirmed that reporting data is final.
- `check-gsc` inspects a **local** Google Web Search CSV against an owner-confirmed mapping from canonical public URLs to the frozen member IDs. It does not import the raw data into the public repository or create a positive-outcome record.

### 1. Reconfirm production and plan the windows

Use the current R2 cohort, not the historical held freeze. The independently reviewed production record names 13 September 2026 and ref `13b49e9a5faa9256b5bbded049caf33327abc240`. The CLI cannot verify either statement by itself; the owner must reconcile them with the deployment receipt.

```bash
node bin/arwp-cohort.mjs plan \
  knowledge/experiments/2026-09-15-ptichi-cohort-refreeze-r2.json \
  --production-ref=13b49e9a5faa9256b5bbded049caf33327abc240 \
  --deployment-date=2026-09-13 \
  --as-of=2026-10-10
```

The deployment day is excluded because it may be partial. The fixed windows are therefore **T14: 14–27 September**, **T28: 14 September–11 October**, and **T56: 14 September–8 November 2026** (inclusive). As of 10 October, T28 has not ended. The T14 calendar has ended, but its actual data finality and quality still need owner confirmation. Add `--final-through=YYYY-MM-DD` **only** when that final-data date is verified in the provider report. The helper never converts an elapsed day into a measured success.

The `plan` command refuses to promote a historical HOLD merely because someone supplies a matching ref. Calendar windows remain blocked until both the *existing frozen gate* and the supplied independently observed production ref agree.

### 2. Map the real published pages, not source filenames

```bash
node bin/arwp-cohort.mjs page-map \
  knowledge/experiments/2026-09-15-ptichi-cohort-refreeze-r2.json \
  --output=/path/outside/repository/private-ptichi-page-map.json
```

Fill the 18 `url: null` entries with the exact published **canonical** HTTPS URLs. Each ID, entity, and treatment/control assignment must remain unchanged. Goose does not guess a public route from `content/goals/*.md`, strip tracking parameters, merge aliases, silently relocate a member, or fill missing entries for you. Duplicate URLs, unknown members and cross-site mappings fail validation.

### 3. Inspect an actual joint Web Search export locally

In the property owner's Google Search Console account, select **Search results → Web** for the exact intended dates. Export **date + canonical page + query + clicks + impressions together** using the supported Search Analytics API dimensions or an equivalent genuinely joint export. A separate Pages CSV joined to a separate Queries CSV is *not* the same dataset and must not be used. Retain the unmodified export, filters, aggregation basis (`byPage` for page grouping) and report-finality proof privately.

Example for an **actually finalized** T14 export (replace all paths and the final-data date with real owner observations):

```bash
node bin/arwp-cohort.mjs check-gsc \
  knowledge/experiments/2026-09-15-ptichi-cohort-refreeze-r2.json \
  --production-ref=13b49e9a5faa9256b5bbded049caf33327abc240 \
  --deployment-date=2026-09-13 \
  --as-of=2026-10-10 \
  --final-through=YYYY-MM-DD \
  --window-days=14 --report-scope=web \
  --export-start=2026-09-14 --export-end=2026-09-27 \
  --page-map=/path/outside/repository/private-ptichi-page-map.json \
  --export=/path/outside/repository/private-gsc-web.csv \
  --output=/path/outside/repository/private-t14-review.json
```

The parser checks required dimensions, date range, duplicate rows, exact page mappings and nonnegative counts. It reports separately: treatment vs controls, members actually observed in returned rows, frozen-query-panel appearances in those rows, outside-cohort rows and missing members. **Missing rows are unknown, not zero.** The output contains summary counts and frozen member/query IDs, **not raw URLs or query strings**.

Even a final full-window CSV is subject to Search Console row limits and anonymized-query omissions. Report scope and finality are owner declarations because CSV bytes alone cannot authenticate the provider. This helper intentionally does **not** support relabeling ordinary Web Search as a Google generative-AI report, derive a cross-provider conversion score, or declare that an edit caused more traffic. <https://developers.google.com/webmaster-tools/v1/searchanalytics/query> documents the row limits and page/query dimensions; <https://support.google.com/webmasters/answer/17011364> explains page vs property aggregation and preliminary data.

### 4. Make the *review* a separate decision

Only after comparing a real baseline, treatment and control observations, full windows, independent production evidence, contamination, query-to-page fit and useful-task outcomes should the existing Growth Experiment / Recommendation Review mechanism record `keep`, `revise`, `continue-measuring`, `revert` or `retire`. An observed increase is not automatically causal. Preserve neutral, negative and withheld evidence; do not commit private Google exports or site-owner data into this public repository.

## Relationship to Winner Observatory

The fixed query panel can later seed Winner Observatory snapshots:

```text
Controlled Cohort freeze
        ↓
verified production gate
        ↓
Winner snapshot at T0 / T14 / T28 / T56
        ↓
result + citation persistence
        ↓
owner Search/AI evidence
        ↓
treatment vs control review
        ↓
Recommendation Review event
```

Winner Observatory and owner metrics are complementary. Public result observation does not replace Search Console/Bing owner evidence, and owner visibility does not prove a hidden ranking factor.

## Scale-up rule

Do not expand a cohort merely because the site can generate many pages. Expand only after a review establishes that:

- the existing pages are genuinely useful;
- the observed queries fit their jobs;
- control behavior has been considered;
- crawl/index/release truth remains healthy;
- neutral and negative outcomes remain in the record.

A `GO` decision permits the next bounded experiment; it is not a general ranking claim.
