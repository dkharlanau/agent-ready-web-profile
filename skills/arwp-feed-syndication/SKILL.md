---
name: arwp-feed-syndication
description: Audit, implement and verify RSS 2.0 subscription surfaces for public websites while preserving compatible Atom or JSON Feed consumers. Use it to connect feeds to canonical content sources, HTML autodiscovery, locale semantics, stable identifiers, truthful dates and CI without turning feed presence into ranking or citation promises.
license: PolyForm-Strict-1.0.0
compatibility: Requires access to website source or the final generated artifact. GitHub Pages/static builds and Next.js App Router are documented; live deployment improves final verification.
metadata:
  standard: agent-skills
  arwp-role: feed-syndication
---

# ARWP Feed Syndication

Use this skill when adopting, auditing or repairing RSS/Atom/JSON Feed discovery on a public site.

## Contract

Read `registry/feed-syndication.json` and `docs/FEED-SYNDICATION.md` before making changes. Treat RSS 2.0 as the baseline subscription surface for sites with public updates. Preserve existing Atom/JSON feeds unless there is evidence they are obsolete and safe to retire.

A valid feed is a subscription/distribution surface. Do not describe it as a Search ranking factor, guarantee of citation, or proof that crawlers/subscribers consume the site.

## Workflow

1. Identify the real published root and the canonical source of updateable content.
2. Determine whether the stack is static/GitHub Pages, Next.js App Router, or another framework.
3. Generate RSS from canonical source records; do not hand-maintain duplicate feed content.
4. Prefer `/feed.xml` for the canonical site feed. Add per-locale feeds when the content is localized. Preserve a different established path when compatibility makes replacement risky.
5. Add `<link rel="alternate" type="application/rss+xml" ...>` to relevant HTML entry points through a shared template/layout when possible.
6. Use canonical absolute HTTPS channel/item links and stable GUIDs. Prefer canonical item URLs as GUIDs when durable; otherwise a stable opaque identifier such as a URN is valid.
7. Use source publication/update dates, not the build wall clock.
8. Keep `robots.txt` sitemap directives limited to real sitemaps. Never add RSS/Atom/JSON Feed URLs as `Sitemap:` lines.
9. Add CI checks for XML shape, autodiscovery, URL/GUID/date integrity, locale integrity, deterministic ordering and robots separation.
10. Build and inspect the deployed artifact. A source-only change is not completion.

## Static / GitHub Pages

Use `examples/rss/github-pages/generate-feed.mjs` as a dependency-free reference. Adapt the output directory to the actual Pages source (`docs`, root, `site`, `dist`, etc.). Feed generation belongs before the final read-only audit/deploy gate.

## Next.js

Use `examples/rss/nextjs/app/feed.xml/route.ts` as the App Router reference. The route must return `application/rss+xml; charset=utf-8`. For static exports, verify that the export produces a real XML artifact and does not depend on an unavailable runtime handler.

## Completion evidence

Record the public feed URL, at least one HTML page that advertises it, the CI/check that validates it, and whether legacy Atom/JSON feeds were preserved. If a site has no subscribable/updateable content, record an explicit non-applicability decision rather than silently omitting the check.

Keep implementation readiness, subscription discovery, Search ranking and citation outcomes as separate claims. Feed correctness supports the first two; it does not prove the latter two.
