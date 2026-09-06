# Page Semantics Profile

The ARWP Page Semantics Profile turns structured data, identity, canonicalization and page-type guidance into an implementation contract an agent can apply to a real site.

Canonical machine-readable surfaces:

- packaged: `registry/page-semantics-profiles.json`;
- published: `https://dkharlanau.github.io/agent-ready-web-profile/recommendations/page-semantics.json`;
- implementation skill: `skills/arwp-prepare-site/`.

This profile is non-normative implementation guidance. It does not create a new Schema.org vocabulary and it does not promise ranking, rich results, Discover inclusion or AI citation.

## Why this exists

A generic instruction such as “add JSON-LD” is too weak for autonomous site work. The agent first needs to answer:

1. What kind of page is this?
2. Which real entity is the page about?
3. Which facts are visible and first-party?
4. Which Google feature guidance applies, if any?
5. Which Schema.org semantics are useful even when no Google rich result exists?
6. Does a missing user-facing page need to be created, or would that be SEO cargo cult?
7. Can the change be safely generated from repository evidence, or does it require owner data?

The Page Semantics Profile encodes those decisions.

## Core rule: classify before markup

Do not install a universal schema bundle.

A site home page may deserve `WebSite` plus one publisher identity. An article may deserve an Article-family type and a resolvable author. An event needs a real event leaf page. A dataset needs provenance. A glossary can use `DefinedTerm` and `DefinedTermSet`. A product, software application, video or community discussion has different semantics again.

Markup must mirror the visible page. If the visible content does not support a property, omit it rather than inventing a value.

## Entity graph

Prefer one stable node per reusable entity.

```text
https://example.com/#website
  publisher → https://example.com/#organization

https://example.com/articles/example/#article
  author    → https://example.com/authors/jane/#person
  publisher → https://example.com/#organization
  about     → https://example.com/terms/resolver-regret/#term
```

Stable `@id` values are a graph-consistency technique, not a ranking trick. Reuse the same identity rather than emitting slightly different Organization, Person, Product or term objects on every page.

Use `sameAs` only when the target URL unambiguously identifies the same entity. A topic page, search result, tag or loosely related social post is not an identity alias.

## High-value routing profiles

| Page intent | Primary semantics | Important visible contract | Create a missing page? |
| --- | --- | --- | --- |
| Site home | `WebSite` + publisher `Organization`/`Person` | site name and real publisher identity | no |
| Organization/about | `Organization` or specific subtype | real identity facts represented in markup | only when useful to users |
| Editorial article | `Article` / `BlogPosting` / `NewsArticle` / `TechArticle` | headline, author/accountability, real dates, body | author profile only when real |
| Author page | `ProfilePage` → `Person`/`Organization` | useful real contributor profile | yes for a recurring real contributor |
| Event | `Event` | one real event, date/time and location | yes when a real event lacks a detail page |
| Dataset | `Dataset` | name, description, access/distribution and provenance | yes when a real dataset needs a landing page |
| Software | `SoftwareApplication` | real application facts | only for a real product surface |
| Product | `Product` | real product facts; no invented offers/reviews | only for a real product surface |
| Video watch page | `VideoObject` | real video, title, thumbnail, upload context | yes for an important real video |
| Hierarchical detail | `BreadcrumbList` | meaningful user hierarchy | no |
| Glossary term | `DefinedTerm` | actual term and definition | yes only if the definition page has user value |
| Glossary/taxonomy hub | `DefinedTermSet` | real vocabulary scope and term collection | yes only for a real vocabulary |
| Community Q&A/discussion | `QAPage` / `DiscussionForumPosting` | actual UGC question/discussion and authorship | no synthetic conversion |
| Collection | `ItemList` | real list with distinct detail targets | only if the hub improves navigation |

The machine-readable registry carries the source URL and more detailed constraints for each profile.

## Authors and accountability

For attributable editorial content:

- keep a visible byline or accountable publisher where appropriate;
- use `Person` or `Organization` consistently in Article-family markup;
- provide `author.url` when a stable author/profile page exists;
- use `ProfilePage` only when the page is genuinely about that author or organization;
- never generate biography, credentials or reviewer claims that are not present in first-party source material.

This improves resolvability without turning “E-E-A-T” into a fake schema field. There is no universal `EEAT` markup.

## Publication and freshness

Use dates as evidence, not decoration.

- Show a clear publication/update date when date semantics matter.
- Keep `datePublished`, `dateModified` and sitemap `lastmod` consistent with meaningful content changes.
- Do not touch every page timestamp on every build.
- Prefer repository/content history when an agent needs to infer whether a change was material; if evidence is weak, require owner review.

## Events

Google's event feature is unusually explicit: each event needs a unique leaf URL and the page should focus on a single event. A schedule page containing ten events is not a substitute for ten useful event detail URLs when the site is targeting event search features.

An agent may create an event detail page only when the repository already contains the real event facts required to make that page useful. It must not invent venue, dates, ticket information, organizer or performer data.

## Datasets

Use `Dataset` only for genuine dataset-shaped assets. Prefer useful provenance fields such as creator/publisher, identifiers, license and distributions when those facts exist.

Do not misuse `citation` as the dataset's own identifier. Google's dataset guidance uses it for related publications; the dataset itself is identified through properties such as `name`, `identifier`, `creator` and `publisher`.

## Terms and semantic graphs

`DefinedTerm` and `DefinedTermSet` are useful for sites with real terminology, glossaries, frameworks or classification systems.

They are not a Google rich-result hack. Their value is machine-readable semantic identity:

```text
Term page
  DefinedTerm
    name
    description
    termCode?
    inDefinedTermSet → glossary

Glossary page
  DefinedTermSet
    about → subject/entity
    hasDefinedTerm → canonical term identities
```

Do not produce hundreds of thin “keyword definition” pages. Create a term page when it contributes a real definition, boundary, example, evidence or relation that would otherwise be lost.

## Canonical, sitemap and localization contract

Treat URL signals as one system:

- the page's canonical URL;
- internal links;
- sitemap inventory;
- indexability;
- redirects;
- `hreflang` for real localized/regional variants.

The canonical sitemap should normally contain the absolute canonical URLs the publisher actually wants indexed, not redirects, `noindex` URLs, staging copies or accidental parameter variants.

For localized variants, use a maintainable `hreflang` method and preserve reciprocal plus self references. HTML, HTTP headers and sitemap declarations are alternatives; duplicating all methods does not create an extra benefit.

## Search and AI preview controls

Preview controls are policy, not decoration.

- `nosnippet` and `max-snippet` can suppress or limit previews and can affect eligibility/inputs for generative Search features.
- `data-nosnippet` can exclude selected visible regions from snippets; Bing also documents this for AI-generated summaries.
- `max-image-preview:large` is useful when the publisher wants large-image eligibility and the page has a representative high-quality image.

The agent must surface these choices rather than silently applying a restrictive policy.

## Anti-cargo-cult rules

Do not:

- inject every popular Schema.org type into every page;
- generate machine-only facts absent from visible content;
- invent authors, dates, prices, stock, ratings, reviews or event facts;
- retain `SearchAction` solely for Google's retired sitelinks search box;
- add `FAQPage` or `HowTo` to ordinary content simply to chase historical rich-result behavior;
- create thin author/event/glossary pages only to host markup;
- update `dateModified` or sitemap `lastmod` on every deployment;
- put redirects, noindex pages or non-canonical duplicates into the canonical sitemap;
- use `sameAs` for topical links that do not identify the same entity.

## Agent remediation contract

When ARWP is used with Codex or another repository agent, every page-level finding should be convertible to:

```json
{
  "problem": "Article pages have unresolvable authors",
  "evidence": ["src/content/articles/*.md has author names", "no author route exists"],
  "risk": "Identity is inconsistent across visible content and JSON-LD",
  "recommendedChange": "Create real author profile routes from existing contributor metadata and reference them from Article JSON-LD",
  "files": ["src/content/authors/*", "src/layouts/Article.*"],
  "autofix": "safe-when-author-data-already-exists",
  "verification": ["build", "parse JSON-LD", "crawl author URLs", "compare visible byline"],
  "source": "https://developers.google.com/search/docs/appearance/structured-data/article"
}
```

This is the intended ARWP operating model: audit → classify → patch → verify → record evidence.

## Primary sources

The machine-readable profile includes the primary source for every route. The most important families are:

- Google Search structured data feature documentation and general policies;
- Google canonicalization, sitemap, robots-preview and localized-version guidance;
- Schema.org for semantics that are useful outside Google-specific rich results;
- Bing Webmaster guidance where Bing/Copilot behavior differs or adds controls.

Upstream behavior remains authoritative. ARWP records the reviewed interpretation and keeps dated guidance rather than claiming permanent platform behavior.
