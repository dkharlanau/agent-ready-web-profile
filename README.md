# Cite Goose

**Make your site worth citing.**

Start with the [pattern library](https://dkharlanau.github.io/agent-ready-web-profile/discoverability.html): **219 patterns, 122 sources and 16 categories** for useful editorial work, honest comparisons, structured data and usable interfaces. Every pattern carries a version and review status; 164 have an individual source-support review. Select a few, export a version-pinned plan, then use the Growth Loop to verify and measure the change. [Version contract](docs/DISCOVERABILITY-VERSIONING.md).

[![ARWP validation](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml)
[![Adaptive Site Upgrade validation](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/adaptive-upgrade.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/adaptive-upgrade.yml)
[![Target-Site Transformation validation](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/transformation-engine.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/transformation-engine.yml)
[![BraidGraph validation](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/braid-graph.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/braid-graph.yml)
[![Reference verification](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml)

Cite Goose is the product-facing layer of **Agent-Ready Web Profile (ARWP)**: an open-source system for turning changing Search, AI, crawler, agent-web and target-site signals into **site-specific, verifiable changes**.

Most tools answer one of two questions:

> How visible is my brand in AI search?

or:

> What is technically wrong with my site right now?

Cite Goose is aimed at the harder operational question:

> **What changed upstream, does it actually matter to this site, what exact site/repository change follows from it, can that change be made safely, how do we verify it, and which sites need attention when the rule changes again?**

That is the product boundary.

Read the [September editorial research guide](docs/EDITORIAL-SEARCH-LAB.md) for 26 new patterns covering article voice, openings, decision thresholds, section graphs and AI reporting.

[Anti-pattern field guide](docs/ANTI-PATTERNS.md) adds 28 versioned negative examples with remedies, verification and false-positive boundaries.

[Evidence Relay](docs/EVIDENCE-RELAY.md) adds functional maturity emulation, fit-based distribution, a reviewed DOI reading corpus and an executable artifact-cohort calculator.

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

## Run many sites as one portfolio

The `arwp-portfolio-fleet` skill and `arwp-portfolio` CLI remove repeated checkout-by-checkout triage. Keep a private workspace manifest with each site's local checkout, canonical URL, profile path and reviewed test commands, then inspect the whole fleet in one bounded run:

```bash
arwp-portfolio fleet-init portfolio-inventory.json --output=portfolio-workspace.json
arwp-portfolio fleet-inspect portfolio-workspace.json --output=inspection.json --json
arwp-portfolio fleet-live portfolio-workspace.json --output=live.json --json
```

`fleet-verify` skips dirty worktrees by default, executes argument arrays without a shell and stores command-output hashes instead of logs. No fleet command commits, pushes or deploys. See the [portfolio fleet guide](docs/PORTFOLIO-FLEET.md).

## Why this is not another GEO dashboard

By 2026, strong AI-search products already monitor prompts, mentions, citations, sentiment, competitors and share of voice. Several now add recommendations, content workflows and agentic execution. Agent-experience products can serve AI-optimized content; crawler platforms can enforce access policy; agent-readiness scanners can score technical readiness; open-source AEO/GEO tools can gate regressions in CI.

Cite Goose should not win by cloning those surfaces.

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

The implemented **BraidGraph v0.1** links source evidence, rule versions, target recommendations/surfaces, exact repository transformations, verification and later measurements. An explicit history layer preserves prior source/rule versions and `supersedes` relationships instead of rewriting old evidence.

It is not one giant score and it is not a replacement for source artifacts. It is a relationship/index layer over evidence-bearing artifacts.

Useful queries now include:

- Why was this file changed?
- Which primary source supports this recommendation?
- Which downstream recommendations/transforms should be re-reviewed because a source/rule changed?
- Which transformations still lack implementation verification or transform-linked outcome evidence?
- Which historical source/rule version was superseded?
- Which automation class or policy blocks this change?

```bash
node bin/arwp-braid.mjs compile \
  --upgrade=upgrade.json \
  --transform=transform.bundle.json \
  --out=braid.json

node bin/arwp-braid.mjs explain braid.json --path=index.html
node bin/arwp-braid.mjs impact braid.json --rule=canonical-discovery
node bin/arwp-braid.mjs missing-evidence braid.json

node bin/arwp-braid-history.mjs apply \
  braid.json revisions.json \
  --out=braid-with-history.json
```

Agents should use [`skills/arwp-braidgraph/SKILL.md`](skills/arwp-braidgraph/SKILL.md) for provenance, change-impact and evidence-debt questions rather than creating a second isolated graph.

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

BraidGraph already keeps implementation verification and external measurements as separate node/edge classes and can report which transform-level evidence is still missing.

### 6. Watch — **What needs attention now?**

The next high-leverage portfolio layer.

Example:

> Google/OpenAI/Bing changes a rule. Which sites, recommendations and repository paths in this portfolio are affected?

The BraidGraph foundation already provides per-graph source/rule impact traversal plus explicit superseded history. Watch should operationalize that across sites with:

- source/rule drift alerts;
- portfolio reverse-impact queues;
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
- Search Maturity reference benchmarking and intervention evidence;
- vertical/site-type evidence;
- Growth Plan and P0–P3 actions;
- Adaptive Site Upgrade Graph;
- Target-Site Transformation Engine;
- deterministic local apply/rollback and production PR delivery;
- BraidGraph v0.1 compiler, schema, explain/impact/missing-evidence queries and source/rule revision history;
- BraidGraph Agent Skill and public skill catalog;
- entity/provenance tooling;
- crawler policy matrix;
- owner visibility evidence imports;
- browser-agent evaluation receipts;
- dataset publication/DOI readiness for genuine corpora;
- Resolver / MCP / A2A / WebMCP / Agent Skills / ARD interoperability foundation;
- change/history/experiment evidence.

## Highest-value next builds

### P0 — Repository Mapper

Resolve rendered public surfaces to their source repository files, framework ownership, facts and mutation classes.

This is now the biggest blocker to promoting more grounded recommendations into safe deterministic PRs and to populating trustworthy `repo-file → renders → surface` BraidGraph edges.

### P0 — Unified Change Receipt + evidence adapters

Every executed transformation should preserve source/rule version, before/after digests, verification results, deployment evidence and outstanding measurement requirements, then map those canonical artifacts into BraidGraph without duplicating their payloads.

### P0 — Cite Goose Watch

Turn BraidGraph source/rule revisions and reverse impact traversal into portfolio re-review queues, alerts and bounded remediation waves.

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
- open BraidGraph schema/compiler/history/query layer;
- open CLI, schemas and Agent Skills;
- deterministic transformation engine;
- local verification/evidence.

### Hosted / Pro

- managed continuously refreshed intelligence;
- Cite Goose Watch portfolio mode;
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

Cite Goose is the product brand. **Agent-Ready Web Profile (ARWP)** remains the repository/package and interoperability foundation.

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
- BraidGraph reachability/history does not prove breakage or causality;
- a DOI is a persistent citation identifier, not a ranking factor or quality certificate;
- negative benchmark/experiment results remain visible.

## Key docs

- [`docs/PRODUCT-LINE.md`](docs/PRODUCT-LINE.md) — product line, market boundary and packaging.
- [`docs/BRAIDGRAPH.md`](docs/BRAIDGRAPH.md) — implemented evidence-to-change graph, revision history and query model.
- [`docs/BRAND-CITE-GOOSE.md`](docs/BRAND-CITE-GOOSE.md) — current Cite Goose identity, asset provenance and evidence labels.
- [`docs/BRAND-SIGNALBRAID.md`](docs/BRAND-SIGNALBRAID.md) — previous SignalBraid visual direction, retained as a historical reference.
- [`docs/ADAPTIVE-SITE-UPGRADE.md`](docs/ADAPTIVE-SITE-UPGRADE.md) — target-specific upgrade compiler.
- [`docs/TARGET-SITE-TRANSFORMATION.md`](docs/TARGET-SITE-TRANSFORMATION.md) — deterministic repository transformation boundary.
- [`docs/GROWTH-LOOP.md`](docs/GROWTH-LOOP.md) — research/hypothesis/measurement loop.
- [`docs/DATASET-PUBLICATION.md`](docs/DATASET-PUBLICATION.md) — genuine corpus publication and DOI boundary.
- [`docs/SEARCH-AGENT-RECOMMENDATIONS.md`](docs/SEARCH-AGENT-RECOMMENDATIONS.md) — dated source-backed rules.
- [`docs/RESOLVER.md`](docs/RESOLVER.md) — interoperability foundation.

## Brand relationship

The [brand policy](docs/trust/brand.html) identifies the current product without claiming trademark registration or clearance.

- **Cite Goose** — product brand.
- **ARWP** — the established technical abbreviation.
- **Agent-Ready Web Profile** — repository, npm package and interoperability foundation.

Canonical product name: **Cite Goose**. **Agent-Ready Web Profile** and **ARWP** remain technical aliases.

## North Star

> **Can Cite Goose turn a meaningful upstream web change into the right site-specific implementation, prove what happened, and identify every site that needs re-review when the evidence changes again?**

## License

Apache License 2.0. See [`LICENSE`](LICENSE).

## Choose a concrete implementation practice

The [Discoverability Library](https://dkharlanau.github.io/agent-ready-web-profile/discoverability.html) adds versioned, source-backed practices to the existing Growth Loop. Each practice has implementation steps, verification, source scope, an impact hypothesis and native rule/hypothesis routing. It covers decision-oriented articles, fair comparisons, visible evidence footnotes, coherent entities and useful user actions.

```bash
arwp discoverability --search="comparison" --json
arwp adoption-plan arwp-adoption.json --output=planned-work.json
arwp editorial-check article.receipt.json --json
```

Use `arwp-discoverability` as a specialist inside `arwp-growth-loop`. A corpus selection is a planning aid; actual changes, verification and outcomes stay in the existing Growth/Change Receipt/BraidGraph workflow. [Playbook](docs/DISCOVERABILITY-PLAYBOOK.md) · [Editorial examples](docs/examples/editorial/README.md) · [Measurement contract](docs/DISCOVERABILITY-BENCHMARKS.md).

[Asset workshop](docs/ASSET-WORKSHOP.md): four delivery patterns, three reusable packs and a question-led gap review.

[Names, locales and offers](docs/COMMERCIAL-LOCALIZATION.md): ten reviewed practices and commercial/localization review fixtures.

[Catalog review](docs/CATALOG-REVIEW.md): 23 historical records reviewed, nine source/instruction corrections and explicit remaining review scope.
