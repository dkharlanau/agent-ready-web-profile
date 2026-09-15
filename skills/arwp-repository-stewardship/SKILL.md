---
name: arwp-repository-stewardship
description: Audit, simplify, map and maintain a website repository so humans and coding agents can understand it quickly, remove proven dead weight safely, preserve source-of-truth and evidence boundaries, and install lightweight navigation and drift checks without treating file-count reduction as a quality goal.
license: PolyForm-Strict-1.0.0
compatibility: Works with repository/file access. Git history, build/test execution and CI access improve deletion confidence but are not required for read-only audit mode.
metadata:
  standard: agent-skills
  arwp-role: repository-stewardship
---

# ARWP Repository Stewardship

Use this skill when a repository has grown hard to understand, contains suspected dead or duplicated files, has stale navigation, mixes canonical and generated artifacts, or is expensive for humans and coding agents to modify safely.

This is a repository-readiness and maintenance layer. It is not a Search ranking, AI citation or recommendation mechanism.

## Outcome

Leave the repository easier to reason about than before:

- canonical sources and generated/public outputs are distinguishable;
- proven dead weight is removed or consolidated;
- useful tests, schemas, fixtures, provenance and historical evidence are preserved;
- `AGENTS.md` and/or `REPO_MAP.md` route maintainers to the right source and verification path;
- duplicated current roadmaps/checkpoints are collapsed into one durable source of truth;
- build/test/release boundaries remain intact;
- uncertainty becomes explicit debt instead of deletion.

Optimize for comprehension cost, maintenance cost, agent navigation speed, architectural coherence, reproducibility and regression resistance. Do not optimize for the smallest possible repository.

## Modes

`AUDIT` — inspect and classify only. Produce an evidence-backed cleanup and navigation plan. Do not mutate files.

`EXECUTE` — perform the audit first, then apply only changes that pass the deletion/consolidation gates below. Verify the repository before completion.

When authority is unclear, stay in `AUDIT`. Tool availability never grants permission to delete, merge, publish or bypass repository policy.

## Workflow

### 1. Resolve the actual repository state

Before cleanup:

- resolve the exact repository, default branch/ref and current HEAD;
- read the nearest `AGENTS.md`, `CONTRIBUTING.md`, README, architecture docs and repository-specific policy;
- identify build, test, generation, release and deployment commands;
- identify whether generated/public files are committed intentionally;
- identify active issues/roadmap/checkpoint sources before inventing another backlog.

Do not assume a local checkout or CLI exists. Prefer the connected repository toolchain available in the current session and adapt the plan to its actual capabilities.

### 2. Inventory repository surfaces

Build a bounded inventory of at least:

- root entry points and policy files;
- application/library source;
- content/data registries;
- generators/templates and generated/public output;
- tests, fixtures and examples;
- schemas/contracts/migrations;
- CI/workflows/release scripts;
- docs, architecture decisions and current roadmap/state files;
- static assets and large/binary artifacts;
- caches, local output and dependency/build directories when visible.

Also look for exact-content duplicates, near-duplicate current documentation, obsolete migration copies, one-off temporary artifacts, generated output without a clear owner and directories whose purpose cannot be explained.

### 3. Classify before deleting

Classify material into one of these states:

- `canonical-source` — authoritative source or configuration;
- `required-runtime` — needed by product/runtime/package behavior;
- `verification` — tests, fixtures, schemas or checks that protect behavior;
- `generated-output` — reproducible output with a known owner/generator;
- `published-artifact` — committed output intentionally required for hosting/distribution or a stable public URL;
- `durable-evidence` — benchmark, migration, provenance or historical evidence still required for reproducibility or decisions;
- `duplicate-candidate` — substantially duplicated by a stronger current source;
- `obsolete-candidate` — appears superseded and has no known current consumer;
- `local-artifact` — workstation/cache/build output that should normally be ignored rather than versioned;
- `unknown` — purpose or dependency cannot yet be established.

`unknown` is not a synonym for unused. A `published-artifact` may have external consumers that repository search cannot see.

### 4. Build the source-to-output map

For important surfaces, record:

`task → canonical source → coupled/generated outputs → verification → publication/runtime effect`

Prefer a task-routing map over a giant generated file tree. A useful repository map answers questions such as:

- Where do I change this behavior?
- What else is coupled to it?
- What must be regenerated?
- Which check proves the repository behavior still works?
- Does this change publish or deploy anything?

If `REPO_MAP.md` already exists, improve it instead of creating a parallel map.

### 5. Apply the deletion gate

Delete or merge a candidate only when all applicable evidence is satisfied:

1. its current purpose is understood;
2. it is not the canonical source for a live surface;
3. repository search finds no required consumer in source, build config, package metadata, CI, tests, generators, docs or release paths;
4. it is not the only copy of a schema, fixture, migration, provenance record, benchmark input or reproducibility evidence;
5. if generated, the regeneration path is known and the repository does not intentionally require the generated copy to be committed;
6. removing it does not silently reduce meaningful test or validation coverage;
7. the rollback path is ordinary version control, not reconstruction from memory;
8. the repository's focused verification is known and can be run or explicitly left as an evidence gap;
9. if it is served from a public/static root or has had a stable public URL, external-consumer and compatibility risk has been checked and removal has an explicit migration, redirect, deprecation or other justified compatibility decision.

A grep miss, old timestamp, unfamiliar filename or low reference count is not enough evidence by itself. Internal repository search cannot prove that a published URL has no external consumers.

When one gate is unresolved, keep the file and record the exact missing evidence.

### 6. Consolidate structure, not evidence

Prefer these transformations:

- merge duplicate current guides into one canonical guide plus links;
- move durable historical material under an explicit archive/history area when history is still useful;
- remove committed caches/local output and strengthen `.gitignore`;
- replace repeated hand-maintained facts with one canonical registry/template where justified;
- collapse multiple current backlog/checkpoint documents into the repository's existing issue/roadmap/state system;
- preserve small focused tests instead of deleting them merely to reduce file count;
- preserve evidence-bearing examples when they protect behavior or explain a non-obvious contract.

Do not rewrite generated output manually when an owning source/generator exists.

### 7. Install repository navigation

A healthy repository should have a short human/agent entry path. Reuse existing files when possible.

Recommended shape:

- `AGENTS.md` — mutation rules, authority/publication boundaries, source/output rules, core invariants, start-here routing and focused verification;
- `REPO_MAP.md` — task → canonical source → coupled surface → focused verification;
- README — product/user entry point, not a duplicate architecture manual;
- one durable roadmap/state source plus live issues for actionable work;
- scoped instructions near complex subsystems only when root instructions would become noisy.

Include a `not first reads` section for dependency output, generated mirrors or historical artifacts that agents commonly waste context on.

### 8. Add drift protection where the repository benefits

Prefer lightweight checks that fail on structural drift rather than heavyweight repository scoring. Examples:

- links in `AGENTS.md` / `REPO_MAP.md` must resolve;
- required canonical navigation files must exist;
- workstation-local paths must not leak into durable repository memory;
- generated output ownership must remain explicit;
- public mirrors must match canonical sources when exact mirroring is the contract;
- current roadmap/state sources must not multiply silently;
- ignored local/build output must remain ignored.

Do not invent a composite repository-health score. Findings should stay inspectable.

### 9. Re-run repository verification

After cleanup or map changes:

- run the narrowest checks coupled to changed surfaces;
- run the normal build/test boundary when structure, package/public files or CI routing changed;
- inspect generated output when a source/generator relationship changed;
- verify exact changed paths and the tested commit/ref;
- verify deployment separately when the cleanup affects publication.

Passing repository checks does not prove Search ranking, AI citation, production adoption or business impact.

### 10. Leave a concise stewardship record

Report:

- audited ref/HEAD;
- files/directories removed, merged, moved or intentionally retained;
- deletion evidence for each consequential removal;
- new/updated canonical maps and instructions;
- source-to-output relationships clarified;
- tests/CI/ignore rules added or repaired;
- unresolved `unknown` / debt items and the exact evidence needed next;
- verification commands/results and tested revision.

## Integration with other ARWP skills

Use Repository Stewardship before `arwp-prepare-site` when repository entropy makes the site hard to inspect safely, and after large transformations when navigation or generated/source boundaries changed.

Use it with:

- `arwp-portfolio-fleet` to identify repositories with high comprehension/maintenance cost;
- `arwp-target-transformation` to preserve exact source/output and verification routes after implementation;
- `arwp-evidence-ci` to turn important structural invariants into CI checks;
- `arwp-braidgraph` when deletion/consolidation decisions depend on provenance or evidence lineage.

## Anti-patterns

Do not:

- delete tests, fixtures or schemas because they are not runtime code;
- treat old files as dead solely because of age;
- treat an unreferenced file as safe to delete without checking generation, release, evidence and public-compatibility roles;
- delete a stable public/static-root artifact merely because internal repository search finds no references;
- create a giant auto-generated tree and call it repository understanding;
- create `ROADMAP-2.md`, `TODO-new.md` or agent-session checkpoint files when a current issue/roadmap system already exists;
- manually edit generated/public mirrors when a canonical source owns them;
- reduce validation coverage to make cleanup pass;
- use file count, repository size or deletion volume as the success metric.

The success condition is lower comprehension and maintenance cost with preserved behavior, evidence, public compatibility and rollback safety.