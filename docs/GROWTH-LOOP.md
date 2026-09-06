# ARWP Growth Loop

ARWP keeps the Resolver, optional publisher profile, scanner, protocol observatory, evidence receipts and agent interoperability work. The product focus is now broader and outcome-oriented:

> **Help a website continuously improve eligibility, discoverability, recommendation readiness, citability and agent usability as Search and AI surfaces change.**

The method is not “install a manifest and rank better.” It is a learning loop.

```text
PRIMARY-SOURCE RESEARCH
        ↓
    TREND RADAR
        ↓
EVIDENCE CLASSIFICATION
        ↓
 GROWTH HYPOTHESES
        ↓
SITE BASELINE + CHECKLIST
        ↓
 IMPLEMENT → VERIFY → MEASURE
        ↓
   EXPERIMENT REVIEW
        ↓
KEEP / REVISE / REVERT / RETIRE
        └───────────────↺
```

## Target surfaces

ARWP may create site-specific work for classic Search, Google generative Search, Discover and image/video surfaces, Bing AI/Microsoft surfaces, ChatGPT Search/referrals, and compatible agent retrieval/tooling. Provider-specific guidance remains provider-specific.

## Evidence layers

1. `registry/search-agent-recommendations.json` records dated upstream requirements and opportunities.
2. `registry/trends.json` records recent changes and WATCH/ADOPT/MEASURED status.
3. `registry/growth-hypotheses.json` states why a mechanism may matter, where it applies, how to test it and what outcome signal to observe.
4. `arwp-growth` audits a real site and produces concrete P0–P3 actions.
5. Growth snapshots and experiments record implementation state over time.
6. Owner-side visibility snapshots record aggregate Search/AI outcomes that public crawling cannot infer.

These layers are deliberately separate. A trend is not a hypothesis, an implementation is not an outcome, and an observed outcome is not automatic causality.

## Hypothesis lifecycle

A hypothesis is not a ranking claim. It has:

- evidence class and confidence;
- site/vertical applicability;
- target surfaces;
- implementation checks and check modes;
- success signals;
- links to current Growth actions;
- primary sources.

Use:

```bash
arwp-hypotheses check
arwp-hypotheses list --vertical=editorial
arwp-hypotheses show discover-visual-preview
```

Default Growth planning excludes `project-experiment` hypotheses. Experiments remain available for explicit research/agent interoperability work.

## Experiment lifecycle

`arwp-growth-experiment` closes the gap between a hypothesis and longitudinal evidence. It binds a known hypothesis to Growth actions that were actually active in a before snapshot, then records implementation-state and optional owner-side visibility evidence after the change.

```bash
arwp-growth-experiment create before.growth.snapshot.json \
  --id=experiment-001 \
  --hypothesis=<hypothesis-id> \
  --actions=<growth-action-id> \
  --commit=<commit-sha> \
  --output=experiment.json

arwp-growth-experiment evaluate experiment.json \
  before.growth.snapshot.json after.growth.snapshot.json \
  --before-visibility=before.visibility.json \
  --after-visibility=after.visibility.json \
  --output=experiment.measured.json
```

Evaluation records implementation debt movement and owner-side metric direction, but always marks the result for review. Positive movement is an observation, not automatic evidence of causality or a reason to promote a hypothesis. See `docs/GROWTH-EXPERIMENTS.md`.

## Owner-side evidence import

Owner exports can be normalized into the existing visibility contract without requiring API credentials:

```bash
arwp-visibility import google.csv --provider=google \
  --site=https://example.com/ --start=2026-08-01 --end=2026-08-31 \
  --output=google.visibility.json

arwp-visibility import bing.csv --provider=bing \
  --site=https://example.com/ --start=2026-08-01 --end=2026-08-31 \
  --output=bing.visibility.json

arwp-visibility import analytics.csv --provider=referrals \
  --site=https://example.com/ --start=2026-08-01 --end=2026-08-31 \
  --match=chatgpt.com,perplexity.ai --output=referrals.visibility.json
```

Only recognized aggregate metrics are normalized. Unknown dimensions remain in the original export; missing metrics are not converted to zero.

## Trend lifecycle review

Primary-source monitoring can create review proposals for current `WATCH` trends:

```bash
node scripts/trend-source-watch.mjs --output=trend-watch.json
arwp-trends propose trend-watch.json --output=trend-promotions.json
arwp-trends review trend-promotions.json \
  --id=<proposal-id> --decision=approve --reviewer=<name> \
  --output=trend-promotions.reviewed.json
```

Approval records a human decision but deliberately does not mutate `registry/trends.json`.

After reviewed Growth experiments accumulate, ARWP can check whether an `ADOPT` trend has real owner-side longitudinal evidence:

```bash
arwp-trends measure experiments/ --output=trend-measurement.json
```

An `ADOPT -> MEASURED` proposal requires a reviewed linked experiment with before/after owner visibility evidence and at least one comparable metric. Positive, negative, mixed and unchanged observations all remain in the evidence set. `MEASURED` means evidence exists; it is not a positive-effect label.

See `docs/GROWTH-LEARNING.md` for the complete workflow.

## Decision order

1. Eligibility and policy blockers.
2. Correct canonical/freshness foundations.
3. Original, useful, evidence-bearing content.
4. Identity, authorship and addressability.
5. Recommendation/citation features that fit the site.
6. Measurement hooks and owner evidence.
7. Agent-web experiments only where they serve a real task.

## Agent execution

`arwp-growth-loop` is the outcome-driven Agent Skill. It tells an agent to research, inspect the target repository, select hypotheses, implement safe changes, verify the site's own build plus ARWP checks, and identify follow-up measurement.

`arwp-prepare-site` remains the initial technical adoption skill. Resolver/protocol specialists remain unchanged.

## Durable evidence

Use:

- `templates/growth/growth-loop-checklist.md` for baseline/completion review;
- `templates/growth/hypothesis-ledger.md` for lightweight before/after observations and keep/revise/revert decisions;
- `arwp-growth-history` for immutable implementation-state snapshots and diffs;
- `arwp-growth-experiment` for versioned hypothesis → action → implementation → outcome records;
- `arwp-visibility import` for aggregate owner-side Search/AI evidence;
- `arwp-trends propose|review|measure` for explicit Trend lifecycle evidence;
- Evidence Receipts for stable technical observations.

Negative or neutral evidence is not a failure of the methodology. It is how weak hypotheses stop accumulating as permanent “SEO best practices.”

## Guardrails

ARWP does not guarantee crawling, indexing, ranking, Discover placement, AI citations, recommendations, traffic or conversion. Platform eligibility is not placement. A static check is not runtime conformance. A repository change is not outcome evidence. New agent metadata is never allowed to displace ordinary web quality fundamentals.
