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
KEEP / REVISE / REVERT / RETIRE
        └───────────────↺
```

## Target surfaces

ARWP may create site-specific work for classic Search, Google generative Search, Discover and image/video surfaces, Bing AI/Microsoft surfaces, ChatGPT Search/referrals, and compatible agent retrieval/tooling. Provider-specific guidance remains provider-specific.

## Four evidence layers

1. `registry/search-agent-recommendations.json` records dated upstream requirements and opportunities.
2. `registry/trends.json` records recent changes and WATCH/ADOPT/MEASURED status.
3. `registry/growth-hypotheses.json` states why a mechanism may matter, where it applies, how to test it and what outcome signal to observe.
4. `arwp-growth` audits a real site and produces concrete P0–P3 actions.

Owner-side performance is a fifth, external layer. It must not be inferred from repository metadata.

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
node bin/arwp-hypotheses.mjs check
node bin/arwp-hypotheses.mjs list --vertical=editorial
node bin/arwp-hypotheses.mjs show discover-visual-preview
```

Default Growth planning excludes `project-experiment` hypotheses. Experiments remain available for explicit research/agent interoperability work.

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
- `templates/growth/hypothesis-ledger.md` for before/after observations and keep/revise/revert decisions;
- Evidence Receipts for stable technical observations;
- owner exports/snapshots for Search/AI outcome evidence.

Negative or neutral evidence is not a failure of the methodology. It is how weak hypotheses stop accumulating as permanent “SEO best practices.”

## Guardrails

ARWP does not guarantee crawling, indexing, ranking, Discover placement, AI citations, recommendations, traffic or conversion. Platform eligibility is not placement. A static check is not runtime conformance. A repository change is not outcome evidence. New agent metadata is never allowed to displace ordinary web quality fundamentals.
