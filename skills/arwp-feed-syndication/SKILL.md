# ARWP Feed Syndication

Use this skill when adopting, auditing or repairing RSS/Atom/JSON Feed discovery on a public site.

## Contract

Read `registry/feed-syndication.json` and `docs/FEED-SYNDICATION.md` before making changes. Treat RSS 2.0 as the baseline subscription surface for sites with public updates. Preserve existing Atom/JSON feeds unless there is evidence they are obsolete and safe to retire.

## Workflow

1. Identify the real published root and the canonical source of updateable content.
2. Determine whether the stack is static/GitHub Pages, Next.js App Router, or another framework.
3. Generate RSS from canonical source records; do not hand-maintain duplicate feed content.
4. Prefer `/feed.xml` for the canonical site feed. Add per-locale feeds when the content is localized.
5. Add `<link rel="alternate" type="application/rss+xml" ...>` to relevant HTML entry points through a shared template/layout when possible.
6. Use canonical absolute HTTPS item URLs and stable GUIDs.
7. Use source publication/update dates, not the build wall clock.
8. Keep `robots.txt` sitemap directives limited to real sitemaps. Never add RSS/Atom/JSON Feed URLs as `Sitemap:` lines.
9. Add CI checks for XML shape, autodiscovery, URL/date integrity, locale integrity, deterministic ordering and robots separation.
10. Build and inspect the deployed artifact. A source-only change is not completion.

## Static / GitHub Pages

Use `examples/rss/github-pages/generate-feed.mjs` as a dependency-free reference. Adapt the output directory to the actual Pages source (`docs`, root, `site`, `dist`, etc.). Feed generation belongs before the final read-only audit/deploy gate.

## Next.js

Use `examples/rss/nextjs/app/feed.xml/route.ts` as the App Router reference. The route must return `application/rss+xml; charset=utf-8`. For static exports, verify that the export produces a real XML artifact and does not depend on an unavailable runtime handler.

## Completion evidence

Record the public feed URL, at least one HTML page that advertises it, the CI/check that validates it, and whether legacy Atom/JSON feeds were preserved. If a site has no subscribable/updateable content, record an explicit non-applicability decision rather than silently omitting the check.
