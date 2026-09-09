---
name: arwp-measurement-os
description: Build or review Search/AI measurement for a website without collapsing incompatible provider data into a synthetic visibility score. Use when asked how to track Google generative Search, Bing AI citations, ChatGPT/AI referrals, AI crawler access, page cohorts or the outcome of an ARWP/GEO/SEO experiment. Establish the Site Readiness Gate, normalize owner evidence, merge compatible provider snapshots, produce the access-to-task observation funnel, and preserve missing/negative evidence.
license: Apache-2.0
compatibility: Requires owner exports or equivalent measurement evidence for provider-specific observations. Node.js is recommended for the arwp-visibility CLI.
metadata:
  standard: agent-skills
  arwp-role: measurement-orchestrator
---

# ARWP Measurement OS

Use this skill when the question is not merely “did traffic go up?” but “which Search/AI stage changed, what evidence proves that observation, and what should we inspect next?”

## Operating model

`site gate → baseline → provider-native evidence → merge → access → exposure → citation → visit → task → cohort review → decision`

The sequence is an observability model. It is not automatically one mathematical funnel because providers expose different populations and denominators.

## Workflow

1. **Establish readiness before interpreting outcomes.** Read `registry/site-readiness-checklist.json` and use `templates/growth/growth-loop-checklist.md`. Resolve relevant P0 failures before treating outcome movement as an experiment result. A P0 failure does not block repair work; it blocks interpretation.

2. **Define the unit of analysis.** Record the site, exact observation period, priority page cohort, hypothesis/change, change timestamp and real downstream task. For data/knowledge sites, start with a bounded reviewed cohort before scaling generated pages.

3. **Collect provider-native evidence.** Prefer owner exports and first-party logs. Keep dimensions privately when useful for page/query/cohort analysis.

```bash
arwp-visibility import google.csv --provider=google --report-scope=generative-ai --site=https://example.com/ --start=YYYY-MM-DD --end=YYYY-MM-DD --output=google.json
arwp-visibility import bing.csv --provider=bing --site=https://example.com/ --start=YYYY-MM-DD --end=YYYY-MM-DD --output=bing.json
arwp-visibility import cloudflare.csv --provider=cloudflare --site=https://example.com/ --start=YYYY-MM-DD --end=YYYY-MM-DD --output=cloudflare.json
arwp-visibility import analytics.csv --provider=referrals --site=https://example.com/ --start=YYYY-MM-DD --end=YYYY-MM-DD --output=referrals.json
```

Ordinary Google Web Search impressions are not generative AI impressions. Missing provider data stays partial/unavailable rather than becoming zero.

4. **Merge only compatible snapshots.** Exact site and observation period must match; duplicate providers are rejected.

```bash
arwp-visibility merge google.json bing.json cloudflare.json referrals.json --output=visibility.merged.json
```

5. **Inspect the stage-separated view.** Run:

```bash
arwp-visibility funnel visibility.merged.json
```

Interpret stages separately:
- access — crawler requests/policy/response success;
- exposure — provider-native generative visibility;
- citation — cited pages/citations/grounding-query observations;
- visit — identifiable AI referrals;
- task — first-party useful completion/conversion.

6. **Use only provider-local derived metrics.** Review `registry/measurement-patterns.json`. Ratios are acceptable when numerator and denominator share provider, scope and period, or an explicit join key. Never compute Bing-citations/Google-impressions or referrals/crawler-requests and call it conversion. Never manufacture one weighted AI visibility score.

7. **Review cohorts.** For large data sites, measure deep-page contribution separately for exposure, citations, referrals and task outcomes. Compare a bounded treatment cohort with comparable unchanged pages where practical, plus a dated baseline. Review crawl/index growth against useful discovery rather than URL count.

8. **Compare longitudinally.** Use non-overlapping before/after windows:

```bash
arwp-visibility compare before.visibility.json after.visibility.json
```

Record seasonality, launches, outages and unrelated material changes. A delta is an observation, not proof that one ARWP change caused it.

9. **Decide.** Route the evidence into the Growth experiment lifecycle and mark `keep`, `revise`, `revert`, `retire` or `continue-measuring`. Preserve neutral and negative results.

## Core rules

- no ranking/citation/traffic guarantee;
- no cross-provider pseudo-conversion rate;
- no single AI visibility score as system of record;
- missing is not zero;
- implementation evidence stays separate from outcome evidence;
- raw page count is not a data-site success metric;
- provider/query/page evidence is kept with provenance so the observation can be replayed.

See `docs/MEASUREMENT-OS.md` for metric definitions, safe ratios, data-site cohort design and current provider source references.
