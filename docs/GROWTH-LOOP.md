# ARWP Growth Loop

ARWP keeps the Resolver, optional publisher profile, scanner, protocol observatory, evidence receipts and agent interoperability work. The product focus is now broader and outcome-oriented:

> **Help a website continuously improve eligibility, discoverability, recommendation readiness, citability and agent usability as Search and AI surfaces change.**

The method is not “install a manifest and rank better.” It is a learning loop.

```text
PRIMARY-SOURCE RESEARCH
        +
INDEPENDENT RESEARCH / EXPERT EXPERIMENTS
        +
WINNER OBSERVATORY
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
REPLICATE / CHALLENGE
        ↓
KEEP / REVISE / REVERT / RETIRE
        └───────────────↺
```

The external evidence path is documented in `docs/EVIDENCE-WINNER-LAB.md`. It adds independent large-sample studies, transparent individual experiments and repeated observations of newly successful Search/AI pages without allowing any of them to bypass hypothesis testing.

## Target surfaces

ARWP may create site-specific work for classic Search, Google generative Search, Discover and image/video surfaces, Bing AI/Microsoft surfaces, ChatGPT Search/referrals, and compatible agent retrieval/tooling. Provider-specific guidance remains provider-specific.

## Evidence layers

1. `registry/search-agent-recommendations.json` records dated upstream requirements and opportunities.
2. `registry/trends.json` records recent changes and WATCH/ADOPT/MEASURED status.
3. `knowledge/research/` preserves reviewed research records, including independent external evidence and source conflicts.
4. Winner Observatory records preserve dated query/prompt cohorts and comparison pages before any observed feature becomes a pattern.
5. `registry/growth-hypotheses.json` states why a mechanism may matter, where it applies, how to test it and what outcome signal to observe.
6. `arwp-growth` audits a real site and produces concrete P0–P3 actions.
7. Growth snapshots and experiments record implementation state over time.
8. Owner-side visibility snapshots record aggregate Search/AI outcomes that public crawling cannot infer.

These layers are deliberately separate. A source is not a rule, a trend is not a hypothesis, a winning page is not a causal explanation, an implementation is not an outcome, and an observed outcome is not automatic causality.

## Source-job contract

Evidence classes have different jobs rather than a universal prestige order:

- official provider documentation is strongest for eligibility, crawler controls, supported features and reporting semantics;
- standards and academic work are useful for mechanisms, measurement and interoperability when their scope matches;
- large independent datasets are useful for prevalence, associations, drift and cohort behaviour;
- transparent individual experiments can clarify narrowly defined feature behaviour;
- winner observations can reveal current candidate patterns but cannot prove why a page won;
- opinion/commentary can seed a question but cannot directly promote a recommendation.

Every reusable claim should preserve method, date, scope, caveat and a path to replication. Confidence belongs to the claim in context, not permanently to a source, company or expert.

## Winner Observatory contract

The Winner Observatory is deliberately page- and cohort-level. It asks which URLs newly gain or sustain organic/Search or AI-citation visibility for a defined query/prompt cohort and how they differ from controls.

A one-time screenshot is insufficient. Candidate winners should be observed in repeated dated snapshots. Compare them with stable incumbents, ranking-but-uncited pages, cited-but-weakly-ranking pages where observable, the target site's comparable page and the same URL before/after a meaningful revision when evidence exists.

Public observation also cannot prove that a business uses no paid acquisition. The manual record therefore uses `unknown`, `none_observed` or `confirmed_present`; `none_observed` is scoped to the defined check and is never rewritten as “zero advertising.”

Use `templates/growth/winner-observation.md` until repeated use justifies a dedicated schema and append-only registry.

## External-evidence promotion rules

External research does not write recommendations directly.

- One correlational study may create or reprioritize a hypothesis, not a universal rule.
- One transparent expert experiment may support feature behaviour in that setup, not universal transfer.
- Compatible findings from independent methods raise prior confidence but still require site applicability review.
- Current official provider contradiction reopens provider-specific rules immediately.
- Neutral and negative target-site experiments remain visible even when external evidence is positive.
- High citation drift, product/UI change or stale source evidence shortens the review window.
- Unsupported advice becomes `review-due` or retired rather than silently accumulating as permanent SEO folklore.

The initial September 2026 source review is in `knowledge/research/2026-09-09-external-evidence-winner-loop.json`.

## Hypothesis lifecycle

A hypothesis is not a ranking claim. It has:

- evidence class and confidence;
- site/vertical applicability;
- target surfaces;
- implementation checks and check modes;
- success signals;
- links to current Growth actions;
- primary sources and, when used, dated external evidence;
- a falsifier or competing explanation for winner-derived patterns.

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

The external evidence layer also keeps citations, explicit brand mentions, referral clicks and product outcomes separate. No single AI-visibility number should collapse those states.

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
7. External/winner-derived hypotheses with a clear mechanism and falsifier.
8. Agent-web experiments only where they serve a real task.

## Agent execution

`arwp-growth-loop` is the outcome-driven Agent Skill. It tells an agent to research, inspect the target repository, select hypotheses, implement safe changes, verify the site's own build plus ARWP checks, and identify follow-up measurement.

For research-led runs, the agent should now:

1. check current primary sources first;
2. inspect the external evidence registry for fresh independent support or contradiction;
3. use Winner Observatory evidence only when the query/prompt cohort and repeat snapshots are recorded;
4. convert observations into falsifiable hypotheses rather than direct “best practices”;
5. preserve conflicting evidence and retirement triggers;
6. prefer a small measured site test to broad speculative rewrites.

`arwp-prepare-site` remains the initial technical adoption skill. Resolver/protocol specialists remain unchanged.

## Durable evidence

Use:

- `templates/growth/growth-loop-checklist.md` for baseline/completion review;
- `templates/growth/hypothesis-ledger.md` for lightweight before/after observations and keep/revise/revert decisions;
- `templates/growth/winner-observation.md` for dated external winner/control observations;
- `knowledge/research/2026-09-09-external-evidence-winner-loop.json` for the initial reviewed external source set and promotion policy;
- `arwp-growth-history` for immutable implementation-state snapshots and diffs;
- `arwp-growth-experiment` for versioned hypothesis → action → implementation → outcome records;
- `arwp-visibility import` for aggregate owner-side Search/AI evidence;
- `arwp-trends propose|review|measure` for explicit Trend lifecycle evidence;
- Evidence Receipts for stable technical observations.

Negative or neutral evidence is not a failure of the methodology. It is how weak hypotheses stop accumulating as permanent “SEO best practices.”

## Guardrails

ARWP does not guarantee crawling, indexing, ranking, Discover placement, AI citations, recommendations, traffic or conversion. Platform eligibility is not placement. A static check is not runtime conformance. A repository change is not outcome evidence. A currently winning page is not a causal ranking model. Public observation cannot prove the absence of paid acquisition. New agent metadata is never allowed to displace ordinary web quality fundamentals.
