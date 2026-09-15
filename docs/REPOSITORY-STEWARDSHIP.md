# Repository Stewardship Layer

Repository Stewardship is the ARWP layer for keeping website repositories understandable, safe to change and cheap to maintain as they grow.

It complements site-quality, Search, localization and agent-readiness work. It does not replace them and it does not treat repository tidiness as a ranking or citation signal.

Canonical Agent Skill: [`skills/arwp-repository-stewardship/SKILL.md`](../skills/arwp-repository-stewardship/SKILL.md).

## Problem

Long-lived repositories accumulate several forms of structural entropy:

- generated and canonical files become hard to distinguish;
- temporary/local output gets committed;
- old guides continue to look current;
- multiple backlogs or checkpoint files compete for authority;
- tests, fixtures and evidence look removable because they are not runtime code;
- agents spend context reading mirrors, dependency output or historical artifacts before finding the source of truth;
- maintainers cannot quickly answer what must be changed, regenerated and verified for a task.

The cost is not only repository size. The bigger cost is uncertainty: every change requires rediscovering architecture and every cleanup carries regression risk.

## Stewardship loop

```text
resolve current HEAD and repository policy
→ inventory important surfaces
→ classify canonical / runtime / verification / generated / evidence / candidate / unknown
→ map source → output → verification
→ remove or consolidate only proven dead weight
→ improve AGENTS.md / REPO_MAP.md routing
→ install lightweight drift checks
→ run focused + normal verification
→ leave explicit debt for unresolved uncertainty
```

## Repository map contract

A useful map is task-oriented, not a dump of every path.

Recommended columns:

| Task | Canonical source | Coupled/generated outputs | Focused verification | Publication/runtime effect |
| --- | --- | --- | --- | --- |
| Example content page | content registry / source Markdown | generated HTML, sitemap entry | site/content tests | public page changes |
| Example localization | source locale + glossary | locale bundles, localized metadata | localization parity checks | localized public surface |
| Example CI contract | validation manifest | workflows/package scripts | validation-contract test | repository-only unless workflow publishes |

The map should answer where to edit, what else changes, what to regenerate, what to test and whether a mutation can publish/deploy.

## Safe cleanup rule

Repository cleanup must be evidence-gated.

A file is not safe to delete merely because it is old, unfamiliar or unreferenced by one text search. Before consequential deletion, establish that it is not a canonical source, live runtime/package dependency, build/release input, test/fixture/schema, committed publication requirement, migration, benchmark/provenance record or other unique reproducibility evidence.

If the role is still unclear, keep it and record the missing evidence.

This rule intentionally favors a slightly larger understandable repository over a smaller repository that lost verification or provenance.

## Recommended navigation baseline

For repositories large enough to justify durable agent navigation:

- `AGENTS.md` — how to work safely in the repository, authority/publication boundaries, invariants, start-here routes and verification expectations;
- `REPO_MAP.md` — task-to-source-to-output-to-check routing;
- README — product/user entry point rather than a second architecture manual;
- one durable roadmap/state mechanism plus live issues for actionable work;
- scoped subsystem instructions only where they reduce root-level noise.

Add a `not first reads` section for generated mirrors, dependency output, historical milestones or other paths that are useful evidence but poor starting points.

## Drift protection

Repository stewardship should remain lightweight. Useful checks include:

- repository-map and AGENTS links still resolve;
- required navigation files still exist;
- local workstation paths do not leak into durable repository memory;
- generated/public mirror ownership remains explicit;
- exact mirrors stay equal when equality is the contract;
- build/local output remains ignored;
- parallel current backlogs do not silently become competing sources of truth.

Avoid a composite repository-health score. Keep failures inspectable and actionable.

## When to run it

Run Repository Stewardship:

- before a deep ARWP/site audit when repository entropy makes source ownership unclear;
- after a large migration, generator change or architecture refactor;
- after a long agent-development cycle with many temporary docs/branches/artifacts;
- periodically on repositories with frequent autonomous edits;
- before handing a project to another maintainer or coding agent;
- when a repository feels slow to understand even though tests are green.

## Relationship to Repository Dream

Repository Dream-style consolidation is a compatible execution pattern for this layer:

`AUDIT → classify → map → consolidate safely → verify → refresh navigation`.

The Stewardship layer turns that pattern into a reusable ARWP contract with explicit deletion gates, navigation outputs and drift protection. It should never become a license to delete aggressively.

## Completion evidence

A stewardship pass should leave:

- audited ref/HEAD;
- material removed, merged, moved and intentionally retained;
- evidence behind consequential removals;
- updated canonical navigation/map surfaces;
- clarified source/generated/public ownership;
- verification results;
- unresolved unknown/debt items with the exact next evidence needed.

The result is successful when future work requires less rediscovery while behavior, verification coverage, evidence and rollback safety remain intact.