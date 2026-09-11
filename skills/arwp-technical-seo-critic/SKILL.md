# ARWP Technical SEO Critic

Use this skill for a second-pass adversarial technical SEO review after the normal ARWP Search Release, Technical Integrity and Search Surface checks. The goal is not to repeat a generic SEO checklist. The goal is to find states that can remain wrong after the ordinary checks look green.

Read these sources first:

- `registry/search-release-practices.json`
- `registry/technical-integrity-rules.json`
- `registry/search-surface-blueprint.json`
- `registry/site-readiness-checklist.json`
- `registry/technical-seo-critic-practices.json`
- `registry/portfolio-sites.json` when working across the owner-controlled fleet

## Operating mode

Treat the review as an adversarial interview. For every applicable critic practice, ask what bad state could still pass the existing checks, then inspect the final built artifact and the live public surface where possible.

Classify every candidate as one of:

- `missing` — a supported technical control is absent or wrong;
- `contradictory` — individually valid signals disagree;
- `false-green` — ordinary presence checks pass while the effective Search behavior can still fail;
- `false-positive` — ARWP itself is presenting a non-SEO or obsolete signal as Search work;
- `owner-data` — field/provider data is required and cannot be inferred from repository state;
- `not-applicable` — the site does not use the relevant mechanism;
- `covered` — an existing ARWP check already handles the risk adequately.

Do not create duplicate work for `covered` findings.

## Critic sequence

1. Establish the canonical public hostname and representative priority URLs.
2. Run or inspect the ordinary Search Release / Technical Integrity / Search Surface findings first.
3. Inspect source-order integrity of the final HTML head. Presence of canonical, robots, hreflang, favicon or JSON-LD is not enough if invalid head markup can stop Google before those elements.
4. Carry field Core Web Vitals into the release review when owner/provider evidence exists. Do not substitute a Lighthouse or local lab score for real-user field data, and do not turn Core Web Vitals into a universal ranking score.
5. If the site paginates, verify persistent crawlable URLs and independent canonical identities for useful page 2+ states.
6. If the site has filters, facets, search, query-state or generated collections, inspect the potential URL state space rather than only a small healthy sample.
7. For large or frequently updated sites, inspect truthful HTTP validators and conditional revalidation as crawl-efficiency evidence when the hosting stack exposes them.
8. Inspect link relationship semantics: important internal discovery paths should not be accidentally `nofollow`; paid and user-generated outbound relationships should be qualified where applicable.
9. Reject obsolete or falsely labelled SEO work. In particular, do not generate Search tasks for `meta keywords`, `rel=next/prev`, or `nositelinkssearchbox`. Keep `html[lang]` for accessibility and document semantics, but do not claim Google Search uses it to determine page language.
10. Reconcile the result with the site's rollout mode and repository guardrails before mutating another repository.

## Mutation policy

When repository edits are allowed, fix deterministic, evidence-backed technical defects and add regression checks where practical. For portfolio rollouts, honor `registry/portfolio-sites.json`: audit before mutation and do not treat portfolio membership as permission to deploy production changes.

Prefer fixing the generator, shared layout, release gate or canonical configuration rather than patching many generated HTML files independently.

## Output contract

Return a concise list with:

- finding and priority;
- affected site/surface;
- evidence;
- what existing ARWP check missed;
- action taken now;
- remaining owner-data or production-verification gate.

Separate repository implementation from measured Search outcome. A technically correct change does not prove ranking, indexing, traffic, Discover visibility or AI citation improvement.
