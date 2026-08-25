# Reference MCP gateway

ARWP includes a generic **read-only stdio MCP gateway** for static knowledge sites.

The gateway is intentionally small. It does not try to infer domain-specific tools from arbitrary JSON. Instead it reads a validated ARWP profile and exposes a safe baseline over resources and retrieval indexes that the publisher explicitly declared.

## Why this exists

Static hosts such as GitHub Pages can publish excellent machine-readable knowledge but cannot themselves run a remote MCP server.

ARWP separates those concerns:

```text
Static site
  ├─ HTML
  ├─ JSON / JSONL / NDJSON
  ├─ schemas
  ├─ releases
  ├─ provenance
  ├─ llms.txt
  └─ /ai/site-profile.json
            |
            v
      ARWP MCP gateway
            |
            v
       MCP client
```

The site remains the source of truth. The gateway is an adapter.

## Current transport

The reference implementation currently uses **stdio** and the MCP v2 Node server package.

This is suitable for local clients such as development tools and desktop agent runtimes. A remote Streamable HTTP deployment is a separate runtime concern and is not claimed by this repository yet.

## Tools

The gateway exposes five read-only tools:

### `get_site_profile`

Returns the validated ARWP profile used to configure the server.

### `list_declared_resources`

Lists declared web, data, retrieval and trust resources without fetching them.

An optional prefix can select groups such as `data`, `retrieval`, `web` or `trust`.

### `fetch_declared_resource`

Fetches one resource by its ARWP resource key. The tool does **not** accept an arbitrary URL.

Examples of keys:

- `web.llms`
- `data.catalog`
- `data.openapi`
- `retrieval.indexes.0`
- `trust.provenance`

### `search_retrieval`

Runs deterministic lexical retrieval over one declared JSON, JSONL or NDJSON retrieval index.

This is a baseline interoperability tool, not a semantic-search claim. A domain project can and should expose a richer MCP server when it has reviewed domain-specific search, filtering, relations, evidence or safety behavior.

### `get_record`

Finds one record by common stable-identity fields such as `canonical_id`, `canonicalId`, `record_id`, `id`, `slug`, URL or aliases.

If no record matches, the gateway returns `found: false` rather than fabricating a record.

## Run with a local profile

By default the gateway looks for:

```text
./ai/site-profile.json
```

Run:

```bash
npm install
npm run mcp:start
```

Or set an explicit local path:

```bash
ARWP_PROFILE=/absolute/path/to/site-profile.json npm run mcp:start
```

## Run against a published static site

```bash
ARWP_PROFILE=https://example.com/ai/site-profile.json npm run mcp:start
```

The remote profile must validate against the ARWP schema before the server starts.

## Example client configuration

A typical local MCP client can launch the gateway with an environment variable:

```json
{
  "mcpServers": {
    "example-knowledge": {
      "command": "node",
      "args": ["/absolute/path/to/agent-ready-web-profile/gateway/server.mjs"],
      "env": {
        "ARWP_PROFILE": "https://example.com/ai/site-profile.json"
      }
    }
  }
}
```

Client configuration formats vary; treat this as a shape example rather than a universal configuration file.

## Network safety

The gateway is deliberately restrictive.

By default it may fetch resources only from:

1. the canonical site origin declared in `canonicalUrl`;
2. the profile origin when the profile itself was loaded over HTTPS.

Extra trusted origins can be added explicitly:

```bash
ARWP_ALLOWED_ORIGINS=https://data.example.com,https://cdn.example.com
```

Other safeguards:

- only HTTPS resources are fetched;
- URLs containing credentials are rejected;
- redirect targets are checked again against the origin allow-list;
- arbitrary user-provided URLs are never fetched;
- a response-size limit is applied before content is exposed to the MCP client;
- public resources are cached in memory for a short period.

Defaults:

```text
ARWP_CACHE_TTL_MS=300000
ARWP_MAX_BYTES=2097152
```

These controls reduce accidental SSRF-like behavior. They do not turn a public remote resource into trusted content; MCP clients must still treat retrieved text as untrusted input.

## Retrieval contract

Generic retrieval currently supports:

- JSON arrays;
- JSON objects containing `items`, `records` or `data` arrays;
- JSONL;
- NDJSON.

The generic lexical adapter recognizes common identity/display fields but does not modify source records.

A good ARWP retrieval index should preserve:

- stable record ID;
- canonical URL when applicable;
- title/name;
- concise summary or text;
- source/provenance identity;
- citation metadata;
- review/trust state;
- safety/exclusion state when relevant.

The last four items are domain data. The gateway intentionally does not invent them when the source does not provide them.

## Generic gateway versus domain MCP

Use the generic gateway when you want zero-bespoke-code access to a static site's declared data.

Use a domain MCP server when the domain needs meaningful operations such as:

- `compare_biases(a, b)`;
- `get_evidence(id)`;
- `find_protocol(problem)`;
- `find_pattern(intent, language)`;
- safety-aware routing;
- ontology traversal;
- reviewed semantic search.

Both approaches can coexist. ARWP can advertise the domain MCP server while the generic gateway remains a fallback for the same public data.

## Next implementation step

The next gateway milestone is a stateless Streamable HTTP adapter with explicit deployment and authorization guidance. It should reuse the same profile loader and retrieval core rather than fork the contract.
