# Search + Agent Recommendations

ARWP maintains dated, source-backed guidance for websites that want to remain discoverable, citable, fresh and agent-operable as search and browser-agent ecosystems change.

The Search + Agent registry is **not** a ranking algorithm, certification or universal readiness score. ARWP also maintains a separate Page Semantics Profile for route-level structured data and identity decisions, because a bounded homepage audit must not pretend it has reviewed every page on a site.

Current machine-readable surfaces:

- Search + Agent rules: `registry/search-agent-recommendations.json`;
- page semantics routing: `registry/page-semantics-profiles.json`;
- published Search + Agent rules: `https://dkharlanau.github.io/agent-ready-web-profile/recommendations/registry.json`;
- published page semantics: `https://dkharlanau.github.io/agent-ready-web-profile/recommendations/page-semantics.json`;
- human guide: `https://dkharlanau.github.io/agent-ready-web-profile/recommendations/`;
- immutable Search + Agent history: `https://dkharlanau.github.io/agent-ready-web-profile/recommendations/history/index.json`.

## Audit a site

```bash
arwp audit https://example.com
arwp audit https://example.com --json
```

The static audit currently checks or observes:

- homepage HTTP/indexability heuristics;
- root Googlebot access;
- snippet-blocking directives relevant to Google generative Search eligibility;
- OAI-SearchBot access separately from training controls;
- Google Preferred Sources integration signals;
- stable heading IDs and obvious fragment/scroll-reset hazards;
- sitemap `lastmod` syntax while leaving semantic accuracy to the publisher;
- draft AIPREF `Content-Usage` signals in HTTP/robots surfaces;
- an adopted ARWP profile's validity.

It deliberately returns `not-assessed` for content originality, Google/Bing owner analytics and WebMCP runtime behavior.

## Page Semantics Profile

A connected site should not receive the generic instruction “add schema.” The repository preparation loop is:

```text
inspect routes
  → classify page type
  → identify canonical entities
  → map visible first-party facts
  → choose applicable structured data
  → patch only grounded fields/pages
  → align canonical/sitemap/hreflang
  → build and inspect rendered output
  → validate externally where applicable
```

The machine-readable profile currently covers:

- `WebSite` plus publisher identity;
- `Organization` and applicable subtypes;
- Article-family pages;
- author `ProfilePage` identity;
- `Event` leaf pages;
- `Dataset` provenance;
- `SoftwareApplication`;
- `Product`;
- `VideoObject`;
- `BreadcrumbList`;
- `DefinedTerm` and `DefinedTermSet`;
- `QAPage` / `DiscussionForumPosting`;
- `ItemList` collection pages.

The core rule is **classify before markup**. Do not install one universal JSON-LD graph across every route.

Detailed guide: `docs/PAGE-SEMANTICS-PROFILE.md`.

## Entity graph

Prefer one stable node per reusable entity:

```text
/#website
  publisher → /#organization

/articles/example/#article
  author    → /authors/jane/#person
  publisher → /#organization
  about     → /terms/example/#term
```

Stable `@id` values reduce contradictory duplicate nodes. They are a graph-consistency mechanism, not a ranking mechanism.

Use `sameAs` only for URLs that unambiguously identify the same entity.

## Authorship and dates

For attributable editorial content:

- keep visible authorship/accountability;
- use a real Person or Organization consistently in Article-family markup;
- link `author.url` to a stable real profile when one exists;
- use `ProfilePage` only for a page genuinely centered on that author/entity;
- keep visible Published/Updated dates consistent with `datePublished`/`dateModified`;
- do not invent biographies, credentials, reviewer claims or publication history.

## Events and datasets

Google's current Event guidance requires each event to have a unique leaf URL and supports pages focused on a single event. ARWP therefore treats “create an event detail page” as a valid autofix only when the repository already contains the real event facts required to make the page useful.

Dataset pages have a provenance contract rather than a generic markup contract. Use `Dataset` only for real dataset-shaped assets and preserve identifiers, creator/publisher, license and distribution information where those facts exist. Google's `citation` property is for related publications, not the dataset's own citation identity.

## Terms and knowledge graphs

Schema.org `DefinedTerm` and `DefinedTermSet` can make a real glossary, vocabulary, methodology or classification system easier to resolve consistently.

ARWP treats these as semantic graph primitives, **not** a Google rich-result promise. Do not create thin pages for every keyword variation. A term page should contribute a real definition, boundary, example, relation or evidence.

## Canonical + sitemap + hreflang

Treat URL signals as one system.

- canonical links, internal links and sitemap inventory should converge on intended canonical URLs;
- do not intentionally keep redirects, `noindex` pages or accidental duplicate variants in the canonical sitemap;
- use truthful `lastmod` for meaningful changes;
- for real localized/regional variants, choose one maintainable hreflang mechanism and preserve reciprocal/self links;
- HTML, HTTP-header and sitemap hreflang are alternative declaration mechanisms, not stackable ranking layers.

## Search and AI preview controls

`nosnippet`, `max-snippet`, `data-nosnippet` and `max-image-preview` are publisher controls. They can materially affect what Search and generative systems may use or show.

ARWP therefore treats them as explicit policy decisions. It should detect accidental restrictive settings, not silently install them.

## Anti-cargo-cult guardrails

The Page Semantics Profile rejects:

- universal JSON-LD bundles;
- machine-only facts absent from the visible page;
- synthetic reviews, ratings, prices or availability;
- sitelinks-search `SearchAction` kept solely for a Google feature removed in November 2024;
- FAQ/HowTo markup sprayed across ordinary content simply to chase historical rich-result behavior;
- multiple conflicting identities for the same site/author/product/term;
- automatic `dateModified`/`lastmod` churn on every deployment;
- thin author/event/glossary pages created only for bots.

## Agent remediation contract

The preparation skill converts a material finding into:

```text
problem
  → evidence
  → risk
  → recommendedChange
  → files
  → autofix
  → verification
  → source
```

Autofix is allowed only when required facts already exist in repository or rendered-page evidence. Missing author biography, organization/legal data, event details, prices, ratings, reviews, dataset identifiers/licenses or publication history remain explicit owner-data gates.

## Freshness contract

ARWP treats freshness as several independent signals rather than one badge:

1. accurate sitemap `lastmod` for significant page changes;
2. explicit RSS/Atom/JSON feeds when the site has a useful update stream;
3. IndexNow notification for participating search engines when configured;
4. product/site history and changelog surfaces when they improve provenance;
5. measured external recrawl/citation results where platform tooling exposes them.

IndexNow helper:

```bash
export INDEXNOW_KEY='...'
arwp-indexnow payload https://example.com --urls-file=changed-urls.txt --key-location=https://example.com/indexnow-key.txt
arwp-indexnow submit https://example.com --urls-file=changed-urls.txt --key-location=https://example.com/indexnow-key.txt --endpoint=https://SEARCH_ENGINE/indexnow
```

A successful IndexNow receipt means only that the endpoint received or accepted the request. It does not prove crawling, indexing, ranking or citation.

## Visibility evidence loop

Owner-observed aggregate metrics can be stored using `schema/visibility-snapshot.schema.json` and compared without causal claims:

```bash
arwp-visibility validate evidence/visibility-2026-08.json
arwp-visibility compare evidence/visibility-2026-08.json evidence/visibility-2026-09.json
```

Supported source labels include Google Search Console generative-AI reporting, Bing Webmaster Tools AI Performance, referral analytics and reviewed manual observations.

The comparison keeps negative deltas and explicitly forbids inference that ARWP caused a movement.

## Browser-agent runtime evidence

`schema/agent-eval-receipt.schema.json` records identical task definitions evaluated through UI and WebMCP variants. This is intentionally separate from the static audit.

```bash
arwp-agent-eval validate evidence/agent-eval.json
arwp-agent-eval show evidence/agent-eval.json
```

The receipt can compare success, interactions, retries, tool calls and duration. Runtime evidence remains scoped to the tested task/browser/environment and is not automatically security trust or universal agent compatibility.

## Living-source maintenance

`.github/workflows/recommendations-watch.yml` and the Trend Radar source watch keep upstream changes visible. Reachability is only a maintenance hint. Source content still requires review before a recommendation changes.

The Trend Radar now also watches Schema.org release changes and IndexNow documentation, in addition to Google, Bing, Chrome, OpenAI and Cloudflare sources.

## Current watch items

The 2026.09 Search + Agent ruleset tracks IETF AIPREF `Content-Usage` as an Internet-Draft and the W3C Introduction Layer Community Group as incubation. Neither is promoted to a stable web requirement.

Schema.org semantics are treated separately from Google-specific feature eligibility: a type such as `DefinedTerm` can be useful for machine-readable meaning even when Google documents no rich-result feature for it.
