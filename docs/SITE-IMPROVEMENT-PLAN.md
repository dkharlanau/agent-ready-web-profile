# ARWP Site Improvement Plan

The Site Improvement Plan is the orchestration layer above ARWP Growth, Entity Graph analysis/remediation, and bounded page/internal-link observations.

It answers a narrower question than a generic SEO audit: **given the evidence ARWP can observe now, which small set of changes should be reviewed and implemented first, and how will each change be verified and measured?**

## Inputs

- Search / AI-search Growth actions and current platform guidance.
- Entity Graph Gap Report and, when a repository is supplied, grounded Entity Remediation evidence.
- A bounded page graph: canonical links, titles, primary headings, language declaration, sampled inbound links, duplicate titles, and generic internal anchors.

## Prioritization

ARWP does not calculate an SEO/readiness/ranking score. Ordering is deterministic:

1. priority (`P0` → `P3`);
2. evidence quality (`grounded-first-party` → direct observation → source-backed → manual review → advisory);
3. actionability (concrete proposal/target before open-ended review);
4. lane diversity inside a priority band so one family of issues does not crowd out all others.

The default plan is capped at eight actions. A smaller executable backlog is preferred to a long unranked checklist.

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

Every selected action carries verification and measurement hooks. Verification re-runs the relevant ARWP observation after deployment. Measurement points to owner-side evidence such as page/query Search Console data, crawl/index coverage, structured-data validation, AI referrals/citations when available, and a keep/revise/revert decision.

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
