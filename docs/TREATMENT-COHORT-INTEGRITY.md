# Treatment Cohort Integrity

Status: experimental implementation-scope evidence contract · reviewed 2026-09-09

Treatment Cohort Integrity answers a narrow question before Search/AI outcome data is interpreted:

> Which canonical routes can the repository evidence actually show changed between two reviewed revisions, and does that scope match the treatment cohort we planned to measure?

A declared treatment URL is not evidence that an implementation reached that URL. A commit hash alone is also not enough when shared templates, layouts, data sources or route-scoped metadata owners can affect multiple pages.

This report is companion implementation evidence for an experiment. It does not infer causality, rankings, citations, referrals or conversion impact.

## Inputs

The comparison consumes two valid Repository Mapper Site State Graphs for the same repository and site scope:

```text
before Site State Graph
+ after Site State Graph
+ optional declared canonical treatment URLs
→ Treatment Cohort Integrity report
```

Use explicit committed revisions where possible. The tool compares route-level source ownership, not Git timestamps or file mtimes.

## CLI

Discover the actual changed canonical-route cohort without declaring treatment:

```bash
node bin/arwp.mjs treatment-cohort compare \
  .arwp/site-state-before.json \
  .arwp/site-state-after.json \
  --output=treatment-cohort.json
```

Compare against a planned treatment cohort stored as a JSON array of canonical HTTPS URLs:

```bash
node bin/arwp.mjs treatment-cohort compare \
  .arwp/site-state-before.json \
  .arwp/site-state-after.json \
  --treatment=treatment-urls.json \
  --output=treatment-cohort.json
```

For small cohorts, treatment URLs can be repeated inline:

```bash
node bin/arwp.mjs treatment-cohort compare \
  before.json after.json \
  --treatment-url=https://example.com/page-a \
  --treatment-url=https://example.com/page-b \
  --text
```

Validate a stored report:

```bash
node bin/arwp.mjs treatment-cohort validate treatment-cohort.json
```

The CLI creates output files exclusively and will not overwrite an existing report implicitly.

## What counts as mapped route input

For each canonical route, Goose builds implementation evidence from all currently proven route-scoped source inputs:

- the resolved route document owner;
- `route.buildPath` inputs;
- resolved route-scoped ownership claims such as title, description, canonical, JSON-LD or other mapped surfaces.

This matters because a route can change without its leaf page source changing. For example, editing a shared layout can affect many routes, and editing a separately owned metadata/data source can affect one route while its document file stays byte-identical.

If a route-scoped ownership claim is unresolved or ambiguous, or a referenced mapped input is missing, the route stays `unknown`. Goose does not guess around incomplete ownership.

## Route states

### `changed`

At least one completely mapped route input changed between the two revisions.

This establishes an implementation-scope difference only. It does not prove that the rendered difference is visible, substantive, helpful or responsible for an outcome.

### `unchanged`

All completely mapped route inputs are byte-identical across the compared revisions.

If such a URL was declared as treatment, review whether the intended implementation actually reached that canonical route or whether important runtime evidence is missing.

### `added` / `removed`

A complete resolved canonical route exists on only one side of the comparison. These URLs are part of the actual changed implementation cohort.

### `unknown`

The implementation change cannot be established safely. Typical causes include unresolved ownership, incomplete inputs, a treatment URL absent from both snapshots, duplicate normalized routes, a changed mapping basis, or inconsistent same-commit snapshots.

Unknown is not unchanged.

## Declared treatment findings

When treatment URLs are supplied, the report separates:

### `declaredChangedUrls`

Declared treatment routes that have mapped implementation evidence of `changed`, `added` or `removed`.

### `declaredUnchangedUrls`

Declared treatment routes whose complete mapped inputs are byte-identical. This is a P1 review because the treatment claim and repository implementation evidence do not currently agree.

### `declaredUnknownUrls`

Declared treatment routes whose implementation cannot be proven from comparable complete evidence. Resolve ownership or collect inspected runtime/build evidence before presenting these URLs as implemented treatment.

### `changedOutsideTreatmentUrls`

Canonical routes that changed in the mapped implementation but were not declared treatment.

This is especially important for shared layouts, templates and data sources. A supposedly narrow change to one page can silently affect an entire route family. Before interpreting a route-scoped before/after experiment, either:

1. expand the treatment cohort to the actual affected scope;
2. isolate the implementation so the intended cohort is accurate; or
3. mark the experiment as contaminated and interpret the outcome accordingly.

Do not hide these routes merely to preserve the original experiment plan.

## Mapping-basis boundary

The two Site State Graphs must use the same Repository Mapper adapter/version and the same `siteRoot` for route-level input comparison.

If the framework adapter or site root changes, Goose sets the overlapping comparison to `unknown` and emits `mapping-basis-changed`. A framework/site-root migration is a separate implementation event, not a clean route-level treatment comparison.

## Same-commit drift boundary

A Git commit SHA is immutable. If two snapshots claim the same non-null `baseCommitSha` but their mapped route inputs differ, Goose converts those differences to `unknown` and emits `same-commit-drift`.

Possible causes include a dirty working tree, stale snapshot, generated/uncommitted input or inconsistent capture. Regenerate snapshots from explicit committed revisions or record the working-tree state separately. Do not treat same-commit drift as reproducible treatment evidence.

## Shared-input contamination example

Assume the declared treatment is only `/article-a`, but a shared layout used by `/`, `/article-a` and `/article-b` changes:

```text
planned treatment
  /article-a

mapped actual changed cohort
  /
  /article-a
  /article-b
```

The tool will keep `/article-a` as declared-and-changed and surface `/` and `/article-b` as changed outside treatment. This is not a judgment that the layout change is bad; it is a warning that the experiment scope is broader than declared.

## Relationship to Growth Experiment

`growth-experiment` remains the durable hypothesis/action/commit/before-after outcome record. Treatment Cohort Integrity does not replace it and v0.1 does not mutate that schema automatically.

Use this report as companion evidence before interpreting owner-side outcome movement:

```text
hypothesis
→ implementation
→ before/after Site State Graphs
→ Treatment Cohort Integrity
→ verified treatment scope / contamination state
→ owner-side outcome comparison
→ keep / revise / revert / retire
```

A clean cohort report makes the implementation boundary more defensible. It still does not establish causal attribution.

## Guardrails

Treatment Cohort Integrity explicitly preserves these boundaries:

- no causal inference;
- no ranking or citation promise;
- digest change is not proof of visible or significant change;
- digest equality is not proof of rendered equality when runtime inputs are outside the mapper;
- shared mapped inputs can expand the actual treatment cohort;
- unresolved evidence remains unknown;
- mapping-basis changes fail closed;
- same-commit input drift fails closed;
- no composite treatment/SEO score.

The objective is not to make experiments look cleaner. It is to make the implemented cohort honest enough that later measurements are worth interpreting.
