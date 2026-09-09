# Internal Discovery Evidence Contract

Status: experimental executable Search/Growth evidence contract · reviewed 2026-09-09

Internal discovery is useful only when the graph being measured resembles what a crawler or user can actually traverse. A source tree is not automatically a rendered link graph.

This contract defines how Goose ARWP should observe and report internal topical/discovery relationships without turning implementation artifacts into false Search evidence.

## Core rule

> Prefer the rendered canonical graph. Treat source-level inference as partial evidence unless the rendering contract is deterministic and inspectable.

The contract is about measurement quality. It does not claim that a specific number of internal links causes ranking, citation or retrieval outcomes.

Google's current link guidance provides two useful external boundaries: crawlable internal links use ordinary `<a href>` markup, and every page a publisher cares about should normally be linked from at least one other page on the site. Google also explicitly says there is no magical ideal number of links. Goose therefore measures missing/weak discovery paths rather than rewarding link volume.

Primary source: https://developers.google.com/search/docs/crawling-indexing/links-crawlable

## Executable v0.1

Run a bounded live observation:

```bash
node bin/arwp-internal-discovery.mjs https://example.com/ \
  --max-pages=20 --json --output=internal-discovery.json

node bin/arwp-internal-discovery.mjs validate internal-discovery.json
node scripts/internal-discovery-test.mjs
```

The live command reuses the Site Readiness Gate's deterministic bounded cohort selection, then fetches the selected HTML pages as the graph evidence. It does not crawl the entire site and does not infer demand from the selected URLs.

The machine-readable contract is `schema/internal-discovery-report.schema.json`. The implementation is `lib/internal-discovery.mjs`.

### What v0.1 reports

- canonical owners in the reviewed cohort;
- redirect aliases, canonical aliases and non-indexable states as separate node classes;
- same-origin crawlable owner-to-owner edges;
- `contextual`, `hub`, `utility`, `global` and `unclassified` link classes;
- owners with no observed inbound owner edge;
- owners whose only observed inbound owner edges are global navigation;
- owners with no contextual/hub/utility continuation;
- internal edges aimed at sampled redirects, canonical aliases or non-indexable states;
- internal edges that point outside the bounded cohort;
- unknown/fetch-failed pages;
- explicit partial coverage when an anchor observation cap is reached.

No PageRank-like value, authority score, SEO score or combined graph grade is produced.

### Raw HTML classification boundary

V0.1 uses structural HTML evidence conservatively:

- `<nav>`, `<header>` and `<footer>` imply a global link unless a more specific semantic hub/related marker applies;
- `<main>`, `<article>`, `<section>` and `<aside>` imply contextual placement;
- bounded class/id/ARIA labels such as `breadcrumb`, `related`, `topic`, `category`, `collection`, `cluster` or `hub` can classify an edge as hub/collection evidence;
- action-like anchor text can classify a contextual/unclassified link as utility/action evidence;
- anything else stays `unclassified`.

These are review heuristics over observed HTML structure, not Google link categories or ranking factors. A rendered DOM may differ from raw HTML on JavaScript-heavy sites; use browser/runtime evidence when that difference is material.

### Partial coverage is not absence

V0.1 caps same-origin anchor observations per page. If a canonical owner hits that cap, the report sets `summary.gapEvaluationState = "partial"` and suppresses inbound/global-only gap conclusions that could be falsified by omitted edges. It does not convert a bounded observation limit into an orphan finding.

## Node classes

Classify a route before treating it as a graph node:

- **canonical owner** — an index-eligible or intentionally discoverable page that owns a user/search intent;
- **supporting page** — a real rendered page with a distinct job but not the canonical owner for the target intent;
- **redirect alias** — a route whose meaningful behavior is redirecting elsewhere; it is an edge/transition, not a weak content node;
- **canonical alias** — a fetched page that explicitly canonicalizes elsewhere;
- **non-indexable state** — personalized, filtered, preview, attempt or other useful state that should not inflate the public discovery graph;
- **generated/runtime-only surface** — count only when its rendered behavior can be observed or deterministically reproduced;
- **unknown** — ownership or rendering cannot be established from available evidence.

Do not classify an alias as an orphan or weak page merely because its source file contains no links.

## Evidence precedence

When available, prefer evidence in this order:

1. rendered HTML / runtime crawl of the reviewed deployment;
2. framework build/export artifact corresponding to the reviewed revision;
3. deterministic renderer/component contract plus route-to-renderer mapping;
4. source-level literal-link extraction;
5. repository/file presence alone.

Lower-precedence evidence may identify candidates, but should not silently override contradictory rendered evidence.

If a build artifact is stale or from a different revision, label it stale rather than combining it with current source as one graph.

## Shared renderer rule

A route may contain almost no literal links while a shared server renderer emits a useful related-content rail for every page in the family.

Source-mode analysis may count those links only when all of the following are true:

- the route is demonstrably mapped to that renderer;
- the renderer emits ordinary crawlable anchors in the reviewed state;
- the target URLs are deterministic for that route/family;
- index/visibility conditions that can suppress the links are accounted for;
- the inference is labeled as renderer-derived rather than literal source evidence.

If any condition is uncertain, keep the link observation `unknown` until runtime/build evidence is available.

## Redirect and canonical transitions

Keep these separate:

```text
alias --301/308--> canonical owner
canonical owner --contextual link--> related owner
canonical owner --navigation link--> hub
```

A redirect can preserve a useful transition/history contract, but it is not evidence that the alias itself has a topical outbound graph.

Audits should therefore expose redirect-only exclusions or a separate transition report instead of mixing them into weak-content counts. Google's site-move guidance also recommends updating internal links to the new intended URLs rather than relying on old redirected URLs where practical.

Primary source: https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes

## Contextual vs global links

Do not collapse every internal anchor into the same signal.

Report at least when practical:

- **contextual** — appears in body, related-reading, before/next sequence or another topic/job-specific block;
- **hub/collection** — connects a page to a canonical cluster or collection;
- **global navigation** — header/footer/sitewide navigation;
- **utility/action** — moves from explanation to a real tool, practice, dataset or workflow;
- **redirect/canonical transition** — URL-state transition rather than editorial relationship.

A footer link can make a route crawlable without proving a meaningful topical relationship. Conversely, a contextual relation can be valuable even when it is not a commercial CTA.

## Recommended measurements

Prefer inspectable counts/distributions rather than a magic graph score:

- reviewed canonical owners;
- priority owners with no observed inbound crawlable path;
- owners reached only through global navigation in the bounded cohort;
- owners with no contextual/hub continuation;
- canonical cluster pair coverage where a bounded cluster is explicitly defined;
- unresolved, partial or stale renderer/source observations;
- redirect-only routes excluded from content-node analysis;
- broken/non-canonical relation targets;
- absolute cross-owner/domain transitions when relevant;
- changes before/after a scoped linking intervention.

Always retain denominators, observation limits and the route cohort definition.

## Scoped repair loop

1. Define a bounded owner/intent cluster.
2. Capture the current rendered/build graph when possible.
3. Remove aliases, previews and other non-owner states from the content-node cohort.
4. Identify genuine missing user journeys or topical relations.
5. Add contextual/hub/action links only where the destination is useful.
6. Re-run the same graph measurement.
7. Verify canonical/sitemap/index behavior did not drift.
8. Measure Search/AI/user outcomes separately over an appropriate window.

Do not solve a page-specific graph problem by injecting a sitewide footer link merely to improve a count.

## Failure modes

Reject or downgrade evidence when an audit:

- treats redirect stubs as weak articles;
- treats a source import as proof of a visible anchor without checking the renderer;
- combines current source with a stale build/export artifact;
- counts hidden/client-only state that crawlers/users cannot traverse in the reviewed state;
- equates navigation reachability with topical relevance;
- creates links to keyword variants instead of canonical owners;
- treats an anchor-observation cap as proof that no inbound link exists;
- interprets link count improvement as ranking causality.

## Outcome boundary

A cleaner internal discovery graph can improve navigability, crawl paths, product continuation and entity/intent coherence. Goose records those as implementation/product evidence.

Classic Search visibility, AI retrieval/citation, referrals and business outcomes remain external observations. A successful graph repair does not by itself prove any of them.
