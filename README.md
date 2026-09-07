<p align="center">
  <img src="docs/media/signalbraid-lockup.svg" alt="SignalBraid · ARWP" width="620">
</p>

# SignalBraid · ARWP

**Weave the signals. Ship the change.**

[![ARWP validation](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml)
[![Adaptive Site Upgrade validation](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/adaptive-upgrade.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/adaptive-upgrade.yml)
[![Target-Site Transformation validation](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/transformation-engine.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/transformation-engine.yml)
[![Reference verification](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml)

SignalBraid is the product-facing layer of **Agent-Ready Web Profile (ARWP)**: an open-source system for turning changing Search, AI, crawler, agent-web and target-site signals into **site-specific, verifiable changes**.

Most tools answer one of two questions:

> How visible is my brand in AI search?

or:

> What is technically wrong with my site right now?

SignalBraid is aimed at the harder operational question:

> **What changed upstream, does it actually matter to this site, what exact site/repository change follows from it, can that change be made safely, how do we verify it, and which sites need attention when the rule changes again?**

That is the product boundary.

## The product loop

```text
RADAR       detect meaningful upstream change
  ↓
MAP         understand the actual site + source repository
  ↓
PLAN        decide what really applies
  ↓
PATCH       make the safe exact change
  ↓
PROOF       verify implementation + preserve evidence
  ↓
WATCH       detect drift + rule-change blast radius
  └────────────────────────────────────────────────↺
```

**Detect. Map. Decide. Change. Prove. Watch.**

## Why this is not another GEO dashboard

By 2026, strong AI-search products already monitor prompts, mentions, citations, sentiment, competitors and share of voice. Several now add recommendations, content workflows and agentic execution. Agent-experience products can serve AI-optimized content; crawler platforms can enforce access policy; agent-readiness scanners can score technical readiness; open-source AEO/GEO tools can gate regressions in CI.

SignalBraid should not win by cloning those surfaces.

Its stronger differentiation is the complete evidence lineage:

```text
UPSTREAM SOURCE
      ↓
RULE VERSION + FRESHNESS
      ↓
TARGET-SITE EVIDENCE
      ↓
APPLICABILITY
      ↓
RECOMMENDATION
      ↓
EXACT REPOSITORY / SITE SURFACE
      ↓
SAFE TRANSFORMATION
      ↓
VERIFICATION RECEIPT
      ↓
OUTCOME EVIDENCE
```

And crucially, the chain works backwards:

```text
RULE CHANGED / REVIEW-DUE
          ↓
WHICH RECOMMENDATIONS DEPEND ON IT?
          ↓
WHICH SITES?
          ↓
WHICH PREVIOUS TRANSFORMS?
          ↓
WHICH FILES / SURFACES NEED RE-REVIEW?
```

That reverse path is what turns web-platform drift into an operational maintenance system.

See [`docs/PRODUCT-LINE.md`](docs/PRODUCT-LINE.md).

## BraidGraph — the shared product primitive

The proposed **BraidGraph** links source evidence, rule versions, site state, repository ownership, recommendations, transformations, verification and later measurements.

It is not one giant score and it is not a replacement for source artifacts. It is a relationship/index layer over evidence-bearing artifacts.

Useful queries include:

- Why was this file changed?
- Which primary source supports this recommendation?
- Which target sites depend on a rule that is now stale?
- Which merged transformations still lack owner-side outcome evidence?
- Which rendered page is owned by which source file?
- Which automation class or policy blocks this change?

See [`docs/BRAIDGRAPH.md`](docs/BRAIDGRAPH.md).

## Product line

### 1. Radar — **What changed?**

Versioned source intelligence for Search, generative discovery, crawler policy, agent-web mechanisms, datasets/PIDs and related platform changes.

Existing ARWP foundations: Trend Radar, recommendation registries, source snapshots, rule freshness and hypothesis lifecycle.

### 2. Map — **What does this site actually have?**

The next major core build: a **Site State Graph + Repository Mapper**.

Map should understand:

- public routes/pages and their source owners;
- framework/build/deploy structure;
- entities and structured-data source of truth;
- content collections and real datasets;
- crawler/access policy;
- Search/AI/agent discovery surfaces;
- API/MCP/A2A/WebMCP/Agent Skills when real;
- safe, gated and forbidden mutation paths.

The critical missing bridge is **rendered surface → owning source file** resolution.

### 3. Plan — **What actually applies?**

The active **Adaptive Site Upgrade Engine** combines current rules, target-site evidence, site type, goals and dependencies.

It can produce `recommended`, `conditional`, `not-applicable` and `review-due` work instead of pushing the same checklist onto every site.

```bash
node bin/arwp-growth.mjs https://example.com \
  --vertical=documentation \
  --upgrade \
  --goals=search,generative-search,ai-citations,measurement
```

Or compile an existing Growth Plan:

```bash
node bin/arwp-upgrade.mjs compile growth.json \
  --verticals=documentation \
  --goals=search,generative-search,ai-citations,measurement \
  --output=upgrade.json
```

### 4. Patch — **What can change safely?**

The active **Target-Site Transformation Engine** converts deterministic mechanical or explicitly grounded work into path-allowlisted, SHA-256-gated operations.

```bash
node bin/arwp-transform.mjs compile \
  upgrade.json target-transform-spec.json \
  --output=transform.bundle.json

node bin/arwp-transform.mjs simulate transform.bundle.json
```

Production GitHub delivery is new-branch/PR first. Direct-main transformation is intentionally absent.

Policy, editorial truth, authenticated owner-platform settings and runtime/security decisions remain gated.

See [`docs/TARGET-SITE-TRANSFORMATION.md`](docs/TARGET-SITE-TRANSFORMATION.md).

### 5. Proof — **Did the implementation pass?**

Evidence receipts, build/test results, ARWP re-audits, transformation digests, owner visibility imports, runtime agent evaluations and experiment history remain separate but should converge into a unified **Change Receipt**.

A passing implementation proves implementation. It does **not** prove ranking, indexing, AI citation, recommendation traffic or conversion.

Neutral and negative results are valid evidence.

### 6. Watch — **What needs attention now?**

The next high-leverage portfolio layer.

Example:

> Google/OpenAI/Bing changes a rule. Which sites, recommendations and repository paths in this portfolio are affected?

Watch should provide:

- source/rule drift alerts;
- reverse impact analysis;
- multi-site re-audit waves;
- policy drift;
- merged-change-without-evidence detection;
- prioritized portfolio remediation.

### 7. Connect — **What happened outside the repository?**

Owner-data adapters should bring external observations into BraidGraph without pretending ARWP controls the provider:

- Google Search/generative Search exports;
- Bing AI Performance / grounding-query / citation evidence;
- Cloudflare AI crawler traffic and policy state;
- referral analytics;
- deployment/build evidence;
- CMS/repository metadata where appropriate.

## What is active today

- Search/AI Recommendations Registry;
- Trend Radar + source-backed hypotheses;
- vertical/site-type evidence;
- Growth Plan and P0–P3 actions;
- Adaptive Site Upgrade Graph;
- Target-Site Transformation Engine;
- deterministic local apply/rollback and production PR delivery;
- entity/provenance tooling;
- crawler policy matrix;
- owner visibility evidence imports;
- browser-agent evaluation receipts;
- dataset publication/DOI readiness for genuine corpora;
- Resolver / MCP / A2A / WebMCP / Agent Skills / ARD interoperability foundation;
- change/history/experiment evidence.

## Highest-value next builds

### P0 — BraidGraph compiler

Create one canonical relationship graph over existing ARWP artifacts rather than adding another isolated report.

### P0 — Repository Mapper

Resolve rendered public surfaces to their source repository files, framework ownership, facts and mutation classes.

This is the biggest blocker to promoting more grounded recommendations into safe deterministic PRs.

### P0 — Reverse impact analysis

Given a changed, retired or `review-due` rule, compute affected sites, recommendations, previous transforms and source files.

### P0 — Unified Change Receipt

Every transformation should preserve source rule version, before/after digests, verification results, deployment evidence and outstanding measurement requirements.

### P1 — Portfolio policy-as-code

Organization-level rules for what can be automated, what always needs review, crawler/content-use policy and required verification gates.

### P1 — Verified stack transformation packs

High-confidence adapters and fixtures for GitHub Pages/static HTML, Jekyll, Next.js, Astro, Docusaurus and later CMS/e-commerce stacks.

### P1 — Semantic source-diff watcher

Detect material guidance changes and generate proposed rule revisions + blast-radius previews instead of reacting to simple timestamp/page churn.

### P1 — First-party evidence connectors

Google, Bing, Cloudflare and analytics adapters with explicit provenance and missing-data states.

### P2 — Page-cohort evidence helper

Support before/after cohorts and comparable unchanged pages for more disciplined outcome review without claiming unsupported causality.

### P2 — Public transformation benchmark

Reproducible fixtures showing whether specific transformations close intended implementation debt — including failures and negative results — without turning this into a ranking benchmark.

## Product packaging

### Open core

- single-site Radar / Map / Plan / Patch / Proof primitives;
- open BraidGraph schema/compiler;
- open CLI, schemas and Agent Skills;
- deterministic transformation engine;
- local verification/evidence.

### Hosted / Pro

- managed continuously refreshed intelligence;
- SignalBraid Watch portfolio mode;
- scheduled re-audits and source-impact alerts;
- owner-data connectors;
- verified stack transformation packs;
- managed transformation PRs;
- longitudinal evidence dashboards.

### Team / Enterprise

- private rule packs;
- policy-as-code;
- approval/review workflows;
- automation governance;
- portfolio audit/change history;
- organization-level crawler/content-use policy.

Paid value should be **maintenance, automation, governance, evidence and scale** — never a ranking/citation guarantee.

## The technical foundation remains ARWP

SignalBraid is the product brand. **Agent-Ready Web Profile (ARWP)** remains the repository/package and interoperability foundation.

The Resolver still discovers heterogeneous website interfaces, preserves provenance/conflicts and selects a suitable interface for a concrete intent without requiring every site to adopt ARWP.

```bash
node bin/arwp.mjs resolve https://example.com
node bin/arwp.mjs explain https://example.com
node bin/arwp.mjs plan https://example.com --intent=search
node bin/arwp.mjs snapshot https://example.com --output=example.snapshot.json
node bin/arwp.mjs drift before.snapshot.json after.snapshot.json --json
```

Supported planning intents remain `read`, `search`, `structured`, `tools` and `agent`.

## Evidence before claims

- passing a check does not prove ranking or indexing;
- an AI visibility score is external evidence, not conformance;
- owner-controlled reference sites are implementation evidence, not independent adoption;
- benchmark improvements are not Search/AI visibility gains;
- static metadata never grants authorization or security trust;
- source-watch candidates are not recommendations;
- `review-due` knowledge cannot silently remain accepted best practice;
- generated upgrade graphs never authorize unsafe production mutation;
- a DOI is a persistent citation identifier, not a ranking factor or quality certificate;
- negative benchmark/experiment results remain visible.

## Key docs

- [`docs/PRODUCT-LINE.md`](docs/PRODUCT-LINE.md) — product line, market boundary and packaging.
- [`docs/BRAIDGRAPH.md`](docs/BRAIDGRAPH.md) — shared evidence-to-change graph design.
- [`docs/BRAND-SIGNALBRAID.md`](docs/BRAND-SIGNALBRAID.md) — product brand system.
- [`docs/ADAPTIVE-SITE-UPGRADE.md`](docs/ADAPTIVE-SITE-UPGRADE.md) — target-specific upgrade compiler.
- [`docs/TARGET-SITE-TRANSFORMATION.md`](docs/TARGET-SITE-TRANSFORMATION.md) — deterministic repository transformation boundary.
- [`docs/GROWTH-LOOP.md`](docs/GROWTH-LOOP.md) — research/hypothesis/measurement loop.
- [`docs/DATASET-PUBLICATION.md`](docs/DATASET-PUBLICATION.md) — genuine corpus publication and DOI boundary.
- [`docs/SEARCH-AGENT-RECOMMENDATIONS.md`](docs/SEARCH-AGENT-RECOMMENDATIONS.md) — dated source-backed rules.
- [`docs/RESOLVER.md`](docs/RESOLVER.md) — interoperability foundation.

## Brand relationship

- **SignalBraid** — product brand.
- **ARWP** — technical project identity and suffix in the canonical lockup.
- **Agent-Ready Web Profile** — repository, npm package and interoperability foundation.

Canonical presentation: **SignalBraid · ARWP**.

## North Star

> **Can SignalBraid turn a meaningful upstream web change into the right site-specific implementation, prove what happened, and identify every site that needs re-review when the evidence changes again?**

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
