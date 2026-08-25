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

Unless explicitly stated otherwise, contributions intentionally submitted to this repository are accepted under the Apache License 2.0, consistent with the repository `LICENSE`.
