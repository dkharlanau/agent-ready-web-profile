# SignalBraid Patch — Verified Transformation Packs

Status: **v0.1 · static HTML + Jekyll + Astro + experimental Next.js App Router · 2026-09-07**

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

A recommendation such as “add canonical metadata” is not enough to edit a real repository safely. The visible page may be owned by a direct HTML file, a Jekyll source, an Astro page, a Next.js metadata route, a layout, runtime state, or several ambiguous sources. A file may also have changed since it was mapped.

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

- `canonical-link` — only for a resolved static Astro route whose exact owner is a safe page source and whose source contains one deterministic `</head>` anchor;
- `source-backed-jsonld` — same ownership/anchor requirement plus reviewed grounding;
- `machine-surface-replace` — only for safe, exactly mapped Astro `public/` machine surfaces such as sitemap, agent-discovery or API-description files.

Dynamic bracket routes, server/runtime ownership, unresolved i18n/config, Markdown/MDX editorial sources, layout-owned head state, crawler policy, editorial `llms.txt`, ambiguous ownership and conflicting existing metadata remain blocked.

### `nextjs-app-router-v0.1` — experimental

The Next.js pack starts narrower than the Mapper adapter on purpose.

It currently exposes only:

- `machine-surface-replace` for exactly mapped, non-policy App Router metadata/machine surfaces such as `sitemap.ts`, manifest metadata routes, and future agent/API surfaces when those capabilities genuinely exist.

The recipe requires:

- exact Next.js Mapper ownership;
- current source digest match;
- `reviewedGrounding=true`;
- at least one grounding evidence reference;
- a surface type and mutation class explicitly allowed by the pack.

It intentionally does **not** automate:

- `robots.ts` crawler-policy mutation;
- dynamic `[segment]` routes;
- Pages Router sources;
- page canonical or JSON-LD mutation through arbitrary React/Server Component code;
- values produced by `generateMetadata()`;
- rewrite/runtime behavior;
- creation of capabilities or discovery surfaces that the target does not actually have.

This means “Next.js supported” does not imply “arbitrary TSX rewriting supported.” v0.1 only prepares transformations where Map can prove a concrete owning file and Patch can preserve the existing safety model.

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

The Next.js experimental pack does not yet expose this recipe because App Router canonical ownership is often inherited or computed through Metadata APIs rather than a deterministic literal page-source `<head>` anchor.

## JSON-LD boundary

`source-backed-jsonld` requires parseable JSON input, `reviewedGrounding=true`, at least one evidence reference, exact source ownership/digest and one deterministic source insertion anchor.

If Repository Mapper already records a resolved JSON-LD surface for that route, preparation blocks for review instead of appending another graph. The pack serializes supplied reviewed data; it does not invent authorship, offers, ratings, dates, entities or capabilities.

The Next.js experimental pack does not expose arbitrary JSON-LD TSX insertion in v0.1.

## Machine-surface boundary

`machine-surface-replace` acts only on an already mapped source-owned surface and only when its surface type and mutation class are allowlisted by the stack pack.

A useful filename is not evidence that a new capability should exist. Creating new discovery/API surfaces remains a separately grounded recommendation and transformation decision.

For Next.js, Ptichi was the first real portfolio ownership case inspected through the connected GitHub integration: `src/app/sitemap.ts`, `src/app/robots.ts`, and `src/app/manifest.ts` are explicit App Router metadata sources. The pack can prepare a grounded sitemap/manifest replacement, while `robots.ts` remains blocked by the policy mutation class. Because Ptichi is private, ARWP does not copy its source into public fixtures and CI does not request a cross-repository secret.

## CLI

List packs:

```bash
node bin/arwp-transform-pack.mjs list --adapter=nextjs
```

Validate the registry:

```bash
node bin/arwp-transform-pack.mjs validate
```

Example generic prepare call:

```bash
node bin/arwp-transform-pack.mjs prepare site-state.json \
  --pack=nextjs-app-router-v0.1 \
  --recipe=machine-surface-replace \
  --recommendation=reviewed-sitemap-update \
  --surface=machine:/sitemap.xml \
  --before=src/app/sitemap.ts \
  --inputs=machine-input.json \
  --reviewed-grounding \
  --grounding=repo:reviewed-route-inventory \
  --out=prepared-operation.json
```

A `ready` result contains `operationSpec`, which is input for the existing Transformation Engine. The CLI itself performs no target mutation.

## Result states

### `ready`

All pack preconditions passed. The operation spec can be handed to Transformation Engine, which still performs its own validation and authorization gates.

### `no-op`

The exact requested state is already present. No mutation spec is produced.

### `blocked`

The pack cannot justify a safe deterministic operation. Examples include:

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

Regression coverage includes:

- static HTML canonical/JSON-LD preparation;
- Jekyll grounded machine-surface preparation;
- Astro Mapper → Pack → Transformation Engine handoff;
- Astro canonical/JSON-LD/machine surfaces and runtime/editorial/ambiguity blocking;
- Next.js App Router static/dynamic ownership boundaries;
- Next.js reviewed-grounding requirement;
- Next.js source-digest drift blocking;
- Next.js deterministic no-op behavior;
- Next.js sitemap operation preparation;
- policy-gated `robots.ts` ownership;
- a structural Next.js regression that mirrors the observed Ptichi ownership pattern without copying private source;
- real Ptichi ownership checked through the connected GitHub integration during development;
- npm package-surface verification.

## Remaining #61 work

The original minimum three-stack requirement is exceeded: static HTML, Jekyll and Astro are active, with experimental Next.js App Router support added from real portfolio demand.

Issue #61 remains open for two useful reasons rather than for pack count:

1. Docusaurus still needs a dedicated reproducible ownership adapter/pack if portfolio evidence justifies it;
2. safe transformation coverage should be measured on real portfolio repositories through `ready / no-op / blocked` receipts, not inferred from synthetic fixtures.

The next expansion should be driven by real blocked reasons. A new generic recipe is not automatically an improvement if ownership or review evidence remains ambiguous.
