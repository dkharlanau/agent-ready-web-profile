# Cognitive Biases localization dogfood

This reference records implementation lessons from applying the ARWP localization-quality model to the Cognitive Biases knowledge site. Treat it as a reusable pattern, not as a required file layout.

This file is intentionally updated from the real repository state. Locale roles, public routes and machine surfaces can evolve. Do not copy an old dogfood snapshot back into a target repository as if it were current truth.

## Current locale roles and the first lesson

At the 2026-09-14 closure pass, Cognitive Biases exposes:

- `en` as the canonical locale;
- `fr` and `es` as reviewed human-interface locales with full declared Search publication;
- `de`, `ru`, `pt-BR` and `it` as reviewed partial human-interface locales with explicit coverage boundaries.

Earlier dogfood passes described `de` and `ru` as routing-only. That later became false because the product expanded. The reusable lesson is stronger than the old snapshot:

> Locale role must come from the current machine-readable locale contract, not from memory, old documentation or a previous release.

A machine-routing surface is also not the same thing as a locale role. A human-interface locale may publish `llms.txt` or Agent Skills, while a routing-only locale may have no human pages. Model those as separate surfaces.

## Layer 1: keep deep locale-specific checks

Cognitive Biases already had strong language-specific checks. These verify exact canonical/localized library coverage, required fields, reviewed state, source release, generated routes, canonical URLs, reciprocal `hreflang`, sitemap membership, structured-data language, localized machine surfaces and domain-specific evidence boundaries.

Do not replace strong domain-specific validation merely to make CI look generic. Add generic orchestration above it first.

## Layer 2: add a generic localization contract

A repository-level contract declares:

- canonical locale;
- current locale roles and release states;
- required surfaces per role;
- generator and checker paths that actually exist;
- machine-readable surfaces;
- glossary paths;
- freshness strategy;
- watched canonical/localizable source families;
- locale-specific update signals;
- bounded Quality Debt / exception policy.

The contract must describe the real repository. One Cognitive Biases pass caught a false-green profile that pointed to an invented generated `llms.txt` location instead of the repository's actual routing source. A generic abstraction is harmful if it validates a path the product does not use.

## Layer 3: localization-impact gate

On pull requests and protected direct pushes to the release branch, compare the change with the relevant base revision. If a watched canonical/localizable surface changed, every active locale that requires that surface must provide one of two things:

1. a corresponding locale update/currentness proof; or
2. a documented, time-bounded exception.

The gate should ignore changes that only modify the governance mechanism itself. Exceptions need a unique ID, reason, affected locales, provenance and expiry/review date; optional path scoping prevents one exception from suppressing unrelated future work.

This catches a common failure that ordinary translation tests miss: a new canonical surface was added, but nobody remembered that it needed localization at all.

## Layer 4: glossary-first and freshness are executable rules

Glossary quality and freshness should not exist only in prose.

The Cognitive Biases governance layer validates stable glossary concept IDs, locale metadata, review state and preferred terms. It also requires an enforceable freshness strategy instead of accepting a label such as `reviewed` forever.

For small release-oriented projects, a canonical release version can be sufficient. For larger or independently edited libraries, prefer per-record hashes or source revisions. A translation can exist, look complete and still be stale.

## Layer 5: separate Search requirements from product/agent contracts

The final closure made source authority explicit.

Do not present a product-specific agent surface as a Search-engine requirement. In particular, a project may intentionally publish localized `llms.txt`, machine datasets or Agent Skills, but those remain product/agent interoperability contracts unless a Search provider explicitly documents them as a Search requirement.

Likewise, generic BCP 47 validity and provider-specific `hreflang` eligibility are different questions. Keep them as separate checks. The project also chose one intentional `hreflang` representation instead of duplicating the same language graph in every possible surface.

Reusable rule:

- classify every localization check by surface and authority;
- link provider-specific claims to fresh primary guidance;
- keep optional agent interoperability useful without relabeling it as SEO evidence.

## Layer 6: validate the final artifact, not an intermediate build

Several false greens only become visible after late generators or mutators run.

The safe order is:

`source checks → build → late generators/mutators → final-artifact checks → browser checks`

Canonical, `hreflang`, metadata, structured data, 404 output and machine routes should be checked after the last step that can change them. A valid generator input is not evidence that the final public artifact stayed valid.

Keep the evidence layers separate:

1. source/repository state;
2. generated final artifact;
3. rendered browser state;
4. deployed production state.

Do not let one green layer stand in for the next one.

## Layer 7: browser verification needs two coverage strategies

The final Cognitive Biases browser workflow uses both exhaustive measurable coverage and richer representative evidence.

For every locale:

- discover the locale list from the current locale registry;
- discover public routes from the final sitemap or another authoritative published-route inventory;
- scan the full public corpus at 320 px for objective browser failures;
- select representative page/component archetypes for richer checks across about 320, 375, 430, 768 and desktop widths;
- capture screenshot, rendered DOM and accessibility-tree evidence together;
- exercise keyboard/focus plus secondary states such as menus, search and disclosures;
- record runtime/resource errors and long-string risk;
- apply 30–50% pseudo-expansion where useful.

Sampling screenshots alone is too weak. Taking rich screenshots of every page is too brittle and expensive. Full lightweight scanning plus representative deep evidence gives a better balance.

See [`browser-verification.md`](browser-verification.md) for the reusable browser contract.

## Layer 8: error and recovery routes are localization surfaces

The browser pass found that the global 404 experience had been missed by source-oriented localization work.

A localized missing route should be tested for each published human locale. Verify at least:

- correct `html lang` after runtime routing;
- localized heading, explanation, skip link and navigation label;
- a useful recovery action back into the same locale;
- explicit language marking when a recovery link intentionally goes to canonical-language content;
- keyboard/focus behavior;
- noindex/follow or other deliberate crawler policy;
- the same essential recovery path required by the site's global public-surface contract.

Generalize this beyond 404 pages: offline states, auth failures, empty results, validation errors and fatal fallbacks are part of localization even when they are generated outside normal page templates.

## Layer 9: prove the browser detector before trusting the browser gate

A browser checker can be wrong too.

The Cognitive Biases workflow runs fault injection before the real audit. It proves that the detector can catch known false-green classes such as accessible-name leakage, narrow-width overflow and hidden/focusable UI.

It also self-tests the audit harness. Instrumentation failures are reported separately from product failures. A broken test harness must not be interpreted as a clean site or as a localization defect.

When a heuristic produces known noise, calibrate it transparently:

- keep the raw finding in the evidence artifact;
- document the exact non-blocking condition;
- keep larger or materially different cases blocking;
- prefer fixing the detector over adding broad ignore rules;
- never convert a heuristic exception into proof that the surface passed.

Examples from the real pass included off-canvas skip links, Chromium rounding at 320 px, proper names in accessible-name leak heuristics and a focus-obscured heuristic that disagreed with visible/operable focus evidence.

## Layer 10: deployment identity is part of localization verification

A successful local browser pass does not prove that production serves the same revision.

The post-deploy workflow should run only after the real deployment succeeds and should verify the deployed revision before treating browser evidence as release evidence. A small `deploy-revision.txt`, build metadata endpoint or equivalent deterministic marker is enough.

Useful production sequence:

1. deploy the exact release revision;
2. checkout that same revision in the verification job;
3. prove browser detectors still work;
4. verify the production revision marker;
5. run the full narrow-width scan plus representative browser/accessibility matrix against production;
6. gate blocking findings;
7. retain the report/evidence artifact for a bounded period.

This closes a common false green: CI validated commit A while the user still received commit B.

## Layer 11: one equivalence graph, not loose language links

Localized canonical URLs, `hreflang`, sitemap membership, language switching and duplicate-canonical treatment should derive from one reviewed page-equivalence model where practical.

Do not infer equivalence from similar titles or aliases. Related concepts and homonyms can share search wording without being the same canonical entity. Conversely, duplicate/alias routes can intentionally canonicalize to one entity and should not be counted as independent localized pages.

This matters for both Search correctness and coverage reporting.

## CI environment parity

The first dogfood workflow failed even though localization logic was valid. The reason was infrastructure drift: the new workflow used a different Node version and omitted the WebP encoder required by the site's real build pipeline.

The fix was to reuse the production validation environment:

- same Node major version;
- same system dependencies;
- same dependency install method;
- same canonical repository quality suite.

General rule: a localization gate that builds the site must reproduce the production build prerequisites. Otherwise CI reports environment differences as localization defects.

## Recommended release shape

A mature localization release now has four layers:

1. **Fast governance** — roles, glossary, freshness, bounded debt and change impact.
2. **Final-artifact validation** — exact route/data/Search/machine-readable invariants after all mutators.
3. **Rendered browser validation** — full lightweight corpus scan plus representative screenshot/DOM/accessibility/keyboard evidence.
4. **Post-deploy verification** — exact deployed revision, live HTTP/browser behavior and the same blocking contract against production.

Keep stronger domain-specific locale checks inside this shape instead of replacing them with weaker generic assertions.

## What still remains outside deterministic proof

Even this closure does not prove that prose sounds native, examples are culturally good, Search engines indexed the pages, AI systems cite them, users understand them, or the localization improves business outcomes.

Keep independent editorial/semantic review and external owner/search evidence separate from implementation gates. A green gate proves declared invariants, not universal localization quality.
