# Search Release Gate

Reviewed: **2026-09-10**.

This gate exists because a site can be crawlable, richly structured and content-heavy while still presenting a weak Search result: a generic host/site label, stale or unsuitable favicon, rewritten title, poor snippet, wrong canonical host, or an old deployment artifact. Passing repository tests does not prove what Search displays.

Canonical practice set: [`registry/search-release-practices.json`](../registry/search-release-practices.json).

## Release interview

Before calling a public site "search-ready", answer these questions from evidence rather than assumptions:

1. **What is the canonical production hostname?** Is the inspected page the hostname root or only a project/locale subdirectory?
2. **What name should a user see above the result?** Do the visible home brand, `WebSite.name`, `WebSite.url`, `og:site_name`, title and canonical host support that same identity?
3. **What title would Google infer if it ignored `<title>`?** Check the first prominent/H1 title, `og:title`, page text and meaningful link text. Contradictory title sources are a release defect even if each tag is syntactically valid.
4. **What snippet would be produced if meta description were ignored?** Read the leading visible text. Consent banners, utility copy, stale notices and repeated chrome must not become the strongest summary candidate. Use `data-nosnippet` only for genuinely non-essential UI; never wrap the substantive answer in it.
5. **What favicon is actually fetched?** Verify the deployed asset, bytes, square dimensions, stable URL, crawler access and recognizability at small size. A `<link rel=icon>` declaration is not enough.
6. **Do every URL-bearing signal and redirect vote for the same host?** Check canonical, `og:url`, structured data, sitemap, internal absolute links, HTTP/HTTPS, www/non-www, custom domain and default `github.io` variants.
7. **Does the sitemap describe the intended index, not merely the build output?** It should contain current canonical indexable URLs, not redirects, noindex routes, deleted routes, stale hostnames or build-time fake freshness.
8. **Can crawlers discover important pages through real links?** Important URLs should be reachable via crawlable `a[href]` paths with useful anchor text; sitemap membership does not replace internal discovery.
9. **For localized sites, are alternate clusters complete enough to trust?** Use self-referential and reciprocal fully-qualified `hreflang`; keep `x-default` intentional and canonical roles distinct.
10. **For GitHub Pages custom domains, is the hosting contract healthy?** Verify the domain, supported DNS, HTTPS enforcement, apex/www behavior, and absence of wildcard takeover exposure.
11. **Are we checking the final artifact?** Inspect the HTML after the last generator/post-processor and then inspect production. A source template or intermediate build is not release evidence.
12. **What did Search actually select?** After recrawl, record the selected canonical, site name, title, snippet and favicon. Treat differences as new evidence for the next loop.

## Required order

Use this order for public site work:

```text
scope + canonical host
→ crawl/index eligibility
→ final-artifact search identity
→ canonical/redirect host contract
→ sitemap + robots contract
→ internal discovery
→ localization
→ production verification
→ owner-side Search observation
→ keep / revise / revert
```

Search appearance is not an optional polish step. For a hostname root it is part of the release contract because the user-facing result is itself a product surface.

## GitHub Pages-specific checks

GitHub Pages is a hosting mechanism, not the site's identity. A public result should resolve to the project's own identity rather than "GitHub" merely because the site is hosted there.

For `https://project.github.io/`:

- run the full hostname-root identity pass;
- keep `WebSite.url`, canonical, sitemap and social URLs on that hostname;
- use a real project favicon rather than an arbitrary repository image;
- verify the final Pages deployment after Actions/Jekyll/custom generators finish.

For `https://owner.github.io/project/`:

- improve page title, description, visible heading, canonical and content normally;
- do **not** pretend the project path owns an independent Google site-name or Search-favicon scope;
- preserve the parent hostname's site-level identity.

For a custom domain on GitHub Pages:

- choose the public canonical host deliberately;
- verify GitHub's custom-domain configuration and DNS;
- enable HTTPS enforcement;
- configure apex + `www` according to GitHub's documented redirect behavior;
- avoid wildcard DNS records;
- audit for old `github.io` host leakage in canonical, structured data, sitemaps and internal links;
- when a real site move occurred, preserve redirect continuity where the hosting stack can provide it.

## What strong GitHub Pages sites have in common

Do not cargo-cult a theme or a domain. Public projects such as Just the Docs demonstrate a simpler pattern: a focused homepage, descriptive site title/description, explicit site URL, stable navigation, crawlable documentation hierarchy, and a build process that produces consistent final pages. The transferable property is **coherence and discoverability**, not a particular Jekyll plugin or visual design.

A custom domain can improve product identity and migration control, but it is not a ranking factor by itself. `github.io` sites can be discoverable when the content, identity and crawl graph are strong. Conversely, a custom domain with conflicting canonical/redirect/sitemap signals can be worse operationally than a clean `github.io` publication.

## Snippet hygiene rule

Google says snippets are primarily produced from page content and may use the meta description when it better describes the page. Therefore the first useful visible copy matters.

Common snippet-pollution candidates:

- cookie/analytics consent prompts;
- repeated legal/safety notices before the page promise;
- global navigation text dominating a thin page;
- stale release banners;
- generic "welcome" copy;
- generated counters or inventory prose that is less useful than the page's actual purpose.

Do not hide useful content to force a snippet. If a consent/utility component is not useful as a Search summary, place `data-nosnippet` on the narrow UI container and keep the real page introduction visible and indexable.

## Favicon rule

For Search, favicon quality requires three kinds of evidence:

1. **declaration** — a usable icon URL is emitted in the homepage head;
2. **delivery** — the production asset can actually be fetched, is square, is in a supported format and is not crawler-blocked;
3. **presentation** — the mark is recognizable at small size and represents the site.

The first can be automated from HTML. The second needs deployed asset evidence. The third remains an editorial/visual check. Never mark the latter two as passed because a filename says `icon-192.png`.

## Canonical-host invariant

For a stable public site, these should normally agree on one host unless there is an explicit migration reason:

- final browser URL;
- HTML canonical;
- `WebSite.url` / `WebPage.url`;
- `og:url`;
- sitemap `<loc>` URLs;
- `hreflang` URLs;
- important absolute internal links;
- IndexNow submissions;
- public profile links after a host migration.

Protocol/host variants can still exist as redirecting aliases, but they should not form competing canonical identities.

## Sitemap and crawl graph

A sitemap is a discovery hint, not a replacement for site architecture. Maintain both:

- canonical, current sitemap inventory;
- meaningful internal links from hubs, related pages and user journeys.

For data sites with many generated pages, prioritize canonical coverage, useful hubs and bounded crawl paths before generating additional query variants. Large URL counts are not themselves evidence of discoverability.

## Production loop

For every material site release:

1. build from canonical source;
2. inspect the final generated homepage and representative leaf pages;
3. run ARWP Technical Integrity;
4. run ARWP Search Appearance on the hostname root;
5. review the Search Release Practices applicable to the site shape;
6. deploy;
7. verify production bytes/redirects/assets against the intended revision;
8. inspect Search Console/Bing owner data after an appropriate processing window;
9. record mismatches and feed them back into the next implementation loop.

Do not block a whole development session waiting for longitudinal ranking evidence. Implementation verification is immediate; search-engine selection and outcome measurement are asynchronous follow-up evidence.

## Primary sources reviewed

- Google Search Central — Provide a site name to Google Search: https://developers.google.com/search/docs/appearance/site-names
- Google Search Central — Influencing title links: https://developers.google.com/search/docs/appearance/title-link
- Google Search Central — Control snippets: https://developers.google.com/search/docs/appearance/snippet
- Google Search Central — Define a favicon: https://developers.google.com/search/docs/appearance/favicon-in-search
- Google Search Central — Canonicalization: https://developers.google.com/search/docs/crawling-indexing/canonicalization
- Google Search Central — Site moves: https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes
- Google Search Central — Build and submit a sitemap: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google Search Central — Link best practices: https://developers.google.com/search/docs/crawling-indexing/links-crawlable
- Google Search Central — Localized versions: https://developers.google.com/search/docs/specialty/international/localized-versions
- GitHub Docs — Custom domains and GitHub Pages: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages
- GitHub Docs — Securing GitHub Pages with HTTPS: https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
- Bing Webmaster Guidelines: https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a
- IndexNow: https://www.indexnow.org/documentation

Review dates are provenance only. Recheck upstream guidance when platform behavior changes.
