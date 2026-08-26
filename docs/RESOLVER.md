# ARWP Resolver

ARWP Resolver turns a website's heterogeneous discovery surfaces into one evidence-backed service map.

The resolver is deliberately different from a new universal manifest. It reads upstream standards and community conventions, preserves where each claim came from, reports conflicts, and recommends an interface for a concrete intent.

```bash
arwp resolve https://example.com
arwp explain https://example.com
arwp plan https://example.com --intent=search
```

Operational commands now extend the same model:

```bash
arwp resolve-many targets.txt
arwp snapshot https://example.com --output=example.snapshot.json
arwp drift old.snapshot.json new.snapshot.json
npm run monitor:resolver
```

## Why a resolver

A site may publish several independent discovery surfaces at the same time:

- ordinary HTTP/HTML, Link headers, content negotiation, `robots.txt`, sitemap and `llms.txt`;
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
| `ietf-standard` | IETF-published discovery such as RFC 8288 Link relations, RFC 9727 and RFC 9728 |
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

### Ordinary HTTP discovery

In addition to the bounded base-page scan, Resolver performs a bounded `HEAD` observation with `Accept: text/markdown`.

It can use standard HTTP `Link` relations such as:

- `api-catalog`;
- `service-desc`;
- `service-doc`;
- `alternate` with `text/markdown`;
- `describedby` when it explicitly identifies an ARWP profile.

If the response itself negotiates to `text/markdown`, that is recorded as `observed-web` content evidence. A linked RFC 9727 API catalog is subsequently resolved through the normal API Catalog adapter.

This means a site can become more machine-discoverable through normal HTTP metadata without adopting an ARWP-specific manifest.

### ARWP profile

If `/ai/site-profile.json` exists and validates, its declared web, data, retrieval, Agent Skills, WebMCP, MCP, A2A and trust surfaces are normalized. A profile explicitly linked with `rel=describedby` can also be resolved.

### agents.txt / agents.json

The resolver probes the root `/agents.json` and `/agents.txt` community convention. It maps MCP, Skills, A2A, WebMCP and authorization pointers while deliberately leaving unrelated commerce blocks outside the current knowledge-site resolver scope.

If the two files disagree about MCP, Skills, A2A or WebMCP URLs, the resolver emits a conflict instead of silently choosing one.

### RFC 9727 API Catalog

The resolver requests:

```text
/.well-known/api-catalog
```

and also follows explicit HTTP `Link: <...>; rel="api-catalog"` declarations. It understands Linkset `item`, `service-desc`, `service-doc` and nested `api-catalog` relations.

RFC 9727 is an IETF Standards Track RFC. ARWP does not duplicate its API catalog semantics.

### RFC 9728 OAuth Protected Resource Metadata

For a root-origin resource, the resolver probes:

```text
/.well-known/oauth-protected-resource
```

and preserves resource, authorization-server, scope and bearer-method metadata when present.

Path-scoped RFC 9728 resolution remains evidence-gated and should be driven by a concrete protected-resource use case rather than guessed from a site root.

### A2A Agent Card

The resolver probes the current canonical A2A discovery location:

```text
/.well-known/agent-card.json
```

Readers accept both the v1.0 `supportedInterfaces[]` structure and the legacy v0.3-style URL/interface shape during the transition.

Presence of Agent Card signatures is preserved as evidence. Cryptographic verification is opt-in: the Resolver MCP `verify_a2a_signatures` path validates the current v1 card shape, normalizes field presence, canonicalizes the supported fixture shape, resolves bounded public-HTTPS JWKS through `jku`, selects by `kid`, and verifies RS256 or ES256 signatures. Unsigned cards remain `unsigned`, while unsupported algorithms, unavailable keys and invalid signatures are reported separately.

The verifier has bidirectional reproducible interoperability tests against official A2A JavaScript (`@a2a-js/sdk@1.0.1`, RS256) and Python (`a2a-sdk[signing,encryption]==1.1.2`, ES256) SDK fixtures. That evidence is scoped to those tested implementations/algorithms; a valid signature proves integrity/authenticity relative to the selected key, not signer trust.

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

## MCP runtime reconciliation

Runtime verification is opt-in. A normal `resolve` does not create MCP sessions.

The Resolver MCP exposes `verify_mcp_runtime`, which first resolves static MCP evidence and then probes up to four discovered remote Streamable HTTP endpoints.

For current MCP servers it sends a real sessionless:

```text
server/discover
```

For legacy servers that do not support the modern discovery request, it falls back to the actual lifecycle:

```text
initialize
notifications/initialized
```

The probe:

- keeps HTTPS/DNS/private-network/time/size protections;
- blocks cross-origin runtime redirects;
- reports 401/403 as `authorization-required`;
- never invokes MCP tools;
- never sends credentials discovered from site metadata automatically;
- compares self-reported runtime server identity with static metadata and emits a conflict when they disagree.

A successful runtime probe is still evidence about the endpoint, not a security endorsement of the server.

## Conflict model

Conflict rules remain intentionally narrow and explainable:

1. canonical site identity differs across discovery sources;
2. `agents.txt` and `agents.json` disagree about MCP, Agent Skills, A2A or WebMCP URLs;
3. an experimental MCP Server Card endpoint conflicts with a single site-declared remote MCP endpoint;
4. opt-in MCP runtime identity differs from the static identity for that endpoint.

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

The planner returns selected interface, reason, source authority, fallbacks and conflicts. It prefers publisher-maintained retrieval for search, API descriptions for structured access, remote MCP for tools and A2A for agent-to-agent interaction. Markdown content discovered through `llms.txt`, HTTP negotiation or an explicit alternate link can be used for `read`.

These are deterministic routing heuristics, not learned quality rankings.

## Batch resolution

`resolveMany` and `arwp resolve-many` support inventory/research workflows without turning one failed site into a failed batch.

Safety limits include:

- at most 100 library/CLI targets per batch;
- bounded global concurrency;
- same-origin resolutions are serialized within one batch;
- per-site failures are isolated;
- summary metrics do not collapse into a readiness score.

The Resolver MCP exposes a smaller `resolve_sites` surface capped at 25 URLs.

## Snapshots and drift

`arwp snapshot` emits a compact versioned snapshot containing:

- canonical identity;
- discovery sources and authority;
- normalized interfaces;
- conflicts;
- deterministic intent plans;
- observation/resolver version metadata.

It deliberately does not copy canonical datasets.

`arwp drift` compares two snapshots and reports added/removed/changed sources, interfaces, conflicts, identity and plan changes. Observation time alone does not count as drift.

The diff keeps raw additions/removals for auditability but separates evidenced URL migration from hard disappearance. Fixed-root discovery sources that stay resolved in the same source slot can produce `sourceMigrations`; normalized interfaces can produce `interfaceMigrations` only when the canonical site is unchanged, exactly one interface occupies the same semantic slot before and after, and URL is the only normalized metadata change. The summary therefore exposes `hardSourcesRemoved` and `hardInterfacesRemoved`. Monitor `source-removed` / `interface-removed` classes use those hard counts, so a URL-only move is still visible as drift without being mislabeled as endpoint disappearance. No new migration fail class is added merely from synthetic evidence.

The monitor runtime (`npm run monitor:resolver`) persists per-site snapshots and can fail only on selected operational classes such as `interface-removed`, `identity`, `conflict-added` or `resolution-failed`. Pass `--evidence-dir=<path>` to archive an audit bundle only when structural drift is detected; each bundle preserves the complete compact before snapshot, after snapshot, machine-readable diff, site identity and drift classes. Stable observations do not create evidence bundles. `--no-write` disables both snapshot and evidence writes.

`templates/github-actions/resolver-monitor.yml` provides a copyable scheduled workflow. The repository's independent drift workflow also uploads any generated drift bundles with the run report and current snapshots, so a later stable observation cannot erase the evidence needed to audit the earlier change.

## Resolver-backed federation

The original federation layer requires ARWP profiles. The newer resolver-backed path does not.

`search_resolved_sites` accepts reviewed canonical site URLs, resolves them first, then executes only explicitly resolved static JSON/JSONL/NDJSON retrieval indexes and JSON Feed surfaces. JSON Feed is treated as a static record source only after the Resolver has already identified the URL as feed evidence; federation does not guess an arbitrary feed URL or scrape HTML as records.

JSON Feed payloads fit the existing generic JSON parser because their `items[]` array is a record collection. `content_text` and `content_html` are exposed as record summaries when a more specific summary/description is absent. Retrieval indexes remain preferred over feeds when authority is otherwise equal.

It intentionally does not invent generic OpenAPI, MCP or A2A calls because an interface description alone does not define the semantic search operation to invoke.

Each result preserves:

- source site identity;
- original discovery source and authority;
- selected retrieval/feed interface;
- record-level retrieval result.

The federation response also includes an `executed[]` observation so a benchmark can distinguish “interface executed but query returned no hits” from “no compatible interface was resolved.” Sites without a supported static retrieval index or JSON Feed are skipped rather than scraped arbitrarily.

A reviewed independent smoke corpus lives at `benchmarks/federation-corpus.json` and runs with `npm run benchmark:federation-external`. After the ordinary-web JSON Feed fallback discovery fix, the unchanged four-site corpus executes all 4/4 reviewed interfaces (JSONFeed.org, Manton Reece, ai.rud.is and Daring Fireball). This is an engineering interoperability observation, not adoption or answer-quality evidence. Durable evidence is under `benchmarks/results/2026-08-26-federation-v0.2.*`.

## Network safety

Resolver network operations use bounded public-HTTPS primitives:

- HTTPS only;
- no URL credentials;
- no non-standard HTTPS ports for general discovery;
- DNS resolution before requests;
- private, loopback, link-local and reserved IP rejection;
- redirect target revalidation;
- request timeouts;
- response-size limits;
- stricter same-origin redirect policy for MCP runtime sessions.

The resolver does not provide an arbitrary fetch/proxy endpoint.

## Non-goals

Resolver v0.1 does not:

- define a payment standard;
- replace OAuth metadata;
- replace MCP, A2A, Agent Skills, RFC 8288, RFC 9727 or RFC 9728;
- claim experimental MCP Server Cards are ratified;
- execute browser WebMCP tools;
- invent generic API/tool calls from interface metadata;
- make security decisions from self-reported metadata;
- infer a capability from marketing copy;
- hide source conflicts behind a readiness score.

## Current upstream references

As of 2026-08-26, implementation work tracks:

- RFC 8288 — Web Linking;
- RFC 9727 — API Catalog;
- RFC 9728 — OAuth 2.0 Protected Resource Metadata;
- JSON Feed 1.1 for explicitly resolved static feed execution;
- A2A v1.0 Agent Card discovery/signature model;
- Agent Skills discovery index;
- agents.txt / agents.json community specification;
- MCP 2026-07-28 `server/discover` plus legacy initialization compatibility;
- experimental MCP Server Card / AI Catalog extension work.

Upstream status can change. Resolver adapters should change to follow upstream rather than adding overlapping ARWP core fields.
