# Comprehensive site audit contract

Use this reference whenever `arwp-prepare-site` is applied to an existing website and the user asks for a thorough, deep, complete, end-to-end, or whole-site review.

The canonical machine-readable domain list is `registry/comprehensive-site-audit.json`.

## Core rule

A **full audit is a coverage claim**. Do not use that phrase merely because many different checks ran.

ARWP currently contains deliberately bounded tools such as Site Readiness Gate, Technical Integrity and Internal Discovery. They are useful preflight and diagnostic evidence, but a 20-page or 50-page cohort does not prove the rest of the site is healthy.

Before diagnosing pages, build and reconcile the inventory. The audit is complete only when the report can answer:

- how many routes/pages were discovered;
- which are canonical owners;
- which are aliases, redirects, non-indexable states, utilities or non-HTML resources;
- which page archetype/template and locale each canonical page belongs to;
- which pages received deterministic checks;
- which pages received rendered-browser/runtime checks;
- what was excluded and why;
- what remains unknown.

If those questions cannot be answered, use `partial` or `unknown`, not “full”.

## Evidence stack

Treat the site as five related but non-interchangeable states:

1. **Repository** — source intent: routes, content, templates, metadata generators, redirect rules, sitemap/robots ownership, analytics config.
2. **Build** — generated truth: final HTML, assets, feeds, sitemap, robots, JSON-LD, manifest and generated routing artifacts.
3. **Deployed HTTP** — public delivery: status, redirects, headers, content type, canonical host, cache behavior and response body.
4. **Rendered browser** — runtime/user truth: final DOM, console/network failures, hydration, keyboard/focus, responsive layout, forms and interactive controls.
5. **Owner/platform evidence** — Search Console, Bing Webmaster Tools, field Core Web Vitals, analytics, crawler logs, AI referrals and task/conversion outcomes.

Never silently substitute one layer for another. A repository `<title>` is not proof of the deployed title. Raw HTML is not proof of an SPA's rendered content. Lighthouse is not field Core Web Vitals. A green implementation check is not proof of indexing or ranking.

## Phase 1 — enumerate the site before sampling it

Collect route candidates from every available source:

- route manifests, content collections and data-driven page generators;
- deterministic build output;
- sitemap indexes and leaf sitemaps, including `Sitemap:` declarations in `robots.txt`;
- all same-origin crawlable links observed while traversing known pages;
- canonical and `hreflang` targets;
- feeds when they expose first-party page URLs;
- first-party URLs emitted by JSON-LD or machine-readable catalogs;
- redirect maps;
- pagination, locale variants, generated filters/states and known utility routes.

Normalize URLs deliberately. Preserve query states that are real product/search states; do not erase them merely to make the inventory smaller.

Reconcile the sources. A URL present only in the sitemap, only in the build, only in navigation, or only as an alias is a finding to classify, not a reason to discard it.

Build a page ledger with at least:

`url | canonicalOwner | routeArchetype | templateOrLayout | locale | inventorySources | expectedIndexability | auditState | findings | evidence`

Classify non-canonical inventory items as redirect, canonical alias, noindex utility, error state, non-HTML resource or unexplained.

## Phase 2 — choose the coverage state

Use the registry definitions exactly:

- `runtime-complete` — every canonical page gets deterministic and rendered/runtime coverage;
- `complete` — every canonical page gets all applicable deterministic checks, plus all system surfaces;
- `template-runtime-complete` — every canonical page gets deterministic checks, while runtime/browser checks cover every distinct template/archetype and every changed/high-risk page;
- `partial` — some page or domain checks are sampled/capped/skipped;
- `unknown` — inventory or evidence cannot be reconciled.

For small static sites, prefer `runtime-complete`.

For larger sites, do not hammer production merely to obtain a label. Run page-complete repository/build checks, batch public HTTP checks conservatively, and render every route archetype plus changed/high-risk pages. Say exactly which pages were not rendered.

## Phase 3 — run system-wide surfaces

These are site-level rather than page-level and must never disappear because page sampling looked healthy:

- canonical host, HTTP→HTTPS and hostname redirects;
- TLS/HTTPS/mixed-content state;
- `robots.txt` and crawler-specific policy;
- sitemap index and leaf sitemap integrity;
- representative 404/410 and soft-404 behavior;
- favicon/site-name/search-result identity;
- feeds/manifests/catalogs where present;
- security response headers and privacy/analytics behavior;
- Search/analytics owner integrations where access exists;
- deployment revision identity and stale-build drift where repository work is involved.

## Phase 4 — page-complete deterministic checks

Every enumerable canonical page should receive the applicable deterministic parts of the machine-readable audit domains.

At minimum cover:

1. HTTP, redirects, content type, robots/noindex, canonical, sitemap and hreflang.
2. Title, description, language, viewport, social metadata, favicon/preferred-image references.
3. JSON-LD parseability, page-type fit, stable entity identity and visible-fact parity.
4. Clear page job, first useful content, thin/duplicate/stale/template-heavy content and claim/source boundaries.
5. Internal discovery: inbound path, descriptive anchors, breadcrumbs, continuation and canonical link targets.
6. Accessibility structure that can be inspected statically: headings, landmarks, labels/names, alt text and language.
7. Performance delivery basics: asset sizes, image dimensions, loading policy, caching/compression where public responses are available.
8. Media/download validity and content types.
9. Localization consistency for every locale variant.
10. Trust/provenance/legal surfaces when applicable.
11. AI/agent policy and truthful agent-discovery surfaces.
12. Freshness/version/lastmod consistency.

All internal links and critical first-party assets should be validated when the build/public inventory makes that feasible. Do not probe only the first few links and call the link graph clean.

## Phase 5 — rendered browser and interaction coverage

Rendered/browser evidence is mandatory when JavaScript, layout or interaction can materially change the result.

For each route archetype/template, and for every high-risk or changed page, verify:

- final DOM contains the primary content promised by raw/source evidence;
- no critical console errors or failed network requests;
- SPA/deep-link reload and history behavior;
- desktop and narrow mobile layouts;
- keyboard navigation and visible/unobscured focus;
- navigation/menu/dialog/tab/accordion behavior;
- forms: labels, validation, success/error states without destructive submissions;
- search/filter/sort/pagination and empty states;
- copy/share/download controls;
- sticky UI, cookie banners and interstitials do not obscure primary content;
- images/fonts/media render without breakage;
- reduced-motion and responsive/reflow behavior where relevant.

Do not report an automated accessibility pass as WCAG conformance. Manual keyboard and interaction review remains necessary. W3C WCAG 2.2 is the baseline accessibility reference.

## Phase 6 — specialist packs

Activate every pack whose trigger is actually present:

- ecommerce/product;
- editorial/news;
- datasets/research;
- tool/app/account;
- local business;
- media-heavy.

Do not run irrelevant checks just to make the report longer. “Comprehensive” means exhaustive over the site's applicable surface, not universal cargo cult.

## Phase 7 — current Search/AI specialists

After coverage exists, compose the relevant ARWP specialists rather than duplicating their logic:

- `arwp-site-focus` for problem territory, information architecture and scope drift;
- Technical Integrity and Site Readiness Gate as bounded source-backed preflight;
- `arwp-search-release` for hostname/search-result release presentation;
- `arwp-technical-seo-critic` for adversarial false-green review;
- `arwp-internal-discovery` for canonical relation/crawl-path evidence;
- `arwp-image-discovery` for meaningful image surfaces;
- `arwp-index-worthiness` before broad generated-page publication;
- `arwp-ai-search-content` for human-useful retrieval/citation quality;
- `arwp-measurement-os` for provider-native outcomes;
- `arwp-future-search` only after current foundations are healthy.

A bounded specialist report contributes evidence to the page/site ledger. It does not overwrite the coverage state.

## Phase 8 — performance, accessibility, security and privacy are first-class

Do not reduce ARWP application to Search metadata.

Performance review should distinguish field Core Web Vitals from lab diagnostics. Current good field thresholds remain LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1 at the 75th percentile, segmented appropriately; owner/platform field data is stronger than a one-off lab run.

Accessibility should use WCAG 2.2 as the baseline and combine deterministic checks with manual keyboard/focus/interaction review.

Security/privacy review should inspect secure delivery, relevant response headers, mixed content, third-party scripts, analytics/cookie behavior and whether privacy/terms/security surfaces are actually applicable. Interactive apps, authentication, uploads and payments require a deeper application-security gate; do not pretend a public-page audit is a penetration test.

## Phase 9 — source → build → deploy drift

When repository mutation is part of the task, the completion report must identify the exact tested revision and deployment evidence.

Check for:

- source changed but build output did not;
- build output changed but deployment still serves an older artifact;
- generated metadata differs from source expectations;
- one shared template changed many routes outside the initially intended cohort;
- deployed routes exist that are missing from repository/build inventory;
- old aliases remain in sitemap/navigation after migration.

Use Treatment Cohort Integrity and Repository Mapper evidence when available. Do not shrink the blast radius merely to preserve a cleaner story.

## Phase 10 — completion gates

A comprehensive ARWP application is not complete until the report states:

- coverage state;
- discovered route count;
- canonical in-scope count;
- deterministic audited count;
- rendered/browser-tested count;
- redirects/aliases/utilities/non-HTML/excluded counts;
- unknown count;
- every material P0/P1/P2 finding with evidence layer;
- every `watch`, `owner-data` and `not-applicable` decision that materially affects readiness;
- what was autofixed, what requires owner/runtime evidence, and what was intentionally left unchanged;
- exact verification commands/results and tested revision/deployment identity;
- an explicit list of anything not checked.

Never replace this with one SEO, AI, accessibility, security or quality score.
