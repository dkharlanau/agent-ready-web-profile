# Content Page Quality Contract

Status: strict ARWP content/detail page contract · reviewed 2026-09-16

The canonical machine-readable rules live in `registry/content-page-quality-contract.json`. The execution workflow lives in `skills/arwp-content-page-quality/SKILL.md`.

## Why this exists

ARWP already had strong Search release, image, internal-discovery and comprehensive-audit rules, but some distribution features were intentionally optional. That made it possible for a technically healthy content site to pass broad work while still shipping article/detail pages with weak social previews, generic images, no reliable Share/Copy surface, or decorative feedback controls that record nothing.

This contract fixes the applicability problem rather than adding another vanity score.

For content/detail pages, quality is a page-family invariant. Every applicable rule must be evaluated. Priority decides remediation order; it does not allow an agent to silently omit the rule.

## In-scope pages

Required by default:

- articles and blog posts;
- guides;
- documentation detail pages;
- reference and research detail pages;
- case studies;
- glossary/term pages;
- resource detail pages;
- substantive product/tool detail pages whose primary job is content, explanation or reference.

Not applicable by default:

- homepage;
- hubs/listings;
- search results;
- auth flows;
- privacy/terms;
- error pages;
- redirect/canonical aliases;
- noindex utilities;
- non-HTML resources.

A `not-applicable` decision needs a reason.

## Mandatory end-of-content distribution footer

Every in-scope page must expose a compact distribution footer after the primary content and before broad sitewide footer/navigation, unless the design already has an equivalent end-of-content utility region.

Minimum actions:

```text
Share · Copy link · [Provider 1] · [Provider 2]
```

The site chooses providers for its audience. Typical candidates include LinkedIn, X, Facebook, Bluesky, Telegram and WhatsApp. Do not render every network merely to increase icon count.

Optional actions can include:

```text
Save · Cite · Copy Markdown link · Print
```

The canonical URL is the source of truth for every share/copy/citation action.

### Native Share + fallback

Use the Web Share API only as progressive enhancement. The `navigator.share()` call must be triggered by user activation and must be feature-detected. When a payload needs validation, `navigator.canShare()` can be used where supported.

`Copy link` remains the universal fallback. Cancellation or rejection of the native share sheet is not a successful share.

Primary reference: https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API

## Social preview surface

Each in-scope page needs a deliberate preview in final generated HTML.

Required ARWP baseline:

- page-specific `<title>`;
- page-specific meta description;
- canonical URL;
- `og:title`;
- `og:description`;
- `og:url` matching canonical;
- intentional `og:type`;
- absolute HTTPS `og:image`;
- meaningful `og:image:alt`;
- explicit card compatibility metadata for the social targets the site supports.

When the image width, height and media type are known, publish them. Verify the image URL actually serves an image.

Open Graph requires the core object identity fields and supports image/description/locale/site-name metadata. ARWP adds a stricter product-quality layer for content pages.

Primary reference: https://ogp.me/

## Share image policy

A page share image and a hostname favicon solve different problems.

- favicon = stable site/hostname identity;
- share/preferred image = representative page/content asset.

For substantial content, prefer a page-relevant visual rather than falling back to a tiny logo. ARWP's interoperable default is approximately `1200 × 630` / `1.91:1` where target platforms support it. That dimension is an ARWP design default, not an Open Graph requirement and not a Search ranking claim.

Keep Open Graph image selection, structured-data image and any preferred page image semantically coherent. Platform-specific crops/renditions may differ.

## Search title and snippet surface

Head metadata is not the whole result. Google can derive title links and snippets from visible page content.

A content page therefore needs:

- a concise descriptive title;
- a distinctive primary heading;
- useful opening copy that states the page's job/value;
- a page-specific meta description;
- no contradictory social title;
- no utility/share/consent boilerplate dominating the leading text.

Use `data-nosnippet` only for non-essential UI when appropriate. Do not hide the substantive answer/content merely to force a preferred snippet.

Primary references:

- https://developers.google.com/search/docs/appearance/title-link
- https://developers.google.com/search/docs/appearance/snippet

## Structured data

Use only page types that match visible content. Article-like pages may use `Article`, `BlogPosting` or `TechArticle` where truthful. Otherwise use a more general page type rather than manufacturing specialized semantics.

Do not invent:

- authors;
- review/publication dates;
- ratings;
- identifiers;
- product facts;
- freshness from build time.

Canonical URLs, image identity, publisher/author entities and visible page facts should agree.

Primary references:

- https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- https://developers.google.com/search/docs/appearance/structured-data/article

## Feedback: useful only when it is real

A thumbs-up/thumbs-down or `Was this useful?` control is not mandatory.

If there is no real persistence or measurement sink, omit it. Do not ship a reaction button that changes appearance locally and implies a vote was recorded somewhere.

A feedback control is acceptable when:

- an analytics/backend/issue/feedback endpoint actually receives it; or
- the UI explicitly says the state is local-only.

If aggregate counts are shown, they must come from real aggregate data. The UI must expose failure/retry state and must not show success before the sink accepts the event.

## Accessibility and resilience

Share controls are interactive product UI and therefore need runtime evidence:

- semantic buttons/links;
- meaningful accessible names;
- accessible labels for icon-only buttons;
- keyboard operation;
- visible/unobscured focus;
- non-color-only success/error state;
- working fallback when Web Share is unsupported;
- primary content remains usable if sharing JavaScript fails.

WCAG 2.2 remains the accessibility baseline: https://www.w3.org/TR/WCAG22/

## Strict applicability ledger

A strict or complete ARWP pass must produce one state for every applicable requirement on every in-scope content/detail page:

```text
pass | fail | watch | owner-data | not-applicable | unknown
```

Rules:

1. `not-applicable` requires a reason.
2. `unknown` is not a pass.
3. P0 failure blocks a strict release.
4. P1 failure blocks a strict quality pass.
5. P2 is still evaluated; lower priority never means omitted.
6. Final generated artifacts, not just source templates, are the deterministic evidence surface.
7. Every distinct Share/Copy/footer runtime implementation needs rendered interaction evidence.

This is deliberately different from a score. A site cannot compensate for a broken Share footer by having more schema fields, or compensate for a wrong canonical by having a good image.

## Final-artifact gate

For enumerable content families, CI should inspect every final canonical page after all generators/post-processors and before publication.

Fail or explicitly surface unknown/watch for:

- missing or contradictory canonical;
- missing/generic title or description;
- missing/contradictory Open Graph identity;
- missing/broken representative image;
- missing end-of-content distribution footer;
- missing Share or Copy link;
- fewer than two configured direct provider destinations;
- malformed JSON-LD;
- wrong-host URLs;
- accidental noindex;
- a shared layout regression affecting the whole content family.

Runtime/provider behavior remains a separate layer. A green build does not prove that an external provider still accepts its share URL or that a search/social service selected the declared preview.

## Outcome boundary

This contract can prove a stronger implementation and distribution surface. It does not prove:

- indexing;
- ranking;
- Discover placement;
- social reach;
- external share completion;
- AI citation;
- traffic or conversion.

Those require provider/owner evidence and separate measurement.
