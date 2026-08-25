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

The CLI checks items 1–4 structurally. Truthfulness and runtime availability require external verification.

## Capability groups

A conforming site can implement any subset of the following groups.

### Web

Typical evidence:

- crawlable canonical HTML;
- sitemap;
- crawler policy;
- feed;
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

ARWP distinguishes two types of checks.

### Schema validation

Deterministic and local:

- required fields;
- allowed properties;
- URI syntax;
- conditional requirements such as a URL for Streamable HTTP MCP;
- enabled WebMCP requiring at least one page.

Run:

```bash
node bin/arwp.mjs validate ai/site-profile.json
```

### Runtime verification

Network- and implementation-dependent:

- URL status and redirects;
- media types;
- sitemap/robots correctness;
- `llms.txt` syntax;
- JSON Schema/OpenAPI/Croissant validity;
- stable release manifests;
- WebMCP tool discovery;
- MCP protocol handshake and tool listing;
- A2A Agent Card validity;
- citation/provenance preservation through retrieval.

Runtime verification is planned for a later CLI command because it needs explicit network policy, timeouts, redirect handling and protocol-specific adapters.

## Recommended CI policy

For an adopting repository, fail CI on:

- invalid ARWP JSON;
- schema violations;
- a declared remote MCP server without a remote URL;
- WebMCP enabled with no declared page;
- unsupported core properties.

Do not fail CI merely because a site does not implement optional MCP, WebMCP, A2A, Croissant or `llms.txt` surfaces.

Example:

```yaml
- name: Validate Agent-Ready Web Profile
  uses: dkharlanau/agent-ready-web-profile@main
  with:
    profile: ai/site-profile.json
```

For reproducible production use, pin a released tag or commit instead of `main` once ARWP publishes stable releases.

## Future conformance work

Planned checks should produce machine-readable results rather than a single opaque score. The goal is to answer "what is implemented and what is broken?", not to create a vanity agent-readiness grade.

Candidate result shape:

```json
{
  "profile": "https://example.com/ai/site-profile.json",
  "schema": "pass",
  "web": {
    "sitemap": "pass",
    "llms": "not-declared"
  },
  "data": {
    "schemas": "pass",
    "releases": "warning"
  },
  "agentWeb": {
    "webmcp": "experimental"
  },
  "mcp": {
    "remote": "pass"
  }
}
```

This keeps conformance evidence inspectable and avoids turning optional experimental technologies into mandatory badges.
