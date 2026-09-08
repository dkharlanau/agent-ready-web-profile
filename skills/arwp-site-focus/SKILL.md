---
name: arwp-site-focus
description: Define a website's problem territory, audience, explicit scope and anti-scope, page architecture, navigation, visual system and performance budget before expanding content or discoverability work. Use at the start of a site build/redesign or when a site feels broad, fragmented or feature-led.
license: Apache-2.0
metadata:
  standard: agent-skills
  arwp-role: site-focus-and-information-architecture
---

# ARWP site focus

Use this skill before `arwp-discoverability`, `arwp-ai-search-content`, broad content expansion or a visual redesign. A site should first be coherent enough that a person can explain what problem territory it owns and what it intentionally leaves out.

This is a product/design gate, not a claimed search ranking factor. The numeric limits below are Cite Goose house heuristics intended to force clarity; test them against the actual audience and task rather than presenting them as platform requirements.

## Workflow

Prefer Site Focus v0.2 whenever the owner/repository context is available.

1. Declare intended product truth in `.arwp/site-focus.json`: thesis, IN / ADJACENT / OUT scope, problem lanes, primary navigation and route roles.
2. Observe the generated/public site with `arwp-focus`.
3. Compare declared intent with observed implementation rather than inferring business strategy from route count alone.
4. Review page contracts, locale-equivalence suppression, navigation drift, unclassified routes and bounded `KEEP / NARROW / MERGE / DEFER` decisions.
5. Pass only accepted decisions forward. Focus may emit proposal-only Target Transformation handoff candidates, but it never authorizes mutations itself.

Run the executable report when a public site or generated repository surface exists:

```bash
node bin/arwp-focus.mjs https://example.com --focus-profile=.arwp/site-focus.json
node bin/arwp-focus.mjs https://example.com --focus-profile=.arwp/site-focus.json --max-pages=30 --json
node bin/arwp-focus.mjs https://example.com/project/ --repo-root=. --output=site-focus-report.json
```

Repository mode auto-discovers `.arwp/site-focus.json` and then `site-focus.json`. Without a declared profile, the observation layer is still useful, but low lexical similarity and route-family counts must not be treated as owner intent.

Read `docs/SITE-FOCUS-ENGINE.md` before treating any heuristic finding as a structural decision. The engine emits transparent evidence and Page Contract Map diagnostics; it never emits one focus/readiness/ranking score. `REMOVE` and `SPLIT` are never automatic.

## 1. Write the site thesis

Produce one sentence with four parts:

> For **[primary audience]** who need to **[solve a concrete problem]**, this site provides **[distinct useful mechanism / evidence / tool]** so they can **[useful outcome]**.

Then record:

- `primary_problem`: the problem territory the site wants to own;
- `primary_audience`: one main audience, not a list of everyone who could visit;
- `useful_outcome`: what a successful visit lets that audience understand, decide or do;
- `distinct_evidence`: why this site deserves to exist instead of paraphrasing the rest of the web;
- `primary_action`: the next action the homepage should make obvious.

When the repository supports Site Focus v0.2, encode the same intent in `.arwp/site-focus.json` under `thesis` so future runs can detect declared ↔ observed drift.

If those fields cannot be stated without broad words such as “everything”, “all solutions” or a long list of unrelated jobs, stop expansion and narrow the thesis first.

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

## 3. Declare route roles, not fake problem counts

Do not infer that a site has six problems because it has six top-level folders or hundreds of routes. Route families are implementation/content architecture, not product strategy.

Use Site Focus v0.2 route roles:

- `problem-commercial` — directly solves the primary problem or carries product/commercial continuation;
- `proof-portfolio` — projects, cases, research, experiments, datasets or other evidence that reduces uncertainty;
- `trust-utility` — identity, methodology, contact, policy, corrections or other trust/support surfaces;
- `technical-reference` — protocol, API, schema, implementation and deep reference material;
- `localization-equivalent` — an explicitly managed localized representation when a route rule needs that role.

Assign every declared route family `IN`, `ADJACENT` or `OUT` scope and, when appropriate, a problem lane. Supporting roles may legitimately use vocabulary unlike the homepage; low lexical overlap alone is not evidence that they are out of scope.

For multilingual sites, declare locale prefixes. Equivalent locale routes must not be merged merely because their structural intent is similar. Locale equivalence also does not prove that canonical/hreflang implementation is correct; technical Search checks remain separate.

## 4. Use a small problem architecture

Default house heuristic unless the site's evidence justifies another structure:

- **1** primary problem territory;
- **up to 3** problem lanes on the homepage;
- **up to 5** primary navigation destinations;
- **1** dominant primary action per page;
- deep technical/reference material lives one level below the main narrative.

Choose lanes by user problem, not by internal technology. Prefer “Get discovered”, “Make the answer usable”, “Prove what changed” over “Schema”, “MCP”, “JSON-LD” unless the site is explicitly for protocol implementers.

Every primary page gets a page contract:

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

## 5. Make the homepage a decision surface

Recommended sequence:

1. **Problem + promise** — one clear statement above the fold.
2. **Boundary** — what the site solves and deliberately does not solve.
3. **Problem lanes** — no more than three first-order routes for the primary audience.
4. **Proof / mechanism** — why the promise is credible and how the product/site works.
5. **Action** — one obvious next step; secondary actions remain subordinate.
6. **Technical/reference depth** — standards, changelogs, directories, APIs and research artifacts may remain available without competing with the main narrative.

Do not use the homepage as a sitemap dump. Footer depth is allowed; primary navigation should stay intentionally small.

## 6. Use a distinctive visual system without paying for it in latency

A strong site should be visually recognizable without requiring a framework-heavy runtime.

Prefer:

- a small tokenized palette with one high-energy accent plus strong neutral contrast;
- one self-hosted variable/static webfont or a system-font fallback;
- editorial typography, large hierarchy and meaningful whitespace;
- a few large visual fields/cards instead of dozens of tiny dashboard widgets;
- original lightweight illustrations or diagrams when they communicate meaning;
- SVG/WebP/AVIF assets with explicit dimensions;
- CSS-driven layout and state before adding JavaScript.

Avoid:

- generic gradient-on-dark “AI product” styling without a brand reason;
- decorative carousels, auto-playing media and animation that delays comprehension;
- shipping a component library only to render a mostly static page;
- hiding essential text inside images;
- visual novelty that reduces contrast, keyboard access or mobile readability.

## 7. Set performance budgets before design expands

Treat performance as a design constraint. Record a project-specific budget and test on the generated production output.

Cite Goose default targets for a mostly static informational page:

- no render-blocking third-party JavaScript for core content;
- critical content remains usable when JavaScript is unavailable;
- one primary hero media asset, correctly sized and compressed;
- reserve image dimensions to avoid avoidable layout shift;
- lazy-load non-critical imagery below the first viewport;
- keep the number of fonts/weights intentionally small;
- target good Core Web Vitals in field data where field data exists; use lab checks only as diagnostics, not outcome proof.

Do not invent a universal kilobyte or millisecond threshold when the actual hosting, device cohort and page job are unknown. If the project has a measured budget, preserve the stricter local rule.

## 8. Review engine dispositions safely

The engine may emit:

- `KEEP` — sampled evidence and declared intent do not currently expose a focus conflict requiring action;
- `NARROW` — the page job/action contract is unclear;
- `MERGE` — another non-locale-equivalent sampled page has substantially overlapping intent signals;
- `DEFER` — scope or placement deserves review, including owner-declared `OUT` surfaces.

These are review dispositions, not mutation authority. A `MERGE` recommendation still needs canonical/redirect/history review. A `DEFER` recommendation is not a noindex/delete instruction. Never infer `REMOVE` or `SPLIT` from numeric similarity alone.

The v0.2 `transformationHandoff` is deliberately `proposal-only`, `executable: false`, and `destructiveOperationsAllowed: false`. Only an explicitly accepted product decision may be compiled later into exact Target Transformation operations.

## 9. Run the focus gate in the Growth Loop

Before proposing new content or discovery features, emit this compact decision record:

```yaml
site_thesis: ...
primary_problem: ...
primary_audience: ...
we_do: [...]
we_do_not: [...]
problem_lanes: [...] # target <= 3
primary_nav: [...]   # target <= 5
route_role: problem-commercial | proof-portfolio | trust-utility | technical-reference | localization-equivalent
route_scope: IN | ADJACENT | OUT
observed_drift: [...]
page_being_changed:
  page_job: ...
  primary_action: ...
focus_decision: keep | narrow | merge | defer | manual-split-review | manual-remove-review
```

Then continue with the appropriate ARWP specialist. Focus does not replace technical eligibility, evidence review, Search/AI research or measurement; it prevents those systems from optimizing a site whose product story is still incoherent.

## 10. Verification

For a redesign or new page set, verify at minimum:

- the declared thesis and boundary still match the intended product;
- the observed homepage communicates that thesis without requiring the footer;
- primary navigation destinations map to the problem architecture rather than the repository's internal module list;
- unexpected/missing declared navigation is reviewed rather than silently accepted;
- sampled public routes have an intentional role or are explicitly left unmanaged;
- each primary route has one page job and one dominant action;
- locale equivalents are not treated as consolidation targets solely because of structural similarity;
- no new route is an orphan or non-locale duplicate of another page job;
- responsive layout works at narrow mobile widths without horizontal scrolling;
- heading order, focus states, link labels and contrast remain usable;
- generated HTML exposes core content without JavaScript;
- image dimensions are declared and non-critical media is not eagerly loaded;
- re-run `arwp-focus` after the structural change and compare evidence rather than trying to maximize or minimize a score;
- existing project tests/build checks still pass.

When a site remains broad after this gate, recommend splitting a genuinely distinct problem territory into another resource rather than creating more navigation levels inside the same site. That recommendation must still be reviewed against the real product, traffic/history and URL migration constraints.
