---
name: arwp-site-focus
description: Define a website's problem territory, audience, explicit scope and anti-scope, page architecture, navigation, visual system and performance budget before expanding content or discoverability work. Use at the start of a site build/redesign or when a site feels broad, fragmented or feature-led.
license: Apache-2.0
metadata:
  standard: agent-skills
  arwp-role: site-focus-and-information-architecture
---

# ARWP site focus

Use this skill before `arwp-discoverability`, `arwp-ai-search-content`, broad content expansion or a visual redesign. A site should first be coherent enough that a person can explain what problem territory it owns, for whom, which first-order problem lanes it exposes and what it intentionally leaves out.

This is a product/design gate, not a claimed search ranking factor. Numeric limits are Goose house heuristics or owner-declared budgets unless an upstream source explicitly defines them. Never turn them into a composite readiness/focus/beauty score.

## Workflow

Prefer Site Focus v0.3 whenever the owner/repository context is available. v0.2 remains backward compatible.

1. Declare intended product truth in `.arwp/site-focus.json`: thesis, IN / ADJACENT / OUT scope, problem lanes, homepage contract, primary navigation, route roles and experience budgets.
2. Give every problem lane an audience, concrete problem, desired outcome and primary action. A lane is a user job, not a technology bucket.
3. Declare which lane owns the homepage and which signals it must communicate: problem, audience, outcome, evidence and action.
4. Observe the generated/public site with `arwp-focus`.
5. Compare declared intent with observed implementation: homepage-lane drift, required-signal drift, lane-to-route coverage, navigation budget, page contracts, locale-equivalence and unclassified routes.
6. Keep visual principles as owner intent and Core Web Vitals as field-evidence budgets. Static HTML inspection must not fabricate visual quality or performance evidence.
7. Pass only accepted decisions forward. Focus may emit proposal-only Target Transformation handoff candidates, but it never authorizes mutations itself.

Run the executable report when a public site or generated repository surface exists:

```bash
node bin/arwp-focus.mjs https://example.com --focus-profile=.arwp/site-focus.json
node bin/arwp-focus.mjs https://example.com --focus-profile=.arwp/site-focus.json --max-pages=30 --json
node bin/arwp-focus.mjs https://example.com/project/ --repo-root=. --output=site-focus-report.json
```

Repository mode auto-discovers `.arwp/site-focus.json` and then `site-focus.json`. Without a declared profile, the observation layer is still useful, but low lexical similarity and route-family counts must not be treated as owner intent.

Read `docs/SITE-FOCUS-ENGINE.md` and `docs/SITE-FOCUS-V0.3.md` before treating any heuristic finding as a structural decision. The engine emits transparent evidence and Page Contract Map diagnostics; it never emits one focus/readiness/ranking/experience score. `REMOVE` and `SPLIT` are never automatic.

## 1. Write the site thesis

Produce one sentence with four parts:

> For **[primary audience]** who need to **[solve a concrete problem]**, this site provides **[distinct useful mechanism / evidence / tool]** so they can **[useful outcome]**.

Then record:

- `primaryProblem`: the problem territory the site wants to own;
- `primaryAudience`: one main audience, not a list of everyone who could visit;
- `usefulOutcome`: what a successful visit lets that audience understand, decide or do;
- `distinctEvidence`: why this site deserves to exist instead of paraphrasing the rest of the web;
- `primaryAction`: the next action the homepage should make obvious.

Encode the intent under `thesis` so future runs can detect declared ↔ observed drift. If those fields cannot be stated without broad words such as “everything”, “all solutions” or a long list of unrelated jobs, stop expansion and narrow the thesis first.

## 2. Draw the boundary

Maintain a small scope ledger with three buckets:

- **IN** — directly helps solve the primary problem or proves the site's solution;
- **ADJACENT** — supports the core problem but must not become a competing site identity;
- **OUT** — interesting, related or monetizable, but does not strengthen the core problem enough to belong here.

Write an explicit `we_do` and `we_do_not` statement for the site. Anti-scope is a feature: it prevents topical sprawl, duplicate audience promises and navigation entropy.

Before adding a page, ask:

1. Which part of the site thesis does this page serve?
2. Which user decision or action becomes easier because this page exists?
3. What original evidence, tool, example or synthesis makes it non-redundant?
4. Which existing hub should own it?
5. If it disappeared, would the core site become materially weaker?

A page with no defensible answer is a backlog idea, not a publishable route.

## 3. Define problem lanes as mini contracts

A v0.3 problem lane carries more than a label. Declare:

```yaml
id: be-found
label: Be found
job: Help people, crawlers and agents reach the useful surface.
audience: who has this problem
problem: concrete friction or failure state
desiredOutcome: what becomes materially easier
primaryAction: the next useful step for this lane
```

The schema permits up to six lanes so specialist sites are not artificially invalidated, but the default homepage heuristic remains **one primary lane plus no more than two supporting lanes** unless real product evidence justifies more. If six lanes all compete equally above the fold, the declaration has not solved the focus problem.

Choose lanes by user problem, not internal technology. Prefer “Get discovered”, “Make the answer usable”, “Prove what changed” over “Schema”, “MCP”, “JSON-LD” unless the site is explicitly for protocol implementers.

## 4. Declare route roles, not fake problem counts

Do not infer that a site has six problems because it has six top-level folders or hundreds of routes. Route families are implementation/content architecture, not product strategy.

Use route roles:

- `problem-commercial` — directly solves the primary problem or carries product/commercial continuation;
- `proof-portfolio` — projects, cases, research, experiments, datasets or other evidence that reduces uncertainty;
- `trust-utility` — identity, methodology, contact, policy, corrections or other trust/support surfaces;
- `technical-reference` — protocol, API, schema, implementation and deep reference material;
- `localization-equivalent` — an explicitly managed localized representation when a route rule needs that role.

Assign every declared route family `IN`, `ADJACENT` or `OUT` scope and, when appropriate, a problem lane. Site Focus v0.3 reports a `problem-lane-without-route-contract` gap when a declared lane owns no route rule. That is a review prompt: give the lane an intentional surface or remove the lane from the product contract.

Supporting roles may legitimately use vocabulary unlike the homepage; low lexical overlap alone is not evidence that they are out of scope.

For multilingual sites, declare locale prefixes. Equivalent locale routes must not be merged merely because their structural intent is similar. Locale equivalence also does not prove that canonical/hreflang implementation is correct; technical Search checks remain separate.

## 5. Make the homepage a problem contract

Declare:

```yaml
homepage:
  primaryLane: be-found
  supportingLanes: [be-used, be-proven]
  requiredSignals: [problem, audience, outcome, evidence, action]
```

Recommended sequence:

1. **Problem + audience** — who has the problem and what is going wrong.
2. **Outcome / promise** — what useful result the site helps produce, without guarantees the evidence cannot support.
3. **Boundary** — what the site solves and deliberately does not solve.
4. **Problem lanes** — a small number of first-order continuations for the primary audience.
5. **Proof / mechanism** — why the promise is credible and how the product/site works.
6. **Action** — one obvious next step; secondary actions remain subordinate.
7. **Technical/reference depth** — standards, changelogs, directories, APIs and research artifacts may remain available without competing with the main narrative.

The engine reports each required signal separately using transparent lexical overlap. `missing` or `partial` is a review cue, not proof that a visitor failed to understand the page. Never average these signals into a homepage quality score.

## 6. Keep navigation intentionally small and consistent

Declare an owner-specific budget:

```yaml
experience:
  navigation:
    maxPrimaryItems: 5
    consistentAcrossPages: true
```

Default house heuristic: aim for no more than five first-order navigation destinations for a focused site, while allowing the profile to set another explicit budget where the product genuinely needs it. The engine can compare the observed homepage navigation count with the declared budget and identify which problem lanes those destinations represent.

Do not use the homepage as a sitemap dump. Footer/reference depth is allowed. Repeated navigation should remain predictably ordered across the site; static homepage-only observation cannot prove cross-page consistency, so the report keeps that assessment explicitly unmeasured unless a suitable multi-page check exists.

## 7. Give every primary page a page contract

```yaml
page_job: what this page helps the visitor do
primary_question: the question it answers
in_scope: what belongs here
out_of_scope: what belongs elsewhere
proof: source, data, example, tool or first-hand evidence
primary_action: next useful step
parent_hub: one canonical owning section
```

When an executable report exists, compare this intended contract with `pageContracts[]` instead of overwriting the observed evidence.

Default house heuristics unless the site's evidence justifies another structure:

- **1** primary problem territory;
- **1** primary homepage problem lane plus up to **2** supporting lanes;
- **up to 5** primary navigation destinations;
- **1** dominant primary action per page;
- deep technical/reference material lives below the main narrative.

## 8. Use a distinctive visual system without paying for it in latency

Store visual principles in the v0.3 profile. They should describe recognizability and design behavior, for example:

- bright high-contrast identity without decorative clutter;
- strong typographic hierarchy;
- evidence-led diagrams rather than generic stock imagery;
- a simple first screen with progressive disclosure of technical depth;
- motion only when it communicates state, causality or progression.

Prefer:

- a small tokenized palette with one high-energy accent plus strong neutral contrast;
- one self-hosted variable/static webfont or a system-font fallback;
- editorial typography, large hierarchy and meaningful whitespace;
- a few large visual fields/cards instead of dozens of tiny dashboard widgets;
- original lightweight illustrations or diagrams when they communicate meaning;
- SVG/WebP/AVIF assets with explicit dimensions;
- CSS-driven layout and state before adding JavaScript.

Avoid generic gradient-on-dark “AI product” styling without a brand reason, decorative carousels, auto-playing media, unnecessary component-library/runtime weight, essential text hidden inside images, or novelty that harms contrast, keyboard access or mobile readability.

The static Site Focus engine does **not** grade visual beauty. It only carries the declared principles forward so a designer or visual QA process can review the implementation against them.

## 9. Set performance budgets before design expands

For v0.3, record Core Web Vitals budgets explicitly:

```yaml
experience:
  performance:
    lcpMsP75Max: 2500
    inpMsP75Max: 200
    clsP75Max: 0.1
```

These default ceilings correspond to current “good” Core Web Vitals thresholds. They are field-data targets, not values the Site Focus static analyzer can infer from HTML. The report therefore says `field-data-required` until a real performance evidence adapter is attached.

Also prefer:

- no render-blocking third-party JavaScript for core content where avoidable;
- critical content usable when JavaScript is unavailable for mostly static informational pages;
- correctly sized/compressed hero media;
- reserved image dimensions;
- lazy loading for non-critical below-fold imagery;
- intentionally small font/weight sets.

Do not invent a universal total-byte budget when hosting, device cohort and page job are unknown. If a project has stricter measured budgets, preserve the stricter local rule.

## 10. Review engine dispositions safely

The engine may emit:

- `KEEP` — sampled evidence and declared intent do not currently expose a focus conflict requiring action;
- `NARROW` — the page job/action contract is unclear;
- `MERGE` — another non-locale-equivalent sampled page has substantially overlapping intent signals;
- `DEFER` — scope or placement deserves review, including owner-declared `OUT` surfaces;
- v0.3 review findings for homepage-lane mismatch, missing homepage signals, navigation budget and lane-route contract gaps.

These are review dispositions, not mutation authority. A `MERGE` recommendation still needs canonical/redirect/history review. A `DEFER` recommendation is not a noindex/delete instruction. Never infer `REMOVE` or `SPLIT` from numeric similarity alone.

`transformationHandoff` remains deliberately `proposal-only`, `executable: false`, and `destructiveOperationsAllowed: false`. Only an explicitly accepted product decision may be compiled later into exact Target Transformation operations.

## 11. Run the focus gate in the Growth Loop

Before proposing new content or discovery features, emit this compact decision record:

```yaml
site_thesis: ...
primary_problem: ...
primary_audience: ...
we_do: [...]
we_do_not: [...]
problem_lanes:
  - id: ...
    audience: ...
    problem: ...
    outcome: ...
    action: ...
homepage_primary_lane: ...
homepage_required_signals: [problem, audience, outcome, evidence, action]
primary_nav: [...]       # owner budget; focused default <= 5
visual_principles: [...]
performance_budget:
  lcp_ms_p75_max: 2500
  inp_ms_p75_max: 200
  cls_p75_max: 0.1
route_role: problem-commercial | proof-portfolio | trust-utility | technical-reference | localization-equivalent
route_scope: IN | ADJACENT | OUT
observed_drift: [...]
focus_decision: keep | narrow | merge | defer | manual-split-review | manual-remove-review
```

Then continue with the appropriate ARWP specialist. Focus does not replace technical eligibility, evidence review, Search/AI research, visual QA, accessibility testing or field measurement; it prevents those systems from optimizing a site whose product story is still incoherent.

## 12. Verification

For a redesign or new page set, verify at minimum:

- the declared thesis and boundary still match the intended product;
- the primary homepage lane is the lane actually mapped to `/`;
- the homepage exposes the required problem/audience/outcome/evidence/action signals clearly enough for human review;
- every declared problem lane has intentional route ownership or is removed from the contract;
- primary navigation stays within the owner-declared budget and maps to the problem architecture rather than the repository's module list;
- unexpected/missing declared navigation is reviewed rather than silently accepted;
- sampled public routes have an intentional role or are explicitly left unmanaged;
- each primary route has one page job and one dominant action;
- locale equivalents are not treated as consolidation targets solely because of structural similarity;
- no new route is an orphan or non-locale duplicate of another page job;
- responsive layout works at narrow mobile widths without horizontal scrolling;
- heading order, focus states, link labels and contrast remain usable;
- generated HTML exposes core content without JavaScript where that is a declared requirement;
- image dimensions are declared and non-critical media is not eagerly loaded;
- real field performance evidence is checked against the declared LCP/INP/CLS budget rather than invented by the static analyzer;
- re-run `arwp-focus` after the structural change and compare evidence rather than trying to maximize or minimize a score;
- existing project tests/build checks still pass.

When a site remains broad after this gate, recommend splitting a genuinely distinct problem territory into another resource rather than creating more navigation levels inside the same site. That recommendation must still be reviewed against the real product, traffic/history and URL migration constraints.
