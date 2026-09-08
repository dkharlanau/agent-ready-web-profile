# Give the reader something they can use

Edition 1.0.0 · reviewed 8 September 2026 · corpus 1.5.0.

The catalog already covers original articles, comparison criteria, datasets, evidence, access and measurement. The gap in this review was operational: a site owner can select a good pattern and still lack a small usable artifact to publish. This workshop connects existing patterns to three reusable packs and four additional delivery practices. It does not claim the catalog is complete or that adding assets guarantees ranking.

[Pattern library](./discoverability.html) · [Anti-patterns](./ANTI-PATTERNS.html) · [Worked figure and data](./examples/asset-kits/) · [Download asset brief](https://github.com/dkharlanau/agent-ready-web-profile/blob/main/templates/growth/asset-kits/asset-brief.md)

## Questions that changed this edition

| Review question | Existing coverage | Decision |
| --- | --- | --- |
| Do we need more generic article advice? | Openings, headings, evidence-first outlines, comparisons and counterexamples already exist. | Reuse them; do not add synonymous patterns. |
| Can a visitor complete a useful task? | Useful-artifact and quickstart patterns exist. | Add a fillable asset brief and a runnable minimal pair. |
| Can a crawler reach the useful answer without pressing Run? | Initial-HTML and collection guidance exists. | Add an explicit interaction-free loading review; test both rendered and source states. |
| Does each page have a representative preview? | Image delivery and responsive sizing exist. | Add page-specific preview selection, distinct from body-figure readability. |
| Can someone reuse the exact image correctly? | General media rights exist. | Add image-object licensing metadata and a rights-verification boundary. |
| Is a download a duplicate or a distinct asset? | Canonical and dataset landing patterns exist. | Add non-HTML header and host-capability checks; never assume GitHub Pages can emit arbitrary headers. |
| Are new downloads genuinely useful? | Dataset quality and independent reuse already exist. | Provide data plus visible method and a negative case; measure reuse separately from downloads. |
| Have we proved acquisition or revenue? | Baselines and Evidence Relay exist. | No. Keep discovery, task completion, independent reuse and paid demand separate. |

## Three starter packs

### 1. A minimal failure and correction

The [canonical pair](https://github.com/dkharlanau/agent-ready-web-profile/tree/main/templates/growth/asset-kits/canonical-pair) includes before/after HTML, a standard-library Python reproducer and interpretation notes. Run from the repository:

```sh
python3 templates/growth/asset-kits/canonical-pair/check.py
```

The deliberate before failure is the useful part: a visitor sees exactly which declaration changes. All example URLs are synthetic and fixtures retain noindex. For a real Jekyll site, inspect the source configuration, rebuild it and verify the live output. The reproducer checks only its two local files; it cannot diagnose arbitrary sites or prove indexing.

Use this format for a real bug you can explain: symptom, minimal input, one change, expected output, conditions where the fix is inappropriate. Prefer a small owned reproduction over publishing client source code.

### 2. A figure that can be checked and reused

The [corpus review figure](./examples/asset-kits/) includes an SVG, CSV and a visible HTML table. Its values come from the actual 1.4.0 snapshot and 1.5.0 corpus: reviewed 89 → 93; individually unreviewed 116 → 116. This is a documentation coverage figure, not search performance or growth evidence.

For a target site, replace the subject with a real measurement useful to its audience. Keep units, denominator, source version and limitations visible. Provide the data and terms beside the image. A labelled chart can serve the article well even when a different representative image would be better as a Search preview.

### 3. A decision worksheet before another page

The [asset brief](https://github.com/dkharlanau/agent-ready-web-profile/blob/main/templates/growth/asset-kits/asset-brief.md) asks what a reader can actually finish, why existing content is insufficient, what evidence exists and what would invalidate the result. Use it with the current adoption record and BraidGraph identity, not a replacement provenance system.

For static-site inbound acquisition, possible assets include a migration map with example rows, a version-support matrix with actual policy dates, a narrow error reproduction, or a tested starter configuration. These are proposals, not evidence of search demand. Prioritize an existing page with a real task before making a new landing page.

## Four delivery additions

- **Representative preview:** supply a relevant preferred image; selection remains automated. [Google image guidance](https://developers.google.com/search/docs/appearance/google-images).
- **Image-specific rights:** describe the exact object and actual licensing terms. Metadata cannot grant permission. [Image metadata](https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata).
- **No required gesture for discovery:** important content must not depend on clicking or scrolling to load. [Lazy-loading guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading).
- **Real download response:** equivalent non-HTML documents can use HTTP canonical headers where supported. Distinct artifacts need not be collapsed into HTML. [Canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

Each new corpus record has its own version, source-support locator and anti-pattern. Four matching negative examples bring the companion catalog to 28. The preceding 205 positive records and 24 negative examples are preserved.

## Acceptance before rollout

Read the explanation without running anything. Download and open the artifact. Reproduce the stated result and the failure case. Inspect the real license and media bytes. Check direct links after publication. Ensure the next action works for the intended reader. Keep an asset only when its maintenance cost is justified by its task value; do not call static checks proof of ranking or inbound demand.
