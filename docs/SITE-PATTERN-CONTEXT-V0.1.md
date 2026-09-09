# Site Pattern Context v0.1

A Site Pattern Context records the **purpose archetype** and the **capability facets that are actually present** before Cite Goose selects patterns for review.

It exists because these are different dimensions:

- `documentation-research` describes why a site exists;
- `static-delivery`, `machine-interfaces`, `dataset-publication` and `localization` describe surfaces or operating capabilities it may have.

Treating every capability as an archetype creates huge pseudo-personas. Treating every archetype as if it had every capability recreates a universal checklist. The context keeps the dimensions separate.

## Required provenance

Each `.arwp/pattern-context.json` pins:

- Site Focus v0.3;
- exact Cite Goose runtime commit;
- Pattern Applicability version;
- one existing Search Surface archetype;
- zero or more reviewed capability facets;
- review basis and date;
- rationale;
- known unknowns.

A floating `main` ref is invalid. This makes the selected review set reproducible when the central corpus or crosswalk changes later.

## Facets

The canonical registry is `registry/pattern-applicability-facets.json`.

Current facets cover orthogonal capabilities such as:

- interactive JavaScript/forms;
- machine interfaces and OpenAPI/schema surfaces;
- dataset publication;
- maintained editorial publishing;
- localization;
- research/evaluation;
- versioned project lifecycle;
- static delivery;
- video;
- commerce catalogs;
- community content.

A facet must be declared or observed. Its absence from the context is **unknown**, not evidence that all related practices are irrelevant.

## Selection rule

The bounded review set uses:

```text
universal tags
+ archetype tags
+ declared facet tags
```

A positive pattern enters the plan only when its own versioned `applicability` list intersects that set.

Anti-patterns remain review candidates; the facet model does not bypass Detector Authority or false-positive review.

## Gap invariant

Every applicability tag currently used by the discoverability corpus must have at least one owner:

- universal;
- archetype;
- facet.

The CI fails when a new corpus tag is introduced without a reviewed mapping. This is intentional. Pattern-library growth must not silently broaden which sites receive a recommendation.

```bash
node bin/arwp-applicability.mjs gaps --json
```

## Validate a site context

```bash
node bin/arwp-applicability.mjs context path/to/.arwp/pattern-context.json --json
```

The output includes the pinned context, the archetype/facet-aware review plan and the site's explicit known unknowns. It does not claim that selected patterns are present or beneficial; those observations belong in the Site Pattern Map.

## Relationship to the learning loop

```text
Site Focus
  ↓
Pattern Context (archetype + facets)
  ↓
Pattern Applicability
  ↓
Detector Authority / review
  ↓
Site Pattern Map
  ↓
Receipt + outcomes
  ↓
Pattern Learning Loop
  └─ repeated context/tag gaps → reviewed crosswalk update
```

This lets real portfolio sites improve the selection model without converting portfolio correlation into a ranking theory.
