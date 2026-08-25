# ARWP Resolver

ARWP Resolver turns a website's heterogeneous discovery surfaces into one evidence-backed service map.

The resolver is deliberately different from a new universal manifest. It reads upstream standards and community conventions, preserves where each claim came from, reports conflicts, and recommends an interface for a concrete intent.

```bash
arwp resolve https://example.com
arwp explain https://example.com
arwp plan https://example.com --intent=search
```

## Why a resolver

A site may publish several independent discovery surfaces at the same time:

- ordinary HTML, `robots.txt`, sitemap and `llms.txt`;
- an ARWP profile;
- `/agents.txt` and `/agents.json`;
- RFC 9727 `/.well-known/api-catalog`;
- RFC 9728 OAuth Protected Resource Metadata;
- A2A `/.well-known/agent-card.json`;
- an Agent Skills discovery index;
- experimental MCP AI Catalog / Server Cards;
- protocol-specific endpoints referenced by any of the above.

Each can be useful without being the complete map of the site. The resolver normalizes them instead of asking a publisher or client to choose one metadata ecosystem.

## Source authority is preserved

The resolver does not flatten all claims into an undifferentiated truth set. Every normalized interface carries the source that declared it and an authority class.

| Authority | Meaning |
| --- | --- |
| `ietf-standard` | IETF-published discovery such as RFC 9727 / RFC 9728 |
| `upstream-standard` | protocol-native standardized discovery such as A2A Agent Card |
| `upstream-convention` | protocol ecosystem convention such as Agent Skills discovery |
| `community-convention` | useful non-ratified discovery such as agents.txt / agents.json |
| `experimental-upstream` | upstream work that is explicitly experimental, such as current MCP Server Card / AI Catalog work |
| `project-profile` | a publisher's ARWP profile |
| `observed-web` | directly observed ordinary web evidence |

Authority is not a security rank. Runtime authorization and security decisions stay with the actual protocol.

## Normalized interface groups

Resolver output keeps mechanisms separate:

- `content`
- `data`
- `retrieval`
- `apis`
- `tools`
- `skills`
- `agents`
- `browserTools`
- `auth`
- `trust`

This normalized map is resolver output. It is not the normative ARWP profile schema.

## Discovery surfaces currently resolved

### ARWP profile

If `/ai/site-profile.json` exists and validates, its declared web, data, retrieval, Agent Skills, WebMCP, MCP, A2A and trust surfaces are normalized.

### agents.txt / agents.json

The resolver probes the root `/agents.json` and `/agents.txt` community convention. It maps MCP, Skills, A2A, WebMCP and authorization pointers while deliberately leaving unrelated commerce blocks outside the current knowledge-site resolver scope.

If the two files disagree about MCP, Skills, A2A or WebMCP URLs, the resolver emits a conflict instead of silently choosing one.

### RFC 9727 API Catalog

The resolver requests:

```text
/.well-known/api-catalog
```

and understands Linkset `item`, `service-desc`, `service-doc` and nested `api-catalog` relations.

RFC 9727 is an IETF Standards Track RFC. ARWP does not duplicate its API catalog semantics.

### RFC 9728 OAuth Protected Resource Metadata

For a root-origin resource, the resolver probes:

```text
/.well-known/oauth-protected-resource
```

and preserves resource, authorization-server, scope and bearer-method metadata when present.

Path-scoped RFC 9728 resolution is a future extension and should be driven by a concrete protected-resource use case rather than guessed from a site root.

### A2A Agent Card

The resolver probes the current canonical A2A discovery location:

```text
/.well-known/agent-card.json
```

Readers accept both the v1.0 `supportedInterfaces[]` structure and the legacy v0.3-style URL/interface shape during the transition.

### Agent Skills discovery

The resolver probes:

```text
/.well-known/agent-skills/index.json
```

and preserves skill URL, type, description and digest when exposed.

### Experimental MCP AI Catalog / Server Cards

Current MCP Server Card work is still an experimental extension. Resolver support is therefore explicitly marked `experimental-upstream`.

The resolver probes the experimental domain catalog:

```text
/.well-known/ai-catalog.json
```

selects entries with media type:

```text
application/mcp-server-card+json
```

and follows card URLs or inline card data. If a remote MCP endpoint is already known from other metadata, the resolver may also probe the current experimental `<streamable-http-url>/server-card` fallback.

A Server Card remains advisory. Resolver output must never treat it as stronger than the live MCP runtime.

## Conflict model

The first conflict rules are intentionally narrow and explainable:

1. canonical site identity differs across discovery sources;
2. `agents.txt` and `agents.json` disagree about MCP, Agent Skills, A2A or WebMCP URLs;
3. an experimental MCP Server Card endpoint conflicts with a single site-declared remote MCP endpoint.

A conflict is evidence for a maintainer to investigate. It is not automatically an error: sites can legitimately expose several interfaces.

## Intent planning

`arwp plan` currently supports:

- `read`
- `search`
- `structured`
- `tools`
- `agent`

Example:

```bash
arwp plan https://example.com --intent=search
```

The planner returns:

- selected interface;
- why it was selected;
- source authority;
- fallback interfaces;
- any resolver conflicts.

The planner prefers publisher-maintained retrieval for search, API descriptions for structured access, remote MCP for server-side tools, and A2A for agent-to-agent interaction. These are deterministic routing heuristics, not learned quality rankings.

## Network safety

Resolver fetches use bounded public-HTTPS primitives:

- HTTPS only;
- no URL credentials;
- no non-standard HTTPS ports;
- DNS resolution before requests;
- private, loopback, link-local and reserved IP rejection;
- redirect target revalidation;
- request timeouts;
- response-size limits.

The resolver does not provide an arbitrary fetch/proxy endpoint.

## Non-goals

Resolver v0.1 does not:

- define a payment standard;
- replace OAuth metadata;
- replace MCP, A2A, Agent Skills, RFC 9727 or RFC 9728;
- claim experimental MCP Server Cards are ratified;
- execute browser WebMCP tools;
- make security decisions from self-reported metadata;
- infer a capability from marketing copy;
- hide source conflicts behind a readiness score.

## Current upstream references

As of 2026-08-25, implementation work tracks:

- RFC 9727 — API Catalog
- RFC 9728 — OAuth 2.0 Protected Resource Metadata
- A2A v1.0 Agent Card discovery
- Agent Skills discovery index
- agents.txt / agents.json community specification
- MCP 2026-07-28 `server/discover`
- experimental MCP Server Card / AI Catalog extension work

Upstream status can change. Resolver adapters should change to follow upstream rather than adding overlapping ARWP core fields.
