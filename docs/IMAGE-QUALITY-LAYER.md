# Image Quality & Attribution Layer

ARWP Image Quality complements Image Discovery. Image Discovery asks whether a meaningful image can be found, understood and selected by Search surfaces. Image Quality asks whether the asset is technically efficient, visually intact, correctly loaded, maintainable and truthfully attributed.

The canonical machine-readable practices live in `registry/image-quality-practices.json`.

## What the module must measure

Do not review images from filenames alone. Build a reproducible inventory for meaningful first-party assets and important shared UI imagery with at least:

- source path and public URL;
- pages/templates that use the asset;
- file format and MIME type;
- exact encoded byte size;
- intrinsic width and height;
- largest realistic rendered width and height;
- responsive variants plus `srcset` / `sizes` or framework-native equivalent;
- `loading`, `fetchpriority` and dimension/aspect-ratio policy;
- alt/decorative state;
- creator, credit, license and provenance when applicable;
- optimization state and whether a source/master is preserved.

The report should sort the inventory by transferred bytes and by intrinsic-to-rendered mismatch. This makes the largest avoidable costs visible instead of hiding them behind an overall page score.

ARWP does not define one universal byte limit for every image. A 1200 px editorial hero, a tiny icon, a UI screenshot and a diagram have different constraints. Projects may define budgets, but they must be labelled as project policy rather than a browser or Search requirement.

## Quality-preserving optimization

"Optimize without quality loss" must not be implemented as "convert everything to a low-quality modern codec."

Use this order:

1. Remove redundant assets and unnecessary variants.
2. Strip unneeded metadata when doing so does not remove required rights/provenance data.
3. Apply lossless recompression where it produces a smaller file.
4. Resize served variants to realistic display needs while keeping an appropriate high-resolution source/master.
5. Evaluate a more efficient encoding only when it is smaller at accepted visual quality.
6. Inspect diagrams, screenshots, small text, transparency and high-contrast edges specifically for blur, ringing, color shifts and alpha damage.
7. Reject a transcode that is larger or visibly worse.

A lossy codec can be visually equivalent at the intended display size, but it is not mathematically lossless. Keep that distinction explicit in reports.

## Format policy

Use the image type, not fashion, to choose the format.

- **SVG**: suitable vector artwork, icons and diagrams when SVG is safe and maintainable.
- **PNG or another lossless raster path**: pixel-accurate screenshots, small text, transparency or assets where compression artifacts are unacceptable.
- **AVIF/WebP or another supported efficient raster encoding**: photographs and illustrations when measured bytes fall materially and visual acceptance passes.
- **GIF**: avoid for large animation when a more efficient media format is appropriate; preserve only when compatibility/product constraints justify it.

Do not create unnecessary fallback variants. Keep a normal crawlable `src` and stable preferred-image identity where Search/social metadata depends on the URL.

## Responsive sizing and overdelivery

CSS scaling is not image optimization. If one large raster is repeatedly downloaded for much smaller rendered slots, generate deterministic responsive variants and use truthful `srcset` / `sizes` or the framework-native equivalent.

Review the selected resource at realistic breakpoints and high-density displays. The goal is to avoid systematic overdelivery without causing visible upscaling.

A normal pattern is:

```html
<img
  src="/images/microphone-baseline-1200.webp"
  srcset="/images/microphone-baseline-480.webp 480w,
          /images/microphone-baseline-800.webp 800w,
          /images/microphone-baseline-1200.webp 1200w"
  sizes="(max-width: 720px) 92vw, 720px"
  width="1200"
  height="675"
  loading="lazy"
  decoding="async"
  alt="Waveform comparison before and after microphone gain adjustment">
```

`srcset` is useful only when its candidates resolve and `sizes` reflects the real layout.

## Lazy loading and priority

Native `loading="lazy"` is the default candidate for genuinely offscreen content imagery. It should not be sprayed onto every `<img>`.

For a likely Largest Contentful Paint / above-the-fold hero image:

- do not blindly lazy-load it;
- ensure it is present in normal HTML or the framework's supported early-discovery path;
- use explicit dimensions/aspect ratio;
- consider `fetchpriority="high"` only when the image is genuinely critical and the page does not mark many competing resources high priority.

For offscreen imagery, lazy loading can avoid unnecessary network work. Explicit `width` and `height` help the browser reserve space and reduce avoidable layout shifts.

## File naming

Human-managed source assets should be concise, descriptive and stable.

Prefer:

- `microphone-baseline-waveform.webp`
- `cbt-thought-record-example.svg`
- `sap-bp-replication-flow.png`

Avoid when safe to rename:

- `IMG_4821.png`
- `image1.webp`
- `final-final-2.png`
- keyword-stuffed names written for Search rather than maintainability.

Generated immutable hashes are fine in build output when the source/manifest retains a stable semantic identity. Renaming a public preferred image should not create URL churn without a real migration reason.

## Provenance and attribution

Important images should have known provenance or an explicit `unknown` state. Do not infer authorship or copyright from repository location.

When attribution is required by license or publisher policy, expose it visibly through an appropriate surface such as:

- a `<figcaption>` near the image;
- a nearby credit line;
- a linked media/credits page for repeated site assets.

When structured image metadata is used, keep the visible credit consistent with supported `ImageObject` facts such as `creator`, `creditText`, `copyrightNotice`, `license` and `acquireLicensePage`.

Example for an owner-produced portfolio image:

```html
<figure>
  <img
    src="/images/cognitive-bias-map.webp"
    width="1200"
    height="675"
    loading="lazy"
    alt="Map grouping cognitive biases by decision stage">
  <figcaption>Image: Metal Heads Cats</figcaption>
</figure>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ImageObject",
  "contentUrl": "https://example.github.io/images/cognitive-bias-map.webp",
  "creator": {"@type": "Organization", "name": "Metal Heads Cats"},
  "creditText": "Metal Heads Cats"
}
</script>
```

Only publish rights/licensing properties that are actually true. If a real photographer, illustrator, licensor or other creator is known, preserve that attribution instead of replacing it with a portfolio brand.

## Portfolio GitHub Pages default

For owner-controlled first-party images on the ARWP portfolio's GitHub Pages sites, use **Metal Heads Cats** as the default creator/credit when it is factually the portfolio producer/publisher and no different real creator or rights holder applies.

Exception:

- `dkharlanau/dkharlanau.github.io` (`https://dkharlanau.github.io/`) is a personal publisher site. Preserve its explicit personal author/owner identity; do not apply the Metal Heads Cats default automatically.

This default is a portfolio policy, not a claim that every file hosted in those repositories was created by Metal Heads Cats.

## GitHub Pages implementation

GitHub Pages has no runtime image optimization service. Optimize and generate responsive variants before deployment, commit or deterministically build the outputs, and verify the published asset bytes.

For static sites:

- keep semantic source assets in a predictable directory;
- generate derived width/format variants deterministically;
- keep attribution/provenance in source-controlled metadata when repeated across pages;
- make templates emit `width`/`height`, `srcset`/`sizes` and loading policy consistently;
- verify that generated HTML references existing assets after renames;
- compare production bytes with the tested build when deployment evidence is available.

Do not hand-edit generated outputs when a generator owns them.

## Audit result states

Use the normal ARWP states:

- `FAIL` — deterministic conflict with the site's explicit policy or a required invariant, such as a broken image URL, required credit removed, or critical image accidentally deferred by a known bad template rule;
- `WATCH` — likely waste or quality risk that needs context, such as a very large source delivered into a small slot or an attribution record that remains unknown;
- `PASS` — no issue observed by the bounded check;
- `not-applicable` — the rule does not apply;
- `owner-data` — provenance/licensing facts cannot be established from repository/public evidence.

A green Image Quality result is not proof of Search indexing, ranking, Core Web Vitals field success or licensing ownership.

## Primary references

- MDN `<img>` element: `https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img`
- MDN native image loading: `https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/loading`
- MDN fetch priority: `https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/fetchPriority`
- Google Images best practices: `https://developers.google.com/search/docs/appearance/google-images`
- Google image metadata: `https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata`
- Schema.org `ImageObject`: `https://schema.org/ImageObject`
