# Agent-Ready Web Profile

[![ARWP validation](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml)

Agent-Ready Web Profile (ARWP) is a small interoperability profile for websites that want to be useful to people, search engines, retrieval systems, browser agents, and MCP clients without inventing a new protocol for each audience.

ARWP does **not** replace SEO, `llms.txt`, WebMCP, Model Context Protocol (MCP), A2A, OpenAPI, JSON Schema, Schema.org, Croissant, sitemaps, feeds, or crawler controls. It provides one machine-readable map that tells a consumer which of those surfaces a site actually exposes and where they live.

Status: **experimental v0.1**.

## The problem

Modern knowledge websites often publish several parallel interfaces:

- human-readable HTML pages;
- search-engine metadata and sitemaps;
- JSON, JSONL, NDJSON, RDF or other structured data;
- schemas, releases and provenance;
- RAG-ready distributions;
- `llms.txt` and Markdown mirrors;
- WebMCP tools exposed by interactive pages;
- local or remote MCP servers;
- sometimes a real A2A agent.

These pieces can be individually correct while still being difficult for an external agent to discover and combine. ARWP adds a thin discovery layer over them.

## Design principle

**One source of truth, many representations.**

A site should maintain canonical knowledge and derive its human, search, data, retrieval and agent interfaces from that knowledge wherever practical. ARWP describes those interfaces; it does not become another source of domain content.

```text
                         CANONICAL KNOWLEDGE
                                 |
              +------------------+------------------+
              |                  |                  |
          HUMAN / SEO          DATA / RAG        AGENT TOOLS
              |                  |                  |
          HTML pages           JSON/NDJSON         WebMCP
          sitemap              JSON Schema         MCP
          JSON-LD              OpenAPI             A2A (if real)
          feeds                releases
                               provenance
              \__________________|__________________/
                                 |
                         site-profile.json
```

## Profile location

The recommended initial location is:

```text
/ai/site-profile.json
```

This is a project convention, **not** a registered `.well-known` URI. ARWP intentionally avoids claiming a new Internet standard before there is adoption and interoperability evidence.

A site may additionally advertise the profile with an HTTP `Link` header or an HTML link element, for example:

```html
<link rel="describedby" type="application/json" href="/ai/site-profile.json">
```

Consumers should not assume that every site has an ARWP profile.

## Minimal example

```json
{
  "$schema": "https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/site-profile.schema.json",
  "profileVersion": "0.1",
  "id": "example-knowledge-site",
  "name": "Example Knowledge Site",
  "canonicalUrl": "https://example.com/",
  "description": "A reviewed public knowledge library.",
  "web": {
    "sitemap": "https://example.com/sitemap.xml",
    "robots": "https://example.com/robots.txt",
    "llms": "https://example.com/llms.txt"
  },
  "data": {
    "catalog": "https://example.com/data/catalog.json",
    "schemas": "https://example.com/schemas/",
    "openapi": "https://example.com/api/openapi.json"
  },
  "trust": {
    "license": "https://example.com/license/",
    "citation": "https://example.com/cite/",
    "provenance": "https://example.com/data/provenance.json"
  }
}
```

See [`SPEC.md`](SPEC.md) for normative language and [`examples/`](examples/) for fuller profiles.

## Layers

ARWP treats these as separate concerns:

1. **Web** — crawlable HTML, canonical URLs, sitemaps, robots policy, feeds, `llms.txt` and optional Markdown representations.
2. **Data** — stable machine-readable records, schemas, APIs, releases and dataset metadata.
3. **Retrieval** — bounded search/RAG distributions, citation-preserving chunks and explicit no-match/abstention behavior where relevant.
4. **Agent Web** — WebMCP tools exposed by a page to browser agents.
5. **MCP** — real local or remote MCP servers. A static API must not be described as a hosted MCP server.
6. **Agent** — A2A discovery only when the site operates an actual agent service.

These layers are complementary. A site can implement any useful subset.

## Important distinctions

### ARWP is not an SEO ranking mechanism

Google Search does not require `llms.txt`, AI-specific markup, or a special machine-readable file for AI Overviews or AI Mode. ARWP must therefore never be marketed as a Google ranking hack. Human-readable, indexable, useful content and normal technical SEO remain a separate requirement.

### WebMCP is not remote MCP

WebMCP exposes structured tools from a web page to a browser agent. MCP connects clients to external tools and data sources. A site may support one, both, or neither.

### Static hosting can still be highly agent-ready

A static site can expose versioned JSON, NDJSON, schemas, OpenAPI, RAG distributions, `llms.txt`, provenance and WebMCP-enhanced pages. A remote MCP endpoint requires an actual runtime; it should only be declared when one exists.

### A2A is not a badge

An A2A Agent Card describes a real agent and its capabilities. A knowledge repository should not publish one merely to appear "AI-ready".

## Repository contents

- [`SPEC.md`](SPEC.md) — v0.1 profile specification.
- [`schema/site-profile.schema.json`](schema/site-profile.schema.json) — JSON Schema 2020-12.
- [`examples/minimal.site-profile.json`](examples/minimal.site-profile.json) — minimum valid example.
- [`examples/knowledge-site.site-profile.json`](examples/knowledge-site.site-profile.json) — fuller knowledge-site example.
- [`bin/arwp.mjs`](bin/arwp.mjs) — command-line validator.
- [`action.yml`](action.yml) — reusable GitHub Action for adopting repositories.
- [`docs/CONFORMANCE.md`](docs/CONFORMANCE.md) — capability-based validation and verification model.
- [`docs/STANDARDS-MAP.md`](docs/STANDARDS-MAP.md) — how ARWP relates to existing standards and conventions.
- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — validates schemas and examples in CI.

## Quick start

Local validation:

```bash
npm install
npm test
node bin/arwp.mjs validate examples/minimal.site-profile.json
```

For a website implementation, copy the example profile, replace the URLs with real public endpoints, and remove capabilities the site does not actually provide.

### Use from another GitHub repository

Add the profile to the adopting site, for example `ai/site-profile.json`, then add a workflow step:

```yaml
- name: Validate Agent-Ready Web Profile
  uses: dkharlanau/agent-ready-web-profile@main
  with:
    profile: ai/site-profile.json
```

`main` is appropriate while v0.1 is experimental. Once release tags exist, production adopters should pin a tag or commit.

## Principles

- Prefer existing standards over ARWP-specific fields.
- Do not claim capabilities that are not live.
- Keep canonical identity stable across HTML, data, RAG and agent surfaces.
- Preserve provenance, review state, licensing and citations with retrieved records.
- Prefer read-only integrations by default for public knowledge sites.
- Make abstention and `no_match` explicit where unsupported answers would be harmful or misleading.
- Treat browser-agent security and remote-tool authorization as runtime concerns, not metadata shortcuts.
- Version contracts before consumers depend on them.

## Current external standards tracked by v0.1

ARWP v0.1 is designed to coexist with:

- Google Search technical requirements and normal SEO;
- `llms.txt` v2 (community proposal/convention);
- WebMCP (experimental browser API in Chrome 149+ origin trial);
- Model Context Protocol and the official MCP Registry;
- A2A Agent Card discovery;
- OpenAPI;
- JSON Schema 2020-12;
- Schema.org structured data;
- MLCommons Croissant for dataset metadata;
- standard sitemaps, feeds, robots controls and HTTP link relations.

Experimental or preview technologies are labelled as such in the specification rather than treated as permanent requirements.

## Roadmap

v0.1 focuses on discovery and truthful capability declaration. Planned follow-up work includes:

- network conformance tests that verify declared URLs and media types;
- reference profiles for several real static knowledge sites;
- a generic read-only MCP gateway driven by an ARWP profile;
- WebMCP reference examples and agentic-browser evals;
- release/pinning guidance and compatibility rules;
- evidence for or against standardizing a future `.well-known` discovery location.

Contributions should prefer concrete interoperability problems and working implementations over adding speculative metadata.