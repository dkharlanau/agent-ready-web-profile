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

`research → classify → technical preflight → internal discovery/demand baseline → hypothesis → implement → verify → measure → keep/revert/revise`

Do not collapse this into a generic SEO checklist.

## Workflow

1. **Research before adding a tactic.** Start with:

```bash
node bin/arwp-trends.mjs list --since=90 --exclude-retired
node bin/arwp-hypotheses.mjs list --vertical=general
```

When network access exists, review current primary sources for the target surfaces. Prefer official platform documentation and specifications. Classify a mechanism as platform requirement, platform guidance, platform feature, platform measurement, or project experiment. Newness alone is not evidence.

For page-level structured data, identity, canonicalization, authorship, events, datasets, localization or terminology, load `registry/page-semantics-profiles.json` (or the published `recommendations/page-semantics.json`). Treat it as an implementation-routing profile, not as a ranking hypothesis.

2. **Establish the site baseline and run Technical Integrity.** Inspect framework, deployment, public root, routes, content architecture, metadata, sitemap/robots, structured data, images/video, crawler policy, existing agent surfaces and owner-side metrics where available. Then run both:

```bash
node bin/arwp.mjs technical-integrity https://example.com/ --max-pages=20 --max-link-targets=24 --json
node bin/arwp-growth.mjs https://example.com --vertical=<vertical> --json
```

Technical Integrity is the bounded preflight for problems that can already be checked before Search outcome windows mature. It evaluates provider/source-backed technical blockers and conservative review heuristics including:

- robots.txt fetch semantics and path-specific Googlebot access on sampled priority URLs;
- known HTTP/noindex failures;
- Google AI snippet restrictions;
- canonical integrity on HTML pages only;
- bounded retrieval-footprint outliers without relabeling audit limits as Search failures;
- soft-404 suspicion;
- crawlable internal-link markup plus a capped health probe of important same-origin link targets;
- raw textual availability and JS-shell risk;
- hreflang reciprocity;
- Bing preview/grounding controls;
- near-duplicate priority content;
- OAI-SearchBot policy separately from GPTBot training policy.

Internal-link target probing is intentionally bounded. By default Goose selects at most 24 same-origin targets from the priority cohort, favoring links referenced from more sampled pages, then more occurrences and shallower paths. `404`, `410` and `5xx` targets make this P1 check fail; redirects, authorization/rate-limit states and probe uncertainty remain `WATCH`. A redirect is not automatically harmful, and the sample is not a claim about every internal link on the site.

Interpret states strictly:

- `FAIL` — a bounded source-backed blocker or explicit broken technical target was actually observed; fix or deliberately resolve it before optional acquisition work when material;
- `WATCH` — investigate context/rendering/redirects/audit limits; it is not automatically a defect;
- `PASS` — no issue was observed by that detector in the bounded sample; it is not ranking/indexing proof;
- `not-applicable` — the check does not apply to the observed representation.

A bounded fetch failure is **unknown**, not an indexability failure. A directly served Markdown/text resource is not required to carry an HTML `<link rel="canonical">`. Do not weaken these truth boundaries to make the report look cleaner.

Do not infer Google/Bing/ChatGPT visibility from repository metadata or from a green technical preflight.

### Internal discovery before content expansion

For multi-page sites, data sites, documentation, editorial resources, entity directories or any task involving internal links/hubs/topic clusters, run the bounded Internal Discovery evidence graph after hard eligibility blockers are understood and before approving broad URL/content expansion:

```bash
node bin/arwp-internal-discovery.mjs https://example.com/ \
  --max-pages=20 --json --output=internal-discovery.json
```

Read `docs/INTERNAL-DISCOVERY-EVIDENCE.md`. Use the report to review:

- canonical owners with no observed inbound owner path in a **complete** bounded cohort;
- owners reached only by global navigation when an in-context relationship would genuinely help users;
- owners with no contextual/hub/utility continuation when the page is not intentionally terminal;
- links that still point at sampled redirects, canonical aliases or non-indexable states rather than stable canonical owners;
- unknown or out-of-cohort edges that need more evidence before action.

The analyzer classifies raw-HTML link placement conservatively as contextual, hub, utility, global or unclassified. Those are Goose review heuristics, not Google ranking categories. Never produce PageRank/authority/SEO scores from this graph. Never add sitewide/footer links merely to improve a count.

Coverage is part of the result. If any canonical owner reaches the per-page anchor observation cap, `gapEvaluationState=partial`; inbound/global-only gaps that could be falsified by omitted edges stay suppressed. Preserve that unknown state instead of calling pages orphaned.

When JavaScript rendering materially changes the graph, use rendered/browser evidence or a deterministic inspected build artifact; do not treat raw source or a stale build as conclusive runtime graph evidence.

When page semantics are relevant, inventory the important route archetypes and identify reusable canonical entities before editing templates. Classify pages such as site-home, organization, article-editorial, author-profile, event, dataset, software-application, product, video-watch, glossary-term/glossary-index, community-qa and collection-list. Do not install a universal JSON-LD bundle.

For portfolio or repeated site rollouts, follow `docs/SITE-ROLLOUT-PLAYBOOK.md` and start a site-specific record from `templates/growth/site-adoption-record.md`. Reuse the decision order and evidence contract; do not blindly copy provider-specific markup or crawler policy from a reference site.

3. **Select hypotheses, not cargo cult.** Choose the smallest applicable hypothesis set that has a clear implementation change, checkable completion condition and observable success signal. Platform requirements and high-confidence guidance come before optional features or experiments.

Structured-data correctness is a baseline contract, not an excuse to maximize schema volume. Remove obsolete feature-only markup when appropriate and never fabricate authors, dates, prices, ratings, reviews, event facts, organization facts or dataset provenance.

4. **Implement highest-confidence changes.** Typical order:
   - Technical Integrity `FAIL` blockers and reviewed high-impact `WATCH` findings;
   - broken important internal-link destinations observed by the bounded target-health check;
   - reviewed Internal Discovery P1 missing-path findings and clearly useful canonical transition cleanup;
   - Search/AI/Discover eligibility blockers;
   - canonical URLs, sitemap and meaningful freshness;
   - canonical/sitemap/indexability consistency and reciprocal/self `hreflang` for real localized variants;
   - non-commodity content and original evidence;
   - resolvable identity, authorship and provenance;
   - stable WebSite/publisher/author/product/dataset/term identities and page-specific JSON-LD grounded in visible first-party facts;
   - unique useful event leaf pages for real events when targeting event features;
   - real Dataset provenance and DefinedTerm/DefinedTermSet graphs where the site's content model actually contains them;
   - useful contextual/hub/action internal links justified by actual user journeys, not graph-volume targets;
   - deep-linkable sections;
   - relevant large images/video when a target surface benefits;
   - Preferred Sources or other bounded acquisition features when applicable;
   - snippet/AI-preview controls only when they match publisher policy;
   - crawler/freshness mechanisms that match publisher policy;
   - agent interoperability only for real agent use cases.

For each material route-level change, record `problem → evidence → risk → recommendedChange → files → autofix → verification → source`. Autofix only when the required facts already exist. Otherwise leave an explicit owner-data gate.

5. **Verify.** Run the site's own build/tests/lint, Technical Integrity again on the deployed/public surface when network access exists, and relevant ARWP checks. For each selected hypothesis, distinguish `pass`, `fail`, `manual-pass`, `manual-fail`, `external-owner-data`, `not-applicable` and `watch`. Never call a manual or owner-data check automated.

For semantic/template changes also parse generated JSON-LD, compare it with the rendered visible content, and check canonical/indexability/sitemap/hreflang consistency on changed routes. Use current feature-specific external validators or Search Console/Bing tools where owner access exists.

For internal-link/hub changes, rerun the same bounded Internal Discovery cohort when practical. A cleaner graph verifies the implementation only; Search impressions, positions, citations, referrals and conversions remain separate outcome evidence.

Technical Integrity is intentionally self-correcting. If a live dogfood run exposes a false positive caused by an audit limit, representation mismatch or detector assumption, fix the detector/evidence model rather than editing the target site to satisfy a bad check.

6. **Measure.** Where owner data exists, compare the relevant Google Search/generative/Discover signals, Bing AI citations and grounding-query samples, ChatGPT referral traffic/citations, image/video discovery, conversions and agent task completion. Choose a sensible before/after window. Do not automatically attribute movement to ARWP.

7. **Keep, revise, revert or retire.** Preserve negative results. Keep a correct change when evidence is neutral/positive, revise a weak implementation or measurement design, revert harmful changes, and retire a hypothesis when upstream guidance or evidence invalidates it.

Use `templates/growth/growth-loop-checklist.md`, `templates/growth/site-adoption-record.md` and `templates/growth/hypothesis-ledger.md` when a durable review trail is useful.

## Core rule

ARWP never guarantees ranking, Discover placement, AI citation, recommendation traffic or conversion. The goal is faster adaptation, stronger implementation discipline and better evidence about what works for the actual site.

## Search opportunity selection

After eligibility fixes and relevant Internal Discovery review, read `docs/SEARCH-OPPORTUNITIES.md`. Build a small reviewed map of real user needs, existing landing pages, original assets and useful next actions. Prefer improving a complete existing answer to generating pages for query variants.

```bash
node bin/arwp-opportunities.mjs templates/growth/arwp-opportunity-map.json
node bin/arwp-opportunities.mjs <site-map.json> --search-console=<private-query-page.json> --json
```

The bundled map is a self-pilot with hypothetical queries and no verified demand. Adapt it only after inspecting the target repository. Joint final query+page data is required for owner-observed prioritization; separate Queries and Pages exports or aggregate visibility snapshots cannot be joined into that evidence. Missing data stays unknown. Keep real exports and reports private.

Use the queue as a project heuristic, not a ranking score. Review overlapping URLs manually; do not automatically merge, redirect or noindex. Verify that declared original assets and internal links actually exist. Implement one substantive useful improvement, verify the built page and next action, record its commit, then use the existing experiment/visibility workflow for outcomes. Do not replace the live Growth audit or the owner-measurement gate with this offline planner.

## Search appearance review

After building relevant HTML, run the explicit local check and read `docs/SEARCH-APPEARANCE.md`:

```bash
node bin/arwp-search-appearance.mjs <built-page.html> \
  --url=https://example.com/ --output=appearance.json
```

Use the actual public URL represented by that file. A project or locale subdirectory does not have separate Google site-name or Search-favicon scope. Never overwrite hostname-wide branding during a project rollout. Inspect existing WebSite nodes, preserve conflicting identity evidence, and check genuine alternate names before adding markup. Review malformed JSON-LD even on non-root pages.

The report is static evidence, not a rendered-DOM, image-byte, robots or Search-appearance validation. Keep absent/unsupported declarations distinct from failed checks and actual outcomes. This command is not yet automatically invoked by the live `arwp-growth` audit. Carry its review actions into the site's adoption record explicitly, and retain owner-side appearance observation as a separate follow-up.

When a Search Appearance finding is accepted and a repository change is actually being prepared, combine it with an existing Repository Mapper Site State Graph instead of guessing the source file:

```bash
node bin/arwp-search-appearance-patch.mjs build \
  appearance.json .arwp/site-state.json \
  --output=appearance-patch.json
```

The patch manifest is proposal-only. It records exact mapped source ownership and `beforeSha256` only when ownership is proven. `buildPath` alone is not field ownership. Unknown site-name state remains absent rather than becoming a patch request; ambiguous framework ownership remains manual; project-subdirectory hostname branding stays blocked. A patch manifest never authorizes a target-repository write by itself.

## Concrete implementation practices

After identifying the site gap, use `arwp-discoverability` or `arwp discoverability --search="comparison" --json` to inspect concrete practices. The corpus adds implementation choices to existing hypotheses and rules; a routing reference does not establish applicability or an outcome. Read the current native registry entries, select a few relevant IDs and carry accepted work through this Growth Loop, the site adoption record, Growth experiment and shared BraidGraph.
