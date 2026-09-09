# ARWP Measurement OS

Search and AI discovery now exposes several different observable surfaces. ARWP should not collapse them into a single “AI visibility” number because the populations, providers and denominators are different.

The operating model is:

```text
ACCESS → EXPOSURE → CITATION → VISIT → TASK
```

This is an **observability sequence**, not automatically a mathematical conversion funnel.

## Provider-native evidence map

| Stage | Primary evidence | What it can establish | What it cannot establish |
| --- | --- | --- | --- |
| Access | Cloudflare AI Crawl Control or equivalent edge/server logs | AI crawler requests, allow/block state, response success, paths/content formats, bytes | Indexing, citation, ranking |
| Exposure | Google Search Console Generative AI performance | Generative AI impressions and available page/country/device dimensions | Bing citations, attributable visits, causal impact |
| Citation | Bing Webmaster Tools AI Performance | Citations, cited pages, grounding-query samples and related Bing observations | Google exposure or downstream conversion |
| Visit | First-party analytics/referrer/UTM evidence; edge referral observations | Identifiable AI-origin visits/sessions/referrals | Total unobservable AI influence |
| Task | First-party product analytics | Completed product/site task for a measurable referral cohort | Cause of the upstream exposure/citation event unless explicitly joinable |

The goal is to preserve the evidence chain while keeping each provider's population honest.

## CLI workflow

Normalize each available owner export using the same observation window:

```bash
arwp-visibility import google.csv --provider=google \
  --report-scope=generative-ai \
  --site=https://example.com/ --start=2026-08-01 --end=2026-08-31 \
  --output=google.visibility.json

arwp-visibility import bing.csv --provider=bing \
  --site=https://example.com/ --start=2026-08-01 --end=2026-08-31 \
  --output=bing.visibility.json

arwp-visibility import cloudflare.csv --provider=cloudflare \
  --site=https://example.com/ --start=2026-08-01 --end=2026-08-31 \
  --output=cloudflare.visibility.json

arwp-visibility import analytics.csv --provider=referrals \
  --site=https://example.com/ --start=2026-08-01 --end=2026-08-31 \
  --match=chatgpt.com,perplexity.ai \
  --output=referrals.visibility.json
```

Then combine provider evidence **without combining provider denominators**:

```bash
arwp-visibility merge \
  google.visibility.json bing.visibility.json \
  cloudflare.visibility.json referrals.visibility.json \
  --output=visibility.merged.json

arwp-visibility funnel visibility.merged.json
```

`merge` requires the same site and exact observation period. It rejects a duplicate provider instead of silently double-counting it.

## Safe derived metrics

Derived values are allowed when numerator and denominator belong to one compatible provider population/window:

- **Crawler allow rate** = Cloudflare allowed AI crawler requests / Cloudflare AI crawler requests.
- **Crawler success rate** = Cloudflare successful AI crawler responses / Cloudflare AI crawler requests.
- **Generative impressions per visible page** = Google generative AI impressions / pages observed in that same report/window.
- **Citation density** = Bing total citations / Bing cited pages in that same observation window.
- **AI referral engagement rate** = engaged matched AI referrals / matched AI referrals in the same analytics view.
- **Task completions per AI referral** = measured task completions / matched AI referrals in the same first-party analytics scope.

The last metric is a per-referral density unless the site's task definition guarantees at most one completion per visit.

## Ratios ARWP must not calculate

Do not create these:

```text
Bing citations / Google generative impressions
AI referrals / Cloudflare crawler requests
Google AI impressions / Bing grounding queries
one weighted sum of crawler traffic + citations + referrals + conversions
```

Those numbers look precise but mix different populations. They are useful only if a future provider or first-party event model exposes a real join key linking the same event/user/page population end to end.

## Cohort measurement for data sites

Large data/knowledge sites need more than site-wide totals. Use a bounded page cohort before scaling.

Recommended experiment shape:

```text
priority treatment cohort (for example 20–50 reviewed entity pages)
                vs
comparable unchanged cohort where practical
                +
dated site-wide baseline
```

Track each surface separately:

1. Are priority pages technically eligible and reachable?
2. Are they appearing in provider-native exposure data?
3. Are specific deep pages being cited?
4. Are deep pages receiving identifiable AI/search visits?
5. Do those visits complete the site's actual task?
6. Is crawl/index volume growing faster than useful discovery?

A **Deep Page Contribution** view can report the share/count of deep entity pages in Google generative exposure, Bing citations, AI referrals and task outcomes. Keep these as separate surface-specific metrics; do not blend them into one authority score.

## Freshness lag

For pages where freshness matters, preserve:

```text
meaningful source/content change timestamp
→ deploy timestamp
→ first observed crawler fetch (when available)
→ first later Search/AI visibility observation (when available)
```

Compare the lag by cohort. This measures an operational property without incentivizing fake date changes. Sitemap `lastmod` should continue to represent significant content changes.

## Measurement data quality contract

Before interpreting movement:

- preserve the provider/export name and observation period;
- retain raw provider exports privately when they contain query/page dimensions;
- distinguish `0` from missing/unavailable/partial;
- keep treatment and comparison cohorts stable during an observation window;
- note major launches, migrations, outages, seasonality and unrelated content changes;
- use non-overlapping before/after windows for longitudinal comparison;
- record the implementation commit/change receipt separately from outcome evidence;
- preserve negative and unchanged observations;
- never promote a hypothesis automatically because a metric moved positively.

## Why this is better than a visibility score

A score can hide the most important diagnostic fact. For example:

- crawler access may be healthy while exposure is absent;
- exposure may grow while citations remain concentrated on a few pages;
- citations may grow while referrals stay flat;
- referrals may grow while task completion is poor.

The stage-separated view keeps those states visible. It helps decide **what to inspect next** rather than producing a number whose meaning changes when providers or weights change.

## Site readiness gate

Before treating outcome evidence as an experiment result, use:

- `templates/growth/growth-loop-checklist.md` — human review artifact;
- `registry/site-readiness-checklist.json` — machine-readable non-composite gate;
- `registry/measurement-patterns.json` — provider-native measurement patterns and guardrails.

P0 blockers prevent outcome interpretation; they do not prevent the site from implementing repairs and collecting a new baseline.

## Current primary sources

- Google Search Central: `https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports`
- Bing Webmaster Blog: `https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview`
- OpenAI Publishers and Developers FAQ: `https://help.openai.com/en/articles/12627856`
- Cloudflare AI Crawl Control: `https://developers.cloudflare.com/ai-crawl-control/`
- Google Search documentation updates: `https://developers.google.com/search/updates`

Provider reports and fields can change. Keep the source version/date in ARWP's upstream evidence layer and review adapters when a report contract changes.
