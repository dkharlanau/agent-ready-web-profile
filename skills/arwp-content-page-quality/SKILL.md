---
name: arwp-content-page-quality
description: Enforce the strict ARWP quality contract for canonical content/detail pages: search/snippet identity, Open Graph/social previews, representative images, end-of-content Share/Copy/social actions, truthful structured data, accessible runtime behavior, feedback integrity and final-artifact family-wide CI. Use whenever a site contains articles, guides, docs/detail, research, reference, case-study, glossary, resource or substantive product/tool detail pages.
license: PolyForm-Strict-1.0.0
compatibility: Requires access to website source and preferably final generated HTML. Runtime/browser access is required to prove interactive Share/Copy/feedback behavior; repository declarations alone are insufficient.
metadata:
  standard: agent-skills
  arwp-role: content-page-quality
---

# ARWP Content Page Quality

Use this skill for every site with canonical content/detail pages. It turns distribution and preview quality from an optional polish pass into an explicit page-family contract.

Read first:

- `registry/content-page-quality-contract.json`
- `registry/comprehensive-site-audit.json` when the task is deep/complete/whole-site
- `registry/search-release-practices.json`
- `registry/internal-discovery-distribution-practices.json`
- `docs/CONTENT-PAGE-QUALITY-CONTRACT.md`

## Core rule

Classify routes before checking them. Articles, blog posts, guides, documentation detail, reference/research detail, case studies, glossary terms, resource detail and substantive product/tool detail pages are in scope by default.

Homepage, hubs/listings, search results, auth, privacy/terms, errors, aliases, noindex utilities and non-HTML resources are not content/detail pages by default. `not-applicable` requires a reason; it is never a shortcut for a missing implementation.

**Priority controls remediation order, not audit coverage.** Every applicable requirement must emit an explicit state. A P2 item may be lower urgency, but it may not disappear from a strict or complete audit.

## Required content-page footer

Every applicable content/detail page must end with a compact distribution footer after the primary content and before broad sitewide footer/navigation, unless the layout has an equivalent end-of-content utility region.

Minimum contract:

- `Share`;
- `Copy link`;
- at least two explicit provider share destinations selected for the site's audience.

Typical provider candidates include LinkedIn, X, Facebook, Bluesky, Telegram and WhatsApp. Do not cargo-cult every network onto every site. The configured set is a product decision, but at least two direct destinations are required for this strict content-page profile.

All sharing uses the canonical page URL. Encode provider query values correctly. Do not put private state, auth tokens or sensitive user data in share URLs.

### Native Share

Use `navigator.share()` only as progressive enhancement from a real user activation. Feature-detect it. Use `navigator.canShare()` when a payload needs validation. Treat user cancellation/rejection as not-shared; do not display a false success state.

`Copy link` is the universal fallback and must remain available when Web Share is unsupported or fails.

### Direct provider shares

Provider links must be normal usable links or buttons with meaningful accessible names and visible focus. Runtime-test the configured providers because external share endpoints can change independently of the repository.

The page content stays primary. Do not add a sticky/floating wall of icons that obscures reading merely to satisfy the contract.

## Social preview contract

For each applicable page, verify the final generated HTML exposes a coherent preview:

- page-specific title and description;
- canonical URL;
- `og:title`;
- `og:description`;
- `og:url` equal to canonical;
- intentional `og:type`;
- absolute HTTPS `og:image`;
- meaningful `og:image:alt`;
- card compatibility metadata for the site's supported social targets.

When width, height and media type are known, publish them. Verify the image actually resolves as an image.

Prefer a dedicated page-relevant share image. ARWP's interoperable default is approximately 1200x630 / 1.91:1 when supported by the target platforms. This is an ARWP product default, not an Open Graph requirement and not a ranking factor.

Keep page share images separate from the hostname favicon. The favicon is stable site identity; the social/preferred image represents the page.

## Search-result and snippet quality

Do not stop at head tags. Search engines can derive title/snippet text from visible content.

For each content/detail page:

1. make `<title>`, H1/prominent heading, `og:title` and page purpose coherent;
2. write a page-specific meta description;
3. make the opening visible copy useful even if the meta description is ignored;
4. keep repetitive share/consent/utility text from dominating the snippet surface;
5. use `data-nosnippet` only for non-essential UI when justified;
6. never hide the substantive answer/content merely to force a preferred snippet.

## Structured semantics

Use page-appropriate structured data only when it truthfully describes visible content. Reuse canonical URLs and stable publisher/author identities. Do not invent:

- author identities;
- publication/review dates;
- ratings;
- DOI-like identifiers;
- product facts;
- freshness from CI/build time.

Article-like pages may use Article/BlogPosting/TechArticle when the visible page actually fits that role. WebPage is preferable to a false specialized type.

## Feedback and reactions

Do not add decorative likes/dislikes merely because engagement UI looks useful.

A `Was this useful? Yes / No` control is allowed only when one of these is true:

1. it sends to a real analytics/backend/issue/feedback sink with documented accepted/error behavior; or
2. it is explicitly labelled as local-only state and never presented as aggregate feedback.

Rules:

- no fake public counts;
- no success message before the configured sink accepts/records the event;
- failure/retry state is accessible;
- no hidden claim that feedback syncs across devices when it does not;
- do not leak sensitive page/user data in query strings;
- measurement distinguishes share intent/menu opening from confirmed external publication, which the browser normally cannot prove.

If no real sink exists, omit the reaction control. Share/Copy remain useful without it.

## Accessibility and failure behavior

For every distribution implementation/template, verify in rendered runtime evidence:

- semantic button/link roles;
- accessible names, including icon-only controls;
- keyboard operation;
- visible/unobscured focus;
- success/error state that is not color-only;
- Share API unsupported/cancel/error paths;
- Copy link success/error paths;
- primary content remains readable if sharing JavaScript fails.

A static HTML declaration is not runtime proof.

## Full-site enforcement

For a complete/strict ARWP pass:

1. enumerate every canonical page;
2. classify page family/archetype;
3. evaluate every applicable CPQ requirement for every content/detail page against the final build artifact;
4. runtime-test every distinct sharing/footer implementation plus every changed/high-risk page;
5. record `pass`, `fail`, `watch`, `owner-data`, `not-applicable` or `unknown` for every applicable requirement;
6. require a reason for every `not-applicable` state;
7. fail the strict release on applicable P0 deterministic failures;
8. fail the strict quality pass on applicable P1 deterministic failures;
9. keep P2 findings explicit instead of silently dropping them.

Do not use one representative article to claim every article passed when the route inventory is enumerable.

## CI contract

The strongest implementation puts family-wide deterministic checks after all generators and metadata post-processors and before publication. A final-artifact gate should catch at least:

- missing/duplicate/contradictory canonical;
- generic/missing title or description;
- missing or contradictory Open Graph URL/title/description/image;
- missing content-page distribution footer;
- missing Share/Copy controls;
- fewer than two configured direct provider destinations;
- malformed JSON-LD;
- wrong-host metadata;
- accidental noindex;
- missing/failed social image assets when the build can validate them;
- regressions where a shared layout loses distribution controls across the route family.

Then inspect deployed/runtime evidence separately. A passing build does not prove external provider share dialogs, deployed asset delivery or Search/social selection.

## Done when

The content/detail route inventory is explicit, every applicable requirement has a state, final artifacts pass deterministic P0/P1 requirements, runtime behavior has evidence for each distinct implementation, and any owner/provider outcome evidence remains separate from implementation quality.
