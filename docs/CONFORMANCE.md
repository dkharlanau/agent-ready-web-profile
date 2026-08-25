# Conformance model

ARWP conformance is intentionally capability-based. A website is not expected to implement every surface, and a larger capability count does not imply a better site.

## Core conformance

A profile is ARWP v0.1 conforming when it:

1. is valid UTF-8 JSON;
2. validates against `schema/site-profile.schema.json`;
3. declares the exact `profileVersion` it implements;
4. uses HTTPS for declared public URLs;
5. describes only capabilities that actually exist;
6. does not treat ARWP metadata as crawler permission, authentication, or execution authorization.

Schema validation can prove items 1–4. URL verification can provide evidence that declared resources are reachable. Truthfulness and protocol behavior still require the publisher and protocol-specific tests.

## Capability groups

A conforming site can implement any useful subset.

### Web

Typical evidence:

- crawlable canonical HTML;
- sitemap;
- crawler policy;
- feeds;
- optional `llms.txt`;
- optional Markdown discovery.

ARWP does not score ordinary SEO quality. Search ranking and indexing are evaluated by search-engine tooling, not by this profile.

### Data

Typical evidence:

- canonical JSON/JSON-LD/JSONL/NDJSON or other machine-readable records;
- schema index;
- OpenAPI contract;
- immutable/versioned releases;
- Croissant metadata for dataset-shaped assets.

Recommended invariant: one canonical record identity should survive across HTML, datasets, APIs and retrieval artifacts.

### Retrieval

Typical evidence:

- RAG-ready distribution;
- search index;
- bounded query endpoint;
- canonical IDs and citations preserved in returned records;
- documented unsupported-query or abstention behavior where relevant.

### Agent Skills

Typical evidence:

- each declared skill has a valid Agent Skills name;
- the declared URL resolves to the real `SKILL.md`;
- optional version/source metadata matches the distributed skill;
- the skill describes a real reusable procedure rather than a placeholder capability.

Agent Skills are not tool transports. A valid skill does not imply that MCP, WebMCP or an API exists unless those interfaces are separately declared and implemented.

### Agent Web

Typical evidence:

- one or more declared pages expose real WebMCP tools;
- tool schemas and descriptions are available through the page runtime;
- tool security guidance is followed;
- agentic-browser evals cover intended calls and failure cases.

A page that merely contains ordinary forms or buttons is not WebMCP-conforming unless the runtime actually exposes WebMCP capabilities.

### MCP

Typical evidence:

- a real MCP server can be started or reached;
- the declared transport matches reality;
- a remote Streamable HTTP declaration resolves to an actual MCP endpoint;
- a stdio declaration has installable package metadata or a public source location;
- Registry metadata is linked when published;
- public knowledge operations are read-only by default when mutation is unnecessary.

A static JSON endpoint does not satisfy MCP conformance by itself.

### Agent

Typical evidence:

- a real A2A agent service exists;
- its Agent Card is retrievable;
- the advertised protocols, authentication and skills match runtime behavior.

Publishing `/.well-known/agent-card.json` without a real agent is non-conforming behavior, not an advanced conformance level.

## Validation versus verification

ARWP distinguishes deterministic contract validation from live resource verification.

### Schema validation

Run:

```bash
node bin/arwp.mjs validate ai/site-profile.json
```

This checks:

- required fields;
- allowed properties;
- URI syntax;
- Agent Skills naming;
- local MCP package/source requirements;
- a URL for Streamable HTTP MCP;
- enabled WebMCP requiring at least one page.

### Live URL verification

Run against a local profile:

```bash
node bin/arwp.mjs verify ai/site-profile.json
```

Or a published profile:

```bash
node bin/arwp.mjs verify https://example.com/ai/site-profile.json
```

The current verifier checks:

- profile validity before probing;
- HTTPS reachability;
- redirects and final HTTPS URL;
- HTTP status;
- expected media type with warnings for mismatches;
- Agent Skill files/source links;
- declared WebMCP pages/documentation;
- MCP URLs/source/registry/documentation;
- data, retrieval, identity and trust resources.

It uses `HEAD` where possible and a bounded `GET` fallback for servers that reject `HEAD`.

The verifier does **not yet** execute protocol-semantic tests such as:

- parsing and linting every `SKILL.md` against the upstream Agent Skills validator;
- WebMCP runtime tool discovery;
- MCP initialize/handshake/tool-listing;
- A2A Agent Card semantic validation;
- OpenAPI/Croissant domain validation;
- citation/provenance preservation through a real retrieval run.

Those checks should use upstream validators/adapters rather than reimplementing their protocols inside ARWP.

## Exit semantics

`validate` and `verify` return a non-zero exit status for hard failures.

Live verification distinguishes:

- `pass` — the resource is reachable and matches the expected basic transport contract;
- `warn` — reachable but metadata such as `Content-Type` is unexpected or incomplete;
- `fail` — unreachable, error status or invalid HTTPS final URL.

Warnings do not make a profile invalid by themselves.

Use `--json` for machine-readable results:

```bash
node bin/arwp.mjs verify https://example.com/ai/site-profile.json --json
```

## Recommended CI policy

For an adopting repository, always fail CI on:

- invalid ARWP JSON;
- schema violations;
- a declared remote MCP server without a remote URL;
- a stdio MCP server with neither package nor source metadata;
- WebMCP enabled with no declared page;
- invalid Agent Skill names;
- unsupported core properties.

Do not fail CI merely because a site does not implement optional MCP, WebMCP, Agent Skills, A2A, Croissant or `llms.txt` surfaces.

Example validation step:

```yaml
- name: Validate Agent-Ready Web Profile
  uses: dkharlanau/agent-ready-web-profile@main
  with:
    profile: ai/site-profile.json
```

Live verification is better suited to a scheduled or deployment smoke test because it depends on external network availability.

For reproducible production use, pin a released tag or commit instead of `main` once ARWP publishes stable releases.

## No single readiness score

ARWP intentionally does not produce one opaque "agent-ready score". A content-rich static site with excellent data and no WebMCP may be more useful than a site with many experimental integrations and weak source material.

Conformance output should answer two questions instead:

1. Which capabilities are actually declared?
2. Which declared contracts are currently healthy?

That keeps interoperability evidence inspectable and avoids turning optional technologies into vanity badges.
