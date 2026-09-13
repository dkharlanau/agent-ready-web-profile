---
name: arwp-future-search
description: Explore and implement future-ready website semantics, machine-readable entity/evidence graphs, retrieval feedback and browser-agent operability after current Search foundations are healthy. Use when the goal is to prepare a real site for emerging Search/AI/agent systems beyond today's documented rich-result requirements, while keeping experiments explicit, grounded and reversible.
license: PolyForm-Strict-1.0.0
compatibility: Requires a website repository or captured site/page/entity manifests. Network access is recommended for rechecking current platform and open-standard sources before promoting experiments.
metadata:
  standard: agent-skills
  arwp-role: future-search-experimentation
---

# ARWP Future Search

Use this specialist after the normal Growth Loop has handled current crawl/index/canonical/content/identity blockers.

## Goal

Improve the site's public machine-readable knowledge model without pretending every useful semantic mechanism is a documented ranking factor.

`current foundation → semantic graph → evidence graph → retrieval feedback → agent operability → experiment → verify → measure → promote/retire`

## Source of truth

Read:

- `registry/future-search-experiments.json`;
- `docs/FUTURE-SEARCH-LAB.md`;
- `registry/page-semantics-profiles.json`;
- the target site's actual page/entity/content model.

Recheck primary sources when an experiment is `watch`, when the reviewed date is stale, or when a platform has recently changed behavior.

## Workflow

1. **Protect the baseline.** Do not let future-search experiments outrank current Search eligibility, canonical/indexability, truthful content, identity, crawler policy or user experience problems.
2. **Inventory canonical entities and pages.** Reuse stable `@id` values. Do not create duplicate nodes for the same Person, Organization, SoftwareApplication, Dataset, Service or other entity.
3. **Add broader Schema.org semantics only when true.** Current Google feature support is not the only reason to use a Schema.org property, but visible/grounded fact parity still applies. Useful relations can include `mainEntity`, `about`, `mentions`, `isPartOf`, `hasPart`, `subjectOf`, `citation` and `isBasedOn`.
4. **Compile the optional semantic index when useful.** Run:

```bash
node bin/arwp-semantic-index.mjs build \
  <page-manifest.json> <entity-catalog.jsonld> \
  --output=<semantic-index.jsonld>
node bin/arwp-semantic-index.mjs check <semantic-index.jsonld>
```

Treat the aggregate file as an optional interoperability surface. Do not replace page-local JSON-LD, visible navigation, canonical HTML, sitemap or ordinary crawling.
5. **Build evidence paths.** For research/software/documentation pages, connect real datasets, methods, code, publications and downloadable artifacts through explicit relations where appropriate. Never create decorative evidence.
6. **Use retrieval feedback.** Where owner data exists, review joint Search Console query+page evidence and Bing grounding/citation evidence. Map intent to the strongest existing canonical page and evidence asset before proposing another URL.
7. **Review agent operability.** For interactive pages, prefer native semantic HTML and accurate ARIA role/name/state. Require rendered accessibility checks and browser-agent runtime tasks.
8. **Keep action semantics gated.** Do not declare a structured action unless the public capability is real and the target is accurate. Static metadata never authorizes side effects.
9. **Use truthful change notification.** Keep sitemap `lastmod` meaningful and use IndexNow/provider-specific notification only where supported. Submission is not indexing evidence.
10. **Record the result as an experiment.** Preserve implementation verification separately from external outcome evidence. Promote an experiment only after source review and repeatable utility; retire mechanisms that create maintenance cost or ambiguity without value.

## Maturity handling

- `foundation`: safe to use when applicable because the mechanism improves truthful interoperability on its own merits. This is not a ranking-factor label.
- `experiment`: implement only with a clear reason, bounded scope, verification and rollback.
- `watch`: research and prototype if useful, but do not make it a default site requirement.

## Structured-data rules

- Prefer the most specific true type, not the type with the most attractive SERP screenshot.
- Fewer correct properties beat a large weak graph.
- Reuse canonical `@id` values across pages.
- Keep entity identity separate from page identity (`.../#software` vs `.../product/#page`).
- Use `sameAs` only for identity aliases, never topical links.
- Never fabricate rating/review, author credentials, prices, availability, event facts, identifiers, citations or dataset provenance.
- Do not emit a universal JSON-LD bundle across every route.
- Do not add metadata solely because a field exists in Schema.org.

## Done when

- the experiment and maturity are explicit;
- all added facts are grounded;
- JSON-LD parses and stable identifiers do not conflict;
- page-local visible facts remain consistent;
- the site's build/tests pass;
- runtime checks exist for agent/interactive changes;
- external Search/AI outcomes remain a separate measurement gate;
- no ranking/citation promise has been inferred from implementation success.
