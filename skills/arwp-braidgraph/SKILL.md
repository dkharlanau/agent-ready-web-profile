---
name: arwp-braidgraph
description: Trace why a website change exists, connect repository transformations back to evidence and rules, identify missing verification or outcome evidence, and compute source/rule change blast radius through the canonical ARWP BraidGraph instead of inventing a parallel provenance model. Use for change explanation, stale-guidance review, audit, impact analysis and evidence follow-up.
license: PolyForm-Strict-1.0.0
compatibility: Requires a valid ARWP BraidGraph. Transformation-level provenance is strongest when the graph includes a Transformation Bundle; revision analysis can add explicit Braid history evidence.
metadata:
  standard: agent-skills
  arwp-role: evidence-change-provenance
---

# ARWP BraidGraph

Use this skill when the question is not merely **what should the site change?**, but **why does a change exist, what evidence supports it, what depends on it, and what evidence is still missing?**

## Core rule

Do not create a second ad-hoc provenance graph in notes, issues or agent memory when a valid BraidGraph can represent the relationship.

The canonical chain is:

`source → rule → recommendation → surface/repo-file → transform → verification → measurement`

Keep the evidence classes distinct. A recommendation is not authorization, a planned transform is not a deployment, verification is not a Search/AI outcome, and an observed ranking/citation movement is not proof of causality.

## Sources of truth

Read only what is needed:

- `docs/BRAIDGRAPH.md`;
- `schema/braid-graph.schema.json`;
- the target BraidGraph artifact;
- its referenced Adaptive Upgrade Graph and Transformation Bundle when deeper evidence is required;
- explicit Braid revision evidence for superseded source/rule history;
- Change Receipts / owner measurement evidence when those artifacts exist.

Do not infer missing source history, repository ownership, deployment state or owner metrics.

## Workflow

1. **Validate first.** Reject invalid graphs, duplicate IDs, dangling edges or mismatched transformation lineage before reasoning from them.
2. **Choose the question type.**
   - `explain` for “why is this file/change/recommendation here?”;
   - `impact` for “what should be re-reviewed because this source/rule changed?”;
   - `missing-evidence` for “which transformations still lack implementation or outcome evidence?”
3. **Trace recorded provenance only.** If the graph does not contain the relationship, return it as unknown/unmapped rather than inventing an edge.
4. **Preserve time.** When explicit source/rule revision evidence exists, enrich the graph with prior version nodes and `supersedes` edges. Do not rewrite old nodes into the new truth.
5. **Treat impact as a review queue.** A changed rule can make downstream recommendations/transforms candidates for re-review; it does not automatically mean the implementation is broken or should be reverted.
6. **Keep implementation and outcome separate.** A passing build can close verification debt but cannot close ranking, AI citation, referral or business-outcome measurement debt.
7. **Keep negative evidence.** Negative, unchanged or mixed measurements stay attached to the graph and remain available for future learning.
8. **Respect mutation gates.** BraidGraph explains relationships; it never grants production authorization. Use the Target Transformation / Change Receipt controls for actual writes.
9. **Escalate ownership gaps.** If an exact rendered surface cannot be tied to an owning repository source, route that gap to Repository Mapper rather than guessing a file.
10. **Report the smallest useful result.** Return the affected nodes, exact provenance path, missing evidence class and required next review step; do not collapse the graph into a magic score.

## CLI

Compile the base graph:

```bash
node bin/arwp-braid.mjs compile \
  --upgrade=.arwp/adaptive-upgrade.json \
  --transform=.arwp/transformation-bundle.json \
  --out=.arwp/braid-graph.json
```

Add explicit source/rule history without rewriting the original artifact:

```bash
node bin/arwp-braid-history.mjs apply \
  .arwp/braid-graph.json \
  .arwp/braid-revisions.json \
  --out=.arwp/braid-graph-with-history.json
```

Explain exact repository provenance:

```bash
node bin/arwp-braid.mjs explain \
  .arwp/braid-graph-with-history.json \
  --path=index.html
```

Compute blast radius from a changed rule or source:

```bash
node bin/arwp-braid.mjs impact \
  .arwp/braid-graph-with-history.json \
  --rule=canonical-discovery
```

Find evidence debt:

```bash
node bin/arwp-braid.mjs missing-evidence \
  .arwp/braid-graph-with-history.json
```

## Decision rules

- If a source/rule is `review-due`, re-review the knowledge before executing a dependent change.
- If a historical node is `superseded` or `retired`, preserve it for explanation and history; do not silently delete old transforms.
- If a transform has no verification, implementation state remains unresolved.
- If a transform has verification but no outcome measurement, external effect remains unknown.
- If a measurement is negative or unchanged, retain it; do not hide it to make the recommendation look stronger.
- If the evidence is only site-level, do not attribute it to one transform unless an explicit transform-level relationship exists.
- If a source change affects many downstream nodes, prioritize review by evidence/state and target importance outside BraidGraph; do not reinterpret graph reachability as a ranking score.

## Hard boundaries

- Never infer ranking/citation causality from graph adjacency or timing.
- Never convert missing evidence to zero or failure.
- Never call a planned transformation merged/deployed without execution/deployment evidence.
- Never treat source authority as permission to mutate a site.
- Never expose private owner evidence, competitor cohorts or proprietary learned priors merely because the open graph schema can reference them.
- Never use BraidGraph to bypass editorial, policy, owner-platform or runtime approval gates.

## Done when

- the requested file/change/recommendation can be traced to recorded rule/source evidence, or the missing relationship is stated explicitly;
- changed source/rule impact is returned as a bounded re-review set rather than automatic breakage;
- stale/superseded history remains inspectable;
- verification debt and outcome-measurement debt are reported separately;
- negative/neutral evidence remains visible;
- no ranking, recommendation or citation guarantee is inferred from the graph.
