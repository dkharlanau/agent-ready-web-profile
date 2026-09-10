# Search Release Gate

Reviewed: **2026-09-10**.

This gate exists because a site can be crawlable, richly structured and content-heavy while still presenting a weak Search result: a generic host/site label, stale or unsuitable favicon, rewritten title, poor snippet, wrong canonical host, fabricated freshness, conflicting structured data, or an old deployment artifact. Passing repository tests does not prove what Search displays, and passing an auxiliary workflow does not prove that GitHub Pages deployed the intended revision.

Canonical practice set: [`registry/search-release-practices.json`](../registry/search-release-practices.json).

## Release interview

Before calling a public site "search-ready", answer these questions from evidence rather than assumptions:

1. **What is the canonical production hostname?** Is the inspected page the hostname root or only a project/locale subdirectory?
2. **For GitHub Pages, what is the actual publishing source?** Branch/Jekyll and custom GitHub Actions have different release contracts. With custom Actions, the artifact is the publication source and a repository `CNAME` is not proof of a custom domain.
3. **What name should a user see above the result?** Do the visible home brand, `WebSite.name`, `WebSite.url`, `og:site_name`, title and canonical host support that same identity?
4. **Where is the authoritative site identity stored?** Site name, homepage title, description, canonical root and favicon should not have independent stale literals across generators, finalizers and tests.
5. **What title would Google infer if it ignored `<title>`?** Check the first prominent/H1 title, `og:title`, page text and meaningful link text. Contradictory title sources are a release defect even if each tag is syntactically valid.
6. **What snippet would be produced if meta description were ignored?** Read the leading visible text. Consent banners, utility copy, stale notices and repeated chrome must not become the strongest summary candidate. Use `data-nosnippet` only for genuinely non-essential UI; never wrap the substantive answer in it.
7. **What favicon is actually fetched?** Verify the deployed asset, bytes, square dimensions, stable URL, crawler access and recognizability at small size. A `<link rel=icon>` declaration is not enough.
8. **Is each intended URL actually indexable?** Check successful delivery, crawl allowance, robots directives and a valid indexable canonical target together.
9. **Do every URL-bearing signal and redirect vote for the same host?** Check canonical, `og:url`, structured data, sitemap, internal absolute links, HTTP/HTTPS, www/non-www, custom domain and default `github.io` variants.
10. **Does the sitemap describe the intended index, not merely the build output?** It should contain current canonical indexable URLs, not redirects, noindex routes, deleted routes, stale hostnames or build-time fake freshness.
11. **Can every `<lastmod>` be justified by a meaningful content change?** If not, omit it. A build date is not a content date.
12. **Can crawlers discover important pages through real links?** Important URLs should be reachable via crawlable `a[href]` paths with useful anchor text; sitemap membership does not replace internal discovery.
13. **What happens for a nonexistent URL?** A custom 404 should be useful, clearly an error state and outside the sitemap, not an indexable substitute for missing content.
14. **Does structured data describe the visible canonical page?** Prefer one coherent homepage `WebSite` identity and reject conflicting URL/identity graphs.
15. **Do machine-readable surfaces agree with the human site?** Feeds, datasets, schemas, `llms.txt`-style files and agent manifests must not leak an old host, stale product identity or private/noncanonical routes.
16. **For localized sites, are alternate clusters complete enough to trust?** Use self-referential and reciprocal fully-qualified `hreflang`; keep `x-default` intentional and canonical roles distinct.
17. **For GitHub Pages custom domains, is the hosting contract healthy?** Verify the domain, supported DNS, HTTPS enforcement, apex/www behavior, and absence of wildcard takeover exposure.
18. **Are we checking the final artifact after every mutator?** Inspect HTML after the last generator/post-processor, including deploy-workflow mutations that run after the main test suite.
19. **Is there a post-mutation release gate immediately before artifact upload?** It must re-check the small set of public invariants that later workflow steps can break.
20. **Did the publishing workflow actually succeed for this revision?** A green helper workflow or successful commit is not deployment evidence.
21. **Which known bad states would still pass the current tests?** Add negative tests for stale identity, wrong host, accidental noindex, sitemap aliases, fabricated freshness, missing entry files and conflicting final metadata.
22. **What did Search actually select?** After recrawl, record the selected canonical, site name, title, snippet and favicon. Treat differences as new evidence for the next loop.

## Required order

Use this order for public site work:

```text
scope + canonical host + publishing mode
→ crawl/index eligibility
→ identity contract
→ build
→ final-artifact search identity
→ canonical/redirect host contract
→ sitemap + truthful freshness + robots
→ internal discovery + 404
→ structured/machine-readable consistency
→ localization
→ all deployment-time mutations
→ post-mutation release gate
→ artifact upload + publishing workflow success
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

### Publishing-source rule

Do not cargo-cult `CNAME`. First establish whether Pages publishes from a branch or a custom GitHub Actions workflow. GitHub documents that an existing `CNAME` is ignored and not required for a custom Actions publication. In Actions mode the uploaded artifact is the release boundary, and its entry `index.html` must be present at the artifact root.

Repository files that do not participate in the active publishing mode should not be treated as production evidence. Remove or document stale configuration that can mislead future agents.

## What strong GitHub Pages sites have in common

Do not cargo-cult a theme or a domain. Public documentation projects such as Just the Docs and Material for MkDocs expose the transferable pattern: focused public identity, descriptive content, stable crawlable navigation, static HTML output, strong information architecture, predictable canonical URLs, explicit search/discovery surfaces and repeatable builds. Material for MkDocs additionally treats social cards, search and optimized static output as first-class publishing features.

The useful lesson is **coherence, crawlability, focused information architecture and release reliability**, not a particular Jekyll/MkDocs theme. Google states that crawlable technologies are broadly equivalent if content can be crawled; there is no special GitHub Pages ranking bonus.

A custom domain can improve product identity and migration control, but it is not a ranking factor by itself. `github.io` sites can be discoverable when the content, identity and crawl graph are strong. Conversely, a custom domain with conflicting canonical/redirect/sitemap signals can be worse operationally than a clean `github.io` publication.

## Site identity contract

Generated sites should keep intentional hostname-level values in one explicit source of truth:

- canonical root URL;
- site name and legitimate alternate names;
- homepage title;
- homepage description;
- stable favicon URL;
- optional social image/publisher identifiers.

Generators and late finalizers consume this contract; release tests validate their final output against it. A test must not preserve an obsolete title simply because it was copied into the test months ago.

## Snippet hygiene rule

Google says snippets are primarily produced from page content and may use the meta description when it better describes the page. Therefore the first useful visible copy matters.

Common snippet-pollution candidates include cookie/analytics consent prompts, repeated legal/safety notices before the page promise, global navigation dominating a thin page, stale release banners, generic welcome copy, and generated counters that are less useful than the page's actual purpose.

Do not hide useful content to force a snippet. If a consent/utility component is not useful as a Search summary, place `data-nosnippet` on the narrow UI container and keep the real page introduction visible and indexable.

## Favicon rule

For Search, favicon quality requires three kinds of evidence:

1. **declaration** — a usable icon URL is emitted in the homepage head;
2. **delivery** — the production asset can actually be fetched, is square, is in a supported format and is not crawler-blocked;
3. **presentation** — the mark is recognizable at small size and represents the site.

Google requires a square favicon of at least 8×8 and recommends a higher-resolution image larger than 48×48. The URL should remain stable. Never mark delivery/presentation as passed because a filename says `icon-192.png` or because HTML declares dimensions.

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

## Freshness provenance

Google says `<lastmod>` is useful when it is consistently accurate and represents the last significant modification of the page. Therefore:

- do not assign today's CI/build date to every generated URL;
- use content/data dates only where provenance is reliable;
- update lastmod when main content, structured data or meaningful links change;
- omit lastmod for undated aggregation/static pages when no reliable page date exists;
- keep feed and structured-data dates consistent with the same provenance model.

A believable sitemap with fewer dates is better than a permanently fresh-looking sitemap whose timestamps are generated mechanically.

## Sitemap and crawl graph

A sitemap is a discovery hint, not a replacement for site architecture. Maintain both canonical, current sitemap inventory and meaningful internal links from hubs, related pages and user journeys.

For data sites with many generated pages, prioritize canonical coverage, useful hubs and bounded crawl paths before generating additional query variants. Large URL counts are not themselves evidence of discoverability.

## Error-route integrity

Multi-page sites should intentionally ship a 404 experience when supported by the host. On GitHub Pages, a custom `404.html` can live in the publishing source/artifact. Keep the error page useful to humans, clearly an error state, and absent from the sitemap. Do not intentionally canonicalize missing URLs to a normal content page merely to avoid a 404.

## Structured data and machine-readable surfaces

Structured data must be syntactically valid and semantically consistent with the visible canonical page. For site-name identity, prefer one `WebSite` node on the hostname root instead of generating competing identities. Stable `@id` values and canonical-host URLs reduce accidental graph splits.

Feeds, datasets, JSON schemas, agent manifests and `llms.txt`-style surfaces should agree with the human site's public identity and URL inventory. They are useful distribution/discovery interfaces, but their presence is not proof of ranking, indexing or AI citation.

## Post-mutation release gate

Inventory everything that can modify the publish directory after the main build: theme finalizers, analytics/consent injection, ARWP publication, growth rollout, owner-data restoration, feed/sitemap regeneration and any deployment-only script.

Place a deterministic gate **after the final mutator and before `upload-pages-artifact`**. At minimum re-check:

- artifact-root `index.html` exists;
- intended homepage title/site name/description/favicon contract;
- one canonical host and matching `og:url`;
- no accidental `noindex` on intended pages;
- JSON-LD parses and homepage identity does not conflict;
- sitemap has canonical URLs only and no duplicate/alias/error routes;
- no fabricated lastmod where provenance is unavailable;
- robots points to the canonical sitemap;
- representative leaf pages still have valid title/description/canonical;
- machine-readable public files still use the canonical host.

This gate is deliberately small. It exists to catch late regressions, not rerun the entire content-quality suite.

## Deployment success is evidence

The Pages publishing workflow must succeed for the revision being claimed as live. Separate these states explicitly:

1. source committed;
2. source tests passed;
3. final publish artifact validated;
4. artifact uploaded;
5. deploy job succeeded;
6. production bytes match the intended revision;
7. search engine later recrawled/reprocessed it.

Never collapse those into one green/failed badge. A green auxiliary CI run does not compensate for a failed deploy.

## Negative tests

Positive checks prove presence; negative tests reject known regressions. Once a real failure is found, preserve it as an executable assertion. Typical negative tests reject obsolete site identity strings, wrong-host canonical URLs, accidental noindex, aliases/error routes in sitemap, blanket build-date lastmod, missing artifact-root entry files and final post-processors that restore stale metadata.

## Production loop

For every material site release:

1. resolve host and publishing mode;
2. build from canonical source;
3. inspect the final generated homepage and representative leaf pages;
4. run ARWP Technical Integrity, Search Appearance and Internal Discovery as applicable;
5. review all P0 Search Release practices;
6. apply every deployment-time mutator;
7. run the post-mutation release gate;
8. upload and deploy the exact validated artifact;
9. verify the publishing workflow succeeded for that revision;
10. verify production bytes/redirects/assets against the intended revision;
11. inspect Search Console/Bing owner data after an appropriate processing window;
12. record mismatches and feed them back into the next implementation loop.

Do not block a whole development session waiting for longitudinal ranking evidence. Implementation verification is immediate; search-engine selection and outcome measurement are asynchronous follow-up evidence.

## Primary sources reviewed

- Google Search Central — Provide a site name to Google Search: https://developers.google.com/search/docs/appearance/site-names
- Google Search Central — Influencing title links: https://developers.google.com/search/docs/appearance/title-link
- Google Search Central — Control snippets: https://developers.google.com/search/docs/appearance/snippet
- Google Search Central — Define a favicon: https://developers.google.com/search/docs/appearance/favicon-in-search
- Google Search Central — Canonicalization: https://developers.google.com/search/docs/crawling-indexing/canonicalization
- Google Search Central — Robots meta directives: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- Google Search Central — Structured data introduction: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- Google Search Central — Site moves: https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes
- Google Search Central — Build and submit a sitemap: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google Search Central — Link best practices: https://developers.google.com/search/docs/crawling-indexing/links-crawlable
- Google Search Central — Localized versions: https://developers.google.com/search/docs/specialty/international/localized-versions
- GitHub Docs — Configuring a publishing source: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- GitHub Docs — Custom domains and GitHub Pages: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages
- GitHub Docs — Troubleshooting custom domains: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages
- GitHub Docs — Creating a custom 404: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site
- GitHub Docs — Securing GitHub Pages with HTTPS: https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
- Bing Webmaster Guidelines: https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a
- IndexNow: https://www.indexnow.org/documentation

Review dates are provenance only. Recheck upstream guidance when platform behavior changes.
