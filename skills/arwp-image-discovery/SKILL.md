---
name: arwp-image-discovery
description: Audit and improve meaningful website images across discovery, technical delivery and attribution. Use it for preferred-image convergence, image sitemap applicability and implementation, alt/context semantics, preview controls, Discover-ready asset quality, byte/dimension inventory, responsive delivery, lazy-loading and fetch priority, format/quality optimization, semantic filenames and truthful creator/license attribution without inventing ranking guarantees.
license: PolyForm-Strict-1.0.0
compatibility: Requires access to website source or final generated HTML. Repository/build access improves byte/dimension, naming and provenance checks. Live image responses and final deployed metadata improve verification. Search Console or Discover outcomes remain owner-data evidence.
metadata:
  standard: agent-skills
  arwp-role: image-discovery
---

# ARWP Image Discovery + Quality

Use this skill whenever a site has non-trivial imagery that affects content, Search/social presentation, accessibility, page delivery or attribution. It contains two coupled but distinct layers:

1. **Image Discovery** — can Search/Images/Discover find, understand and select the intended image?
2. **Image Quality & Attribution** — is the image technically efficient, visually intact, correctly loaded, maintainable and truthfully credited?

Do not let a pass in one layer imply a pass in the other.

Read first:

- `registry/search-release-practices.json`
- `registry/technical-seo-critic-practices.json`
- `registry/image-discovery-practices.json`
- `registry/image-quality-practices.json`
- `docs/IMAGE-DISCOVERY-LAYER.md`
- `docs/IMAGE-QUALITY-LAYER.md`
- the target site's publisher/robots policy and final generated artifact

## Evidence hierarchy

1. Publisher intent and explicit restrictions.
2. Current primary platform/browser documentation.
3. Repository source, build output and source-controlled media/provenance data.
4. Final generated HTML and sitemap.
5. Live HTTP/image responses and rendered-browser resource selection.
6. Owner Search Console / Discover / analytics / field performance evidence.
7. Project heuristics only when clearly labelled as heuristics.

Do not turn a repository pass into a claim of image indexing, ranking, Search thumbnail selection, Discover placement, field Core Web Vitals success, copyright ownership or traffic uplift.

## Workflow

### A. Discovery and Search representation

1. Establish the canonical public hostname and priority page cohort.
2. Inventory meaningful image assets separately from decorative UI imagery, logos and icons.
3. Verify crawlability of the landing page and the image URL. Preserve publisher blocks when intentional.
4. For each priority page, identify the representative image. Compare the final `og:image` with schema.org `primaryImageOfPage` or applicable main-entity `image`. Prefer one coherent page-relevant candidate over generic logo fallback.
5. Make an explicit **image sitemap applicability decision** before generating one:
   - `REQUIRED` when image/visual discovery is a material acquisition surface and the site has a large or programmatic canonical page-to-image cohort, important assets with weak ordinary discovery paths, or another clear need for explicit image discovery coverage;
   - `RECOMMENDED` when many canonical content pages have meaningful curated images and deterministic sitemap generation is cheap and maintainable;
   - `NOT_NEEDED` when the site is small, images are sparse or mostly decorative, meaningful images are already directly crawlable from canonical HTML, or image Search is not a meaningful acquisition surface.
   Record the decision and reason. Do not classify absence of an image sitemap as a defect by itself.
6. If the result is `REQUIRED` or `RECOMMENDED`, add `image:image` / `image:loc` entries to the existing canonical sitemap or publish a dedicated image sitemap, whichever is simpler and deterministic. Keep entries limited to meaningful canonical content. Do not add decorative icons, logos, every responsive derivative or non-canonical pages merely to increase coverage. Keep deprecated `image:caption`, `image:geo_location`, `image:title` and `image:license` out of new implementations.
7. Review contextual semantics. Informative images should have concise useful alt text in the context of the visible page; decorative images may legitimately use empty alt. Do not keyword-stuff alt text or generate the same boilerplate across unrelated assets.
8. Resolve image-related serving controls across robots/googlebot metadata and `X-Robots-Tag`. `noimageindex` and restrictive preview settings are publisher controls, not automatic defects. If large previews are desired, verify compatibility with `max-image-preview:large`.
9. Measure the real representative asset where possible. Prefer relevant high-resolution imagery and avoid extreme aspect ratios, generic logos and text-heavy preferred images. Keep the stricter Discover recommendation separate from general image Search eligibility: current Google Discover guidance recommends at least 1200 px width, more than 300,000 total pixels and landscape-friendly presentation such as 16:9.

### B. Image Quality & Attribution

10. Build a reproducible image inventory for in-scope assets. Record source path/public URL, actual bytes, MIME/format, intrinsic dimensions, page/template usage, largest realistic rendered dimensions, responsive variants, loading/fetch priority, alt state and provenance/credit state. Sort the result by bytes and by intrinsic-to-rendered mismatch.
11. Optimize without silently degrading quality. Prefer redundant-variant removal, safe metadata cleanup and lossless recompression first. Resize served variants to realistic needs. If a lossy/visually-lossless transcode is proposed, compare it with the source at relevant sizes and reject visible blur, ringing, text damage, color shifts or transparency defects. Do not call lossy output mathematically lossless.
12. Choose format by content. SVG is appropriate for maintainable vector assets; pixel-accurate screenshots/text/transparency may require a lossless raster path; AVIF/WebP or another supported efficient raster encoding is useful only when it is actually smaller at accepted quality. Keep source masters or an equivalent reproducible source when practical.
13. Use responsive `srcset`/`sizes` when it materially reduces overdelivery, retain a crawlable `src` fallback and stable preferred-image URL, and verify the browser does not repeatedly select a resource far larger than the rendered need.
14. Apply an intentional loading policy. Genuinely offscreen images are candidates for native `loading="lazy"`; likely LCP/above-the-fold hero images must not be blindly lazy-loaded. Give images explicit `width`/`height` or equivalent aspect-ratio reservation. Use `fetchpriority="high"` sparingly for genuinely critical images rather than across the page.
15. Normalize human-managed source filenames to concise descriptive lowercase kebab-case when safe. Avoid camera/export names such as `IMG_4821.png`, generic `image1.webp`, `final-final` chains and keyword-stuffed names. Generated fingerprint names are acceptable when a semantic source/manifest maps them. Avoid unnecessary preferred-image URL churn.
16. Maintain provenance for important first-party, commissioned, third-party and generated images. When attribution is required by license or publisher policy, make it visible through a figure caption, nearby credit or credits/media surface and keep supported `ImageObject`/IPTC facts consistent. Use `creator`, `creditText`, `copyrightNotice`, `license` and `acquireLicensePage` only when grounded.
17. Apply the ARWP portfolio GitHub Pages default only to eligible owner-produced first-party assets: use **Metal Heads Cats** as default creator/credit when no different real creator or rights holder applies. Exclude `dkharlanau/dkharlanau.github.io`. Never replace known third-party creator/license provenance with the portfolio default.
18. Detect byte-identical duplicates, obsolete exports and unused/redundant variants, but delete only after source/build references are proven absent. Preserve source masters, provenance and reproducibility evidence where they still have a role.
19. Re-run against the final generated artifact and, when possible, the deployed URL/image bytes and rendered resource selection.

## Target-site mutation pattern

Prefer fixing the generator, media manifest or metadata source rather than patching built HTML manually.

For a visual catalog or data site, a strong pattern is:

- one stable page-to-image mapping;
- unique representative asset for important entity pages where available;
- page-specific `og:image`;
- matching `WebPage.primaryImageOfPage` or applicable main-entity `image`;
- an explicit image sitemap decision (`REQUIRED`, `RECOMMENDED` or `NOT_NEEDED`) with reason;
- image sitemap entries for the canonical cohort only when the applicability gate says they add useful discovery coverage;
- a source-controlled image metadata manifest for curated alt/subject/provenance/credit overrides;
- deterministic responsive width/format generation;
- explicit width/height plus intentional lazy/eager priority from shared templates;
- deterministic build-time checks that reject missing assets, contradictory preferred-image URLs, deprecated sitemap fields, broken references after renames, missing required attribution and unintended preview restrictions.

For GitHub Pages, perform optimization/variant generation before deployment; there is no runtime image optimizer to rely on. Verify the published bytes instead of assuming the repository source file is what production serves.

Do not mass-generate pseudo-descriptive alt text that claims details not actually visible in the asset. When a visual has not been reviewed, use a conservative subject-level fallback and leave a curation path.

## Output contract

Report:

- priority image cohort inspected and overall inventory coverage;
- exact largest image byte sizes and intrinsic dimensions;
- overdelivery/intrinsic-to-rendered findings;
- discovery/crawlability result;
- preferred-image signal convergence;
- image sitemap applicability decision (`REQUIRED`, `RECOMMENDED` or `NOT_NEEDED`) and reason;
- sitemap image coverage when applicable;
- alt/context quality and decorative exceptions;
- preview/robots restrictions;
- asset quality / Discover-specific readiness separately;
- format/encoding and quality-preservation changes;
- lazy/eager/fetch-priority and width/height findings;
- filename/URL hygiene and broken-reference checks after renames;
- creator/license/provenance coverage plus visible attribution result;
- whether the Metal Heads Cats GitHub Pages default applied, was excepted, or was blocked by stronger provenance;
- duplicate/unused variant findings;
- implementation performed;
- remaining owner-data, visual-review, field-performance or live verification gates.

Keep `general image Search eligibility`, `preferred Search thumbnail`, `Google Images indexing`, `Discover suitability`, `delivery efficiency`, `visual quality` and `rights/attribution correctness` as distinct outcomes. None is guaranteed by metadata alone.
