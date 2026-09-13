---
name: arwp-internal-discovery
description: Audit and improve a site's rendered internal discovery and page-distribution architecture: crawlable canonical links, descriptive anchors, topical/reverse relations, breadcrumbs, continuation blocks, share/copy/save/cite utilities and regression-safe link-graph checks without inventing link-count ranking formulas.
license: PolyForm-Strict-1.0.0
compatibility: Requires access to website source, final generated HTML or a bounded public crawl. Rendered HTML and canonical sitemap evidence are preferred. Search Console, referral and engagement outcomes remain owner-data evidence.
metadata:
  standard: agent-skills
  arwp-role: internal-discovery-distribution
---

# ARWP Internal Discovery & Distribution

Use this skill when a multi-page site has good pages but weak traversal, unclear internal relationships, orphan/global-only pages, generic anchors, missing breadcrumbs/next steps, or useful resources that are hard to save, cite or share.

Read first:

- `registry/internal-discovery-distribution-practices.json`
- `docs/INTERNAL-DISCOVERY-EVIDENCE.md`
- `docs/INTERNAL-DISCOVERY-DISTRIBUTION-LAYER.md`
- `registry/search-release-practices.json`
- the target site's final canonical sitemap and generated HTML

## Evidence hierarchy

1. Publisher intent and product/navigation boundaries.
2. Current primary platform documentation.
3. Final rendered/generated HTML and canonical sitemap.
4. Bounded Internal Discovery report over the reviewed cohort.
5. Live HTTP/redirect/canonical behavior.
6. Owner Search Console, referral, sharing and engagement evidence.
7. Heuristics only when explicitly labelled as heuristics.

Do not infer ranking improvement from link count, click depth, share buttons or a cleaner graph. Do not convert partial crawl coverage into orphan evidence.

## Workflow

1. Resolve the canonical public host, sitemap and priority page families.
2. Run or reuse the bounded Internal Discovery evidence graph when the site is large enough that source inspection alone is misleading:

```bash
node bin/arwp-internal-discovery.mjs https://example.com/ --max-pages=20 --json
```

3. Classify page roles: canonical entity/reference page, hub/collection, comparison, context/use-case, evidence/research, tool/practice or utility page. Exclude redirect aliases, noindex states and canonical aliases from the content-owner graph.
4. Verify important internal paths use crawlable `<a href>` links and point directly to canonical targets. Fix internal links to redirects/aliases when practical instead of relying on the redirect chain.
5. Review anchor text. Prefer concise descriptive labels that help a reader predict the destination. Treat generic anchors such as `read more`, `click here`, `article` or bare URLs as review candidates, not automatic defects; do not replace them with keyword-stuffed exact-match anchors.
6. Build semantic relations only from real relationships. Useful relation labels include `Often confused with`, `Compared with`, `Appears in`, `Use with`, `Evidence`, `Practice` and `Used by`. Add reverse links where the same relationship genuinely helps the reverse journey.
7. For hierarchical content, align visible breadcrumbs with a typical user path. Add or verify `BreadcrumbList` only when it truthfully represents that hierarchy; do not fabricate folder-like categories merely to create markup.
8. On non-terminal page families, add a compact continuation block. Prefer different jobs such as `Understand`, `Apply`, `Compare`, `Evidence` or `Use a tool` over a generic wall of related articles.
9. Consider a compact page utility bar when it fits the product: `Reviewed`, reading time/status, `Save`, `Share`, `Copy link`, `Cite`, `Print`. Share should progressively enhance through the Web Share API with a copy-link fallback. Copy/citation must use the canonical URL. Local save should remain local/private unless the product explicitly owns authenticated server state.
10. For citable reference pages, generate citations only from truthful metadata. Never invent authors, review dates, DOIs or publication history.
11. For eligible publishers, review Google's current Preferred Sources feature as an optional audience/distribution affordance. Check applicability before prominent promotion; never call the button a ranking requirement.
12. Add deterministic CI for the target site's actual contract: canonical target health, orphan/global-only regressions in a complete cohort, required reverse links/continuation blocks, breadcrumb parity and selected anchor-quality rules. Preserve unknown/partial states and avoid an authority score.
13. Re-run final generated/public evidence after all post-processing. Measure Search, referrals, shares, return use and task outcomes separately over time.

## Target-site implementation pattern

For a structured knowledge site, a strong implementation usually has:

- one canonical relation source rather than manually duplicated related lists;
- explicit relation types and deterministic reverse-link generation;
- visible breadcrumbs plus matching `BreadcrumbList` for hierarchical page families;
- a small `Continue from here` block with distinct user jobs;
- a compact utility bar whose JS is progressive enhancement and whose links/actions do not hide the article;
- canonical-URL copy/share/citation behavior;
- optional localStorage bookmarks with no account requirement;
- a graph checker that rejects broken/alias targets and verifies required relation reciprocity.

Do not inject the same sitewide block into every page merely to improve graph counts. Do not turn every taxonomy relationship into a visible link. Use the smallest relation set that genuinely helps the page's user journey.

## Output contract

Report:

- reviewed page/link cohort and coverage limits;
- orphan/global-only/continuation findings;
- canonical target and redirect/alias health;
- anchor-text findings;
- related/reverse relation architecture;
- breadcrumb implementation and structured-data parity;
- continuation and page-utility implementation;
- share/copy/save/cite/Preferred Source applicability separately from SEO claims;
- deterministic CI/regression coverage;
- remaining owner-data or live outcome gates.

Keep implementation evidence separate from crawling/indexing/ranking, AI citation, sharing, referral and engagement outcomes.
