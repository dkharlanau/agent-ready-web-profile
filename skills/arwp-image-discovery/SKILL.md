---
name: arwp-image-discovery
description: Audit and improve how meaningful website images are discovered, contextualized and selected across Google Search, Google Images and Discover. Use it for preferred-image convergence, image sitemaps, alt/context semantics, preview controls, Discover-ready asset quality, responsive delivery and truthful image licensing metadata without inventing ranking guarantees.
license: Apache-2.0
compatibility: Requires access to website source or final generated HTML. Live image responses and final deployed metadata improve verification. Search Console or Discover outcomes remain owner-data evidence.
metadata:
  standard: agent-skills
  arwp-role: image-discovery
---

# ARWP Image Discovery

Use this skill when a site has meaningful visual assets that should become a stronger Search/Google Images/Discover surface, or when a page already has good imagery but metadata and discovery signals do not consistently describe it.

Read first:

- `registry/search-release-practices.json`
- `registry/technical-seo-critic-practices.json`
- `registry/image-discovery-practices.json`
- `docs/IMAGE-DISCOVERY-LAYER.md`
- the target site's publisher/robots policy and final generated artifact

## Evidence hierarchy

1. Publisher intent and explicit restrictions.
2. Current primary platform documentation.
3. Final generated HTML and sitemap.
4. Live HTTP/image responses.
5. Owner Search Console / Discover / analytics evidence.
6. Project heuristics only when clearly labelled as heuristics.

Do not turn a repository pass into a claim of image indexing, ranking, Search thumbnail selection, Discover placement or traffic uplift.

## Workflow

1. Establish the canonical public hostname and priority page cohort.
2. Inventory meaningful image assets separately from decorative UI imagery, logos and icons.
3. Verify crawlability of the landing page and the image URL. Preserve publisher blocks when intentional.
4. For each priority page, identify the representative image. Compare the final `og:image` with schema.org `primaryImageOfPage` or applicable main-entity `image`. Prefer one coherent page-relevant candidate over generic logo fallback.
5. If image discovery matters at scale, inspect the canonical sitemap. Add `image:image` / `image:loc` entries or a dedicated image sitemap when useful. Keep deprecated `image:caption`, `image:geo_location`, `image:title` and `image:license` out of new implementations.
6. Review contextual semantics. Informative images should have concise useful alt text in the context of the visible page; decorative images may legitimately use empty alt. Do not keyword-stuff alt text or generate the same boilerplate across unrelated assets.
7. Resolve image-related serving controls across robots/googlebot metadata and `X-Robots-Tag`. `noimageindex` and restrictive preview settings are publisher controls, not automatic defects. If large previews are desired, verify compatibility with `max-image-preview:large`.
8. Measure the real representative asset where possible. Prefer relevant high-resolution imagery and avoid extreme aspect ratios, generic logos and text-heavy preferred images. Keep the stricter Discover recommendation separate from general image Search eligibility: current Google Discover guidance recommends at least 1200 px width, more than 300,000 total pixels and landscape-friendly presentation such as 16:9.
9. Use responsive `srcset`/`sizes` when it materially improves delivery, but retain a crawlable `src` fallback and stable preferred-image URL. Treat this as delivery/page-experience work, not direct ranking proof.
10. Add license/creator metadata only when provenance is known and the publisher wants it exposed. Use supported structured data or image metadata; never invent ownership from repository location.
11. Re-run against the final generated artifact and, when possible, the deployed URL/image bytes.

## Target-site mutation pattern

Prefer fixing the generator or metadata source rather than patching built HTML manually.

For a visual catalog or data site, a strong pattern is:

- one stable page-to-image mapping;
- unique representative asset for important entity pages where available;
- page-specific `og:image`;
- matching `WebPage.primaryImageOfPage` or applicable main-entity `image`;
- image sitemap entries for the canonical cohort;
- a source-controlled image metadata manifest for curated alt/subject/provenance overrides;
- a deterministic build-time check that rejects missing assets, contradictory preferred-image URLs, deprecated sitemap fields and unintended preview restrictions.

Do not mass-generate pseudo-descriptive alt text that claims details not actually visible in the asset. When a visual has not been reviewed, use a conservative subject-level fallback and leave a curation path.

## Output contract

Report:

- priority image cohort inspected;
- discovery/crawlability result;
- preferred-image signal convergence;
- sitemap image coverage;
- alt/context quality and decorative exceptions;
- preview/robots restrictions;
- asset quality / Discover-specific readiness separately;
- implementation performed;
- remaining owner-data or live verification gates.

Keep `general image Search eligibility`, `preferred Search thumbnail`, `Google Images indexing` and `Discover suitability` as distinct outcomes. None is guaranteed by metadata alone.
