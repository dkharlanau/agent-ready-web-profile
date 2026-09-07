# SignalBraid Patch — Verified Transformation Packs

Status: **v0.1 foundation · 2026-09-07**

Transformation Packs are the stack-specific preparation layer between **SignalBraid Map** and the existing **Transformation Engine**.

They solve one narrow problem:

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

A pack does **not** write a repository, open a PR, authorize mutation, infer Search impact, or replace the Transformation Engine.

## Why packs exist

A generic recommendation such as “wire canonical metadata” is not enough to edit a real repository safely.

The source may be:

- directly owned by a static HTML file;
- generated from Jekyll source;
- ambiguous between multiple files;
- already correct;
- changed since Repository Mapper captured it;
- controlled by editorial/policy/runtime/owner state rather than a safe mechanical source file.

Transformation Packs encode the narrow recipes that can be prepared deterministically for a known stack while failing closed everywhere else.

## Shipped packs

The v0.1 registry is `registry/transformation-packs.json`.

### `static-html-core-v0.1`

Supported preparation recipes:

- `canonical-link` — inserts a same-route, same-origin canonical link only when no canonical already exists and one exact `</head>` anchor is present;
- `source-backed-jsonld` — inserts reviewed, source-grounded JSON-LD only when no existing mapped JSON-LD surface already owns the route;
- `machine-surface-replace` — replaces an exactly mapped machine surface only with reviewed grounding.

### `jekyll-core-v0.1`

Supported preparation recipes:

- `source-backed-jsonld` — only for mapped Jekyll source files that themselves expose the exact HTML insertion anchor; ordinary Markdown pages without an owned `<head>` fail closed;
- `machine-surface-replace` — replaces exactly mapped machine surfaces such as a source-owned `llms.txt` after reviewed grounding.

The Jekyll pack intentionally does not guess whether `_layouts`, plugins, includes, themes or generated output should be edited. More framework-native recipes require explicit ownership evidence first.

## Safety contract

Every pack requires the current Site State Graph to validate.

Before returning `ready`, preparation verifies:

1. the pack supports the detected Repository Mapper adapter;
2. route/surface ownership is `resolved`;
3. the selected owner exists in `files[]`;
4. generated output is not selected as source authority;
5. file role and mutation class are allowlisted by the recipe;
6. caller-supplied current source content hashes to the exact mapped SHA-256;
7. required recipe inputs exist;
8. `grounded-template` work carries reviewed grounding and evidence references;
9. recipe-specific conflict checks pass.

Any failed precondition returns `blocked`; an already-correct target returns `no-op`.

Packs never relax these existing Transformation Engine boundaries:

- explicit path allowlist;
- digest preconditions;
- policy/editorial/owner-platform/runtime changes stay gated;
- production execution needs separate authorization;
- GitHub PR delivery stays separate;
- no Search ranking, recommendation or citation uplift is predicted.

## Canonical recipe boundary

`canonical-link` is deliberately conservative.

It prepares an insertion only when:

- the requested canonical uses HTTPS;
- it is same-origin;
- it exactly equals the mapped public route URL;
- no canonical link currently exists;
- the source contains exactly one closing head tag.

An existing different canonical is **not overwritten**. Multiple canonicals are not repaired automatically. Cross-origin and cross-route canonical choices remain owner review because they can encode intentional consolidation/migration decisions.

## JSON-LD boundary

`source-backed-jsonld` requires:

- parseable JSON input;
- `reviewedGrounding=true`;
- at least one grounding evidence reference;
- exact source ownership and digest;
- no existing resolved JSON-LD surface for that route;
- one deterministic insertion anchor.

The pack serializes the supplied reviewed object; it does not invent entity facts, authorship, offers, ratings, dates or capabilities.

## Machine-surface boundary

`machine-surface-replace` is allowed only for a surface already discovered and owned by Repository Mapper and explicitly allowlisted in the recipe.

The pack does not create a new agent/API capability merely because a filename would be useful. New surface creation remains a separately grounded recommendation and transformation decision.

## CLI

List packs:

```bash
node bin/arwp-transform-pack.mjs list --adapter=static-html
```

Validate the shipped registry:

```bash
node bin/arwp-transform-pack.mjs validate
```

Prepare a canonical operation:

```bash
node bin/arwp-transform-pack.mjs prepare site-state.json \
  --pack=static-html-core-v0.1 \
  --recipe=canonical-link \
  --recommendation=canonical-discovery \
  --route=/ \
  --before=index.html \
  --inputs=canonical-input.json \
  --out=prepared-operation.json
```

Example `canonical-input.json`:

```json
{
  "canonicalUrl": "https://example.com/"
}
```

A `ready` result contains `operationSpec`, which is input for the existing Transformation Engine. The CLI itself performs no target mutation.

For grounded work:

```bash
node bin/arwp-transform-pack.mjs prepare site-state.json \
  --pack=jekyll-core-v0.1 \
  --recipe=machine-surface-replace \
  --recommendation=machine-discovery \
  --surface=machine:/llms.txt \
  --before=llms.txt \
  --inputs=llms-input.json \
  --reviewed-grounding \
  --grounding=repo:README.md
```

## Result states

### `ready`

All pack preconditions passed. The returned operation spec can be handed to Transformation Engine, which still performs its own validation and authorization gates.

### `no-op`

The exact requested state is already present. No mutation spec is produced.

### `blocked`

The pack cannot justify a safe deterministic operation. Typical reasons include:

- `ambiguous-route-ownership`;
- `source-digest-drift`;
- `existing-canonical-needs-review`;
- `multiple-canonicals-need-review`;
- `cross-origin-canonical-needs-owner-review`;
- `mutation-class-not-allowed`;
- `reviewed-grounding-required`;
- `generated-output-not-source-authority`;
- `adapter-not-supported`.

Blocked is a valid outcome, not a pack failure to be bypassed.

## Test contract

The v0.1 regression verifies:

- valid registry semantics;
- static HTML canonical preparation;
- direct handoff into Transformation Engine;
- canonical token-list detection and deterministic no-op;
- conflicting canonical fail-closed behavior;
- source digest drift rejection;
- ambiguous ownership rejection;
- editorial mutation rejection;
- reviewed grounding for JSON-LD;
- grounded Jekyll machine-surface replacement;
- no-op machine replacement;
- adapter mismatch rejection.

## Next expansion

Issue #61 tracks Transformation Packs. Issue #71 tracks additional Repository Mapper adapters.

Next adapters should be added in this order only when ownership evidence exists:

1. real-world Jekyll hardening;
2. Astro;
3. Docusaurus;
4. selected Next.js patterns where route/metadata ownership is provable without arbitrary application execution.

The #61 completion target remains at least three independently verified stack packs. v0.1 therefore establishes the architecture and first two packs; it does not claim the epic is complete.
