# Reference MCP gateways

ARWP includes generic **read-only MCP gateways** for static knowledge sites.

The gateways are intentionally small. They do not infer domain-specific tools from arbitrary JSON. They read a validated ARWP profile and expose a safe baseline over resources and retrieval indexes that the publisher explicitly declared.

## Why this exists

Static hosts such as GitHub Pages can publish excellent machine-readable knowledge but cannot themselves run a remote MCP process.

ARWP separates the source of truth from the transport runtime:

```text
Static knowledge site
  ├─ HTML
  ├─ JSON / JSONL / NDJSON
  ├─ schemas / OpenAPI
  ├─ releases / provenance
  ├─ llms.txt / Agent Skills
  └─ /ai/site-profile.json
            |
            v
      ARWP MCP gateway
         /       \
      stdio     Streamable HTTP
        |             |
        v             v
   local client   remote client
```

The site remains authoritative. The gateway is an adapter.

## Shared tool surface

Both transports expose the same five read-only tools.

### `get_site_profile`

Returns the validated ARWP profile used to configure the server.

### `list_declared_resources`

Lists declared web, data, retrieval, Agent Skills, MCP/A2A integration and trust resources without fetching them.

An optional prefix can select groups such as `data`, `retrieval`, `agentSkills`, `mcp`, `web` or `trust`.

### `fetch_declared_resource`

Fetches one resource by its ARWP resource key. The tool does **not** accept an arbitrary URL.

Examples:

- `web.llms`
- `data.catalog`
- `data.openapi`
- `retrieval.indexes.0`
- `agentSkills.skills.0.url`
- `trust.provenance`

### `search_retrieval`

Runs deterministic lexical retrieval over one declared JSON, JSONL or NDJSON retrieval index.

This is a baseline interoperability tool, not a semantic-search claim. A domain project should expose a richer MCP server when it has reviewed domain-specific search, filtering, relations, evidence or safety behavior.

### `get_record`

Finds one record by common stable-identity fields such as `canonical_id`, `canonicalId`, `record_id`, `id`, `slug`, URL or aliases.

If no record matches, the gateway returns `found: false` rather than fabricating a record.

## Shared gateway factory

`gateway/factory.mjs` owns the validated profile loader, declared-resource map, retrieval-index selection, network allow-list, cache and MCP tool registration.

Both stdio and HTTP create fresh `McpServer` instances from that same prepared context, so the transports cannot silently develop different knowledge semantics.

## Local stdio gateway

By default the stdio launcher looks for:

```text
./ai/site-profile.json
```

Run:

```bash
npm install
npm run mcp:start
```

Or use a local profile:

```bash
ARWP_PROFILE=/absolute/path/to/site-profile.json npm run mcp:start
```

Or a published static profile:

```bash
ARWP_PROFILE=https://example.com/ai/site-profile.json npm run mcp:start
```

A typical local MCP client can launch the adapter directly:

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

Client configuration formats vary; this is a shape example, not a universal configuration file.

## Remote Streamable HTTP gateway

The current MCP TypeScript SDK v2 uses `createMcpHandler(factory)` for stateless Streamable HTTP. The factory creates a fresh MCP server per request while shared caches/resources can remain at module scope.

ARWP provides two HTTP entry shapes:

- `gateway/http.mjs` — creates a guarded Web-standard `{ fetch }` handler;
- `gateway/http-node.mjs` — standalone Node HTTP launcher using `@modelcontextprotocol/node`.

`gateway/http-entry.mjs` is the minimal default-export entry for a compatible fetch-style deployment runtime.

### Required deployment configuration

A remote endpoint intentionally fails closed unless its public Host is declared:

```bash
ARWP_PROFILE=https://example.com/ai/site-profile.json
ARWP_HTTP_ALLOWED_HOSTS=mcp.example.com
```

Then run the standalone Node server:

```bash
ARWP_HTTP_BIND=0.0.0.0 \
PORT=3000 \
ARWP_PROFILE=https://example.com/ai/site-profile.json \
ARWP_HTTP_ALLOWED_HOSTS=mcp.example.com \
npm run mcp:http
```

The MCP endpoint is:

```text
/mcp
```

Override it only when the deployment needs a different path:

```bash
ARWP_HTTP_PATH=/knowledge/mcp
```

### Browser Origin policy

The Streamable HTTP handler validates Host and Origin **before** passing a request to MCP.

By default:

- the allowed Host list is mandatory;
- requests without an `Origin` header may pass the Origin check;
- a request that does contain `Origin` is rejected unless its hostname is explicitly allowed.

Allow browser-originated requests only when required:

```bash
ARWP_HTTP_ALLOWED_ORIGINS=app.example.com,tools.example.com
```

Host and Origin values are hostnames, not full URLs.

There is deliberately no `*` shortcut.

### Response mode

The MCP SDK may use JSON or SSE depending on the protocol exchange. A deployment can explicitly pin the generic gateway:

```bash
ARWP_HTTP_RESPONSE_MODE=json
```

or:

```bash
ARWP_HTTP_RESPONSE_MODE=sse
```

Leave it unset for the SDK default.

### Authentication

ARWP does not invent authentication metadata or token verification.

The generic remote gateway is read-only, but that does not mean every deployment should be anonymous. If authentication is needed, verify credentials **in front of** `handler.fetch` and pass the resulting MCP `authInfo` through according to the current MCP SDK authorization model.

Do not place API keys or bearer tokens in `site-profile.json`.

## Network safety for source resources

The source-data fetcher is deliberately restrictive.

By default it may fetch only from:

1. the canonical site origin declared in `canonicalUrl`;
2. the profile origin when the profile itself was loaded over HTTPS.

Extra trusted origins must be explicit HTTPS origins:

```bash
ARWP_ALLOWED_ORIGINS=https://data.example.com,https://cdn.example.com
```

Other safeguards:

- only HTTPS source resources are fetched;
- URLs containing credentials are rejected;
- redirect targets are checked again against the source-origin allow-list;
- arbitrary user-provided URLs are never fetched;
- a response-size limit is applied before content is exposed to the MCP client;
- public resources are cached in memory for a short period.

Defaults:

```text
ARWP_CACHE_TTL_MS=300000
ARWP_MAX_BYTES=2097152
```

The HTTP **caller** allow-list (`ARWP_HTTP_ALLOWED_HOSTS` / `ARWP_HTTP_ALLOWED_ORIGINS`) and the source **resource** allow-list (`ARWP_ALLOWED_ORIGINS`) are different security boundaries.

These controls reduce accidental SSRF-like behavior and DNS-rebinding exposure. They do not turn remote text into trusted content; MCP clients must still treat retrieved material as untrusted input.

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

Use the generic gateway when you want low-friction access to a static site's declared data without writing a bespoke MCP adapter.

Use a domain MCP server when the domain needs meaningful operations such as:

- `compare_biases(a, b)`;
- `get_evidence(id)`;
- `find_protocol(problem)`;
- `find_pattern(intent, language)`;
- safety-aware routing;
- ontology traversal;
- reviewed semantic search.

Both can coexist. ARWP can advertise a domain MCP server while the generic gateway remains a fallback over the same public data.

## Current portability boundary

The shared profile loader currently includes Node file-system support so local profiles and remote profiles use the same code path. The standalone HTTP launcher is therefore explicitly Node-targeted.

`http-entry.mjs` uses the MCP SDK's Web-standard handler shape, but a fully Node-free Worker bundle is a separate portability milestone rather than a capability claimed by v0.1.
