---
name: arwp-index-worthiness
description: Review whether Search-facing pages, especially generated entity/data/knowledge pages, deserve inclusion in the indexable sitemap cohort. Use after technical eligibility and before broad URL expansion. Produces non-numeric index-candidate/review/hold/exclude-from-search-candidate decisions and scaled-content signals without claiming ranking impact.
license: Apache-2.0
compatibility: Works with repository/page review evidence. Owner-side query and outcome evidence improves demand review but is not required to represent unknowns honestly.
metadata:
  standard: agent-skills
  arwp-role: index-worthiness
---

# ARWP Index Worthiness

Read `docs/INDEX-WORTHINESS.md` and `registry/index-worthiness-practices.json`.

## Goal

Do not ask only:

> Can this URL be crawled and indexed?

Also ask:

> Is there enough independent user value to justify publishing this URL into the Search-facing cohort?

## Required sequence

1. establish technical eligibility and canonical identity;
2. define a bounded priority cohort;
3. review demand and unique value first;
4. review standalone utility, provenance, connectivity, freshness and canonical identity;
5. for data/knowledge sites, review entity depth;
6. record explicit evidence or `unknown`;
7. run `node bin/arwp-index-worthiness.mjs <review.json>`;
8. allow only `index-candidate` pages into the curated sitemap/indexable cohort;
9. measure indexing, impressions, citations/referrals and task outcomes separately.

## Guardrails

- Never compute a composite SEO/index-worthiness score.
- Never infer demand from page count, sitemap presence, crawl frequency or the ability to generate a URL.
- Never create filler AI text to turn a failed `uniqueValue` gate into a pass.
- Never convert a heuristic warning directly into `noindex` or deletion.
- Preserve useful product pages even when Search publication is not justified.
- Treat `owner.github.io/project/` as path scope under one hostname; do not promise an independent site name or Search favicon for the project path.
- A custom domain fixes identity scope, not content value.
- Keep `crawl eligible != index worthy != indexed != ranking != acquisition`.

## Stop condition

The review is complete when every page in the bounded cohort has an explicit state, all `index-candidate` pages have evidence for required gates, non-candidates are excluded from sitemap expansion pending review/fix, and no ranking/citation claim is made from the gate itself.
