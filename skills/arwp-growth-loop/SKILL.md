---
name: arwp-growth-loop
description: Run an evidence-backed website growth loop for Search, Google Discover and recommendations, generative Search, Bing AI citations, ChatGPT Search and agent readability. Use when asked to make a site rank or discover better, get into recommendations, improve AI-search visibility, apply current ARWP guidance, or continuously improve a website repository. Research current primary-source guidance, select explicit hypotheses, inspect and edit the repository, verify checks, measure owner-side outcomes where available, and preserve negative results.
license: Apache-2.0
compatibility: Requires a website repository/filesystem. Node.js is recommended for ARWP CLI checks. Network access is useful for current primary-source research and live audits.
metadata:
  standard: agent-skills
  arwp-role: growth-orchestrator
---

# ARWP Growth Loop

Use this skill when the outcome is not merely “make the site agent-ready” but “improve the site's chances of being discovered, selected, cited or recommended while keeping the work evidence-backed and measurable.”

## Product loop

`research → classify → baseline → hypothesis → implement → verify → measure → keep/revert/revise`

Do not collapse this into a generic SEO checklist.

## Workflow

1. **Research before adding a tactic.** Start with:

```bash
node bin/arwp-trends.mjs list --since=90 --exclude-retired
node bin/arwp-hypotheses.mjs list --vertical=general
```

When network access exists, review current primary sources for the target surfaces. Prefer official platform documentation and specifications. Classify a mechanism as platform requirement, platform guidance, platform feature, platform measurement, or project experiment. Newness alone is not evidence.

For page-level structured data, identity, canonicalization, authorship, events, datasets, localization or terminology, load `registry/page-semantics-profiles.json` (or the published `recommendations/page-semantics.json`). Treat it as an implementation-routing profile, not as a ranking hypothesis.

2. **Establish the site baseline.** Inspect framework, deployment, public root, routes, content architecture, metadata, sitemap/robots, structured data, images/video, crawler policy, existing agent surfaces and owner-side metrics where available. Then run:

```bash
node bin/arwp-growth.mjs https://example.com --vertical=<vertical> --json
```

Do not infer Google/Bing/ChatGPT visibility from repository metadata.

When page semantics are relevant, inventory the important route archetypes and identify reusable canonical entities before editing templates. Classify pages such as site-home, organization, article-editorial, author-profile, event, dataset, software-application, product, video-watch, glossary-term/glossary-index, community-qa and collection-list. Do not install a universal JSON-LD bundle.

For portfolio or repeated site rollouts, follow `docs/SITE-ROLLOUT-PLAYBOOK.md` and start a site-specific record from `templates/growth/site-adoption-record.md`. Reuse the decision order and evidence contract; do not blindly copy provider-specific markup or crawler policy from a reference site.

3. **Select hypotheses, not cargo cult.** Choose the smallest applicable hypothesis set that has a clear implementation change, checkable completion condition and observable success signal. Platform requirements and high-confidence guidance come before optional features or experiments.

Structured-data correctness is a baseline contract, not an excuse to maximize schema volume. Remove obsolete feature-only markup when appropriate and never fabricate authors, dates, prices, ratings, reviews, event facts, organization facts or dataset provenance.

4. **Implement highest-confidence changes.** Typical order:
   - Search/AI/Discover eligibility blockers;
   - canonical URLs, sitemap and meaningful freshness;
   - canonical/sitemap/indexability consistency and reciprocal/self `hreflang` for real localized variants;
   - non-commodity content and original evidence;
   - resolvable identity, authorship and provenance;
   - stable WebSite/publisher/author/product/dataset/term identities and page-specific JSON-LD grounded in visible first-party facts;
   - unique useful event leaf pages for real events when targeting event features;
   - real Dataset provenance and DefinedTerm/DefinedTermSet graphs where the site's content model actually contains them;
   - deep-linkable sections and internal links;
   - relevant large images/video when a target surface benefits;
   - Preferred Sources or other bounded acquisition features when applicable;
   - snippet/AI-preview controls only when they match publisher policy;
   - crawler/freshness mechanisms that match publisher policy;
   - agent interoperability only for real agent use cases.

For each material route-level change, record `problem → evidence → risk → recommendedChange → files → autofix → verification → source`. Autofix only when the required facts already exist. Otherwise leave an explicit owner-data gate.

5. **Verify.** Run the site's own build/tests/lint and relevant ARWP checks. For each selected hypothesis, distinguish `pass`, `fail`, `manual-pass`, `manual-fail`, `external-owner-data`, `not-applicable` and `watch`. Never call a manual or owner-data check automated.

For semantic/template changes also parse generated JSON-LD, compare it with the rendered visible content, and check canonical/indexability/sitemap/hreflang consistency on changed routes. Use current feature-specific external validators or Search Console/Bing tools where owner access exists.

6. **Measure.** Where owner data exists, compare the relevant Google Search/generative/Discover signals, Bing AI citations and grounding-query samples, ChatGPT referral traffic/citations, image/video discovery, conversions and agent task completion. Choose a sensible before/after window. Do not automatically attribute movement to ARWP.

7. **Keep, revise, revert or retire.** Preserve negative results. Keep a correct change when evidence is neutral/positive, revise a weak implementation or measurement design, revert harmful changes, and retire a hypothesis when upstream guidance or evidence invalidates it.

Use `templates/growth/growth-loop-checklist.md`, `templates/growth/site-adoption-record.md` and `templates/growth/hypothesis-ledger.md` when a durable review trail is useful.

## Core rule

ARWP never guarantees ranking, Discover placement, AI citation, recommendation traffic or conversion. The goal is faster adaptation, stronger implementation discipline and better evidence about what works for the actual site.

## Search opportunity selection

After eligibility fixes, read `docs/SEARCH-OPPORTUNITIES.md`. Build a small reviewed map of real user needs, existing landing pages, original assets and useful next actions. Prefer improving a complete existing answer to generating pages for query variants.

```bash
node bin/arwp-opportunities.mjs templates/growth/arwp-opportunity-map.json
node bin/arwp-opportunities.mjs <site-map.json> --search-console=<private-query-page.json> --json
```

The bundled map is a self-pilot with hypothetical queries and no verified demand. Adapt it only after inspecting the target repository. Joint final query+page data is required for owner-observed prioritization; separate Queries and Pages exports or aggregate visibility snapshots cannot be joined into that evidence. Missing data stays unknown. Keep real exports and reports private.

Use the queue as a project heuristic, not a ranking score. Review overlapping URLs manually; do not automatically merge, redirect or noindex. Verify that declared original assets and internal links actually exist. Implement one substantive useful improvement, verify the built page and next action, record its commit, then use the existing experiment/visibility workflow for outcomes. Do not replace the live Growth audit or the owner-measurement gate with this offline planner.

## Search appearance review

After building relevant HTML, run the explicit local check and read `docs/SEARCH-APPEARANCE.md`:

```bash
node bin/arwp-search-appearance.mjs <built-page.html> --url=https://example.com/
```

Use the actual public URL represented by that file. A project or locale subdirectory does not have separate Google site-name or Search-favicon scope. Never overwrite hostname-wide branding during a project rollout. Inspect existing WebSite nodes, preserve conflicting identity evidence, and check genuine alternate names before adding markup. Review malformed JSON-LD even on non-root pages.

The report is static evidence, not a rendered-DOM, image-byte, robots or Search-appearance validation. Keep absent/unsupported declarations distinct from failed checks and actual outcomes. This command is not yet automatically invoked by the live `arwp-growth` audit. Carry its review actions into the site's adoption record explicitly, and retain owner-side appearance observation as a separate follow-up.

## Concrete implementation practices

After identifying the site gap, use `arwp-discoverability` or `arwp discoverability --search="comparison" --json` to inspect concrete practices. The corpus adds implementation choices to existing hypotheses and rules; a routing reference does not establish applicability or an outcome. Read the current native registry entries, select a few relevant IDs and carry accepted work through this Growth Loop, the site adoption record, Growth experiment and shared BraidGraph.
