# ARWP Growth Learning

ARWP separates implementation evidence from outcome evidence and keeps Search/AI trend maturity reviewable.

The operational loop is:

```text
primary-source change
  -> Trend source watch
  -> WATCH -> ADOPT review proposal
  -> site Growth action + Growth Experiment
  -> owner export (Google / Bing / referral analytics)
  -> visibility snapshot
  -> reviewed experiment
  -> ADOPT -> MEASURED evidence proposal
  -> explicit registry review
```

None of these transitions is a ranking guarantee. `MEASURED` means real longitudinal evidence exists; it does not mean the effect was positive or caused by ARWP.

## 1. Import owner-side visibility evidence

ARWP accepts owner-provided CSV or JSON exports before requiring any OAuth/API integration.

```bash
arwp-visibility import google.csv \
  --provider=google \
  --site=https://example.com/ \
  --start=2026-08-01 \
  --end=2026-08-31 \
  --output=google.visibility.json

arwp-visibility import bing.csv \
  --provider=bing \
  --site=https://example.com/ \
  --start=2026-08-01 \
  --end=2026-08-31 \
  --output=bing.visibility.json

arwp-visibility import analytics.csv \
  --provider=referrals \
  --site=https://example.com/ \
  --start=2026-08-01 \
  --end=2026-08-31 \
  --match=chatgpt.com,perplexity.ai \
  --output=ai-referrals.visibility.json
```

Adapters normalize only supported aggregate metrics that are actually present. Unknown fields stay in the original owner export; ARWP does not invent missing numbers. An unrecognized export remains `partial` rather than being converted into zero evidence.

## 2. Review primary-source Trend changes

Run the scheduled/source watcher or its local runner and save the report:

```bash
node scripts/trend-source-watch.mjs --output=trend-watch.json
```

Create review proposals:

```bash
arwp-trends propose trend-watch.json --output=trend-promotions.json
```

A proposal is generated only for a source explicitly mapped to a current `WATCH` trend. It records candidate evidence and affected Growth action/measurement references.

Review it:

```bash
arwp-trends review trend-promotions.json \
  --id=promote:webmcp-origin-trial-evals:2026-09-06 \
  --decision=approve \
  --reviewer=maintainer \
  --output=trend-promotions.reviewed.json
```

Approval records review. It deliberately does **not** mutate `registry/trends.json`; a stage change remains a normal explicit reviewed repository change.

## 3. Decide whether an ADOPT trend has real measurement evidence

Store reviewed Growth Experiment records in a file or directory, then aggregate them:

```bash
arwp-trends measure experiments/ --output=trend-measurement.json
```

ARWP links experiments to trends through the trend's Growth `actionRefs`. An `ADOPT -> MEASURED` proposal is emitted only when at least one linked experiment:

- is evaluated and reviewed;
- contains both before and after owner-side visibility evidence;
- has at least one comparable owner metric.

Positive, negative, mixed and unchanged results all remain in the evidence set. A negative result does not disappear, and a positive result is not automatically called causal.

## Boundaries

- Source-watch candidates are not recommendations.
- Human approval never silently rewrites trend maturity.
- `MEASURED` is an evidence-availability state, not an effectiveness score.
- Repository adoption counts are not outcome evidence.
- Owner data stays aggregate in the normalized snapshot.
- The original export remains the source of truth for dimensions ARWP does not normalize.
