# Agent-Ready Web Profile

[![ARWP validation](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml)
[![Reference verification](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml)

**Research what can improve a website's Search and recommendation visibility, turn it into explicit hypotheses, implement the highest-confidence changes, verify them, and measure what actually happened.**

ARWP keeps its existing agentic-web Resolver, publisher profile, scanner, protocol work, benchmarks and evidence tooling. The primary operational product is now a repeatable website Growth Loop for Search, generative Search, recommendation/citation surfaces and compatible agents.

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

ARWP does **not** promise ranking, Discover placement, AI citation, recommendation traffic or conversion. The goal is to make website improvement evidence-backed, testable and adaptive instead of accumulating SEO/GEO cargo cult.

## Product layers

### 1. Growth Loop — primary operational workflow

- **Trend Radar** tracks current Search, AI-search, citation and agent-web changes from primary sources.
- **Recommendations Registry** records dated upstream requirements, guidance, features and measurement opportunities.
- **Growth Hypotheses** state why a change may matter, where it applies, how to check it and what success signal to observe.
- **Growth Profile** audits a real site and produces a prioritized P0–P3 backlog.
- **Growth History** preserves implementation-state snapshots and diffs.
- **Growth Experiments** link hypotheses and actions to before/after evidence and explicit human review.
- **Owner Evidence Imports** normalize Google generative Search, Bing AI Performance and AI/referral exports into aggregate visibility snapshots.
- **Trend Learning** creates review-required `WATCH → ADOPT` and evidence-gated `ADOPT → MEASURED` proposals without silently mutating maturity.
- **Agent Skills** let coding agents research, edit the target repository, verify checks and preserve evidence.

### 2. Resolver — interoperability foundation

The Resolver remains supported. It discovers heterogeneous website interfaces, preserves provenance and conflicts, and selects a suitable interface for a concrete intent without requiring every website to adopt ARWP.

### 3. ARWP Profile — optional publisher service map

Publishers may still expose `/ai/site-profile.json`. The profile remains experimental, optional and non-exclusive with upstream standards.

## Fast path

```bash
git clone https://github.com/dkharlanau/agent-ready-web-profile.git
cd agent-ready-web-profile
npm ci

# What changed recently?
arwp-trends list --since=90 --exclude-retired

# What hypotheses apply?
arwp-hypotheses list --vertical=editorial

# What should this real site do now?
arwp-growth https://example.com --vertical=editorial --json

# Import owner-side Search/AI outcome evidence.
arwp-visibility import google.csv --provider=google \
  --site=https://example.com/ --start=2026-08-01 --end=2026-08-31 \
  --output=google.visibility.json

# Turn source changes into reviewable Trend lifecycle proposals.
arwp-trends propose trend-watch.json --output=trend-promotions.json

# Check which ADOPT trends have real reviewed longitudinal evidence.
arwp-trends measure experiments/ --output=trend-measurement.json
```

The Growth JSON carries both the actionable backlog and the applicable non-experimental `hypothesisProgram`. See [`docs/GROWTH-LOOP.md`](docs/GROWTH-LOOP.md) for the operating model and [`docs/GROWTH-LEARNING.md`](docs/GROWTH-LEARNING.md) for owner evidence and Trend lifecycle review.

## Growth hypotheses

Canonical registry: [`registry/growth-hypotheses.json`](registry/growth-hypotheses.json)

A hypothesis is deliberately more explicit than a checklist item. It contains:

- evidence class: platform requirement, guidance, feature, measurement or project experiment;
- confidence and vertical applicability;
- target Search/recommendation/AI surfaces;
- automated/manual/runtime/owner-data checks;
- success signals that require observation rather than assertion;
- links back to Growth actions and primary sources.

Validate or inspect it:

```bash
arwp-hypotheses check
arwp-hypotheses list --vertical=editorial
arwp-hypotheses show <hypothesis-id>
```

## Growth learning boundary

A source-watch candidate is not a recommendation. A reviewed `WATCH → ADOPT` proposal is not an automatic registry mutation. An `ADOPT → MEASURED` proposal requires reviewed Growth Experiment evidence with before/after owner metrics, and `MEASURED` means observations exist — not that the effect was positive or caused by ARWP. Negative, mixed and unchanged outcomes remain part of the evidence set.

## Resolver and interoperability

The project still includes the bounded scanner, multi-standard Resolver, source-authority/conflict model, MCP gateway/server, A2A/ARD/Agent Skills integrations, evidence receipts, benchmarks, drift monitoring and independent interoperability work. Those capabilities remain the technical foundation behind the Growth Loop and continue to evolve without being presented as ranking signals.

## License

Apache-2.0.
