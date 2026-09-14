# RSS feed syndication baseline

ARWP treats a subscription feed as a first-class discovery surface for sites that publish updates. The baseline format is RSS 2.0. Atom and JSON Feed may coexist, but they do not replace the RSS baseline for an ARWP rollout unless a project records an explicit exception.

The canonical contract lives in `registry/feed-syndication.json`.

## Required public behavior

For a site with articles, research notes, releases, changelogs, guides, cards, datasets or comparable updateable content:

1. publish a canonical RSS 2.0 endpoint, preferably `/feed.xml`;
2. add HTML autodiscovery on relevant entry pages:

```html
<link rel="alternate" type="application/rss+xml" title="Site updates" href="https://example.com/feed.xml">
```

3. use canonical absolute HTTPS URLs in `<link>` and `<guid>`;
4. source item dates from reviewed content/release metadata, not the build clock;
5. keep ordering deterministic, newest first;
6. validate the generated artifact in CI;
7. never list an RSS/Atom/JSON feed under a `Sitemap:` directive in `robots.txt`.

A sitemap is a crawl-discovery document. A feed is a subscription/update stream. A feed may be linked from HTML and other discovery surfaces, but it is not a sitemap.

## GitHub Pages and other static builds

Generate `feed.xml` from the same canonical source data used to render the public pages. Write it into the directory GitHub Pages actually publishes (`docs/`, repository root, `site/`, `dist/`, etc.). Do not maintain a hand-edited feed in parallel with structured source content.

The build should also inject or render the RSS `<link rel="alternate">` from a shared head/template so discovery does not depend on one manually edited page. See `examples/rss/github-pages/generate-feed.mjs` for a dependency-free pattern.

## Next.js App Router

Prefer a Route Handler at `app/feed.xml/route.ts` when the feed is derived at build/request time from application content. Return UTF-8 XML with `Content-Type: application/rss+xml; charset=utf-8` and a suitable cache policy. The root layout/head should expose the feed through `<link rel="alternate">`.

If the application is a static export, the same contract still applies: make sure the build emits a real `/feed.xml` file and verify the exported artifact rather than assuming a runtime route exists.

See `examples/rss/nextjs/app/feed.xml/route.ts`.

## Localized sites

Prefer a stable feed per locale when the site has genuinely localized content, for example `/en/feed.xml`, `/de/feed.xml` and `/ru/feed.xml`. Each feed should identify its language and point only to canonical URLs for that locale. A global `/feed.xml` may exist as an aggregate or canonical default, but its language semantics must be explicit.

## CI gate

At minimum, CI should fail when:

- `feed.xml` is missing for an applicable site;
- the document is not RSS 2.0 or is malformed XML;
- required channel metadata is absent;
- item links or GUIDs are relative/non-canonical;
- dates are invalid or fabricated from the build wall clock;
- relevant HTML lacks RSS autodiscovery;
- `robots.txt` declares a feed URL as `Sitemap:`;
- generated items diverge from the canonical source set.

ARWP scanners already recognize RSS, Atom and JSON feeds explicitly linked from HTML. This baseline adds the publisher-side requirement: a site that has subscribable updates should actually expose and continuously verify that surface.
