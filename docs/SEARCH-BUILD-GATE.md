# Production Search Build Gate

Reviewed: **2026-09-15**.

The Production Search Build Gate turns the existing Search Release discipline into executable evidence across three states that must not be collapsed:

```text
source revision
→ final publish artifact
→ deployed production representation
```

Canonical practices: [`registry/search-build-gate-practices.json`](../registry/search-build-gate-practices.json).

## Why this exists

A correct source file is not proof of a correct build. A green build is not proof that the intended artifact was deployed. A successful deployment for one revision is not proof for another revision. A production page can also drift from a locally correct artifact because a late mutator, stale deployment, hosting rewrite or parallel publication path changed what users and crawlers receive.

This gate therefore keeps four evidence classes separate:

1. source revision identity;
2. final artifact integrity;
3. deployed revision identity;
4. live Search-surface parity.

Passing the gate does **not** prove indexing, ranking, title/snippet selection, AI citation, traffic or business impact.

## Scope

The gate is intentionally artifact-first. It does not execute the target build and does not import target application code.

Use it after the project has already produced its real publish directory, for example:

- GitHub Pages with Jekyll: the final `_site/` produced by the same Jekyll build path used for Pages publication;
- GitHub Pages without a transform: the exact configured publish directory such as `docs/`;
- GitHub Pages custom Actions: the exact directory uploaded by the Pages artifact step;
- Next.js static export: `out/` after `output: 'export'`;
- other static generators: the final `dist/`, `build/` or equivalent directory.

Do not point the gate at a source directory merely because that directory is the configured Pages source. If GitHub Pages or another publisher transforms Markdown, Liquid, templates, assets or metadata before deployment, reproduce that transform first and inspect its output.

Dynamic SSR/runtime deployments need a different source-to-runtime evidence adapter; do not pretend `.next/` server internals are final static HTML.

## Artifact check

For an already-built static artifact:

```bash
node bin/arwp-search-build.mjs check \
  --root=_site \
  --site=https://example.github.io/project/ \
  --source-sha="$GITHUB_SHA"
```

JSON output:

```bash
node bin/arwp-search-build.mjs check \
  --root=out \
  --site=https://example.com/ \
  --source-sha="$GITHUB_SHA" \
  --json
```

The artifact gate requires an artifact-root `index.html`, rejects symlinked/unbounded artifacts, inventories all HTML, and then chooses its index cohort as follows:

1. if `sitemap.xml` exists at the artifact root, its `<loc>` URLs are the canonical index cohort;
2. otherwise the gate falls back to the non-error HTML inventory and reports that weaker coverage mode.

Using the sitemap cohort matters. Example/demo/error HTML that is shipped for users or documentation should not automatically become an index-candidate failure merely because it exists in the artifact.

## Index-candidate contract

For each URL in the canonical cohort, the final artifact must have:

- one non-empty `<title>`;
- one canonical URL;
- canonical URL inside the declared public site scope;
- canonical identity matching the route represented by the artifact;
- no accidental `noindex`;
- parseable JSON-LD blocks wherever they appear in the HTML document;
- no conflicting `og:url`.

A missing meta description is `watch`, not a crawl/index failure. Search engines may generate snippets from visible content, and this gate must not turn every optional presentation improvement into P0 release failure.

## Canonical route ownership

The artifact filename is only a fallback route hint. When exactly one canonical is present, that canonical becomes the page identity used to reconcile the sitemap.

This supports both ordinary static directories and Next.js static-export layouts such as:

```text
out/about.html
canonical: https://example.com/about
sitemap:   https://example.com/about
```

The gate does not require the public URL to expose `.html` merely because the build artifact does.

## Error documents

Static `404.html` documents are tracked separately from the index cohort.

The gate fails when an error artifact declares a canonical URL, because that would make the static error document masquerade as ordinary canonical content. Missing `noindex` remains `watch`: the serving HTTP 404 status is runtime evidence and cannot be inferred from the file alone.

## Live production parity

After deployment:

```bash
node bin/arwp-search-build.mjs live \
  --root=_site \
  --site=https://example.github.io/project/ \
  --source-sha="$SOURCE_SHA" \
  --deployed-sha="$DEPLOYED_SHA"
```

The default `search-surface` parity compares the deployed representation with the final artifact for:

- title;
- meta description;
- canonical URL;
- effective `noindex` observation from robots/googlebot meta;
- `og:url`;
- JSON-LD parse state, block count and normalized semantic fingerprints.

JSON-LD fingerprints canonicalize object-key order before hashing so harmless key reordering does not become drift, while changed or missing structured-data content does.

For hosts where exact static delivery is part of the deployment contract, use:

```bash
--parity=exact
```

That additionally requires the live HTML byte hash to equal the local artifact HTML hash. Do not use exact mode on platforms that intentionally transform HTML at the edge unless exact bytes are actually part of the release contract.

## Bounded live verification

`--max-live-pages=N` bounds public requests. If the sitemap cohort is larger than the bound, the report is `bounded-index-cohort` and cannot become a complete pass.

This is deliberate. A healthy sample is useful evidence, but it is not whole-site production parity.

## Revision parity

Revision identity is explicit input:

```text
--source-sha=<40-char commit>
--deployed-sha=<40-char commit>
```

When both exist:

- same SHA → `pass` for revision parity;
- different SHA → hard failure;
- one side missing → `watch`.

The CLI does not guess deployment identity from timestamps, file mtimes or a green unrelated workflow.

For GitHub Pages, a practical evidence source is the Pages `deploy` check-run attached to the commit. The important condition is not merely `conclusion=success`; its `head_sha` must equal the source revision being claimed as live.

## GitHub Pages dogfood pattern

For Jekyll-backed GitHub Pages:

```text
main commit
→ reproduce the Pages Jekyll build
→ inspect final _site artifact
→ GitHub Pages deploy check for the same head_sha
→ live Search-surface parity against that exact revision
```

The ARWP repository dogfoods this pattern in `.github/workflows/search-build-gate.yml` with the same pinned `actions/jekyll-build-pages` action used by the Pages build path.

The production job does not set `deployedSha` until GitHub exposes a successful `deploy` check-run whose `head_sha` equals the current `GITHUB_SHA`. Only then does it run live parity.

Both artifact and live reports are uploaded before their result is enforced, so failed gates still leave inspectable machine-readable evidence.

## Next.js static export

For a Next.js project using `output: 'export'`:

```bash
next build
node path/to/arwp/bin/arwp-search-build.mjs check \
  --root=out \
  --site=https://example.com/
```

Run this after every build/post-processing step that can modify `out/`. If another script changes metadata, sitemap, analytics/consent markup or route files after the gate, the result is no longer final-artifact evidence and the gate must move later.

Use Search Platform Eligibility separately to verify that static export itself is applicable to the project. A Search Build Gate pass cannot make unsupported server-only Next.js features compatible with static hosting.

## Evidence boundaries

Keep these statements distinct:

- source test passed;
- artifact gate passed;
- deployment for the exact source SHA succeeded;
- checked production Search surfaces match the artifact;
- Search engine later selected/indexed/displayed the page;
- traffic or business outcome changed.

Only the middle three are owned by this gate. Search engine and business outcomes remain owner/platform evidence handled elsewhere in ARWP.

## Primary sources

- Google Search Central — canonicalization: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Google Search Central — robots meta: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- Google Search Central — sitemaps: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google Search Central — title links: https://developers.google.com/search/docs/appearance/title-link
- Google Search Central — structured-data policies: https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- GitHub Docs — Pages publishing source: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Next.js — static exports: https://nextjs.org/docs/app/guides/static-exports
