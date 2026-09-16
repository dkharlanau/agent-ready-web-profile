# Search failure triage

Use this decision order when a site or portfolio has little traffic, declining impressions, contradictory crawler checks, or many technically prepared pages without meaningful Search results. This extends the existing Growth Loop and Search Release practices; it is not another SEO score or a new ranking mechanism.

Disclosure: public methodology only. Examples are synthetic. Real query/page exports, private deployment logs and portfolio outcome histories belong in the owner's private evidence store, not this public repository.

## 1. Establish what the numbers can describe

Record the exact Search property and canonical host, search type, current/previous dates, data state, country/device filters and collection time. Keep final and preliminary data distinct. Reconcile domain properties, URL-prefix properties, legacy domains and subdirectories before adding totals; overlapping properties can double count the same traffic.

Do not evaluate a deployment with a measurement window that ends before that deployment. Record first public availability and the exact deployed revision separately from repository creation or a recent commit. A current source file cannot explain a historical loss by itself.

Report absolute clicks/impressions alongside changes. A small denominator can produce a spectacular percentage without meaningful acquisition. A zero baseline has no ordinary percentage growth rate. Do not treat a portfolio-average position as the rank of its typical page, infer a universal expected CTR from it, or infer conversions from clicks.

## 2. Find the first broken stage

| Stage | Evidence to obtain | Next action |
| --- | --- | --- |
| Publication | Required build, deploy workflow and production revision agree | Repair deployment drift before repeatedly rewriting correct source |
| Public retrieval | Actual GET response, status, headers, representation and final URL | Resolve observed access/HTTP/rendering defects at their owning layer |
| Search eligibility | Effective HTTP + rendered robots directives, canonical ownership, robots access, sitemap membership | Fix contradictions on approved pages; preserve intentional exclusions |
| Google indexing | Owner URL Inspection/Page Indexing evidence for representative URLs | Separate discovered-not-indexed, crawled-not-indexed, noindex, duplicate/canonical and other reported states |
| Query coverage | Final joint query+page evidence with relevant dimensions | Improve existing answers to real observed needs; do not manufacture search volume |
| Selection and clicks | Comparable query/page cohorts, intent, competitors and Search appearance | Test useful title/opening/answer changes, not arbitrary global CTR targets |
| Useful outcome | A real next action and actual usage/contact/conversion evidence | Improve the user task; an impression is not adoption |

Unavailable owner evidence blocks only the claim needing it, not independently justified code repairs. A sitemap and a repository count of reviewed pages are not Google's indexed-page count. A `site:` search is not a complete indexing audit.

## 3. Effective HTTP contract, not head-tag presence

For each approved indexable HTML cohort, reconcile the canonical source, final artifact, serving configuration, proxy/middleware, response headers and observed production response. Read `X-Robots-Tag` as well as every applicable rendered robots directive. An HTML `index,follow` declaration, a valid canonical or sitemap membership does not override HTTP `noindex`.

In Next.js and other server/edge deployments, inspect headers/redirects/proxy and CDN or deployment protection when accessible. Static output alone cannot establish runtime HTTP behavior. On GitHub Pages, inspect the final artifact and actual serving response rather than pretending a Next.js server exists.

A release gate should execute against every declared sitemap HTML URL when tractable; for larger sites use complete artifact checks plus explicitly bounded runtime cohorts. Report the checked/eligible denominator and missing coverage. Do not relabel a homepage sample as a whole-site audit. Expand sitemap indexes correctly, and distinguish HTML URLs from image/data/XML resources.

Keep safety and editorial publication decisions intact. Never bulk-remove draft, medical-review, legal, archive, utility or duplicate exclusions just to increase the indexable count. Site Focus does not independently authorize noindex mutations.

## 4. Access evidence must name the client and method

Record method, user-agent label, timestamp, requested/final URL, status and relevant response headers for a probe. Avoid storing cookies, credentials or full private response bodies.

HEAD success does not prove GET success or content availability. When a public-monitoring alert contradicts browser access, compare a normal GET and the actual monitoring client; inspect deliberate denylist/rate-limit/cost-path behavior. A general HTTP library is not proof of abuse. Do not grant it privileged crawler status or disable defenses merely to clear an audit.

A synthetic `Googlebot` user-agent string is not verified Googlebot traffic. A 403 observed by a generic audit client proves that response for that client; it does not prove Google is blocked. Use owner URL Inspection and appropriately verified crawler/server evidence for that claim. DNS failure in an isolated runner, a blocked audit tool, a fetch-size cap or a timeout stays unknown until the failure is localized.

Add executable negative fixtures for known failures: HTML index with HTTP noindex; duplicate restrictive meta tags; healthy HEAD with denied GET; wrong canonical host; disappeared approved sitemap owner; preserved intentional noindex; and retained abuse/cost protections. Reuse the target's normal CI and final-artifact/runtime gate rather than adding a report that never runs.

## 5. Audit migrations as cohorts

Before declaring a portfolio domain's loss an SEO regression, inspect old-to-new route maps and compare the same content family across source and destination properties. Old-host impressions can decline during migration while destination visibility grows; movement alone does not prove successful transfer or causation.

Preserve corresponding permanent redirects where supported and verify the actual destination, final status, canonical, internal links, hreflang and sitemap. Review many-to-one redirects to generic hubs for lost intent or soft-404 risk. Do not automatically redirect unrelated old URLs to a homepage, and do not mass-change migrations without equivalent destination evidence. Retain useful established URLs during redesigns.

## 6. Choose a small useful treatment

Use `docs/SEARCH-OPPORTUNITIES.md` and the existing opportunity planner with real joint query+page data when available. Do not join separate aggregate Queries and Pages reports into fictional pair-level observations.

Select a small existing page cohort with a clear user job, query hypothesis, distinct useful asset and next action. For each page record what improves the answer: an original example, diagnostic sequence, worksheet, reproducible comparison, evidence boundary or better internal discovery path. More URL variants, languages, JSON-LD, agent files or validators are not substitutes for that value.

Do not require already-established demand as a universal prerequisite for a genuinely useful initial page. Where demand is unmeasured, label the acquisition hypothesis unvalidated and avoid broad fan-out. For a portfolio, prioritize independently useful fixes across sites, then concentrate acquisition experiments rather than redesigning every site simultaneously.

Keep treatment and comparison cohorts separate; record concurrent content, template, migration and deployment changes. Run Treatment Cohort Integrity where applicable. Choose a prospective observation window after verified deployment and allow for crawl/data latency. A 28-day review window can be a project convention, not a Google promise or a causal experiment by itself.

## Existing implementation routes

- `skills/arwp-growth-loop/SKILL.md`: overall research/implementation/measurement loop.
- `skills/arwp-search-release/SKILL.md` and `registry/search-release-practices.json`: especially SR-06, SR-09, SR-10, SR-14, SR-16 and deployment/owner evidence practices.
- `lib/technical-integrity.mjs`: existing response/noindex/robots/canonical findings; `scripts/technical-integrity-test.mjs` includes synthetic header-precedence regressions.
- `docs/INTERNAL-DISCOVERY-EVIDENCE.md`: bounded graph evidence, not invented orphan counts.
- `docs/SEARCH-OPPORTUNITIES.md`: need-to-existing-page decisions.
- `docs/TREATMENT-COHORT-INTEGRITY.md`: implementation scope before outcome interpretation.

## Report and stop rules

Separate confirmed defects, plausible causes, unresolved owner evidence and already-correct surfaces. For each mutation report the source paths, branch/commit/PR, exact checks and actual publication state. Do not call an open PR merged or a merged commit deployed.

A technical pass ends when the applicable approved cohort has credible implementation evidence or an explicit unresolved boundary. Acquisition success requires owner-observed outcomes. Preserve negative results and revise or stop weak experiments rather than multiplying pages to conceal the absence of demand.

## Primary references

- [Google: debug traffic drops](https://developers.google.com/search/docs/monitor-debug/debugging-search-traffic-drops)
- [Google: robots meta and HTTP directives](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- [Google: site moves with URL changes](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)
- [Google: build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google: people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Next.js: response headers](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers)
