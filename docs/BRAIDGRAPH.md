# BraidGraph — Evidence-to-Change Graph

Status: **design v0.1** · reviewed **2026-09-07**.

BraidGraph is the proposed shared data model behind SignalBraid · ARWP.

Its job is to keep the reason for a website change connected to the change itself and to make the chain queryable in both directions.

## Why another graph?

ARWP already has recommendation registries, site observations, upgrade graphs, transformation bundles, receipts, experiments and owner-data evidence. The missing abstraction is the graph that links them together across time.

Without that shared graph, the product can answer:

> What should this site do now?

But the stronger questions are:

> Why exactly was this file changed six months ago?

> Which sites depend on a recommendation whose upstream source changed today?

> Which merged changes never received outcome evidence?

> Which target-site facts were grounded in repository evidence and which still depend on owner review?

BraidGraph is intended to answer those questions without inventing causality or authority.

## Core node types

### `source`
A primary upstream source, specification, vendor documentation page, changelog or externally maintained guidance source.

Important fields:

- canonical URL;
- source owner/provider;
- reviewed timestamp;
- captured version/hash when available;
- authority/evidence class;
- current/review-due/retired state.

### `rule`
A versioned recommendation or requirement derived from one or more sources.

Important fields:

- rule ID and version;
- source edges;
- applicability conditions;
- automation class;
- review window;
- supersession/retirement history.

### `site`
A target website/repository identity.

### `surface`
A public or owner-side website surface such as a page, sitemap, robots state, structured-data block, dataset landing page, API route, MCP/A2A interface or owner analytics source.

### `repo-file`
A concrete repository path that owns, configures or materially contributes to a surface.

### `fact`
A grounded target-site fact such as organization identity, author identity, dataset version, canonical origin or product metadata.

Facts must preserve provenance. A rendered statement and a repository source-of-truth file are not automatically the same authority.

### `recommendation`
A target-specific application of a rule.

### `transform`
A deterministic intended or executed repository change.

### `verification`
Build/test/audit/runtime evidence that checks the implementation state.

### `measurement`
External outcome evidence such as Search, citation, referral, crawler or agent/runtime observation.

### `policy`
Owner/organization decisions that constrain automation or access.

## Core edge types

```text
source ──supports──────► rule
source ──supersedes────► source/rule
rule ──applies-to──────► recommendation
site ──has-surface─────► surface
repo-file ──renders────► surface
repo-file ──grounds────► fact
fact ──grounds─────────► recommendation
recommendation ──targets► repo-file/surface
recommendation ──depends-on► recommendation/rule
transform ──implements─► recommendation
transform ──mutates────► repo-file
verification ──verifies► transform/surface
measurement ──observes─► site/surface/transform
policy ──allows/blocks─► rule/transform/automation-class
```

Edges should carry timestamps and provenance where that changes interpretation.

## Required graph queries

### Forward: evidence to implementation

```text
source → rule → recommendation → repo-file → transform → verification → measurement
```

Use when explaining why work exists and whether it was completed.

### Reverse: source change blast radius

```text
changed source/rule
      ↓
active recommendations
      ↓
target sites
      ↓
previous transforms
      ↓
repo files / surfaces
```

Use when a vendor changes guidance or an ARWP rule becomes `review-due`, revised or retired.

### Reverse: file provenance

```text
repo-file → transform → recommendation → rule → source
```

Use for “why is this here?” and review/audit questions.

### Missing evidence

```text
merged transform → verification present? → owner measurement present?
```

Use to find changes whose technical state is known but whose external outcome remains unknown.

### Unsafe automation check

```text
transform → automation class → policy → grounding → allowed paths
```

Use before mutation or PR delivery.

## Time and versioning

BraidGraph must not silently rewrite history.

Rules and source evidence should be append-only/versioned enough to preserve the interpretation that existed when a change was proposed or executed.

A later source revision can make an old recommendation stale without making the historical transform disappear.

Example:

```text
rule v1 (current at merge time)
  └─ transform T17 merged

rule v2 published later
  └─ v1 superseded
  └─ T17 becomes re-review candidate
```

This lets SignalBraid Watch say “re-review this implementation” instead of pretending the original change never happened.

## BraidGraph and the existing ARWP artifacts

The graph should initially compile from existing artifacts rather than replacing them:

- `registry/search-agent-recommendations.json` → source/rule nodes;
- `registry/adaptive-upgrade-packs.json` → rule/applicability metadata;
- Growth/vertical evidence → site/surface/fact nodes;
- Adaptive Upgrade Graph → recommendation nodes;
- Transformation Bundle → transform/repo-file edges;
- build/audit receipts → verification nodes;
- visibility/agent-eval/experiment artifacts → measurement nodes;
- portfolio/private policy files → policy nodes.

The graph is an index and relationship layer over evidence-bearing artifacts, not an excuse to duplicate every full document into one giant JSON object.

## Proposed first implementation

### Phase 1 — compiler

Create:

- `schema/braid-graph.schema.json`;
- `lib/braid-graph.mjs`;
- `bin/arwp-braid.mjs`;
- graph compiler from a Growth Plan + Adaptive Upgrade Graph + Transformation Bundle;
- `validate`, `explain`, `impact` and `missing-evidence` commands.

### Phase 2 — Repository Mapper

Add framework-aware edges from rendered surfaces to owning source files and source-of-truth facts.

### Phase 3 — source impact

Connect Trend Radar/source changes to rule revisions and compute affected target-site graph nodes.

### Phase 4 — portfolio graph

Combine multiple site graphs while keeping owner-private evidence isolated from the public/open-core graph.

## Product guardrails

BraidGraph must not turn correlation into causality.

It must preserve distinctions between:

- source guidance and ARWP interpretation;
- public observation and owner-provided data;
- target-site fact and inferred hypothesis;
- recommendation and authorization;
- implementation verification and external outcome;
- historical evidence and current best practice.

A graph that collapses those distinctions would be visually impressive and epistemically useless.

## North Star

> **Can SignalBraid explain and safely propagate website change from upstream evidence to exact implementation — and reverse that chain when the evidence itself changes?**
