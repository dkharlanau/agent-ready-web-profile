# Agent-Ready Web Profile

[![ARWP validation](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml)
[![Adaptive Site Upgrade validation](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/adaptive-upgrade.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/adaptive-upgrade.yml)
[![Reference verification](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml)

**Research what can improve a website's Search and recommendation visibility, detect what actually applies to the target site, compile exact changes, verify them, and measure what happened.**

ARWP keeps its existing agentic-web Resolver, publisher profile, scanner, protocol work, benchmarks and evidence tooling. The product focus is broader: use that technical foundation inside a continuously refreshed website Growth Loop that can tell an implementation agent not only **what is missing**, but **what to change, where, why, how to verify it, and what evidence to measure afterwards**.

```text
PRIMARY-SOURCE RESEARCH
        ↓
    TREND RADAR
        ↓
EVIDENCE CLASSIFICATION
        ↓
 GROWTH HYPOTHESES
        ↓
SITE BASELINE + VERTICAL EVIDENCE
        ↓
ADAPTIVE SITE UPGRADE GRAPH
        ↓
 EXACT TARGETS + CHANGE RECIPES
        ↓
 IMPLEMENT → VERIFY → MEASURE
        ↓
   EXPERIMENT REVIEW
        ↓
KEEP / REVISE / REVERT / RETIRE
        └────────────────────────↺
```

ARWP does **not** promise ranking, Discover placement, AI citation, recommendation traffic or conversion. The goal is to make website improvement more evidence-backed, target-specific, testable and adaptive instead of accumulating SEO/GEO cargo cult.

## Product layers

### 1. Growth Loop — primary operational workflow

- **Trend Radar** tracks current Search, AI-search, citation and agent-web changes from primary sources.
- **Recommendations Registry** records dated upstream requirements, guidance, features and measurement opportunities.
- **Growth Hypotheses** state why a change may matter, where it applies, how to check it and what success signal to observe.
- **Growth Profile** audits a real site and produces a prioritized P0–P3 backlog.
- **Adaptive Site Upgrade Engine** compiles current Growth evidence into dependency-aware target-site change recipes with exact surfaces, automation class, source freshness, verification contracts and measurement signals.
- **Safe Remediation** turns the backlog into proposal-only implementation manifests with bounded snippets and explicit human review gates.
- **Growth History + Experiments** preserve implementation-state changes and link hypotheses/actions to before/after evidence.
- **Owner Evidence Imports** normalize Google generative Search, Bing AI Performance and AI/referral exports into aggregate visibility snapshots.
- **Trend Learning** creates review-required `WATCH → ADOPT` and evidence-gated `ADOPT → MEASURED` proposals without silently changing maturity.
- **Agent Skills** let coding agents research, classify, compile upgrades, edit the target repository, verify checks and preserve evidence.

The intelligence itself is versioned. Adaptive upgrade packs carry `sourceReviewedAt` and `reviewAfterDays`; stale advice becomes `review-due` instead of silently remaining a permanent recommendation.

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
node bin/arwp-trends.mjs list --since=90 --exclude-retired

# What hypotheses apply?
node bin/arwp-hypotheses.mjs list --vertical=editorial

# What should this real site do now?
node bin/arwp-growth.mjs https://example.com --vertical=editorial --json > growth.json

# Audit + compile exact target-site upgrades in one pass.
node bin/arwp-growth.mjs https://example.com \
  --vertical=research-dataset \
  --upgrade \
  --goals=search,generative-search,ai-citations,measurement

# Compile an existing Growth Plan into an upgrade graph.
node bin/arwp-upgrade.mjs compile growth.json \
  --verticals=editorial \
  --goals=search,generative-search,ai-citations,measurement \
  --output=upgrade.json

# Model which known implementation gaps selected upgrades would address.
node bin/arwp-upgrade.mjs simulate upgrade.json \
  --accept=foundation,citation-ready-content

# Turn the backlog into a proposal-only implementation manifest.
node bin/arwp-growth-remediation.mjs growth.json --output=remediation.json

# Normalize an owner-provided Search/AI export.
node bin/arwp-visibility.mjs import google.csv --provider=google \
  --site=https://example.com/ --start=2026-08-01 --end=2026-08-31 \
  --output=google.visibility.json

# Turn primary-source changes into explicit review proposals.
node bin/arwp-trends.mjs propose trend-watch.json --output=trend-promotions.json

# Check whether reviewed experiments justify a MEASURED review proposal.
node bin/arwp-trends.mjs measure experiments/ --output=trend-measurement.json
```

The Growth JSON carries both the actionable backlog and the applicable non-experimental `hypothesisProgram`. The Adaptive Upgrade Graph adds the implementation contract: exact targets, recipes, dependencies, knowledge freshness, verification and measurement. Remediation and upgrade planning do not by themselves authorize unsafe production mutation: robots policy, structured data truth, editorial content and authenticated owner controls remain explicit review boundaries.

## Adaptive Site Upgrade Engine

Canonical intelligence: [`registry/adaptive-upgrade-packs.json`](registry/adaptive-upgrade-packs.json)

Product model:

```text
upstream evidence
  ↔ rule freshness/history
  ↔ target-site classification
  ↔ applicability
  ↔ exact change recipe
  ↔ repository/site surface
  ↔ verification
  ↔ owner/runtime outcome evidence
  ↔ next experiment
```

Current packs cover Search/generative eligibility, citation-ready content, identity/provenance, ChatGPT Search policy, browser-agent accessibility, real dataset publication and DOI lifecycle, Preferred Sources, Google generative Search measurement, Bing citation/grounding-query/intent/topic/Citation Share feedback, content-use policy, real agent interfaces and the change-evidence loop.

A real reusable corpus can activate `dataset-publication-pid`; an ordinary website should not manufacture a dataset or DOI to satisfy the profile. A software product can activate agent-operability work; a static article library should not be told to expose fake tools.

See [`docs/ADAPTIVE-SITE-UPGRADE.md`](docs/ADAPTIVE-SITE-UPGRADE.md).

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
node bin/arwp-hypotheses.mjs check
node bin/arwp-hypotheses.mjs show discover-visual-preview
```

Default Growth planning excludes `project-experiment`. Agent-readable metadata remains available for real interoperability use cases without being turned into a Search ranking claim.

## Agent Skill: execute the loop

```bash
npx skills add dkharlanau/agent-ready-web-profile
```

Default outcome-driven skill:

```text
arwp-growth-loop
```

It runs:

`research → classify → baseline → hypothesis → upgrade graph → implement → verify → measure → keep/revise/revert`

Use `arwp-adaptive-upgrade` when the site has already been inspected and the next job is to turn evidence into exact changes. Use `arwp-prepare-site` for initial technical adoption. Specialists remain available for content quality, genuine dataset publication, agent discovery and evidence/CI.

## What the Growth layer covers

- crawl, HTTP, robots, indexability and snippet eligibility;
- canonical URLs, sitemap and meaningful freshness;
- original/non-commodity content and first-hand evidence;
- deep-linkable sections and internal links;
- Organization/Person/author identity and provenance;
- image/video evidence and Discover-friendly previews where relevant;
- bounded acquisition features such as Preferred Sources where applicable;
- OAI-SearchBot and provider-specific crawler/access policy without conflating Search and model training;
- semantic accessibility and runtime evidence for interactive browser agents where relevant;
- genuine dataset release identity, methodology, versioning, checksums and verified persistent identifiers when a real corpus exists;
- Google/Bing/ChatGPT owner-side measurement inputs;
- truthful agent-readable routes and runtime interfaces;
- governance against fake freshness, speculative protocol adoption and stale best-practice advice.

Manual editorial quality stays manual. Authenticated platform metrics stay external-owner-data. Experimental mechanisms stay experimental.

## Durable checklist and learning ledger

- [`templates/growth/growth-loop-checklist.md`](templates/growth/growth-loop-checklist.md) — baseline/completion review.
- [`templates/growth/hypothesis-ledger.md`](templates/growth/hypothesis-ledger.md) — lightweight before/after evidence and keep/revise/revert decisions.
- `arwp-upgrade` — target-specific evidence-to-change graph plus implementation-debt simulation.
- `arwp-growth-history` — immutable implementation-state snapshots and diffs.
- `arwp-growth-experiment` — versioned hypothesis → action → implementation → outcome records.
- `arwp-growth-remediation` — proposal-only implementation manifests with shipped-template SHA-256 provenance and no target-repository writes.
- `arwp-visibility import` — aggregate owner-provided Google/Bing/referral evidence.
- `arwp-trends propose|review|measure` — explicit Trend maturity evidence and review flow.

A technically correct change can have neutral or negative external impact. ARWP treats that as valid evidence, not as something to hide. `MEASURED` means longitudinal evidence exists; it is not a positive-effect or causality label.

See [`docs/GROWTH-LEARNING.md`](docs/GROWTH-LEARNING.md).

## Resolver commands remain

```bash
node bin/arwp.mjs resolve https://example.com
node bin/arwp.mjs explain https://example.com
node bin/arwp.mjs plan https://example.com --intent=search
node bin/arwp.mjs resolve-many targets.txt --concurrency=4 --json
node bin/arwp.mjs snapshot https://example.com --output=example.snapshot.json
node bin/arwp.mjs drift before.snapshot.json after.snapshot.json --json
npm run resolver:mcp
```

Supported planning intents remain `read`, `search`, `structured`, `tools` and `agent`.

The Resolver continues to normalize ordinary web discovery plus compatible ARWP, HTTP `Link`, Markdown negotiation, `agents.*`, RFC 9727 API Catalog, RFC 9728 Protected Resource Metadata, A2A, Agent Skills, ARD evidence and compatible MCP metadata. Source authority and conflicts remain visible.

See [`docs/RESOLVER.md`](docs/RESOLVER.md).

## Profile and existing runtime tooling remain

```bash
node bin/arwp.mjs scan https://example.com
node bin/arwp.mjs init https://example.com
node bin/arwp.mjs validate ai/site-profile.json
node bin/arwp.mjs verify https://example.com/ai/site-profile.json
node bin/arwp.mjs health https://example.com
npm run monitor:resolver
```

The bounded hosted scanner/resolver service, MCP gateway, federation/router, snapshots/drift, runtime reconciliation, A2A signature verification, browser-agent receipts, IndexNow and visibility evidence tooling remain part of the repository.

## Evidence before claims

- passing a check does not prove ranking or indexing;
- owner-controlled reference sites are implementation evidence, not independent adoption;
- benchmark improvements are not evidence of Search/AI visibility gains;
- static metadata never grants authorization or security trust;
- new drafts and vendor mechanisms keep their actual maturity level;
- source-watch candidates are not recommendations;
- reviewed Trend proposals do not silently mutate `registry/trends.json`;
- generated remediation manifests and upgrade graphs never authorize unsafe production mutation;
- a DOI is a persistent citation identifier, not a ranking factor or quality certificate;
- negative benchmark/experiment results must remain visible.

The frozen Resolver decision-quality corpus and benchmark tooling remain in [`benchmarks/`](benchmarks/). See [`docs/BENCHMARK.md`](docs/BENCHMARK.md).

## North Stars

Primary product North Star:

> **How reliably can ARWP turn current Search/recommendation/AI platform changes into the right site-specific changes, verify them, and connect them to measurable follow-up evidence?**

Upgrade-engine North Star:

> **How much target-site implementation debt can ARWP correctly address without generic advice, invented facts, stale rules or unsafe mutation?**

Technical foundation North Star:

> **How many external sites can the Resolver correctly understand and route without site-specific integration code?**

The Growth Loop, Adaptive Upgrade Engine and Resolver support each other: research tells a publisher what changed; the upgrade graph converts applicable evidence into concrete work; the Resolver/evidence stack prevents the agent-facing side from becoming speculative metadata.

## Key docs

- [`docs/GROWTH-LOOP.md`](docs/GROWTH-LOOP.md) — operating model.
- [`docs/ADAPTIVE-SITE-UPGRADE.md`](docs/ADAPTIVE-SITE-UPGRADE.md) — evidence-to-change engine and commercial product direction.
- [`docs/GROWTH-LEARNING.md`](docs/GROWTH-LEARNING.md) — owner evidence and Trend lifecycle review.
- [`docs/GROWTH-PROFILE.md`](docs/GROWTH-PROFILE.md) — planner and priorities.
- [`docs/GROWTH-REMEDIATION.md`](docs/GROWTH-REMEDIATION.md) — proposal-only patch/snippet boundary.
- [`docs/TREND-RADAR.md`](docs/TREND-RADAR.md) — change lifecycle.
- [`docs/TREND-HISTORY.md`](docs/TREND-HISTORY.md) — immutable Trend snapshots/diffs.
- [`docs/SEARCH-AGENT-RECOMMENDATIONS.md`](docs/SEARCH-AGENT-RECOMMENDATIONS.md) — dated upstream rules.
- [`docs/DATASET-PUBLICATION.md`](docs/DATASET-PUBLICATION.md) — genuine corpus publication and DOI boundary.
- [`docs/RESOLVER.md`](docs/RESOLVER.md) — interoperability model.
- [`SPEC.md`](SPEC.md) — optional publisher profile contract.

Public Growth page: https://dkharlanau.github.io/agent-ready-web-profile/growth/

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
