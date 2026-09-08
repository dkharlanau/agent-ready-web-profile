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
arwp-visibility import google-generative-ai.csv \
  --provider=google \
  --report-scope=generative-ai \
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

Adapters normalize only supported aggregate metrics that are actually present. Unknown fields stay in the original owner export; ARWP does not invent missing numbers. An unrecognized export remains `partial` rather than being converted into zero evidence. The explicit `start`/`end` period is the comparison window; experiment notes should record material confounders that the export itself does not capture.

For Google, generic `Impressions` columns are ambiguous and rejected unless the owner supplies `--report-scope=generative-ai` (`reportScope: 'generative-ai'` in the JavaScript API). Use this only for an export from the dedicated generative AI report. The option records the owner's report context; it does not verify provenance. Keep the original export and its property, report, filters and effective dates as evidence. Ordinary Web Search exports cannot be imported as AI visibility. Explicit `AI Impressions`, `Generative AI Impressions` and `Generative Search Impressions` columns remain supported without the option. Unsupported explicit report scopes are rejected.

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

Positive, negative, mixed and unchanged results all remain in the evidence set. A negative result does not disappear, and a positive result is not automatically called causal. The report also counts human review decisions and distinct sites so evidence breadth remains inspectable instead of being collapsed into one score.

## 4. Keep maturity changes explicit

Neither `arwp-trends review` nor `arwp-trends measure` rewrites `registry/trends.json`. A maintainer must review the actual source/evidence and make a normal repository change if the lifecycle stage should move. That makes Trend history/diff capture the transition and prevents generated evidence from becoming an unreviewed policy change.

## 5. Managed review issue

The reusable `templates/growth/github-action-issue.yml` can run the learning loop as one bounded weekly review surface for a target website.

It now combines four distinct queues rather than mixing them into a score:

1. current P0/P1 implementation debt from the Growth Profile;
2. persistent Growth Experiments awaiting implementation, measurement or human review;
3. primary-source `WATCH -> ADOPT` Trend proposals;
4. evidence-backed `ADOPT -> MEASURED` review proposals.

The workflow saves the Growth plan, immutable Growth snapshot, implementation diff, experiment ledger status, Trend source-watch report, Trend promotion proposals and Trend measurement report as machine-readable workflow artifacts.

Trend source-watch failures remain explicit unavailable evidence; they are never converted into “no changes.” The workflow does not mutate Trend maturity, experiment records, editorial content, robots policy or owner-platform settings.

### Material-change suppression

The managed issue includes a SHA-256 material fingerprint derived from the current Growth actions, experiment attention/invalid states and both Trend review queues. Observation timestamps and snapshot IDs are intentionally excluded.

If the next scheduled run has the same material fingerprint, the workflow uploads fresh machine-readable evidence but leaves the GitHub issue untouched. This avoids weekly notification/edit noise while keeping the previous issue snapshot as the comparison baseline for the next real change.

A changed primary-source candidate, Growth action, experiment state, invalid evidence record or measurement proposal changes the fingerprint and updates the issue. The fingerprint is a change detector only; it is not a trust, readiness or ranking score.

## Boundaries

- Source-watch candidates are not recommendations.
- Human approval never silently rewrites trend maturity.
- `MEASURED` is an evidence-availability state, not an effectiveness score.
- Repository adoption counts are not outcome evidence.
- Owner data stays aggregate in the normalized snapshot.
- The original export remains the source of truth for dimensions ARWP does not normalize.
- Time sequence alone never establishes that ARWP caused a Search, citation, recommendation, traffic or conversion change.
