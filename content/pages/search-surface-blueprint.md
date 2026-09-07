# Search Surface Blueprint

Reviewed: 2026-09-07

Canonical HTML: https://dkharlanau.github.io/agent-ready-web-profile/surfaces/

ARWP maps current Search and AI-search technical guidance to conditional site architecture. It distinguishes platform-backed requirements from useful product and editorial surfaces such as changelog, roadmap, updates, case studies, evidence, datasets and author profiles.

The blueprint currently contains **69 checks, 18 surface definitions and 7 site archetypes**. The first 44 cover Search identity, crawl/indexing, freshness, visual discovery, page archetypes and AI citation. A second 25-check layer covers mobile-first parity, JavaScript/lazy-load and pagination behavior, noindex/robots constraints, international/hreflang, image/video discovery, structured-data visible parity and current spam/policy guardrails.

The registry is intentionally broader than the automatic analyzer. Checks fire automatically only when public evidence supports applicability; other checks remain owner-data or manual review items. Missing optional pages are not treated as SEO failures. News/NewsArticle, FAQ rich-result markup, Event markup and commerce Product markup are only recommended when their real-world requirements are actually met.

The main implementation flow is:

1. classify the site archetype;
2. observe the pages and machine semantics that actually exist;
3. detect technical Search and page-family gaps;
4. keep optional surfaces conditional;
5. distinguish automatic, owner-data and manual/policy checks;
6. merge relevant actions into the bounded Site Improvement Plan;
7. verify after deployment and measure with owner-side evidence.

This Markdown file is a repository source/agent companion. The canonical Search surface remains the HTML page above.
