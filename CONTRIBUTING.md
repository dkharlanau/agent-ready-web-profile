# Contributing to ARWP

ARWP is experimental. Contributions are welcome when they improve real interoperability without turning the profile into a catalog of speculative AI features.

## Start from a concrete problem

Good contributions usually begin with one of these:

- a real website capability that cannot be represented truthfully;
- a declared resource that clients cannot reliably discover or verify;
- a conflict between two upstream standards or conventions;
- a false-positive or false-negative in the validator/verifier;
- an interoperability case demonstrated by a working implementation;
- a missing security, provenance, identity or abstention boundary;
- a reference site that exercises a genuinely different architecture.

Please avoid adding fields only because a new AI term, framework or product exists.

## Prefer upstream standards

Before proposing a new ARWP field, check whether the information already belongs in an established upstream mechanism such as:

- sitemap / robots / HTTP link relations;
- `llms.txt`;
- Agent Skills;
- WebMCP;
- MCP / MCP Registry;
- A2A Agent Card;
- OpenAPI;
- JSON Schema;
- Schema.org;
- Croissant.

ARWP should normally link to the authoritative resource rather than copy its contract.

## Truthfulness rule

Reference profiles and examples must distinguish:

- **implemented** from planned;
- **static metadata** from a live runtime;
- **source code** from a deployed endpoint;
- **publisher-specific Markdown** from a standard Agent Skill;
- **browser WebMCP** from remote MCP;
- **knowledge data** from an A2A agent.

Do not upgrade a capability on paper.

## Search/data disclosure gate

Before adding Search Maturity observations, experiments, datasets, automation or a new technical mechanism, classify the work **before merge**. Public documentation should describe the boundary without requiring private implementation details.

Allowed disclosure classes are:

- **source-available / public methodology** — schemas, validators, transparent cohort math, basic CLI, interoperability contracts and deliberately limited reviewed/synthetic fixtures needed for adoption;
- **commercial/private** — continuously refreshed query/SERP/AI observations, private competitor cohorts, longitudinal outcome history, large negative-results sets, owner-data connectors, portfolio monitoring and learned recommendation priors;
- **confidential R&D** — a genuinely novel similarity, attribution, decision or transformation mechanism that should remain undisclosed until an explicit IP decision is made;
- **defensive publication** — a mechanism intentionally published to establish public prior art rather than kept confidential or pursued for patent protection.

Ask these questions before publishing:

1. Is the material already public/common knowledge, or is it needed for interoperability/adoption?
2. Does it contain a refreshed/live corpus, private query set, competitor cohort, owner-only measurement, large negative-results set or operational know-how?
3. Does it reveal learned priors, recommendation ranking logic or cross-site outcome history that can remain behind a public interface?
4. Could it contain a novel technical mechanism that merits confidential/IP review before disclosure?
5. Is publication intentional, and are the repository's current PolyForm Strict 1.0.0 terms the intended grant for this contribution?

For Search Intervention records, `public-methodology` and `public-fixture` must keep `containsLiveCorpus:false` and `containsLearnedPriors:false`. Use synthetic or deliberately limited reviewed fixtures for tests. Real dogfood evidence belongs in the target's private evidence store unless there is an explicit publication decision.

If classification is uncertain, do not include the sensitive implementation/data in the public PR. The public issue may describe the interface, problem and review gate without candidate patent claims or confidential algorithms.

## Schema changes

A core schema change should include:

1. the interoperability problem it solves;
2. why an existing field or upstream standard is insufficient;
3. at least one valid example;
4. negative or conditional tests when appropriate;
5. updates to `SPEC.md` and `docs/STANDARDS-MAP.md` if semantics change;
6. consideration of compatibility with all real reference profiles.

During v0.x, incompatible changes are possible, but they should still be deliberate and documented.

## Reference profiles

A new reference profile should add a meaningfully different implementation pattern, not just another site using the same stack.

Reference declarations should be supported by public evidence. Live URLs should pass:

```bash
node bin/arwp.mjs verify examples/reference/<name>.site-profile.json
```

Warnings are acceptable when a resource is reachable but served with an unusual media type. Hard failures should be fixed or the declaration removed.

## MCP gateway changes

The generic gateway is a fallback adapter, not a domain-reasoning engine.

Gateway contributions should preserve these defaults:

- read-only public operations;
- no arbitrary URL fetching;
- HTTPS-only remote resources;
- explicit origin allow-listing;
- redirect re-validation;
- bounded response size;
- no invention of domain semantics, trust or safety state;
- explicit `found: false` / no-match behavior instead of fabricated records.

Domain-specific operations belong in domain MCP servers unless they are sufficiently generic and interoperable to justify inclusion here.

## Tests

Run:

```bash
npm install
npm test
```

For Search Maturity / intervention changes also run:

```bash
node benchmarks/search-maturity-test.mjs
node benchmarks/search-intervention-test.mjs
node bin/arwp-search-intervention.mjs check benchmarks/search-intervention/example-public-safe.json
```

For live verification of the reference suite:

```bash
for profile in examples/reference/*.site-profile.json; do
  node bin/arwp.mjs verify "$profile"
done
```

Network checks are intentionally separate from deterministic tests.

## Documentation style

Repository content is written in English.

Use direct technical language. Avoid marketing claims such as "AI-optimized", "LLM SEO boost" or "universal agent compatibility" unless a statement is narrowly defined and supported by evidence.

Experimental upstream technologies must be labelled as experimental when that status is material.

## Licensing

Unless explicitly stated otherwise for third-party material, contributions intentionally submitted to this repository must be offered under the repository's current PolyForm Strict License 1.0.0 terms so they can be distributed as part of ARWP under the same source-available license.

PolyForm Strict permits noncommercial use, but it does not grant permission to redistribute the software or create modified/derivative versions. See `LICENSE` for the authoritative terms.

This licensing change applies prospectively. It does not revoke rights already granted for earlier repository revisions that were released under Apache License 2.0.

Do not submit confidential R&D, private owner evidence or proprietary live corpora merely because an interface/schema referring to them is public.
