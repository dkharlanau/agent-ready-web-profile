---
name: arwp-technical-seo-critic
description: Run an adversarial second-pass technical SEO review after ordinary ARWP Search Release, Technical Integrity and Search Surface checks. Use it to find false-green head metadata, missing field Core Web Vitals evidence, pagination canonical mistakes, unbounded faceted URL states, crawl revalidation gaps, HTTP-vs-HTML canonical conflicts, restrictive robots directives, link relationship problems and obsolete SEO advice without inventing a ranking score.
license: PolyForm-Strict-1.0.0
compatibility: Requires access to website source or final generated HTML. Live response headers, Search Console field data and production crawling improve verification but may remain explicit owner-data gates.
metadata:
  standard: agent-skills
  arwp-role: technical-seo-critic
---

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

## Workflow — critic sequence

1. Establish the canonical public hostname and representative priority URLs.
2. Run or inspect the ordinary Search Release / Technical Integrity / Search Surface findings first.
3. Inspect source-order integrity of the final HTML head. Presence of canonical, robots, hreflang, favicon or JSON-LD is not enough if invalid head markup can stop Google before those elements.
4. Carry field Core Web Vitals into the release review when owner/provider evidence exists. Do not substitute a Lighthouse or local lab score for real-user field data, and do not turn Core Web Vitals into a universal ranking score.
5. If the site paginates, verify persistent crawlable URLs and independent canonical identities for useful page 2+ states.
6. If the site has filters, facets, search, query-state or generated collections, inspect the potential URL state space rather than only a small healthy sample.
7. For large or frequently updated sites, inspect truthful HTTP validators and conditional revalidation as crawl-efficiency evidence when the hosting stack exposes them.
8. Inspect link relationship semantics: important internal discovery paths should not be accidentally `nofollow`; paid and user-generated outbound relationships should be qualified where applicable.
9. Inspect live response `Link` headers for `rel=canonical`. An HTML self-canonical is not a green state if an HTTP Link canonical points somewhere else. Prefer one canonical declaration channel; when both are intentionally present, require exact resolved-URL agreement and alignment with sitemap/internal-link signals.
10. Resolve effective serving directives across robots meta, googlebot meta and `X-Robots-Tag`. Flag unexpected `nosnippet`, `max-snippet:0`, `noimageindex`, `max-image-preview:none`, `max-video-preview:0`, `notranslate` or `unavailable_after` when they conflict with the site's intended Search/Discover/Images/AI exposure. Preserve intentional publisher restrictions.
11. Reject obsolete or falsely labelled SEO work. In particular, do not generate Search tasks for `meta keywords`, `rel=next/prev`, or `nositelinkssearchbox`. Keep `html[lang]` for accessibility and document semantics, but do not claim Google Search uses it to determine page language.
12. Reconcile the result with the site's rollout mode and repository guardrails before mutating another repository.

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
