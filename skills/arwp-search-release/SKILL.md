---
name: arwp-search-release
description: Run the final Search release interview for a public website, especially GitHub Pages portfolios. Use before or after deployment when title, site name, snippet, favicon, canonical host, sitemap, robots, internal discovery, localization, custom-domain aliases, or final-build durability could affect how the site is discovered and presented. This skill treats the search result as a product surface and requires production/owner evidence separately from repository checks.
license: Apache-2.0
compatibility: Requires access to the website source or final generated HTML. Network access and Search Console/Bing owner data improve production verification but are not required for offline implementation review.
metadata:
  standard: agent-skills
  arwp-role: search-release-gate
---

# ARWP Search Release

Read `registry/search-release-practices.json` and `docs/SEARCH-RELEASE-GATE.md` before changing a public site's search identity.

## Why this gate exists

A green crawl/indexability report is not enough. A site may still ship with a generic host label, weak title, polluted snippet, stale favicon, wrong canonical host, broken alternate-host redirect, mixed-host sitemap, thin language gateway, or metadata that an earlier generator later overwrites.

Treat the Search result as a public product surface.

## Required interview

Resolve these in order:

1. canonical production hostname and root scope;
2. coherent homepage site identity;
3. title-source convergence;
4. snippet-source hygiene;
5. favicon declaration, delivery and small-size brand check;
6. canonical/redirect/host coherence;
7. sitemap and robots discovery contract;
8. important internal crawl paths;
9. localization/hreflang when applicable;
10. GitHub Pages custom-domain HTTPS/DNS/alias behavior when applicable;
11. final generated artifact and deployed revision;
12. actual Search/Bing selection after recrawl.

Do not skip an item because another SEO tool is green. Record `not-applicable` or `unknown` explicitly.

## Existing ARWP checks

Use the current Search Appearance checker against the **final built hostname-root HTML**:

```bash
node bin/arwp-search-appearance.mjs <built-homepage.html> \
  --url=https://example.com/ --strict
```

Also run Technical Integrity on the public surface when network access exists:

```bash
node bin/arwp.mjs technical-integrity https://example.com/ \
  --max-pages=20 --max-link-targets=24 --json
```

For multi-page sites, add Internal Discovery before approving broad URL expansion:

```bash
node bin/arwp-internal-discovery.mjs https://example.com/ \
  --max-pages=20 --json
```

These checks overlap deliberately but prove different things. Search Appearance examines root identity declarations; Technical Integrity examines bounded crawl/index/canonical/link conditions; Internal Discovery examines bounded site paths. None proves the actual title, site name, favicon, snippet, canonical, ranking, citation or traffic selected by a search engine.

## Snippet hygiene

Google primarily derives snippets from visible page content and may use the meta description. Therefore inspect the page as text, not just head tags.

When non-essential consent/utility UI appears before the page's real promise and could dominate snippet extraction, narrowly apply `data-nosnippet` to that UI container. Do not use `nosnippet` or `max-snippet:0` on pages intended for Search/AI snippets. Do not wrap the actual answer, evidence, product description or key page content in `data-nosnippet` merely to control appearance.

## GitHub Pages mode

For a hostname root such as `project.github.io`, run the full practice set.

For `owner.github.io/project/`, do not claim a separate Google site-name or Search-favicon scope for the project path. Improve page-level title, description, canonical and content without overwriting the parent hostname identity.

For a GitHub Pages custom domain:

- verify the intended canonical host;
- verify GitHub domain ownership/DNS configuration;
- enforce HTTPS;
- review apex and `www` behavior;
- avoid wildcard DNS;
- check the default `github.io` hostname and any prior custom host for conflicting live copies;
- remove old-host URLs from canonical, structured data, sitemap and internal links after the migration policy is established.

Do not assume a `CNAME` file alone proves production configuration. GitHub Actions-based publication can manage the custom domain independently of a repository CNAME file.

## Final-artifact rule

Find the last HTML-producing or metadata-normalizing step in the build. Search identity checks belong after that step. If a site has post-processors, generators, consent injection, ARWP injection or SEO normalization, inspect the bytes after all of them.

Then inspect production separately. If production still serves an earlier title/favicon/site identity, treat that as deployment drift instead of editing correct source repeatedly.

## Portfolio mode

When the task concerns several sites, reuse the practice IDs, not the text values. For every hostname record:

- canonical host;
- actual product/site name;
- homepage title and visible promise;
- meta description;
- WebSite identity;
- favicon asset and delivery status;
- sitemap/robots host contract;
- important internal-link reachability;
- deployment revision;
- latest owner-side Search observation.

Never copy one site's title, description, publisher identity or favicon into another merely to make the checks pass.

## Stop condition

An implementation pass is complete when all applicable P0 practices have evidence of either `pass`, `intentional`, or explicit `external-owner-data/unknown`, the final artifact has been inspected, and production has no known contradictory host/identity state.

Search outcome evaluation remains a later loop. Do not wait for rankings to finish repository work, and do not call the release successful in Search until the engine-selected result is observed.
