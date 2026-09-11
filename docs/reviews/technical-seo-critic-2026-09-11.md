# Technical SEO Critic Review — 2026-09-11

This review deliberately looked for technical Search gaps that could remain after ARWP's existing Search Release, Technical Integrity, Search Surface, structured-data, sitemap, robots, canonical, deployment and measurement checks already pass.

It is a gap review, not a generic SEO checklist and not a ranking score.

## Scope

Reviewed the current ARWP technical/Search registries and runtime checks, the owner-controlled portfolio registry, representative public fleet surfaces, and current Google Search/Crawling documentation.

Primary fleet scope from `registry/portfolio-sites.json`:

- dkharlanau.github.io
- ptichi.com
- metalhatscats.com
- metkagram.github.io
- brali-lifeos.github.io
- cognitive-biases.github.io
- cbt-cards.github.io

Portfolio rollout guardrails remain active: audit before mutation and no production mutation merely because a site is listed in the fleet.

## Findings implemented in ARWP

### P0 — effective head parsing was not explicitly guarded

A page can contain canonical, robots, favicon, hreflang and other metadata yet still be effectively broken for Google if an invalid element such as `img` or `iframe` occurs earlier inside `head`. Google's documentation states that it treats such an invalid element as the end of the head and ignores later elements.

Action: added `TSC-01-head-metadata-parser-integrity` to `registry/technical-seo-critic-practices.json` and made final source-order inspection part of the critic skill.

### P1 — field Core Web Vitals were not carried into Search Release consistently

ARWP already knows Core Web Vitals through Site Focus, but an ordinary technical/Search release could still finish without explicitly carrying real-user performance evidence into the Search review.

Action: added `TSC-02-search-field-performance`. Field evidence remains owner/provider data; missing data is `unknown`, not an automatic failure or pass. Lighthouse/lab results are diagnostic and are not silently relabelled as field evidence.

### P1 — pagination needed an explicit canonical-independence challenge

Generic canonical validation does not catch the common state where page 2+ has a syntactically valid canonical pointing to page 1. Google recommends persistent crawlable pagination URLs and each useful page should have its own canonical URL.

Action: added `TSC-03-pagination-canonical-independence`.

### P1 — bounded samples could miss crawl-state explosions

Healthy sampled pages do not prove that filter, sort, tracking, search or faceted URL combinations cannot create a very large low-value crawl space.

Action: added `TSC-04-crawl-state-space-control`, including parameter-family inventory, equivalent-state control, real error handling for impossible states, and curated sitemap publication.

### P2 — HTTP conditional revalidation was absent from the technical critic layer

For large or frequently updated sites, truthful `ETag` / `Last-Modified` behavior can help crawlers revalidate unchanged resources efficiently. This is crawl-efficiency work, not a direct ranking promise.

Action: added `TSC-05-http-revalidation-efficiency`. ARWP `public-fetch` now retains `ETag` and `Last-Modified` so a live critic pass can inspect this evidence instead of discarding it.

### P2 — link relation semantics were only partially covered

Existing ARWP checks inspect crawlable `a[href]` discovery paths, but did not make accidental internal `nofollow` or outbound sponsored/UGC relationship semantics an explicit critic question.

Action: added `TSC-06-link-follow-and-relationship-integrity`.

### P2 — obsolete and falsely-labelled SEO work needed an explicit rejection layer

ARWP Search Surface generated a missing `html[lang]` action in the Search presentation lane. Current Google documentation says Google Search does not use the `lang` attribute to determine page language. The attribute remains useful for accessibility and document semantics, but it should not be sold as a Google Search language signal.

Action: removed the `surface:lang` SEO action from `lib/search-surface-core.mjs` and added `TSC-07-obsolete-and-false-seo-signals`. The critic also rejects `meta keywords`, `rel=next/prev` and obsolete sitelinks-search-box controls as current Google SEO tasks.

### P0 — canonical could disagree across HTML and HTTP channels

ARWP's ordinary canonical checks were centered on document/sitemap/internal-link consistency, but a proxy, framework or hosting layer can also emit an HTTP `Link: <...>; rel=canonical` header. Google supports both HTML and HTTP canonical declarations and warns that using both is more error-prone. An HTML self-canonical can therefore look green while the response header asks Google to consolidate elsewhere.

Action: added `TSC-08-canonical-channel-conflict`. ARWP `public-fetch` now retains the live `Link` header, and the critic requires exact resolved-URL agreement if HTML and HTTP canonical channels are intentionally used together.

### P1 — non-indexing serving restrictions could remain hidden

A binary `indexable / noindex` check is not enough. A page can remain indexable while `nosnippet`, `max-snippet:0`, `noimageindex`, `max-image-preview:none`, `max-video-preview:0`, `notranslate` or `unavailable_after` materially changes whether and how it can appear in Search, Discover, Images, video or AI Search surfaces. Google combines negative rules across applicable declarations, including `X-Robots-Tag`.

Action: added `TSC-09-negative-serving-directives`. The critic now resolves restrictive serving rules across HTML robots/googlebot metadata and HTTP response directives and only flags them when they conflict with the publisher's intended exposure.

### P0 — MetalHatsCats fleet target pointed at the wrong public surface

The portfolio registry used `https://github.com/metalhatscats/metalhatscats` as the canonical URL while the real public site is `https://metalhatscats.com/`. That could make a fleet audit inspect the repository page instead of the website.

Action: corrected `registry/portfolio-sites.json` to `https://metalhatscats.com/`.

## Things deliberately not added as new gaps

The critic review also checked several areas that are already adequately represented in ARWP and should not be duplicated:

- `X-Robots-Tag` is already observed by the public-fetch / technical-integrity path.
- Googlebot's current supported-file fetch boundary is already represented as a 2 MB retrieval-footprint check; the old 15 MB figure is obsolete.
- redirect migration directness already has a dedicated URL migration integrity path, while internal discovery detects links aimed at redirects/canonical aliases.
- Google Preferred Sources support is already present in the site audit/recommendation logic.
- sitemap lastmod provenance, soft 404 suspicion, canonical collisions, hreflang clusters, near-duplicate priority pages and final deployment proof are already explicit.

## Fleet observations from this round

The current public surfaces that were observable in this review show substantive crawlable content rather than obvious empty JS shells. Search results expose current pages for the SAP knowledge site, MetalHatsCats, Metkagram and CBT Cards, including deeper content surfaces. This does not replace Search Console or a browser/header crawl.

Ptichi needs a Search-outcome verification round rather than speculative canonical/robots changes. The repository's latest captured owner evidence (2026-09-05) records verified Google ownership, a successfully processed sitemap with 60 discovered pages, and indexing requests for three priority URLs. The paired live audit records all 60 sampled URLs as HTTP 200 with self-canonicals and no reported live issues. In this 2026-09-11 critic round, generic web search did not surface `site:ptichi.com` or exact-domain results, so current indexing/search visibility remains `owner-data / needs verification`, not a proven repository defect. Refresh Search Console indexing, impressions and selected-canonical evidence before expanding or rewriting Search infrastructure.

No repository evidence was found in the sampled fleet for current use of `meta keywords`, `rel=next/prev` or `nositelinkssearchbox`; the new obsolete-signal rule is therefore mainly a regression guard at this point.

No sampled repository exposed an obvious pagination/query-state family or internal `nofollow` implementation in this pass, so the new pagination, URL-state and link-relation checks remain applicability-gated rather than becoming synthetic fleet defects.

`ETag` / `Last-Modified`, HTTP `Link` canonical behavior and negative response-level serving directives were not promoted as blanket site failures because they must be verified from live response headers and hosting/proxy behavior first.

## Verification contract

Added `scripts/technical-seo-critic-test.mjs` to verify:

- all nine critic practices and their source references exist;
- the Search Surface runtime no longer generates the `html[lang]` SEO action;
- public fetch retains `Link`, `ETag` and `Last-Modified` evidence;
- the critic skill preserves the accessibility/Search distinction;
- the critic skill includes the HTTP-versus-HTML canonical challenge and negative serving-directive review;
- the MetalHatsCats canonical fleet target is the real public hostname.

Production Search impact still requires live verification and provider evidence. Passing these checks does not prove ranking, indexing, traffic, Discover visibility or AI citation uplift.
