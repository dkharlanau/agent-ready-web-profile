# Pattern Applicability v0.1

Pattern Applicability connects Cite Goose's existing **7 Search Surface archetypes** to the versioned discoverability and anti-pattern catalogs.

It solves a specific failure mode: a large pattern library becomes less useful when every site is asked to review every pattern. A documentation resource, software product, local business and editorial publisher have different surface expectations and different likely pattern sets.

This layer does **not** create a second site taxonomy. It reuses `registry/search-surface-blueprint.json`:

- `software-product`
- `service-business`
- `editorial-news`
- `documentation-research`
- `ecommerce`
- `portfolio`
- `local-business`

## Selection model

Each profile provides a controlled crosswalk from the archetype to the discoverability corpus' native `applicability` tags.

A positive practice enters an archetype review plan only when at least one of its own applicability tags matches that profile. Patterns retain their original ID, version, evidence level, problem and measurement contract.

The profile can classify the selected practice as:

- `core-review` — closely aligned with the archetype's main operating surface;
- `supporting-review` — commonly useful but not the site's identity;
- `contextual-review` — matched by the native pattern applicability but outside the profile's main category set.

These are workflow tiers, not ranking weights.

## Unknown tags fail open to review, not to assumptions

The corpus evolves. A new pattern may introduce an applicability tag that is not yet represented in any archetype profile.

Pattern Applicability does not silently map that tag to every site and does not declare it irrelevant. `gaps` reports the missing crosswalk explicitly so repeated real-site evidence can drive a reviewed profile update.

```bash
node bin/arwp-applicability.mjs gaps --json
```

This is deliberate evidence debt.

## Anti-patterns stay review-only

Anti-patterns do not become automatic violations merely because an archetype often encounters their category. A profile may nominate a category for review, but the output remains `manual-review-candidate`.

Detector Authority still controls what automation may conclude, and the Site Pattern Graph still requires false-positive-boundary review before a manual-required anti-pattern can become `present` or `absent`.

## Surface contract

The plan carries the existing Search Surface Blueprint's `required`, `recommended` and `opportunity` surfaces for the selected archetype. Missing opportunity surfaces are not failures.

This allows one review object to answer two related but different questions:

1. What page/surface families normally matter for this kind of site?
2. Which already-versioned practices are plausible review candidates for this kind of site?

Neither question proves that a concrete site implements the pattern correctly. That evidence belongs in a Site Pattern Map.

## Operational chain

```text
Site Focus
    ↓
Search Surface archetype
    ↓
Pattern Applicability
    ↓
small archetype-aware review set
    ↓
Detector Authority + manual review
    ↓
Site Pattern Map instances
    ↓
Remediation Receipt
    ↓
Outcome observations
    ↓
Pattern Learning Loop
    └── profile/tag gaps feed back here
```

## CLI

Validate the profile registry:

```bash
node bin/arwp-applicability.mjs check
```

List profiles:

```bash
node bin/arwp-applicability.mjs list --json
```

Build a review plan:

```bash
node bin/arwp-applicability.mjs plan --archetype=documentation-research --json
```

Inspect crosswalk debt:

```bash
node bin/arwp-applicability.mjs gaps --json
```

## What this enables next

Once several portfolio sites publish Site Pattern Maps, Cite Goose can compare archetype-level observations without pretending correlation is causation. Useful questions include:

- Which patterns are repeatedly applicable but absent on documentation resources?
- Which anti-pattern review candidates recur on service sites but not software products?
- Which native applicability tags repeatedly fail to map cleanly to the current seven archetypes?
- Which opportunity surfaces repeatedly prove irrelevant and should be filtered earlier?
- Which archetype/pattern pairs have verified remediation receipts but still lack provider or user outcome evidence?

Repeated observations can justify a **review of the applicability profile**. They do not by themselves justify rewriting a pattern's evidence level or claiming a ranking effect.

## Files

- Registry: `registry/pattern-applicability-profiles.json`
- Runtime: `lib/pattern-applicability.mjs`
- CLI: `bin/arwp-applicability.mjs`
- Tests: `scripts/pattern-applicability-test.mjs`
- Source archetypes: `registry/search-surface-blueprint.json`
- Applied evidence: `.arwp/site-pattern-map.json` in each site repository
