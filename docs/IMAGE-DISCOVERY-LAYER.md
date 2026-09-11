# Image Discovery Layer

ARWP Image Discovery turns meaningful site imagery into a deliberate, verifiable Search surface without treating image metadata as a ranking trick.

The layer is intended for sites with original diagrams, illustrations, screenshots, visual reference cards, product imagery or other assets that genuinely help explain the page.

## Why this exists

A site can have excellent images and still expose weak or contradictory signals:

- the page uses one image while `og:image` points to a logo;
- schema.org points to a different generic asset;
- the image is omitted from a large canonical sitemap;
- informative images have empty or boilerplate alt text;
- image crawling or previews are restricted accidentally;
- a build creates many image variants without a stable preferred image;
- Discover-specific size advice is incorrectly treated as a universal image-indexing requirement;
- old image-sitemap fields survive in generators after Google has deprecated them.

ARWP keeps these states separate and tests the final artifact instead of rewarding metadata volume.

## Current source-backed baseline

The canonical rules live in `registry/image-discovery-practices.json`.

Current primary-source anchors:

- Google Image SEO best practices: `https://developers.google.com/search/docs/appearance/google-images`
- Google image sitemaps: `https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps`
- Google Discover: `https://developers.google.com/search/docs/appearance/google-discover`
- robots / preview controls: `https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag`
- Google Images licensing metadata: `https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata`
- Article structured-data image guidance: `https://developers.google.com/search/docs/appearance/structured-data/article`

As of the 2026-09-11 review, Google documents both schema.org image metadata and `og:image` as sources used when selecting preferred image previews. Image sitemaps remain supported. The older image-sitemap fields `image:caption`, `image:geo_location`, `image:title` and `image:license` are deprecated and should not be added to new implementations.

## Release sequence

Run Image Discovery after the canonical Search baseline is healthy:

`Search Release → Technical SEO Critic → Image Discovery → final artifact verification → live verification → owner outcome evidence`

The ordering matters. Image work should not distract from broken canonical, robots, indexability or hostname identity.

## Preferred-image contract

For a priority content page:

1. Choose one representative image that actually reflects the page.
2. Put it in the rendered content when appropriate.
3. Use the same stable image URL in `og:image`.
4. Use the same preferred asset in `WebPage.primaryImageOfPage` or an applicable main-entity `image` property.
5. Keep logos/icons as branding assets rather than default content-page preferred images unless they really are representative.
6. Verify the final generated page after all post-processing.

Metadata convergence influences candidate selection; it does not guarantee what Google will display.

## Image sitemap contract

Use image sitemap entries when they add useful discovery coverage, especially on visual catalogs or large static/data sites.

A valid pattern is:

```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://example.com/topic/</loc>
    <image:image>
      <image:loc>https://example.com/assets/topic.webp</image:loc>
    </image:image>
  </url>
</urlset>
```

Keep sitemap image entries aligned with the curated canonical page cohort. Do not publish image entries for deleted, redirected or intentionally non-indexed pages merely because an asset exists.

Do not generate deprecated `image:caption`, `image:geo_location`, `image:title` or `image:license` fields.

## Alt and context

Alt text is not a keyword bucket.

- Informative images: describe the meaningful visual content or function concisely in page context.
- Decorative images: empty alt can be correct.
- Linked image cards: avoid redundant text when the link already has an accessible name and the image is purely decorative.
- Unreviewed image libraries: use conservative subject-level fallback text rather than inventing visible details, and keep a source-controlled curation manifest for reviewed overrides.

Visible surrounding copy should independently establish what the page and image are about.

## Preview controls

Evaluate HTML robots/googlebot metadata together with response-level `X-Robots-Tag`.

If image exposure is intended, investigate accidental `noimageindex` or `max-image-preview:none`. If large previews are intended, `max-image-preview:large` is the appropriate publisher permission. Intentional restrictions remain authoritative and must not be removed merely to maximize Search exposure.

## General image Search versus Discover

Do not collapse these into one pass/fail state.

General Image Search guidance favors relevant, representative, high-quality imagery without making 1200 px width a universal indexing gate.

Discover uses stricter image guidance. At the current review date, Google recommends compelling relevant images that are at least 1200 px wide, above 300,000 total pixels, and suitable for landscape presentation such as 16:9, together with large-preview permission or AMP.

Therefore:

- a 1024 px representative image can still be a legitimate Search/Images asset;
- the same image may be classified `WATCH: below current Discover-oriented recommendation` rather than `FAIL: not indexable`.

## Responsive delivery

Responsive variants can reduce transfer cost, but keep:

- a normal crawlable `src` fallback;
- valid `srcset` / `sizes` variants when used;
- one stable preferred-image URL in metadata;
- deterministic generation rather than ephemeral variant identities.

This is primarily delivery/page-experience work. Do not market responsive markup itself as a ranking factor.

## Licensing metadata

When image licensing or creator credit is a product goal, use supported structured data or embedded image metadata and require provenance. Do not infer ownership from a file being present in a repository.

Image sitemap `image:license` is deprecated; supported licensing metadata is a separate mechanism.

## Verification states

Use the same conservative states as other ARWP layers:

- `FAIL` — deterministic conflict with stated publisher intent or source-backed requirement;
- `WATCH` — quality, live-response or surface-specific concern worth investigation;
- `PASS` — no issue observed in the bounded check;
- `not-applicable` — mechanism is not used or not relevant;
- `owner-data` — Search/Discover outcome evidence requires provider/owner data.

A green Image Discovery implementation does not prove image indexing, ranking, Search thumbnail selection, Discover visibility or traffic impact.
