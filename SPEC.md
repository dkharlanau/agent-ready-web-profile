# Agent-Ready Web Profile v0.1

Status: Experimental

This document defines version 0.1 of the Agent-Ready Web Profile (ARWP).

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **NOT RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in BCP 14 when, and only when, they appear in all capitals.

## 1. Scope

ARWP is a discovery profile for a website's existing human, search, data, retrieval and agent-facing interfaces.

An ARWP document answers questions such as:

- What is the canonical site identity?
- Where are its sitemap, crawler policy and `llms.txt` resources?
- Which structured datasets, schemas, releases or APIs are public?
- Are retrieval-ready distributions available?
- Does the site expose WebMCP tools in the browser?
- Is there a real local or remote MCP server?
- Is there a real A2A agent and Agent Card?
- Where can a consumer find license, citation, provenance and review information?

ARWP does not define the semantics of the site's domain records and does not replace the protocols it points to.

## 2. Non-goals

ARWP v0.1 is not:

- a search-engine ranking mechanism;
- a crawler permission system;
- a replacement for `robots.txt`;
- a replacement for `llms.txt`;
- an API description language;
- a tool-execution protocol;
- an MCP transport;
- an A2A protocol extension;
- a new dataset format;
- a new schema language;
- a security or authorization mechanism;
- a registered `.well-known` URI.

## 3. Recommended location

A conforming implementation SHOULD publish the profile at:

```text
/ai/site-profile.json
```

This location is an ARWP convention only.

A publisher MAY advertise the profile with an HTTP `Link` header or HTML `<link>` element using an applicable registered link relation such as `describedby`.

A consumer MUST NOT assume that every site publishes ARWP and SHOULD support configuration with an explicit profile URL.

## 4. Media type and encoding

The profile MUST be valid JSON encoded as UTF-8.

Servers SHOULD return:

```text
Content-Type: application/json; charset=utf-8
```

The profile SHOULD be publicly retrievable over HTTPS without authentication when it describes public website capabilities.

Secrets, bearer tokens, private keys, session identifiers and credentials MUST NOT appear in an ARWP document.

## 5. Core object

The root object MUST conform to `schema/site-profile.schema.json`.

The following properties are required:

- `profileVersion` — ARWP version. v0.1 requires the exact value `0.1`.
- `id` — stable publisher-chosen identifier for this site/profile.
- `name` — human-readable site or project name.
- `canonicalUrl` — canonical public origin or site URL.
- `description` — concise explanation of the site's purpose.

The optional `$schema` property SHOULD identify the JSON Schema used to validate the document.

## 6. Capability groups

### 6.1 `web`

The `web` object describes web-discovery surfaces.

It MAY contain:

- `sitemap` — canonical sitemap or sitemap index URL;
- `robots` — crawler-control resource URL;
- `llms` — `llms.txt` URL;
- `feeds` — RSS, Atom, JSON Feed or comparable public feeds;
- `markdownIndex` — an optional index of Markdown representations when the publisher maintains one.

Publishing `llms` does not imply any search-ranking advantage. `llms.txt` is an inference-time discovery convention and MUST NOT be represented as a Google Search requirement.

The `robots` resource controls crawler access according to the relevant crawler semantics. ARWP itself grants no crawler permission.

### 6.2 `data`

The `data` object describes reusable machine-readable public data.

It MAY contain:

- `catalog` — dataset/resource catalog;
- `schemas` — schema index or schema collection;
- `openapi` — OpenAPI document;
- `releases` — immutable or versioned release index;
- `croissant` — MLCommons Croissant dataset metadata;
- `distributions` — additional named machine-readable artifacts.

When stable record identifiers exist, the same identity SHOULD be preserved across HTML pages, APIs, datasets, RAG chunks and agent responses.

Versioned or immutable releases SHOULD be available when reproducibility matters.

### 6.3 `retrieval`

The `retrieval` object describes artifacts intended for search, RAG or bounded knowledge retrieval.

It MAY contain:

- `indexes` — retrieval indexes or chunk distributions;
- `search` — a public search/query interface description;
- `abstention` — a URL documenting no-match, unsupported-query or abstention behavior.

Retrieval distributions SHOULD preserve enough metadata to recover canonical record identity and citation/provenance.

Safety-sensitive knowledge systems SHOULD document explicit unsupported-query or `no_match` behavior rather than encouraging a client to fabricate an answer.

### 6.4 `agentWeb`

The `agentWeb` object describes browser-agent capabilities exposed by the website itself.

`agentWeb.webmcp` MAY describe WebMCP-enabled pages and documentation.

A publisher MUST NOT set `webmcp.enabled` to `true` unless WebMCP tools are actually available on at least one declared page in the implementation environment being described.

WebMCP is currently experimental in Chrome and MUST be treated as an evolving browser capability. Publishers SHOULD follow the current browser security guidance, including prompt-injection and authorization considerations.

WebMCP is distinct from remote MCP. A WebMCP-enabled page is not, by that fact alone, an MCP server.

### 6.5 `mcp`

The `mcp` object describes real Model Context Protocol servers associated with the site.

Each server declaration SHOULD identify:

- stable server name;
- transport or installation type;
- remote URL when remote;
- package/installation metadata when local;
- official MCP Registry URL when published;
- whether the exposed knowledge operations are intended to be read-only.

A publisher MUST NOT declare a static JSON API as a remote MCP server unless an actual MCP runtime exists at the declared MCP endpoint.

Remote servers SHOULD use the transport forms supported by the current MCP specification and Registry.

Registry metadata SHOULD remain authoritative for Registry-specific installation details; ARWP SHOULD link to it rather than duplicate the full `server.json` contract.

### 6.6 `a2a`

The `a2a` object describes a real agent service using the A2A protocol.

It MAY contain `agentCard`, normally pointing to an A2A Agent Card such as:

```text
https://agent.example.com/.well-known/agent-card.json
```

A static knowledge site without a real A2A agent MUST NOT publish an Agent Card merely to satisfy an ARWP capability checklist.

### 6.7 `identity`

The optional `identity` object documents how canonical record identities are formed.

It MAY provide:

- an ID namespace or prefix;
- an ID pattern;
- an alias registry URL.

Canonical identity SHOULD be independent from presentation labels and SHOULD survive URL or title changes when possible.

### 6.8 `trust`

The `trust` object MAY identify:

- `license` — license or reuse terms;
- `citation` — citation guidance;
- `provenance` — provenance/source model or manifest;
- `reviewPolicy` — editorial/review policy;
- `security` — security/contact policy.

When a public record's trust state affects whether an agent should use it, that trust state SHOULD travel with the record or retrieval chunk, not exist only in a top-level website policy page.

## 7. Extensions

The optional `extensions` object allows experiments without adding speculative core fields.

Extension property names SHOULD be namespaced using a domain-like owner followed by `/`, for example:

```json
{
  "extensions": {
    "example.com/vector-search": {
      "endpoint": "https://example.com/vector/"
    }
  }
}
```

Consumers MUST ignore unknown extension keys unless they explicitly support them.

An extension MUST NOT redefine the meaning of a core ARWP property.

## 8. Truthfulness and verification

An ARWP profile is a declaration, not proof.

Publishers MUST NOT claim capabilities that are planned but unavailable.

Consumers SHOULD verify declared URLs before relying on them and MAY check:

- successful HTTPS retrieval;
- expected media type;
- schema validity;
- stable canonical identity;
- release/version consistency;
- availability of declared MCP or WebMCP capabilities;
- trust metadata required by the consumer's use case.

Future ARWP conformance tooling may automate these checks.

## 9. Search engines and AI search

ARWP is intentionally separate from search ranking.

Google Search documentation states that AI Overviews and AI Mode do not require special machine-readable files or AI-specific markup beyond normal Search eligibility and SEO fundamentals. Therefore:

- publishers MUST NOT promise Google ranking improvements merely from adding ARWP;
- a site SHOULD keep important content in crawlable, useful human-readable HTML;
- structured data SHOULD match visible page content;
- sitemaps, internal links, canonical URLs, page experience and crawler accessibility remain separate technical concerns.

ARWP can make a site easier for configured agents and tooling to integrate with without affecting this distinction.

## 10. `llms.txt`

ARWP may point to `llms.txt` but does not duplicate its content.

As of ARWP v0.1, `llms.txt` v2 is a community proposal/convention rather than a W3C or IETF standard. Publishers SHOULD follow the current upstream proposal when they claim compatibility.

Where Markdown alternates are published, sites SHOULD follow current `llms.txt` v2 discovery guidance rather than invent incompatible page-mirror conventions.

## 11. Security

ARWP metadata MUST NOT bypass authorization.

A client MUST treat a declared tool, API, WebMCP surface, MCP server or agent as untrusted until its own security policy permits interaction.

Publishers SHOULD:

- expose public knowledge integrations read-only by default;
- separate discovery metadata from credentials;
- require explicit authorization for sensitive actions;
- avoid embedding user-controlled instructions into tool descriptions;
- validate tool inputs at execution time;
- follow current WebMCP and MCP security guidance;
- document meaningful safety boundaries for sensitive knowledge domains.

## 12. Versioning

`profileVersion` versions the ARWP contract, not the site's content.

v0.x versions are experimental and may change incompatibly.

A future stable ARWP version should define compatibility rules before claiming long-term interoperability guarantees.

Publishers SHOULD version their domain datasets independently from ARWP.

## 13. Conformance

A profile conforms to ARWP v0.1 when:

1. it is valid JSON;
2. it validates against the v0.1 JSON Schema;
3. all declared capabilities are truthful at publication time;
4. the publisher does not reinterpret ARWP as granting permissions or implementing the protocols it only references.

A conforming profile is not required to implement every optional capability group.

## 14. Upstream references

ARWP intentionally delegates protocol details to their upstream specifications and documentation:

- Google Search Central — AI features and technical Search guidance: https://developers.google.com/search/docs/appearance/ai-features
- Google Search Central — Generative AI optimization guide: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- llms.txt proposal: https://llmstxt.org/
- WebMCP documentation: https://developer.chrome.com/docs/ai/webmcp
- Model Context Protocol: https://modelcontextprotocol.io/
- MCP Registry: https://modelcontextprotocol.io/registry/about
- MCP remote server publishing: https://modelcontextprotocol.io/registry/remote-servers
- A2A protocol: https://a2a-protocol.org/latest/specification/
- JSON Schema: https://json-schema.org/
- OpenAPI: https://www.openapis.org/
- Schema.org: https://schema.org/
- MLCommons Croissant: https://mlcommons.org/croissant/

When an upstream experimental technology changes, implementations SHOULD follow the upstream specification rather than freezing browser/runtime behavior from this document.