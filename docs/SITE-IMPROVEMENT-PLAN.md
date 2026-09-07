# ARWP Site Improvement Plan

The Site Improvement Plan is the orchestration layer above ARWP Growth, Entity Graph analysis/remediation, bounded page/internal-link observations, the Search Surface Blueprint, bounded Content Differentiation review triggers, and vertical evidence.

It answers a narrower question than a generic SEO audit: **given the evidence ARWP can observe now, which small set of changes should be reviewed and implemented first, and how will each change be verified and measured?**

## Inputs

- Search / AI-search Growth actions and current platform guidance.
- Entity Graph Gap Report and, when a repository is supplied, grounded Entity Remediation evidence.
- A bounded page graph: canonical links, titles, primary headings, language declaration, sampled inbound links, duplicate titles, and generic internal anchors.
- Conditional Search Surface Blueprint evidence for page archetypes that actually apply to the site.
- Bounded Content Differentiation signals from substantive informational pages: visible references, data/artifact links, tables, figures, code examples, quantitative claims, and inspectable research/result surfaces.
- Vertical evidence for software, documentation, research/dataset, editorial, commerce and local-business contexts.

## Prioritization

ARWP does not calculate an SEO/readiness/ranking score. Ordering is deterministic:

1. priority (`P0` → `P3`);
2. evidence quality (`grounded-first-party` → direct observation → source-backed → manual review → advisory);
3. actionability (concrete proposal/target before open-ended review);
4. lane diversity inside a priority band so one family of issues does not crowd out all others.

The default plan is capped at eight actions. A smaller executable backlog is preferred to a long unranked checklist.

## Content Differentiation: observable review triggers, not a quality score

Google's current generative Search guidance emphasizes useful, unique/non-commodity content and first-hand experience or expertise, while explicitly warning against creating separate thin pages for every possible query fan-out variation. ARWP therefore does not invent an automatic "originality score" and does not turn query fan-out into a page factory.

The Content Differentiation layer only raises bounded, inspectable review triggers:

- a substantive informational page has no observed table, figure, code example, downloadable artifact, external reference, quote or cite — review whether it exposes a concrete first-hand contribution instead of adding more generic prose;
- repeated percentage-form quantitative claims are present without an observed method/source surface — review whether the claim can be grounded visibly;
- a research, benchmark, analysis, evaluation, dataset, case-study or results page has no observed proof asset — review whether readers can inspect the method, result, example, data excerpt or reproducible artifact.

Absence of those signals does **not** prove low quality. A strong essay, expert explanation or first-hand narrative may legitimately need none of them. Every resulting action is `manual-review`, never an automatic editorial mutation.

Query fan-out is treated as an intent-discovery concept, not a URL-generation recipe. Related needs should normally strengthen a canonical page, section, evidence surface or internal path unless a genuinely distinct user task justifies a separate page.

Primary source: [Google Search Central — AI features and your website](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).

## Page and internal-link observations

The bounded page graph currently reports only inspectable facts. It does not use word count, keyword density, PageRank-like scores, or a universal internal-link quota.

Examples:

- canonical link absent;
- HTML title absent;
- no primary H1 or multiple primary H1 elements requiring review;
- missing `html[lang]`;
- duplicate sampled titles;
- no inbound link from another sampled page;
- generic internal anchor text such as “learn more”.

A sitemap-only page is not called an absolute orphan: the report states only that no inbound link was observed in the bounded sample.

## Verification and measurement

Every selected action carries verification and measurement hooks. Verification re-runs the relevant ARWP observation after deployment. Measurement points to owner-side evidence such as page/query Search Console data, crawl/index coverage, structured-data validation, Google generative Search reports, Bing AI citation/referral evidence when available, and a keep/revise/revert decision.

None of those measurements prove causality by themselves.

## CLI

```bash
arwp-improve https://example.com
arwp-improve https://example.com --repo-root=../website --max-actions=8
arwp-improve https://example.com --repo-root=. --output=site-improvement.json
```

For the full entity chain:

```bash
arwp-entities https://example.com --output=entity-gap.json
arwp-entity-remediation entity-gap.json --repo-root=../website --output=entity-remediation.json
```

## Guardrails

The planner does not mutate the target repository, invent missing facts, guarantee rankings/rich results/AI citations, or claim whole-site coverage from a bounded crawl. Structured-data and editorial changes remain review-required.

Content Differentiation additionally forbids a universal content-quality score, decorative evidence/citations, synthetic proof assets, and thin query-variant page recommendations. Query fan-out is evidence about how a system may explore an intent; it is not proof that a publisher should create one page per subquery.
