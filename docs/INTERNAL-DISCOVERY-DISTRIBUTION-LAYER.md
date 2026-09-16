# Internal Discovery & Distribution Layer

Status: source-backed Search/product-distribution layer · reviewed 2026-09-16

This layer extends the existing Internal Discovery Evidence contract from graph observation into an implementation contract for how useful pages connect, continue, get cited and get shared.

The canonical general practices live in `registry/internal-discovery-distribution-practices.json`. Canonical content/detail pages additionally follow the stricter `registry/content-page-quality-contract.json`. The executable bounded graph remains `lib/internal-discovery.mjs` / `bin/arwp-internal-discovery.mjs` and keeps its existing evidence limits.

## Why this exists

A technically indexable page can still be poorly integrated into its own site. It may have no meaningful inbound path, depend only on a footer, point readers to aliases, use vague anchor text, omit a useful hierarchy, or simply stop when a reader would benefit from a comparison, tool or evidence page.

Google's current link guidance gives two important boundaries: use crawlable links with useful anchor text, and ensure pages you care about are linked from elsewhere on the site. Google does not publish a magic internal-link count. The goal here is therefore useful traversal and canonical relationship quality, not link volume.

Primary source: https://developers.google.com/search/docs/crawling-indexing/links-crawlable

## Discovery architecture

### Crawlable canonical paths

Priority pages should be reachable with normal HTML anchors and should normally point directly to the intended canonical destination. Redirects are useful compatibility mechanisms, but internal navigation should be updated to the current destination when practical.

Primary sources:

- https://developers.google.com/search/docs/crawling-indexing/links-crawlable
- https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes

### Descriptive anchor text

Anchor text should help a person understand what they will get after following the link. `Read more`, `click here`, `article` and bare URLs are useful review candidates when a clearer label exists, but they are not automatically spam or defects. Conversely, turning every internal link into a keyword-heavy exact-match phrase is not the goal.

A useful review question is whether the link label remains understandable when read with only a small amount of surrounding context.

### Semantic relations and reverse links

Knowledge sites should prefer explainable relationships over random related-content widgets. Examples:

- `Often confused with`
- `Compared with`
- `Appears in`
- `Used in`
- `Use with`
- `Evidence`
- `Practice`

When the reverse journey is genuinely useful, generate it from the same canonical relation source rather than maintaining two manual lists. A bias can link to a decision context via `Appears in`, while the context can link back via `Biases involved`. A worksheet can link to a technique and the technique can link back to the worksheet.

Do not expose every graph edge simply because it exists in data. Visible relations should serve the page's user journey.

## Breadcrumbs

For hierarchical content, visible breadcrumbs should reflect a typical user path rather than mechanically mirroring the URL structure. When `BreadcrumbList` structured data is published, it should stay consistent with that visible hierarchy and use current canonical destinations.

Google's current breadcrumb guidance explicitly recommends typical user paths rather than URL mirroring.

Primary source: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb

## Continue from here

A generic `Related articles` wall often mixes several user needs. Prefer a small continuation block with explicit jobs when the page family is not intentionally terminal.

Example:

```text
Continue from here
Understand  → Why anchoring happens
Compare     → Anchoring vs framing
Apply       → Project estimation checklist
Evidence    → Reviewed research notes
```

The labels are product semantics, not Google link categories. A page may legitimately be terminal when there is no useful next action.

## Page distribution and utility controls

There are now two applicability levels.

For ordinary pages such as the homepage, hubs, search results, legal/auth/error routes and non-content utilities, distribution controls remain product-dependent. Do not inject the same sitewide block merely to satisfy a count.

For canonical content/detail pages — articles, guides, documentation/reference/research detail, case studies, glossary/resource detail and comparable substantive pages — the stricter Content Page Quality contract applies. These pages must expose an end-of-content distribution footer with:

```text
Share · Copy link · [direct provider 1] · [direct provider 2]
```

The site chooses audience-appropriate providers; common examples include LinkedIn, X, Facebook, Bluesky, Telegram and WhatsApp. The contract requires at least two direct provider destinations in addition to Share and Copy link. All actions use the canonical URL.

Optional utilities such as `Save`, `Cite`, `Copy Markdown link` and `Print` remain applicability-driven. Keep content primary: the footer must not become a sticky/floating wall of icons or obstruct reading.

Full strict contract: `docs/CONTENT-PAGE-QUALITY-CONTRACT.md`.

### Share

Use the Web Share API only as progressive enhancement from user activation. Feature-detect support and keep `Copy link` as the universal fallback. Cancellation/rejection is not a successful share. Direct provider targets must be runtime-tested because external share endpoints can change independently of the repository.

Share controls are distribution UX; they are not treated as ranking factors.

Reference: https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API

### Save

For public static resources, browser-local saving can provide useful return behavior without an account. Keep this privacy-bounded. Do not imply cross-device sync or server persistence when the implementation is only local storage.

Reference: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API

### Cite / copy canonical link

Reference sites can expose a short citation or Markdown-link utility when the source metadata is trustworthy. Use the canonical URL and real publisher/review/publication information. Never invent an author, review date, DOI or formal publication status merely to make the citation look stronger.

### Feedback / reactions

A like/dislike or `Was this useful?` control is not required. If it exists, it must have a real analytics/backend/issue/feedback sink or be explicitly labelled local-only. Do not show fake aggregate counts and do not report success before the configured sink accepts the event.

## Preferred Sources

Google documents a publisher-facing Preferred Sources button/deeplink. For sites that are available in the source-preferences tool, it can be a legitimate audience/distribution affordance. It remains optional and should be secondary to the content.

Primary source: https://developers.google.com/search/docs/appearance/preferred-sources

Important boundaries:

- availability/eligibility should be checked before prominent promotion;
- the feature is domain/subdomain oriented, not a per-subdirectory signal;
- adding a button does not become a general ranking requirement;
- it does not replace ordinary internal links, content quality, external discovery or owner-side measurement.

## Regression-safe graph and distribution gate

A strong static/data site should be able to detect deterministic regressions such as:

- a priority canonical page losing all observed inbound links in a complete reviewed cohort;
- a page family becoming reachable only through global navigation when its contract requires topical discovery;
- related/reverse links drifting out of reciprocity;
- a relation target becoming a redirect, canonical alias, missing page or noindex state;
- required breadcrumbs disappearing or diverging from structured data;
- a `Continue from here` contract disappearing from a page family that intentionally requires it;
- canonical share/citation URLs drifting to tracking parameters or aliases;
- a content/detail layout losing its required distribution footer, Share/Copy controls or direct provider destinations across the family.

Keep heuristic findings as review/watch states. Do not fail CI because a page has fewer than an arbitrary number of links, and do not emit PageRank-like authority scores.

## Existing executable evidence contract

Use the bounded Internal Discovery tool for graph evidence:

```bash
node bin/arwp-internal-discovery.mjs https://example.com/ --max-pages=20 --json --output=internal-discovery.json
node bin/arwp-internal-discovery.mjs validate internal-discovery.json
```

Use Content Page Quality for deterministic final-artifact evidence:

```bash
node bin/arwp.mjs content-page-quality <build-dir> --base-url=https://example.com/ --include='^guides/' --strict
```

The content-page command never guesses that all HTML is content/detail. Classify pages explicitly with the page marker, `--include`, or `--all-html` only when that is actually true. Runtime-test each distinct Share/Copy/provider implementation separately.

Read `docs/INTERNAL-DISCOVERY-EVIDENCE.md` for graph coverage limits and `docs/CONTENT-PAGE-QUALITY-CONTRACT.md` for the strict content/detail page contract.

## Outcome boundary

This layer can prove that a repository or rendered site has a cleaner, more useful and more deterministic internal-discovery/distribution architecture.

It does not prove:

- Googlebot crawl frequency;
- indexing;
- ranking improvement;
- AI citations;
- external backlinks;
- actual sharing;
- repeat visits;
- conversion or business impact.

Measure those separately with owner/platform/referral evidence over time.
