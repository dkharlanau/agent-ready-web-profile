# ARWP Site Execution Model

ARWP site application is orchestrated through modules, not through one Agent Skill per checklist item.

The canonical machine-readable composition is [`registry/site-execution-manifest.json`](../registry/site-execution-manifest.json). The canonical whole-site check inventory remains [`registry/comprehensive-site-audit.json`](../registry/comprehensive-site-audit.json). The Site Purpose & Mission contract lives in [`registry/site-purpose-mission-practices.json`](../registry/site-purpose-mission-practices.json) and is explained in [`docs/SITE-PURPOSE-MISSION-LAYER.md`](SITE-PURPOSE-MISSION-LAYER.md). The execution manifest references those contracts instead of copying their checks.

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
repository + route inventory
        ↓
site purpose contract
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

The purpose contract is intentionally above optimization. ARWP first establishes who the site helps, what outcome it creates, how it creates that outcome and what it does not claim. Search, content, structured data, footer, feeds and agent-facing representations then have a shared semantic constraint instead of independently inventing positioning.

## What belongs where

### Check or rule

Add a check to an existing canonical registry when it is one observable requirement or recommendation, for example:

- a canonical/hreflang relation;
- one image-delivery requirement;
- one structured-data relationship;
- one accessibility assertion;
- one feed invariant;
- one purpose/mission parity assertion.

A check is not an Agent Skill.

### Module

Add or split an execution module only when several checks share a materially distinct execution/evidence boundary. A module owns applicability and evidence routing for one or more audit domains.

Examples are Site Purpose & Mission, Search Foundation, Localization, Media/Image Quality and Measurement/Observability.

A module does not need a dedicated skill. Site Purpose & Mission, accessibility, performance/runtime, structured data and security/privacy can remain orchestrator-owned until they genuinely require a reusable independent workflow.

### Specialist skill

Create a specialist skill only when the capability is a reusable multi-step procedure with its own inputs, evidence semantics, verification/rollback logic or scoped references/tests.

Good examples already in ARWP include:

- `arwp-localization-quality`;
- `arwp-image-discovery`;
- `arwp-internal-discovery`;
- `arwp-search-release`;
- `arwp-measurement-os`;
- `arwp-repository-stewardship`.

Do not create a skill merely for a metadata field, one validator rule, one provider recommendation, one mission sentence or one checklist item.

### Orchestrator

`arwp-prepare-site` is the default site-application orchestrator. It owns:

- repository/stack inspection;
- complete route inventory and coverage;
- purpose compilation;
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
3. `purpose` — establish the canonical audience/problem/outcome/mechanism/boundary contract plus the visible manifesto/footer target;
4. `applicability` — decide every module as required, optional, not-applicable or unknown;
5. `execute` — run the applicable domains and specialists;
6. `repair` — apply authorized, reversible fixes;
7. `verify` — test build/output/runtime as evidence permits;
8. `re-audit` — recheck changed/affected cohorts and reconcile blast radius;
9. `surface-integrity` — reconcile human-visible and machine-visible representations across modules;
10. `receipt` — report coverage, evidence, remaining gates and tested revision/deployment identity.

Purpose precedes optimization. If owner intent cannot be inferred safely, the purpose state remains unknown/incomplete; ARWP must not manufacture a persuasive mission from keyword research merely to continue SEO work.

Repair is iterative. A resolvable required `fail`, `missing`, `stale` or `incomplete` state routes back through repair → verify → re-audit → Surface Integrity. Owner-data, credential, authorization or materially uncertain work remains an explicit gate rather than being invented or silently skipped.

## Site Purpose & Mission

`site-purpose-mission` owns the P0 `site-purpose-mission-alignment` domain.

Its source of truth is `registry/site-purpose-mission-practices.json`. The contract requires a purpose that is useful even when organic Search traffic is zero and covers, at minimum:

- primary audience;
- user problem or need;
- desired outcome;
- mechanism or approach;
- distinct contribution;
- scope boundaries / anti-purpose;
- supporting evidence;
- primary user action.

The human-visible projections normally include clear homepage/primary-entry copy and a compact shared-footer mission. An About/Mission/Method page is added only when it has independent user value.

The purpose is then reconciled with:

- homepage Search-facing title/description and site identity;
- page jobs and information architecture;
- WebSite / publisher structured data;
- social descriptions;
- feeds;
- AI/agent-facing summaries;
- localized variants;
- CTAs and measurement definitions.

Do not claim that the mission or footer itself is a ranking factor. The layer exists to reduce product/search/entity drift and keep optimization subordinate to user value.

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

Purpose evidence has the same boundary: repository copy can prove what the project declares, but not that users understand it or that Search performance improved.

## Surface Integrity

The final pass is cross-module rather than another isolated checklist. It reconciles representations that can each be locally valid but globally inconsistent, for example:

```text
visible purpose / page
↕
footer / About / page job
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
5. Update the execution manifest and its test whenever domain ownership, stage order or specialist composition changes.

The maintenance invariant is simple: every audit domain must be owned by exactly one execution module, every referenced specialist must exist in `skills/index.json`, every site application must produce an explicit module applicability matrix, and Site Purpose & Mission must be resolved before optimization is treated as coherent.

## Verification

Run:

```bash
node scripts/site-execution-manifest-test.mjs
node scripts/agent-skills-test.mjs
```

The manifest test fails when:

- an audit domain has no module owner or multiple owners;
- the Site Purpose & Mission registry/domain/module/stage contract disappears;
- a specialist skill reference does not exist;
- stage order loses required orchestration steps;
- the execution state vocabulary drifts from Surface Integrity;
- required applicability/completion contracts disappear;
- the manifest/schema/source paths drift.

This protects composition without forcing every individual check into its own skill or duplicating the canonical check lists.
