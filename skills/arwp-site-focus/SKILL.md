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

Run the focus gate before content expansion, Search/AI optimization or visual feature work. Define the site thesis and boundary first, then choose the smallest problem-led information architecture that supports the real audience, and only after that route work to the other ARWP specialists.

## 1. Write the site thesis

Produce one sentence with four parts:

> For **[primary audience]** who need to **[solve a concrete problem]**, this site provides **[distinct useful mechanism / evidence / tool]** so they can **[useful outcome]**.

Then record:

- `primary_problem`: the problem territory the site wants to own;
- `primary_audience`: one main audience, not a list of everyone who could visit;
- `useful_outcome`: what a successful visit lets that audience understand, decide or do;
- `distinct_evidence`: why this site deserves to exist instead of paraphrasing the rest of the web;
- `primary_action`: the next action the homepage should make obvious.

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

## 3. Use a small problem architecture

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

## 4. Make the homepage a decision surface

Recommended sequence:

1. **Problem + promise** — one clear statement above the fold.
2. **Boundary** — what the site solves and deliberately does not solve.
3. **Problem lanes** — no more than three first-order routes for the primary audience.
4. **Proof / mechanism** — why the promise is credible and how the product/site works.
5. **Action** — one obvious next step; secondary actions remain subordinate.
6. **Technical/reference depth** — standards, changelogs, directories, APIs and research artifacts may remain available without competing with the main narrative.

Do not use the homepage as a sitemap dump. Footer depth is allowed; primary navigation should stay intentionally small.

## 5. Use a distinctive visual system without paying for it in latency

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

## 6. Set performance budgets before design expands

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

## 7. Run the focus gate in the Growth Loop

Before proposing new content or discovery features, emit this compact decision record:

```yaml
site_thesis: ...
primary_problem: ...
primary_audience: ...
we_do: [...]
we_do_not: [...]
problem_lanes: [...] # target <= 3
primary_nav: [...]   # target <= 5
page_being_changed:
  page_job: ...
  primary_action: ...
focus_decision: keep | narrow | split | remove | defer
```

Then continue with the appropriate ARWP specialist. Focus does not replace technical eligibility, evidence review, Search/AI research or measurement; it prevents those systems from optimizing a site whose product story is still incoherent.

## 8. Verification

For a redesign or new page set, verify at minimum:

- the thesis and boundary are visible to a first-time visitor without reading the footer;
- primary navigation destinations map to the problem architecture, not the repository's internal module list;
- each primary route has one page job and one dominant action;
- no new route is an orphan or duplicate of another page job;
- responsive layout works at narrow mobile widths without horizontal scrolling;
- heading order, focus states, link labels and contrast remain usable;
- generated HTML exposes core content without JavaScript;
- image dimensions are declared and non-critical media is not eagerly loaded;
- existing project tests/build checks still pass.

When a site remains broad after this gate, recommend splitting a distinct problem territory into another resource rather than creating more navigation levels inside the same site.