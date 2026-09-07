# SignalBraid Patch — Verified Transformation Packs

Status: **v0.1 · static HTML + Jekyll + Astro · 2026-09-07**

Transformation Packs are the stack-specific preparation layer between **SignalBraid Map** and the existing **Transformation Engine**.

```text
Site State Graph
  + exact source ownership
  + current source digest
  + reviewed input / grounding
  + stack-specific recipe
        ↓
read-only pack preparation
        ↓
ready | no-op | blocked
        ↓
existing Transformation Engine operation spec
```

A pack does **not** write a repository, open a PR, authorize production mutation, infer Search impact, or replace the Transformation Engine.

## Why packs exist

A recommendation such as “add canonical metadata” is not enough to edit a real repository safely. The visible page may be owned by a direct HTML file, a Jekyll source, an Astro page, a layout, runtime state, or several ambiguous sources. A file may also have changed since it was mapped.

Transformation Packs encode only the narrow operations that can be prepared deterministically for an evidenced stack. Unsupported ownership remains blocked rather than guessed.

## Shipped packs

The reviewed registry is `registry/transformation-packs.json`.

### `static-html-core-v0.1`

- `canonical-link` — same-origin, same-route canonical insertion when no canonical exists and exactly one source `</head>` anchor is present;
- `source-backed-jsonld` — reviewed, grounded JSON-LD insertion with conflict checks;
- `machine-surface-replace` — replacement of exactly mapped safe machine surfaces.

### `jekyll-core-v0.1`

- `source-backed-jsonld` — only when the mapped Jekyll source itself exposes the exact insertion anchor;
- `machine-surface-replace` — only for exactly mapped machine surfaces and reviewed grounding.

The pack does not guess `_layouts`, `_includes`, themes or plugin-generated output as mutation ownership.

### `astro-core-v0.1`

Astro uses the evidence-backed Repository Mapper adapter introduced in `docs/REPOSITORY-MAPPER.md`.

- `canonical-link` — available only for a resolved static Astro route whose exact owner is a safe page source and whose source contains one deterministic `</head>` anchor;
- `source-backed-jsonld` — same ownership/anchor requirement plus reviewed grounding;
- `machine-surface-replace` — only for safe, exactly mapped Astro `public/` machine surfaces such as sitemap, agent-discovery or API-description files.

The Astro pack intentionally blocks:

- dynamic bracket routes and `getStaticPaths()`-dependent ownership;
- server/on-demand routes without proven static prerendering;
- i18n/computed routing state not reduced by Repository Mapper;
- Markdown/MDX page sources classified as editorial;
- layout-owned `<head>` state when the route source itself has no exact insertion anchor;
- `robots.txt` policy mutation;
- `llms.txt` when mapped as editorial;
- conflicting or ambiguous route ownership.

This gives the project three independently tested stack packs without weakening Map → Patch boundaries.

## Safety contract

Before returning `ready`, preparation verifies:

1. the Site State Graph validates;
2. the pack supports the mapped adapter;
3. route/surface ownership is exactly `resolved`;
4. the selected owner exists in `files[]`;
5. generated output is not selected as source authority;
6. file role and mutation class are allowlisted by the recipe;
7. caller-supplied current source content hashes to the exact mapped SHA-256;
8. required recipe inputs are present;
9. `grounded-template` work carries reviewed grounding and evidence references;
10. recipe-specific conflict and anchor checks pass.

A failed precondition returns `blocked`. An already-correct target returns `no-op`.

Packs never relax Transformation Engine boundaries:

- explicit path allowlist;
- digest preconditions;
- policy/editorial/runtime/owner-platform gates;
- separate production authorization;
- separate GitHub delivery;
- no ranking, recommendation or citation guarantee.

## Canonical boundary

`canonical-link` prepares an insertion only when:

- the requested canonical uses HTTPS;
- it is same-origin;
- it exactly equals the mapped public route URL;
- no canonical link currently exists;
- the source contains exactly one closing head tag.

An existing different canonical is not overwritten. Multiple canonicals, cross-origin canonicals and cross-route consolidation remain owner review.

## JSON-LD boundary

`source-backed-jsonld` requires parseable JSON input, `reviewedGrounding=true`, at least one evidence reference, exact source ownership/digest and one deterministic source insertion anchor.

If Repository Mapper already records a resolved JSON-LD surface for that route, preparation blocks for review instead of appending another graph. The pack serializes supplied reviewed data; it does not invent authorship, offers, ratings, dates, entities or capabilities.

## Machine-surface boundary

`machine-surface-replace` acts only on an already mapped source-owned surface and only when its surface type and mutation class are allowlisted by the stack pack.

A useful filename is not evidence that a new capability should exist. Creating new discovery/API surfaces remains a separately grounded recommendation and transformation decision.

## CLI

List packs:

```bash
node bin/arwp-transform-pack.mjs list --adapter=astro
```

Validate the registry:

```bash
node bin/arwp-transform-pack.mjs validate
```

Prepare a canonical operation:

```bash
node bin/arwp-transform-pack.mjs prepare site-state.json \
  --pack=astro-core-v0.1 \
  --recipe=canonical-link \
  --recommendation=canonical-discovery \
  --route=/ \
  --before=src/pages/index.astro \
  --inputs=canonical-input.json \
  --out=prepared-operation.json
```

Example input:

```json
{
  "canonicalUrl": "https://example.com/"
}
```

A `ready` result contains `operationSpec`, which is input for the existing Transformation Engine. The CLI itself performs no target mutation.

For grounded work, add:

```text
--reviewed-grounding --grounding=repo:path/to/evidence
```

## Result states

### `ready`

All pack preconditions passed. The operation spec can be handed to Transformation Engine, which still performs its own validation and authorization gates.

### `no-op`

The exact requested state is already present. No mutation spec is produced.

### `blocked`

The pack cannot justify a safe deterministic operation. Examples:

- `ambiguous-route-ownership`;
- `unresolved-route-ownership`;
- `source-digest-drift`;
- `existing-canonical-needs-review`;
- `existing-jsonld-needs-review`;
- `cross-origin-canonical-needs-owner-review`;
- `mutation-class-not-allowed`;
- `unsupported-surface-type`;
- `reviewed-grounding-required`;
- `generated-output-not-source-authority`;
- `exact-single-head-close-required`;
- `adapter-not-supported`.

Blocked is a valid outcome, not a condition to bypass.

## Verification contract

Regression coverage now includes:

- static HTML canonical/JSON-LD preparation;
- Jekyll grounded machine-surface preparation;
- Astro real Mapper → Pack → Transformation Engine handoff;
- Astro canonical and grounded JSON-LD operations;
- Astro `public/` sitemap replacement;
- Astro server/runtime route blocking;
- Astro layout-owned-head blocking when no direct source anchor exists;
- Astro editorial `llms.txt` blocking;
- existing JSON-LD conflict blocking;
- ambiguity, source drift, conflicting canonical and gated mutation classes;
- deterministic no-op behavior;
- npm package-surface verification.

## Remaining #61 work

The original three-stack requirement is now met: static HTML, Jekyll and Astro each have a verified pack.

Issue #61 remains open until the second outcome is demonstrated: **safe transformation coverage must measurably increase on real portfolio sites**. That should be proven with before/after coverage receipts from representative repositories rather than inferred from synthetic tests.

Next work therefore shifts from adding generic recipes to dogfooding the packs on real sites, recording `ready / no-op / blocked` coverage and using blocked reasons to decide whether another adapter/recipe is justified.
