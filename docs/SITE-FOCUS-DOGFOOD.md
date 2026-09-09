# Site Focus real-site dogfood — 2026-09-08

This note records the first real-site calibration pass for the Goose Site Focus Engine. It is not a benchmark, ranking study or recommendation outcome report.

Targets:

- `https://ptichi.com/` — focused multilingual product/editorial site;
- `https://github.com/metalhatscats/metalhatscats` — currently verified public MetalHatsCats repository surface; no standalone MetalHatsCats website domain is asserted by this note;
- Goose itself — the self-dogfood control.

The first pass started on Site Focus v0.1 and directly produced v0.2. Version 0.2 now supports owner-declared intent, route roles, locale equivalence and proposal-only transformation handoff. This note keeps the original calibration findings and records what the implementation subsequently proved.

## Ptichi: focused-site control

Repository contract already says:

- the public site's job is distribution, explanation, trust and useful public practice, not application runtime;
- one page should have one real job/question;
- new public search entities require a distinct user job, standalone value/action, cannibalization review and measurement plan;
- keyword difference alone cannot justify another URL;
- static HTML / Server Components are the default.

The visible product story is narrow and stays around rehearsal and everyday speech practice rather than exposing the repository's many internal content families as independent site identities.

### v0.2 declared contract

Ptichi now publishes `.arwp/site-focus.json` as repository truth for the Site Focus layer.

The contract declares:

- one speaking-practice territory;
- three problem lanes: understand, practice and measure;
- `IN / ADJACENT / OUT` boundaries;
- route roles for problems, goals, skills, practice, programs, measurements, research, journal, tools, comparisons, glossary and product truth;
- English as the language-neutral/default route form with RU/DE localized representations;
- primary navigation derived from the actual repository policy rather than from visible labels.

### Dogfood finding: labels are not route contracts

The first draft of the declared profile incorrectly assumed that visible labels such as `Method` and `About` implied `/method` and `/about` routes.

The repository's real source of truth is `src/lib/navigation-policy.json`:

```text
Method   -> /product
Journal  -> /journal
Practice -> /practice
About    -> /product/about
```

This is a useful failure. A declared-intent system must ingest or align with the repository's governing source rather than reconstructing architecture from labels.

Ptichi now has a local `site-focus:check` build gate that compares the profile with the navigation policy and locale-routing policy. It also protects the exact `/product/about` trust-role override and keeps Journal/Research as supporting proof rather than independent product identities.

### Expected Focus behavior

A useful engine should:

- recognize the narrow top-level product story despite a much deeper underlying content/entity model;
- avoid equating content-family count with first-order problem count;
- surface genuine overlapping article/practice intents for review without rewarding URL reduction for its own sake;
- preserve the existing search-expansion gate as stronger local policy when it is stricter than Goose defaults;
- treat multilingual equivalents as localized representations, not duplicate-intent pages merely because their contracts are similar.

v0.2 implements the last requirement by suppressing locale-equivalent pairs from `MERGE` noise while explicitly refusing to treat that as proof of correct canonical/hreflang implementation.

## MetalHatsCats: historical broad-site calibration — re-run required

**Correction, 2026-09-09:** the previous dogfood note treated `metalhatscats.com` as a live target. The project owner clarified that this standalone domain is not in use. The IA observations below are retained as historical calibration context, not current production evidence. Re-run Site Focus against an actual published MetalHatsCats site before using these findings as current evidence.

The repository explicitly defines MetalHatsCats as a public systems studio whose commercial entry points are websites, documentation, public data and search/discovery. Products, projects, research and experiments can also act as proof surfaces.

The current human-facing header has five primary destinations:

```text
Services / Projects / Build / Research / About
```

The v0.2 declared contract keeps three visitor/problem lanes:

- publish clearly;
- get discovered;
- show proof.

Hundreds of routes therefore do not imply hundreds of primary problems.

### Dogfood finding: human IA and machine-readable IA can drift independently

The first v0.2 pass found a concrete discrepancy:

- the visual Header already contained five primary destinations;
- the `SiteNavigationElement` JSON-LD still declared a sixth top-level `Experiments` destination.

The `/experiments` resource itself was valid. The problem was that the human and structured representations of primary architecture disagreed.

The structured navigation was corrected so `Experiments` remains available as supporting proof through secondary surfaces rather than being declared as a sixth primary route.

MetalHatsCats now has a path-scoped Site Focus CI guard that compares:

```text
.arwp/site-focus.json
        =
visual Header navigation
        =
structured SiteNavigationElement navigation
```

It also asserts that `/experiments` remains explicitly classified as `proof-portfolio / ADJACENT` rather than disappearing from the model.

### Expected Focus behavior

A useful engine should:

- allow an intentionally broad studio to have several first-order route families when they are tied together by an explicit site thesis;
- not treat `route territory count` as equivalent to `problem lane count`;
- distinguish commercial/problem routes from proof, trust and technical-reference routes;
- surface true drift inside a large repository without declaring the studio concept itself invalid;
- flag technical navigation only when implementation vocabulary replaces the visitor's task, not merely because technical material exists deeper in the site.

## Goose: self-dogfood control

Goose itself now declares `.arwp/site-focus.json` with:

- the primary problem: deciding which Search, AI-search and agent-web changes actually help a useful site become easier to find, use, cite and verify;
- three lanes: Be found / Be used / Be proven;
- a small internal primary-navigation contract;
- research, benchmarks and examples as proof;
- resolver, standards, directory and skills as technical-reference depth;
- no guaranteed ranking/citation/recommendation outcomes and no opaque readiness score.

The dedicated `Site Focus v0.2` workflow validates v0.1 compatibility, the v0.2 schema/engine, the copyable public example and Goose's own declared-vs-observed dogfood report.

## Calibration finding #1: route territories are not problem lanes

The v0.1 report exposes `routeTerritories` because top-level URL families are useful structural evidence. They must **not** be interpreted as the number of problems a site owns.

Examples:

- Ptichi can have many content families while still presenting one narrow product story.
- MetalHatsCats can expose many route families while still using three coherent visitor/problem lanes.

Therefore:

> `routeTerritories` is an inventory diagnostic, not a focus violation by itself.

v0.2 removes the generic `many-route-territories` finding when owner-declared intent is available and instead evaluates route-role coverage plus declared/observed drift.

## Calibration finding #2: local policy outranks generic house heuristics

Goose defaults (`1` primary problem, `<=3` homepage problem lanes, `<=5` primary navigation destinations) are starting heuristics.

A target repository may already have a stronger, reviewed contract. Ptichi's search-expansion and navigation policies are examples. Site Focus should ingest/preserve such local policy rather than replacing it with the generic threshold set.

The Ptichi dogfood proved that even a well-intended declarative file can be wrong if it ignores the target repository's own governing source.

## Calibration finding #3: observed thesis and intended thesis are different evidence classes

The engine derives an **observed thesis** from homepage title/H1/description. That is useful, but it cannot prove the intended business boundary.

v0.2 now exposes both:

```text
DECLARED THESIS / SCOPE
          ↕ compare
OBSERVED HOMEPAGE / NAV / PAGE CONTRACTS
          ↓
ALIGNMENT + DRIFT EVIDENCE
```

Token coverage is exposed transparently as a wording diagnostic. It is not collapsed into a focus score and is not evidence of user comprehension or Search performance.

## Calibration finding #4: structured architecture is part of architecture drift

The MetalHatsCats case adds another evidence class:

```text
OWNER-DECLARED IA
       ↕
HUMAN-VISIBLE IA
       ↕
MACHINE-READABLE IA
```

A site can look coherent to a visitor while still publishing stale machine-readable navigation. Future fleet-level Focus work should compare these surfaces explicitly rather than relying on the first `<nav>` alone.

## Calibration finding #5: locale equivalence must be explicit

A translated page is not a consolidation candidate merely because its page job, structure and entity identity resemble the default-language route.

v0.2 normalizes declared locale prefixes and suppresses equivalent cross-locale pairs from duplicate-intent `MERGE` candidates.

This does not replace technical localization checks. Canonical, hreflang, sitemap and redirect policy remain separate verification concerns.

## What v0.2 now implements

The original backlog is now materially implemented:

1. reviewed Site Focus intent/profile input — implemented;
2. declared navigation vs observed navigation — implemented;
3. locale-equivalence awareness — implemented;
4. route roles (`problem-commercial`, `proof-portfolio`, `trust-utility`, `technical-reference`, `localization-equivalent`) — implemented;
5. stronger local policy preserved through target-repository guards — implemented first on Ptichi and MetalHatsCats;
6. safe Target Transformation bridge — implemented as proposal-only, non-executable handoff.

The next research step is not another heuristic expansion. It is a larger manually reviewed cohort with labeled expected decisions so false-positive and false-negative rates can be measured per finding class.

No threshold change from this dogfood should be presented as a Search/AI ranking improvement. The purpose of dogfood is decision quality: fewer bad restructuring recommendations, less machine/human IA drift and clearer evidence for the changes that remain.
