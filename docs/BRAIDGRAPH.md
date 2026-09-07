# BraidGraph — Evidence-to-Change Graph

Status: **implemented v0.1** · reviewed **2026-09-07**.

BraidGraph is the shared evidence-to-change index behind SignalBraid · ARWP. It connects upstream guidance to target-specific recommendations, repository transformations, implementation verification and later outcome measurements, while preserving the boundaries between those evidence classes.

The graph answers both directions of the operating loop:

```text
source → rule → recommendation → target surface/repo file → transform → verification → measurement
```

and:

```text
changed source/rule → affected recommendations → transforms → files/surfaces → re-review candidates
```

It is an index over evidence-bearing artifacts. It is not a new publisher protocol, authorization system, causal model or ranking score.

## Shipped v0.1

The implementation includes:

- `schema/braid-graph.schema.json` — strict graph contract;
- `lib/braid-graph.mjs` — compiler, validation and graph queries;
- `bin/arwp-braid.mjs` — compile/validate/explain/impact/missing-evidence CLI;
- `scripts/braid-graph-test.mjs` — deterministic regression coverage;
- `.github/workflows/braid-graph.yml` — dedicated CI.

The compiler currently consumes the existing Adaptive Site Upgrade graph and optional Transformation Bundle. It can also attach normalized implementation verification and external outcome measurement records without collapsing either into the other.

Repository Mapper, richer source revision propagation and portfolio-level graph composition remain separate follow-on layers.

## Node types

### `source`

A versioned upstream source URL used by a rule. The current compiler preserves the reviewed source date and authority supplied by the Adaptive Upgrade artifact.

### `rule`

A versioned ARWP recommendation/rule identity. Rule state preserves `current`, `review-due` or an explicit unresolved dependency state.

### `site`

The canonical target website.

### `surface`

A public or owner-side target surface referenced by a recommendation. In v0.1 a surface emitted from an Adaptive Upgrade target is explicitly marked `existence: unverified`; a recommendation target must not be relabeled as a proven deployed surface.

### `repo-file`

An exact repository path resolved by a Transformation Bundle. The node preserves repository/base evidence plus before/planned-after digests.

### `fact`

Reviewed grounding evidence attached to a deterministic transformation. A grounding string remains provenance-bearing evidence; it is not upgraded into independent truth.

### `recommendation`

A target-specific application of a rule, versioned by the exact Adaptive Upgrade artifact digest.

### `transform`

A deterministic planned repository operation from a Transformation Bundle. A bundle proves an intended operation and its preconditions; it does not prove merge or deployment. Therefore v0.1 transform nodes compile with state `planned` unless later execution evidence is supplied through a future receipt adapter.

### `verification`

Implementation evidence such as a build, test, audit or runtime check. Verification is attached to an exact transformation operation.

### `measurement`

External outcome evidence such as Search, citation, referral or runtime observations. Measurements carry evidence class and remain observational.

### `policy`

The Transformation Bundle policy/allowlist and its safety guardrails.

## Edge types

```text
source ──supports──────► rule
source ──supersedes────► source/rule
rule ──applies-to──────► recommendation
site ──has-surface─────► surface
repo-file ──renders────► surface              # reserved for Repository Mapper evidence
fact ──grounds─────────► recommendation
recommendation ──targets► surface/repo-file
recommendation ──depends-on► rule/recommendation
transform ──implements─► recommendation
transform ──mutates────► repo-file
verification ──verifies► transform
measurement ──observes─► site/surface/transform
policy ──allows/blocks─► transform/recommendation
```

Every edge has a stable ID, state, optional observation time and provenance.

## Versioning model

BraidGraph IDs separate stable identity from evidence versions.

- site and repository-file identities remain stable for the same canonical site/repository path;
- source nodes include the reviewed source version/date in their identity;
- rule nodes include the registry version;
- recommendation nodes include the exact Adaptive Upgrade digest;
- transform nodes preserve the exact Transformation Bundle operation ID;
- verification and measurement records are appendable evidence events.

A future source/rule revision therefore creates new evidence instead of silently rewriting the interpretation that existed when an earlier recommendation or transform was created.

## Compile a graph

```bash
node bin/arwp-braid.mjs compile \
  --upgrade=.arwp/adaptive-upgrade.json \
  --transform=.arwp/transformation-bundle.json \
  --out=.arwp/braid-graph.json
```

The Transformation Bundle must reference the exact SHA-256 digest of the supplied Adaptive Upgrade graph. A stale/mismatched bundle is rejected rather than connected to the wrong recommendation state.

Optional normalized evidence arrays can be attached:

```bash
node bin/arwp-braid.mjs compile \
  --upgrade=.arwp/adaptive-upgrade.json \
  --transform=.arwp/transformation-bundle.json \
  --verifications=.arwp/verification-evidence.json \
  --measurements=.arwp/measurement-evidence.json \
  --out=.arwp/braid-graph.json
```

Verification records require:

```json
{
  "id": "verify-2026-09-07-1",
  "transformOperationId": "operation-id-from-transformation-bundle",
  "status": "passed",
  "observedAt": "2026-09-07T12:06:00Z",
  "kind": "test",
  "evidence": ["CI run 123 passed"]
}
```

Measurement records require an explicit target:

```json
{
  "id": "measurement-2026-10-01-1",
  "target": {
    "type": "transform",
    "ref": "operation-id-from-transformation-bundle"
  },
  "status": "observed",
  "observedAt": "2026-10-01T00:00:00Z",
  "kind": "owner-search-observation",
  "provider": "owner-export",
  "metric": "visibility",
  "value": 12,
  "evidenceClass": "owner"
}
```

Missing owner evidence stays unknown. It is never converted to zero.

## Validate

```bash
node bin/arwp-braid.mjs validate .arwp/braid-graph.json
```

Validation checks both JSON Schema and graph semantics, including duplicate IDs and dangling edges.

## Explain why a file/change exists

Exact repository path:

```bash
node bin/arwp-braid.mjs explain .arwp/braid-graph.json --path=index.html
```

Recommendation or transform:

```bash
node bin/arwp-braid.mjs explain .arwp/braid-graph.json --recommendation=canonical-discovery
node bin/arwp-braid.mjs explain .arwp/braid-graph.json --transform=<operation-id>
```

`explain` walks the recorded upstream lineage and attaches verification/measurement evidence separately. It explains recorded provenance only; it does not infer an unrecorded reason.

## Source/rule impact

```bash
node bin/arwp-braid.mjs impact .arwp/braid-graph.json --rule=canonical-discovery
node bin/arwp-braid.mjs impact .arwp/braid-graph.json --source=https://example.org/current-guidance
```

Impact traversal walks the evidence graph through dependent recommendations, transforms, repository paths, verification and measurements. An affected node means **re-review candidate**, not breakage and not authorization to mutate production.

## Find changes with missing evidence

```bash
node bin/arwp-braid.mjs missing-evidence .arwp/braid-graph.json
```

For each transform, the queue distinguishes:

- missing implementation verification;
- missing transform-linked outcome measurement.

This is intentionally strict. A successful build does not count as a Search/AI outcome, and a site-level traffic metric is not silently attributed to one transform.

## Safety and epistemic boundaries

BraidGraph preserves these distinctions:

- source guidance vs ARWP interpretation;
- target recommendation vs authorization;
- planned transform vs merged/deployed transform;
- implementation verification vs external outcome;
- public observation vs owner evidence;
- correlation vs causality;
- historical evidence vs current best practice.

The graph can show that a measurement followed a transform. It cannot conclude that the transform caused the measurement.

## Next layers

### Repository Mapper / Site State Graph

Resolve rendered public surfaces to owning source files, generators and source-of-truth facts. This will add trustworthy `repo-file → renders → surface` edges instead of guessing ownership.

### Change Receipts

Attach executed mutation, verification, deployment and later outcome evidence to the graph without rewriting historical artifacts.

### SignalBraid Watch

Use source/rule revisions and BraidGraph reverse traversal to generate portfolio re-review queues.

### Portfolio graph

Compose multiple site graphs while keeping private owner evidence, competitor cohorts and longitudinal commercial data outside the public/open-core artifact by default.

## North Star

> Can SignalBraid explain and safely propagate website change from upstream evidence to exact implementation — and reverse that chain when the evidence itself changes?
