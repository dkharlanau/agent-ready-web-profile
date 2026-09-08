# Site Focus real-site dogfood — 2026-09-08

This note records the first real-site calibration pass for the Cite Goose Site Focus Engine. It is not a benchmark, ranking study or recommendation outcome report.

Targets:

- `https://ptichi.com/` — focused product/editorial site;
- `https://metalhatscats.com/` — intentionally broader product/build/research studio.

The target repositories and public pages were reviewed on 2026-09-08. The executable engine is still v0.1, so this pass is primarily about identifying false-positive risks before treating its heuristics as stable product behavior.

## Ptichi: focused-site control

Repository contract already says:

- the public site's job is distribution, explanation, trust and useful public practice, not application runtime;
- one page should have one real job/question;
- new public search entities require a distinct user job, standalone value/action, cannibalization review and measurement plan;
- keyword difference alone cannot justify another URL;
- static HTML / Server Components are the default.

The current public homepage is correspondingly narrow. Its first-order navigation is `Method / Journal / Practice / About`, and the visible product story stays around short rehearsal and speech practice rather than exposing the repository's many internal content families as top-level navigation.

### Expected Focus behavior

A useful engine should:

- recognize the narrow top-level product story despite a much deeper underlying content/entity model;
- avoid equating content-family count with first-order problem count;
- surface genuine overlapping article/practice intents for review without rewarding URL reduction for its own sake;
- preserve the existing search-expansion gate as stronger local policy when it is stricter than Cite Goose defaults;
- treat multilingual equivalents as localized representations, not duplicate-intent pages merely because their contracts are similar.

## MetalHatsCats: broad-site control

The current repository explicitly defines MetalHatsCats as a public systems studio whose commercial entry points are websites, documentation, public data and search/discovery. Products, research and datasets also act as proof surfaces.

The current public homepage presents five primary navigation destinations: `Products / Projects / Build / Research / About`. The first screen connects them through one studio thesis: building websites, public data and digital products, then researching how those things become discoverable and useful.

Observed first-order pages remain distinguishable:

- **Products** — owned focused tools;
- **Projects** — the broader public project constellation;
- **Build** — work performed with clients, currently grouped into GitHub-native websites, public data systems and AI-search readiness;
- **Research** — applied work on discovery, evidence and agent-facing public systems;
- **About** — studio identity/context.

### Expected Focus behavior

A useful engine should:

- allow an intentionally broad studio to have several first-order route territories when they are tied together by an explicit site thesis;
- not treat `route territory count` as equivalent to `problem lane count`;
- distinguish portfolio/supporting routes (`Projects`, `About`) from commercial/problem lanes (`Products`, `Build`, `Research`);
- surface true drift inside the ~400-route repository without declaring the studio concept itself invalid;
- flag technical navigation only when implementation vocabulary replaces the visitor's task, not merely because technical material exists deeper in the site.

## Calibration finding #1: route territories are not problem lanes

The v0.1 report exposes `routeTerritories` because top-level URL families are useful structural evidence. They must **not** be interpreted as the number of problems a site owns.

Examples:

- Ptichi can have many content families while still presenting one narrow product story.
- MetalHatsCats can expose five top-level destinations while still using only a few coherent visitor modes.

Therefore:

> `routeTerritories` is an inventory diagnostic, not a focus violation by itself.

The current `many-route-territories` heuristic should be treated as review-only and is a candidate for replacement in v0.2 by an explicit **declared architecture vs observed architecture** comparison.

## Calibration finding #2: local policy outranks generic house heuristics

Cite Goose defaults (`1` primary problem, `<=3` homepage problem lanes, `<=5` primary navigation destinations) are starting heuristics.

A target repository may already have a stronger, reviewed contract. Ptichi's search-expansion gate is an example. Site Focus should ingest/preserve such local policy rather than replacing it with the generic threshold set.

## Calibration finding #3: observed thesis and intended thesis are different evidence classes

The engine currently derives an **observed thesis** from homepage title/H1/description. That is useful, but it cannot prove the intended business boundary.

The next report revision should support a reviewed intent file (starting from `templates/growth/site-focus.example.json`) and expose both:

```text
DECLARED THESIS / SCOPE
          ↕ compare
OBSERVED HOMEPAGE / NAV / PAGE CONTRACTS
          ↓
ALIGNMENT + DRIFT EVIDENCE
```

This is more useful than trying to infer the entire product strategy from lexical similarity.

## v0.2 backlog from this dogfood

Priority order:

1. Accept a reviewed Site Focus intent/contract file as optional input.
2. Compare declared primary navigation/problem lanes with observed navigation instead of penalizing raw route-family count.
3. Add locale-equivalence awareness so translations do not become duplicate-intent candidates.
4. Separate `commercial/problem lane`, `proof/portfolio`, `trust/utility` and `technical/reference` route roles.
5. Preserve target-repository policy as an explicit stronger-local-rule layer.
6. Only after those changes, run a larger manually reviewed cohort and estimate false-positive/false-negative rates.

No threshold change from this note should be presented as a Search/AI ranking improvement. The purpose of dogfood is decision quality: fewer bad restructuring recommendations and clearer evidence for the ones that remain.