# Freshness Integrity

Status: experimental Search Maturity implementation contract · reviewed 2026-09-09

Freshness Integrity checks whether sitemap `<lastmod>` movement is mechanically consistent with revision-bound source ownership evidence. It is designed to catch obvious synthetic freshness and to surface potentially stale dates without pretending that a source diff proves a significant page update.

The contract follows Google's sitemap guidance: `<lastmod>` should reflect the last significant modification of the page, and Google may use it when the value is consistently and verifiably accurate. A deployment/build timestamp, copyright-year change or arbitrary date refresh is not a substitute for meaningful page freshness.

Primary source: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap

## Why this needs longitudinal evidence

A single crawl can observe that a sitemap contains dates, but it cannot prove those dates are truthful. Goose therefore compares two explicit revisions instead of producing a one-shot "freshness score".

The evidence chain is:

```text
Repository Mapper Site State Graph at revision A
+ leaf urlset sitemap observed for revision A
→ Freshness Snapshot A

Repository Mapper Site State Graph at revision B
+ leaf urlset sitemap observed for revision B
→ Freshness Snapshot B

Snapshot A + Snapshot B
→ Freshness Comparison
```

A snapshot records, per sitemap URL:

- the literal `<lastmod>` and whether it uses accepted W3C/ISO sitemap date syntax;
- exact repository revision metadata from the Site State Graph;
- the proven canonical route owner, when resolved;
- the sorted set of mapped `buildPath` inputs for that route;
- a digest derived from the exact file digests of those mapped inputs;
- whether that build-input evidence is complete, partial or unavailable.

Goose does **not** infer page freshness from file mtimes, build timestamps, deploy timestamps or the current clock.

## CLI

Create one snapshot for a final `urlset` sitemap:

```bash
node bin/arwp-freshness.mjs snapshot \
  .arwp/site-state-before.json sitemap-before.xml \
  --sitemap-source=https://example.com/sitemap.xml \
  --output=freshness-before.json
```

Repeat at a later reviewed revision:

```bash
node bin/arwp-freshness.mjs snapshot \
  .arwp/site-state-after.json sitemap-after.xml \
  --sitemap-source=https://example.com/sitemap.xml \
  --output=freshness-after.json
```

Compare the two snapshots:

```bash
node bin/arwp-freshness.mjs compare \
  freshness-before.json freshness-after.json \
  --output=freshness-comparison.json
```

Human-readable comparison:

```bash
node bin/arwp-freshness.mjs compare \
  freshness-before.json freshness-after.json --text
```

Validate either artifact:

```bash
node bin/arwp-freshness.mjs validate freshness-before.json
node bin/arwp-freshness.mjs validate freshness-comparison.json
```

Output files are created exclusively; the CLI will not overwrite an existing evidence artifact implicitly.

## Comparison states

### `lastmod-churn-candidate`

`<lastmod>` changed while the exact mapped owner/build-input digests stayed byte-identical.

If both snapshots even reference the same repository commit, confidence is stronger: the date moved without any mapped revision movement at all.

This is a review candidate for synthetic/build-time freshness. It is still not absolute proof: Repository Mapper may not know every runtime/external content input.

### `stale-lastmod-candidate`

One or more mapped route inputs changed while `<lastmod>` stayed semantically unchanged.

This remains a **review**, not an automatic failure. A source/template diff can be cosmetic, build-only or otherwise insignificant to the page. Review the changed inputs and the rendered page before changing `<lastmod>`.

### `aligned-change`

Both `<lastmod>` and at least one mapped route input changed.

This proves only mechanical alignment. It does not prove that the page change was significant enough to justify the date, nor that Google crawled or used it.

### `unchanged`

The semantic `<lastmod>` instant/date and mapped route inputs stayed unchanged. Equivalent timezone representations of the same instant are treated as unchanged rather than synthetic churn.

### `unknown`

At least one side lacks a valid `<lastmod>`, resolved route ownership or complete mapped build inputs. Unknown stays unknown and generates no repair action.

### `added` / `removed`

The URL exists on only one side of the comparison. These are lifecycle observations, not freshness defects.

## Significant-change boundary

Repository input changes are useful evidence, but they do not define Google's concept of a significant page update.

Before updating a date for a `stale-lastmod-candidate`, inspect whether the rendered canonical page materially changed in areas such as:

- substantive visible content;
- structured data grounded in visible facts;
- important links or navigational relationships;
- product/data facts that change the page's answer or user task.

Do not refresh `<lastmod>` merely for formatting, CSS, build system churn, generated timestamp changes or other non-substantive edits.

Conversely, a `lastmod-churn-candidate` can be legitimate when meaningful page content comes from a runtime/CMS/external source outside the currently mapped repository inputs. In that case preserve the date and improve the evidence mapping rather than forcing the site to match an incomplete model.

## Sitemap scope

Freshness v0.1 accepts a final XML `<urlset>` rather than a sitemap index. Build a snapshot for each leaf sitemap that matters to the experiment/cohort.

The parser intentionally:

- requires credential-free absolute HTTPS `<loc>` URLs;
- rejects duplicate normalized `<loc>` values;
- bounds leaf sitemaps to 50 MiB and 50,000 URL entries;
- accepts W3C/ISO date-only values or timezone-qualified date-time values for `<lastmod>`;
- preserves missing and invalid dates as explicit states.

It does not fetch sitemap indexes or choose child sitemaps automatically, because snapshot provenance should remain explicit.

## Relationship to other Goose checks

Use the layers for different questions:

```text
Technical Integrity
→ Is the bounded public site technically eligible and internally healthy enough to investigate?

Internal Discovery
→ Can users/crawlers traverse useful canonical-owner relationships in the reviewed cohort?

Freshness Integrity
→ Do sitemap freshness dates move consistently with revision-bound mapped implementation evidence?

Search Opportunities
→ Which existing answer/landing page deserves improvement based on real need and owner evidence?

Outcome measurement
→ Did Search/AI/referral/business signals actually move?
```

Do not merge those questions into a composite SEO/readiness score.

## Guardrails

Freshness Integrity deliberately asserts all of the following:

- no ranking promise;
- no recrawl promise;
- source/build digest equality is not rendered-page proof;
- source/build digest change is not proof of significant content change;
- mapping ambiguity stays unknown;
- no build/deploy timestamp inference;
- negative/neutral observations are retained;
- no composite freshness/SEO score.

A good result means the implementation evidence is internally coherent enough to support a better review. Search performance remains a separate observation.
