---
name: arwp-measurement-os
description: Build or review Search/AI measurement for a website without collapsing incompatible provider data into a synthetic visibility score. Use when asked how to track Google generative Search, Bing AI citations, ChatGPT/AI referrals, AI crawler access, page cohorts or the outcome of an ARWP/GEO/SEO experiment. Establish site readiness, freeze treatment/control and query cohorts before outcome review, verify the production ref, normalize owner evidence, produce the access-to-task observation funnel, and preserve missing/negative evidence.
license: PolyForm-Strict-1.0.0
compatibility: Requires owner exports or equivalent measurement evidence for provider-specific observations. Node.js is recommended for the ARWP measurement CLIs.
metadata:
  standard: agent-skills
  arwp-role: measurement-orchestrator
---

# ARWP Measurement OS

Use this skill when the question is not merely “did traffic go up?” but “which Search/AI stage changed, what evidence proves that observation, and what should we inspect next?”

## Operating model

`site readiness → cohort freeze → production gate → baseline → provider-native evidence → access → exposure → citation → visit → task → repeated cohort review → decision`

The sequence is an observability model. It is not automatically one mathematical funnel because providers expose different populations and denominators.

## Workflow

1. **Establish readiness before interpreting outcomes.** Read `registry/site-readiness-checklist.json` and use `templates/growth/growth-loop-checklist.md`. Resolve relevant P0 failures before treating outcome movement as an experiment result. A P0 failure does not block repair work; it blocks interpretation.

2. **Freeze the unit of analysis before post-change outcomes are visible.** Record the site, exact treatment pages/entities, comparable unchanged controls, hypothesis/intervention, current implementation ref, observation windows and fixed query/prompt panel. For data/knowledge sites, prefer the real eligible page universe over an artificial page-count target.

When a controlled experiment is appropriate, use the Goose cohort contract:

```bash
node bin/arwp-cohort.mjs validate cohort.json
node bin/arwp-cohort.mjs summarize cohort.json
```

Do not silently change treatment/control membership or query text after seeing which pages or prompts performed well. A material cohort change creates a new freeze/version.

3. **Verify production before starting the observation clock.** Repository implementation is not a live deployment. Compare an independently observed production commit/ref with the frozen implementation ref:

```bash
node bin/arwp-cohort.mjs gate cohort.json \
  --production-ref=<exact-live-commit-sha>
```

A mismatch keeps the cohort on `measurement-hold`. Do not start T14/T28/T56 or attribute live outcomes to the treatment until the production gate is ready.

### Review the frozen observation window before exporting data

For a site with an existing Controlled Cohort, first use its read-only calendar and local Web Search check rather than inventing a new experiment:

```bash
node bin/arwp-cohort.mjs plan cohort.json \
  --production-ref=<independently-verified-full-SHA> \
  --deployment-date=YYYY-MM-DD --as-of=YYYY-MM-DD
node bin/arwp-cohort.mjs page-map cohort.json --output=/private/cohort-page-map.json
```

The owner fills exact canonical URLs for **every** frozen treatment/control member. `check-gsc` then accepts an actual **joint date/page/query** Google Web Search CSV (not separate page/query totals or an AI impressions export) for one entire frozen window. It rejects mismatched dates, duplicates, unreviewed page maps and HOLD cohorts, and keeps missing members unknown. Only call it with `--report-scope=web`, the full `--export-start`/`--export-end` window and an owner-verified `--final-through` date. See `docs/CONTROLLED-COHORTS.md` for the complete syntax and privacy limits.

If a dated owner URL Inspection snapshot is available, run `arwp-cohort check-index` after filling the canonical page map and **before** explaining absent search performance. The read-only inspection review distinguishes `indexed`, `discovered-not-indexed`, `unknown-to-google`, and `not-inspected` from the exact indexed-version snapshot. Keep the snapshot date, crawled-before-deployment flags and canonical differences; never label the URL Inspection API a live URL test or use it to establish traffic. For the supported private snapshot wrapper, see `docs/CONTROLLED-COHORTS.md`. Unknown or uninspected pages do not receive synthetic zeroes.

Do not put private query/page owner exports or private page-map files in a public repository. A calendar window that has elapsed is not automatically final provider data, and a descriptive GSC row comparison is not causal evidence.

4. **Collect provider-native evidence.** Prefer owner exports and first-party logs. Keep dimensions privately when useful for page/query/cohort analysis.

```bash
arwp-visibility import google.csv --provider=google --report-scope=generative-ai --site=https://example.com/ --start=YYYY-MM-DD --end=YYYY-MM-DD --output=google.json
arwp-visibility import bing.csv --provider=bing --site=https://example.com/ --start=YYYY-MM-DD --end=YYYY-MM-DD --output=bing.json
arwp-visibility import cloudflare.csv --provider=cloudflare --site=https://example.com/ --start=YYYY-MM-DD --end=YYYY-MM-DD --output=cloudflare.json
arwp-visibility import analytics.csv --provider=referrals --site=https://example.com/ --start=YYYY-MM-DD --end=YYYY-MM-DD --output=referrals.json
```

Ordinary Google Web Search impressions are not generative AI impressions. Missing provider data stays partial/unavailable rather than becoming zero.

5. **Merge only compatible snapshots.** Exact site and observation period must match; duplicate providers are rejected.

```bash
arwp-visibility merge google.json bing.json cloudflare.json referrals.json --output=visibility.merged.json
```

6. **Inspect the stage-separated view.** Run:

```bash
arwp-visibility funnel visibility.merged.json
```

Interpret stages separately:
- access — crawler requests/policy/response success;
- exposure — provider-native Search/generative visibility;
- citation — cited pages/citations/grounding-query observations;
- visit — identifiable AI referrals;
- task — first-party useful completion/conversion.

7. **Use only provider-local derived metrics.** Review `registry/measurement-patterns.json`. Ratios are acceptable when numerator and denominator share provider, scope and period, or an explicit join key. Never compute Bing-citations/Google-impressions or referrals/crawler-requests and call it conversion. Never manufacture one weighted AI visibility score.

8. **Review repeated fixed cohorts.** For ranked/AI surfaces, use the Winner Observatory when appropriate:

```bash
node bin/arwp-winners.mjs validate before.json
node bin/arwp-winners.mjs diff before.json after.json --output=winner-diff.json
```

Keep entrants/drops, top-10 persistence and citation persistence separate from owner-side impressions/clicks. For data sites, compare deep-page contribution across treatment and controls rather than reporting raw URL count.

9. **Compare longitudinal owner evidence.** Use non-overlapping before/after windows:

```bash
arwp-visibility compare before.visibility.json after.visibility.json
```

Record seasonality, launches, outages, deployments and unrelated material changes. A delta is an observation, not proof that one ARWP change caused it.

10. **Decide and feed learning back into Goose.** Route evidence into the Growth experiment lifecycle and mark `keep`, `revise`, `revert`, `retire` or `continue-measuring`. Preserve neutral and negative results. When evidence challenges a current recommendation, create a reviewed Recommendation Review event rather than silently rewriting the registry.

## Core rules

- no ranking/citation/traffic guarantee;
- no observation window before verified production parity;
- no treatment/control/query reshuffle after outcomes are visible without a new cohort version;
- no cross-provider pseudo-conversion rate;
- no single AI visibility score as system of record;
- missing is not zero;
- implementation evidence stays separate from deployment and outcome evidence;
- raw page count is not a data-site success metric;
- smaller real cohorts are preferable to synthetic pages created to satisfy a generic target;
- provider/query/page evidence is kept with provenance so the observation can be replayed;
- neutral and negative evidence remains eligible to challenge or retire weak recommendations.

See `docs/MEASUREMENT-OS.md`, `docs/CONTROLLED-COHORTS.md`, `docs/WINNER-OBSERVATORY.md` and `docs/RECOMMENDATION-REVIEW.md` for the current contracts.
