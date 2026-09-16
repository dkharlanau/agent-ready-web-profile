# ARWP Site Execution Model

ARWP site application is orchestrated through modules, not through one Agent Skill per checklist item.

The canonical machine-readable composition is [`registry/site-execution-manifest.json`](../registry/site-execution-manifest.json). The canonical whole-site check inventory remains [`registry/comprehensive-site-audit.json`](../registry/comprehensive-site-audit.json). The execution manifest references those domains instead of copying their checks.

## Architecture

```text
rules / practice registries
        ↓
audit domains / contracts
        ↓
execution modules
        ↓
optional specialist skills
        ↓
arwp-prepare-site orchestrator
        ↓
site-specific applicability matrix
        ↓
implementation + evidence
        ↓
verification / re-audit
        ↓
Surface Integrity
        ↓
completion receipt
```

This separation exists so ARWP can keep growing without turning every meta tag, image attribute, schema field or validator assertion into a separate skill.

## What belongs where

### Check or rule

Add a check to an existing canonical registry when it is one observable requirement or recommendation, for example:

- a canonical/hreflang relation;
- one image-delivery requirement;
- one structured-data relationship;
- one accessibility assertion;
- one feed invariant.

A check is not an Agent Skill.

### Module

Add or split an execution module only when several checks share a materially distinct execution/evidence boundary. A module owns applicability and evidence routing for one or more audit domains.

Examples are Search Foundation, Localization, Media/Image Quality and Measurement/Observability.

A module does not need a dedicated skill. Accessibility, performance/runtime, structured data and security/privacy can remain orchestrator-owned until they genuinely require a reusable independent workflow.

### Specialist skill

Create a specialist skill only when the capability is a reusable multi-step procedure with its own inputs, evidence semantics, verification/rollback logic or scoped references/tests.

Good examples already in ARWP include:

- `arwp-localization-quality`;
- `arwp-image-discovery`;
- `arwp-internal-discovery`;
- `arwp-search-release`;
- `arwp-measurement-os`;
- `arwp-repository-stewardship`.

Do not create a skill merely for a metadata field, one validator rule, one provider recommendation or one checklist item.

### Orchestrator

`arwp-prepare-site` is the default site-application orchestrator. It owns:

- repository/stack inspection;
- complete route inventory and coverage;
- applicability decisions;
- module sequencing;
- specialist composition;
- safe remediation;
- verification and re-audit;
- cross-module integrity;
- final coverage/evidence receipt.

A specialist contributes evidence to a module. It never substitutes for whole-site coverage.

## Execution flow

Every site-wide ARWP application uses the manifest stages in order:

1. `inspect` — establish repository, stack, source/build/deploy ownership and available evidence layers;
2. `inventory` — reconcile canonical pages, aliases, templates/archetypes and locales;
3. `applicability` — decide every module as required, optional, not-applicable or unknown;
4. `execute` — run the applicable domains and specialists;
5. `repair` — apply authorized, reversible fixes;
6. `verify` — test build/output/runtime as evidence permits;
7. `re-audit` — recheck changed/affected cohorts and reconcile blast radius;
8. `surface-integrity` — reconcile human-visible and machine-visible representations across modules;
9. `receipt` — report coverage, evidence, remaining gates and tested revision/deployment identity.

Repair is iterative. A resolvable required `fail`, `missing`, `stale` or `incomplete` state routes back through repair → verify → re-audit → Surface Integrity. Owner-data, credential, authorization or materially uncertain work remains an explicit gate rather than being invented or silently skipped.

## Applicability matrix

Before implementation, produce one row for every execution module. A row records at least:

```text
moduleId
applicability
reason
state
evidenceClasses
evidence
findings
verification
remediation
```

The allowed applicability states are:

- `required`;
- `optional`;
- `not-applicable`;
- `unknown`.

The result states reuse the generic Surface Integrity vocabulary:

- `pass`;
- `fail`;
- `warning`;
- `stale`;
- `missing`;
- `incomplete`;
- `intentionally-excepted`;
- `not-applicable`;
- `not-assessed`.

`not-applicable` always needs a reason. `unknown` applicability cannot silently become a pass. If it cannot be resolved, the overall coverage claim remains partial/unknown as defined by the comprehensive audit contract.

## Evidence classes

Checks are classified by the evidence they need rather than by how easy they are to automate:

- `deterministic` — source/build/HTTP facts that can be asserted mechanically;
- `heuristic` — quality judgment that needs bounded human/agent interpretation;
- `runtime` — rendered browser, interaction, network or responsive behavior;
- `owner-platform` — Search Console/Bing/analytics/field metrics/crawler logs or other owner-only platform evidence.

Do not convert one evidence class into another. Source markup is not runtime proof and a build pass is not Search/AI outcome evidence.

## Surface Integrity

The final pass is cross-module rather than another isolated checklist. It reconciles representations that can each be locally valid but globally inconsistent, for example:

```text
visible page
↕
canonical / redirects
↕
hreflang
↕
sitemap
↕
JSON-LD entity graph
↕
Open Graph / preferred image
↕
RSS / machine feeds
↕
internal links
↕
AI / agent-facing representations
```

ARWP already provides the generic Surface Integrity engine in `lib/surface-integrity.mjs`. Site execution reuses that state/evidence model rather than creating a second incompatible quality vocabulary.

## Maintaining ARWP

When adding a new requirement, use this decision order:

1. Can it be expressed as a check in an existing audit/practice registry? Add it there.
2. Does it fit an existing execution module? Map it there; do not create a skill.
3. Does it require a materially different evidence/execution boundary? Only then add or split a module.
4. Is it a reusable independent multi-step workflow with its own references/tests/verification? Only then create a specialist skill.
5. Update the execution manifest and its test whenever domain ownership or specialist composition changes.

The maintenance invariant is simple: every audit domain must be owned by exactly one execution module, every referenced specialist must exist in `skills/index.json`, and every site application must produce an explicit module applicability matrix.

## Verification

Run:

```bash
node scripts/site-execution-manifest-test.mjs
node scripts/agent-skills-test.mjs
```

The manifest test fails when:

- an audit domain has no module owner or multiple owners;
- a specialist skill reference does not exist;
- stage order loses required orchestration steps;
- the execution state vocabulary drifts from Surface Integrity;
- required applicability/completion contracts disappear;
- the manifest/schema/source paths drift.

This protects composition without forcing every individual check into its own skill or duplicating the canonical check lists.
