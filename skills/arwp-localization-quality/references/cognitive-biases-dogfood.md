# Cognitive Biases localization dogfood

This reference records implementation lessons from applying the ARWP localization-quality model to the Cognitive Biases knowledge site. Treat it as a reusable pattern, not as a required file layout.

## Locale roles

The site separates full human-interface locales from narrower agent-routing locales. At the time of this dogfood pass:

- `fr` and `es` are reviewed human-interface locales;
- `pt-BR` is a reviewed partial human-interface locale with explicit coverage boundaries;
- `de` and `ru` are localized agent-routing surfaces and are not falsely presented as complete human UI locales.

The practical rule is: CI requirements follow the declared locale role. A routing-only locale should not fail because it lacks a complete localized website; a full-human locale should not pass because it only has an `llms.txt` file.

## Layer 1: keep deep locale-specific checks

Cognitive Biases already had strong language-specific checks. These verify exact canonical/localized library coverage, required fields, reviewed state, source release, generated routes, canonical URLs, reciprocal `hreflang`, sitemap membership, structured-data language, localized `llms.txt` and machine-readable manifests.

Do not replace strong domain-specific validation merely to make CI look generic. Add generic orchestration above it first.

## Layer 2: add a generic localization contract

A repository-level contract declares:

- canonical locale;
- full-human locales and limited locale roles;
- generator and checker scripts;
- machine-readable surfaces;
- glossary paths;
- freshness strategy;
- watched canonical/localizable source families;
- locale-specific update signals;
- the exception ledger.

This contract is the bridge between product architecture and CI. It lets a new component, skill library or dataset become visible to localization governance without teaching every agent the repository from memory.

## Layer 3: localization-impact gate

On pull requests, compare the branch with the base branch. If a watched canonical/localizable surface changed, every active full-human locale must provide one of two things:

1. a corresponding locale update signal; or
2. a documented, time-bounded exception.

The gate should ignore changes that only modify the governance mechanism itself. Exceptions need a unique ID, reason, affected locales and expiration date; optional path scoping prevents one exception from suppressing unrelated future work.

This catches a common failure that ordinary translation tests miss: a new canonical surface was added, but nobody remembered that it needed localization at all.

## Layer 4: glossary-first as an executable rule

Cognitive Biases now keeps versioned glossary baselines for `fr`, `es` and `pt-BR`. The governance checker verifies:

- each full-human locale declares a glossary;
- glossary locale metadata is correct;
- version and status exist;
- a minimum shared baseline exists;
- stable concept IDs are unique;
- source and preferred terms are present;
- the preferred term does not silently equal canonical English;
- stable glossary concept IDs match across active human locales.

Stable glossary IDs matter more than identical wording. They let languages choose natural terminology while keeping the same conceptual inventory.

## Layer 5: freshness is evidence, not a label

The current site uses canonical release version as its freshness strategy. The generic governance checker does not merely accept `freshnessStrategy: canonical-release-version`; it verifies that the locale's actual checker contains source-release validation. Locale-specific checks then compare localized records/manifests with the current canonical release.

For projects with finer-grained publishing, prefer per-record source hashes or source revision IDs. A translation can exist and still be stale.

## CI environment parity

The first dogfood workflow failed even though localization logic was valid. The reason was infrastructure drift: the new workflow used a different Node version and omitted the WebP encoder required by the site's real build pipeline.

The fix was to reuse the production validation environment:

- same Node major version;
- same system dependencies;
- same dependency install method;
- same canonical repository quality suite.

General rule: a localization gate that builds the site must reproduce the production build prerequisites. Otherwise CI reports environment differences as localization defects.

## Recommended CI shape

Use two layers:

1. **Fast localization governance step** — validate locale roles, glossary contracts, freshness enforcement, exceptions and PR impact.
2. **Canonical repository quality suite** — build the actual site and run existing semantic, UI, SEO, accessibility, data and locale-specific checks in the same environment as production.

This gives a useful early failure without creating a second, subtly different build system.

## What remains heuristic

The deterministic system still does not prove that target-language writing sounds native or that every rendered component looks good on narrow screens. Keep the independent language/reconciliation pass and rendered UI audit from the main ARWP workflow.

A green gate proves declared invariants. It does not prove literary quality, cultural fit, Search ranking or recommendation visibility.
