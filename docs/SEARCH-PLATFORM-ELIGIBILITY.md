# Search Platform Eligibility

Reviewed: **2026-09-15**.

Search Platform Eligibility is a small fail-closed layer between a generic Search recommendation and stack/provider-specific implementation. It prevents ARWP from recommending a real platform feature where the target site, URL scope or deployment mode is not actually eligible for that feature.

Canonical rules: [`registry/search-platform-eligibility.json`](../registry/search-platform-eligibility.json).

## Why this exists

A recommendation can be technically correct and still be wrong for the target site.

Examples:

- Google Preferred Sources accepts a domain or subdomain, not an independent subdirectory such as `owner.github.io/project/`;
- Google Indexing API is not a general indexing accelerator: Google restricts it to `JobPosting` pages and livestream pages with `BroadcastEvent` embedded in `VideoObject`;
- a Next.js application deployed under a sub-path needs a matching `basePath` contract;
- relative URL metadata in Next.js depends on the effective `metadataBase`;
- `output: 'export'` cannot preserve features that require request-time/server behavior;
- GitHub Pages repository state is not automatically the same thing as the published artifact.

The gate deliberately preserves `watch` and `not-applicable` instead of converting uncertainty into a defect.

## Evidence states

- `pass` — the supplied evidence satisfies the bounded applicability/configuration rule;
- `fail` — supplied evidence contradicts a required platform/deployment contract;
- `watch` — more explicit scope/runtime/build evidence is required before making the recommendation;
- `not-applicable` — the provider feature or tactic does not apply to the declared site.

A `pass` is **not** indexing, ranking, citation, Preferred Sources selection, traffic or business-outcome proof.

## Run it

Create an explicit input record:

```json
{
  "site": "https://owner.github.io/project/",
  "siteScope": "subdirectory",
  "stack": "nextjs",
  "structuredDataTypes": ["Article"],
  "nextjs": {
    "metadataBase": "https://owner.github.io/project/",
    "basePath": "/project",
    "staticExport": true,
    "unsupportedFeatures": []
  },
  "publishing": {
    "mode": "github-actions",
    "finalArtifactVerified": true,
    "cnameObserved": false
  }
}
```

Then run:

```bash
node bin/arwp-search-platform.mjs check site-platform.json
node bin/arwp-search-platform.mjs check site-platform.json --json
```

The command is read-only and performs no network requests. Exit code `1` means at least one bounded platform contract failed; `watch` and `not-applicable` do not fail the command.

## Growth Profile integration

`arwp-growth` accepts the same hostname-scope decision explicitly:

```bash
node bin/arwp-growth.mjs https://example.com/ --site-scope=hostname-root
node bin/arwp-growth.mjs https://owner.github.io/project/ --site-scope=subdirectory
```

The default is `unknown`. In that state ARWP keeps Preferred Sources as `watch` and removes the ready-to-apply CTA URL until hostname ownership is classified.

For an explicit `subdirectory`, the Preferred Sources acquisition action is removed as not applicable. For `hostname-root`, the opportunity remains only when the supplied public site root is actually `/` on that hostname. A contradictory declaration such as `hostname-root` for `https://owner.github.io/project/` fails closed.

This integration is intentionally narrow. Growth still evaluates ordinary Search/content opportunities for a subdirectory; only the hostname-scoped acquisition tactic is gated.

## Scope must be explicit

`site` is the **public site root being evaluated**, not an arbitrary page URL.

`siteScope` is one of:

- `hostname-root` — the product/publisher owns the hostname-level site identity;
- `subdirectory` — the product is intentionally scoped below another hostname identity;
- `unknown` — ownership/scope was not established.

Do not infer that every path is a separate site. In particular, `https://owner.github.io/project/` may be a valid public project site while still lacking independent hostname-level eligibility for features that are domain/subdomain scoped.

## Preferred Sources eligibility

Before offering a Google Preferred Sources CTA, classify hostname scope. A subdirectory remains an ordinary Search surface, but it must not be represented as an independently selectable Preferred Source.

This rule is about platform eligibility only. A hostname-root site is not guaranteed to be selected by users or highlighted by Google.

Primary source: https://developers.google.com/search/docs/appearance/preferred-sources

## Google Indexing API guardrail

Do not use or recommend Google Indexing API as a generic way to make articles, documentation, product pages or ordinary updates index faster.

The current API scope is limited to:

- pages containing `JobPosting`;
- livestream pages containing `BroadcastEvent` embedded in `VideoObject`.

Even in an applicable scope, API submission does not prove indexing.

Primary source: https://developers.google.com/search/apis/indexing-api/v3/using-api

## Next.js metadataBase

For Next.js, record the intended production site root and compare it with `metadataBase` when relative URL metadata is used. A mismatch can propagate the wrong host/path into canonical, alternate, Open Graph and other URL-based metadata.

A missing `metadataBase` is `watch`, not an automatic defect, because fully absolute URL metadata can be valid. Final generated HTML remains the stronger Search evidence.

Primary source: https://nextjs.org/docs/app/api-reference/functions/generate-metadata

## Next.js sub-path deployment

For a Next.js public root such as:

```text
https://owner.github.io/project/
```

the expected application base path is:

```text
/project
```

The gate compares that public scope with the declared `basePath`. It does not treat `assetPrefix` as an application-routing substitute.

Primary source: https://nextjs.org/docs/pages/api-reference/config/next-config-js/basePath

## Next.js static export

When `staticExport: true` is declared, provide an explicit inventory of server-dependent/unsupported features. A non-empty inventory fails the gate; a missing inventory remains `watch`.

This is intentionally separate from a successful `next build`. Source declarations describe intent; the build and final artifact prove what actually shipped.

Primary source: https://nextjs.org/docs/app/guides/static-exports

## GitHub Pages publication boundary

For GitHub Pages, record the real publishing mode:

- `branch`;
- `github-actions`;
- `unknown`.

With custom Actions the uploaded Pages artifact is the relevant publication boundary. A `CNAME` file observed in the repository is not sufficient evidence of the live custom-domain configuration.

The gate therefore requires final-artifact verification before returning `pass` for the publication-boundary rule.

Primary source: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Relationship to existing ARWP layers

Use this gate before stack-specific remediation, then continue through existing evidence layers:

```text
platform/scope applicability
→ repository/source ownership
→ build
→ final artifact
→ deployed HTTP/browser surface
→ Search Release / Technical Integrity
→ owner-platform Search evidence
```

Search Platform Eligibility does not replace Repository Mapper, Search Release, Technical Integrity, Growth Profile or Change Receipts. Its job is narrower: reject an inapplicable tactic before those systems spend effort implementing it.
