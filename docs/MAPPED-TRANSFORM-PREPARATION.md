# Mapped Transformation Preparation

Status: **v0.1 · read-only handoff · 2026-09-07**

This layer connects SignalBraid **Map** to **Patch** without turning ownership evidence into mutation authority.

Repository Mapper can now answer not only:

> Which source file owns this surface?

but also:

> For the currently applicable Adaptive Upgrade recommendations, which exact repository paths are safe candidates for Transformation Engine authoring, and what current file digest must the author respect?

The handoff is deliberately incomplete by design. It resolves **where**, not **what to write**.

## Flow

```text
Adaptive Upgrade Graph
        +
Site State Graph
        ↓
resolve recommendation target → mapped surface
        ↓
require one proven non-ambiguous owner
        ↓
apply automation + mutation-class gates
        ↓
Mapped Transformation Preparation
        ↓
repository + allowedPaths + current SHA-256 + candidate context
        ↓
agent/human resolves after-state + grounding
        ↓
Transformation Engine compiles exact operation
        ↓
SHA-256/precondition/authorization checks run again
```

## CLI

```bash
node bin/arwp-map-repo.mjs prepare-transform \
  adaptive-upgrade.json \
  site-state.json \
  --out=mapped-transform.json
```

Limit the preparation to reviewed recommendations when useful:

```bash
node bin/arwp-map-repo.mjs prepare-transform \
  adaptive-upgrade.json \
  site-state.json \
  --recommendations=sitemap-maintenance,agent-discovery \
  --out=mapped-transform.json
```

Validate the durable handoff artifact:

```bash
node bin/arwp-map-repo.mjs validate-transform-prep mapped-transform.json
```

A compact review view is also available:

```bash
node bin/arwp-map-repo.mjs prepare-transform adaptive-upgrade.json site-state.json --text
```

## Output contract

`schema/mapped-transform-preparation.schema.json` records:

- exact target site;
- repository, base ref, optional pinned base commit and site root;
- SHA-256 of the Adaptive Upgrade Graph;
- SHA-256 of the Site State Graph;
- a Transformation Engine `specSkeleton` containing repository metadata, mapped `allowedPaths` and intentionally empty `operations`;
- one candidate per resolved recommendation/path;
- current mapped file SHA-256;
- source surface keys and original recommendation target labels;
- allowed deterministic operation families;
- whether first-party grounding is still required;
- verification checks inherited from the recommendation;
- explicit blockers for recommendations that cannot safely cross the Map → Patch boundary.

## Why `operations` is empty

Repository ownership cannot determine truthful after-state content.

A mapped canonical, sitemap, JSON-LD or agent-discovery surface may tell the system which file owns the value. It does not automatically tell the system what new value is correct.

Therefore preparation emits:

```json
{
  "specSkeleton": {
    "repository": {
      "fullName": "owner/site",
      "baseRef": "main",
      "baseCommitSha": "..."
    },
    "allowedPaths": ["sitemap.xml"],
    "operations": []
  }
}
```

The next authoring step must deliberately provide the Transformation Engine operation, before content and intended after-state. `grounded-template` operations still require reviewed first-party evidence.

## What becomes `ready`

A candidate is ready only when all of the following hold:

- the Adaptive Upgrade recommendation is `recommended`;
- its knowledge state is `current`;
- its automation class is `mechanical` or `grounded-template`;
- Repository Mapper produced a single safe candidate path;
- the mapped file still exists in the Site State Graph;
- the mapped file is not editorial, policy-gated, runtime, owner-platform or blocked.

`ready` means **ready for operation authoring**, not authorized for production mutation.

## What remains blocked

The preparation preserves blockers such as:

- conditional/inactive recommendation;
- `review-due` knowledge;
- non-executable automation class;
- unresolved target vocabulary;
- ambiguous repository ownership;
- no safe resolved owner;
- mapped file missing;
- policy/editorial/runtime/owner-controlled mutation class.

Blocked candidates never enter `allowedPaths`.

## Current file digest

Each ready candidate carries the SHA-256 observed by Repository Mapper. This gives the operation author a stable review reference.

The digest is **not** accepted as sufficient execution proof. Transformation Engine still reads/compiles exact before content and rechecks its own preconditions before local apply or production PR delivery.

## Production base commit

The handoff reports whether `repository.baseCommitSha` was pinned when the map was created.

A preparation can still be useful for local authoring when the SHA is absent. Production PR delivery remains subject to Transformation Engine's stronger base-commit and repository-state gates.

## Guardrails

- map evidence does not authorize mutation;
- ambiguous ownership never becomes an allowed path;
- policy/editorial/runtime/owner-controlled surfaces stay gated;
- after-state content is never invented by the handoff;
- `grounded-template` facts still require reviewed grounding;
- Transformation Engine remains the mutation/precondition authority;
- implementation success is not Search ranking, recommendation or AI-citation evidence.
