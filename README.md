# Agent-Ready Web Profile

[![ARWP validation](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml)
[![Reference verification](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml)

**Research what can improve a website's Search and recommendation visibility, turn it into explicit hypotheses, implement the highest-confidence changes, verify them, and measure what actually happened.**

ARWP keeps its existing agentic-web Resolver, publisher profile, scanner, protocol work, benchmarks and evidence tooling. The product focus is now broader: use that technical foundation inside a repeatable website Growth Loop for Search, generative Search, recommendations/citation surfaces and compatible agents.

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

ARWP does **not** promise ranking, Discover placement, AI citation, recommendation traffic or conversion. The goal is to make website improvement more evidence-backed, testable and adaptive instead of accumulating SEO/GEO cargo cult.

## Product layers

### 1. Growth Loop — primary operational workflow

- **Trend Radar** tracks current Search, AI-search, citation and agent-web changes from primary sources.
- **Recommendations Registry** records dated upstream requirements, guidance, features and measurement opportunities.
- **Growth Hypotheses** state why a change may matter, where it applies, how to check it and what success signal to observe.
- **Growth Profile** audits a real site and produces a prioritized P0–P3 backlog.
- **Agent Skills** let coding agents research, edit the target repository, verify checks and preserve evidence.
- **Measurement** keeps owner-side outcomes separate from static implementation claims.

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
node bin/arwp-growth.mjs https://example.com --vertical=editorial --json
```

The Growth JSON now carries both the actionable backlog and the applicable non-experimental `hypothesisProgram`.

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

`research → classify → baseline → hypothesis → implement → verify → measure → keep/revise/revert`

Use `arwp-prepare-site` for initial technical adoption. Specialists remain available for content quality, agent discovery and evidence/CI.

## What the Growth layer covers

- crawl, HTTP, robots, indexability and snippet eligibility;
- canonical URLs, sitemap and meaningful freshness;
- original/non-commodity content and first-hand evidence;
- deep-linkable sections and internal links;
- Organization/Person/author identity and provenance;
- image/video evidence and Discover-friendly previews where relevant;
- bounded acquisition features such as Preferred Sources where applicable;
- OAI-SearchBot and provider-specific crawler/access policy without conflating Search and model training;
- Google/Bing/ChatGPT owner-side measurement inputs;
- truthful agent-readable routes and runtime interfaces;
- governance against fake freshness and speculative protocol adoption.

Manual editorial quality stays manual. Authenticated platform metrics stay external-owner-data. Experimental mechanisms stay experimental.

## Durable checklist and learning ledger

- [`templates/growth/growth-loop-checklist.md`](templates/growth/growth-loop-checklist.md) — baseline/completion review.
- [`templates/growth/hypothesis-ledger.md`](templates/growth/hypothesis-ledger.md) — before/after evidence and keep/revise/revert decisions.

A technically correct change can have neutral external impact. ARWP treats that as valid evidence, not as something to hide.

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
- negative benchmark/experiment results must remain visible.

The frozen Resolver decision-quality corpus and benchmark tooling remain in [`benchmarks/`](benchmarks/). See [`docs/BENCHMARK.md`](docs/BENCHMARK.md).

## North Stars

Primary product North Star:

> **How reliably can ARWP turn current Search/recommendation/AI platform changes into site-specific, verified improvements with measurable follow-up evidence?**

Technical foundation North Star:

> **How many external sites can the Resolver correctly understand and route without site-specific integration code?**

The Growth Loop and Resolver support each other: research tells a publisher what to improve; the Resolver/evidence stack prevents the agent-facing side from becoming speculative metadata.

## Key docs

- [`docs/GROWTH-LOOP.md`](docs/GROWTH-LOOP.md) — operating model.
- [`docs/GROWTH-PROFILE.md`](docs/GROWTH-PROFILE.md) — planner and priorities.
- [`docs/TREND-RADAR.md`](docs/TREND-RADAR.md) — change lifecycle.
- [`docs/SEARCH-AGENT-RECOMMENDATIONS.md`](docs/SEARCH-AGENT-RECOMMENDATIONS.md) — dated upstream rules.
- [`docs/RESOLVER.md`](docs/RESOLVER.md) — interoperability model.
- [`SPEC.md`](SPEC.md) — optional publisher profile contract.

Public Growth page: https://dkharlanau.github.io/agent-ready-web-profile/growth/

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
