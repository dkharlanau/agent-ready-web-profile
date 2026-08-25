# Agent-Ready Web Profile

[![ARWP validation](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml)
[![Reference verification](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml)

Agent-Ready Web Profile (ARWP) is a small interoperability profile for websites that want to be useful to people, search engines, retrieval systems and AI agents without inventing a new protocol for every audience.

ARWP does **not** replace SEO, `llms.txt`, Agent Skills, WebMCP, Model Context Protocol (MCP), A2A, OpenAPI, JSON Schema, Schema.org, Croissant, sitemaps, feeds or crawler controls. It provides one machine-readable map that says which of those surfaces a site actually exposes and where they live.

Status: **experimental v0.1**.

## Why this exists

A modern knowledge site may already publish:

- useful human-readable HTML;
- sitemaps, canonical URLs and crawler policy;
- JSON, JSONL or NDJSON datasets;
- schemas, APIs, releases and provenance;
- RAG-ready indexes;
- `llms.txt` and Markdown resources;
- portable Agent Skills;
- WebMCP tools on interactive pages;
- local or remote MCP servers;
- sometimes a real A2A agent.

Each interface can be correct while the overall site is still difficult for an external client to discover and integrate. ARWP is a thin discovery contract over those existing interfaces.

## Design principle

**One source of truth, many representations.**

```text
                         CANONICAL KNOWLEDGE
                                 |
             +-------------------+-------------------+
             |                   |                   |
         HUMAN / SEO          DATA / RAG         AGENT LAYER
             |                   |                   |
         HTML pages            JSON/NDJSON          Agent Skills
         sitemap               JSON Schema          WebMCP
         JSON-LD               OpenAPI              MCP
         feeds                 releases             A2A (if real)
                               provenance
             \___________________|___________________/
                                 |
                         site-profile.json
```

ARWP describes these surfaces. It should not become another source of domain content.

## Recommended profile location

```text
/ai/site-profile.json
```

This is an ARWP project convention, **not** a registered `.well-known` URI. v0.1 intentionally avoids claiming a new Internet discovery standard before there is independent adoption evidence.

A publisher may additionally advertise the profile with an applicable link relation, for example:

```html
<link rel="describedby" type="application/json" href="/ai/site-profile.json">
```

Consumers should also support an explicitly configured profile URL.

## Minimal profile

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
    "schemas": "https://example.com/schemas/index.json"
  },
  "trust": {
    "license": "https://example.com/license/",
    "provenance": "https://example.com/data/provenance.json"
  }
}
```

See [`SPEC.md`](SPEC.md) for normative requirements and [`examples/`](examples/) for fuller profiles.

## Capability groups

ARWP keeps different interoperability mechanisms separate:

1. **Web** — crawlable HTML, sitemaps, robots policy, feeds, `llms.txt` and optional Markdown discovery.
2. **Data** — stable machine-readable records, schemas, APIs, releases and dataset metadata.
3. **Retrieval** — bounded search/RAG distributions with canonical identity, citations and abstention behavior where relevant.
4. **Agent Skills** — portable `SKILL.md` procedures; instructions, not a tool transport.
5. **Agent Web** — WebMCP capabilities exposed by actual browser pages.
6. **MCP** — real local or remote MCP servers. Static JSON is not a remote MCP server.
7. **Agent** — A2A discovery only when a real agent service exists.
8. **Identity and trust** — stable IDs, aliases, licensing, citation, provenance, review and security surfaces.

A site can implement any useful subset. More capability groups do not automatically make a site better.

## Important distinctions

### ARWP is not an SEO ranking mechanism

ARWP must not be marketed as a Google ranking hack. Important content still needs to be useful, crawlable and indexable through ordinary web/search mechanisms. AI-oriented discovery surfaces are complementary.

### Agent Skills, WebMCP and MCP are different

- **Agent Skills** package reusable procedural instructions.
- **WebMCP** exposes structured tools from an interactive page to browser agents.
- **MCP** connects clients to external tools and data through an MCP runtime.

A site may support one, several or none of them.

### Static hosting can be highly agent-ready

A GitHub Pages site can publish versioned JSON, NDJSON, schemas, OpenAPI, RAG distributions, `llms.txt`, Agent Skills and provenance. A hosted remote MCP server still requires an actual runtime.

### A2A is not a badge

An Agent Card describes a real agent. A static knowledge repository should not publish one merely to look "AI-ready".

## Tooling included in this repository

### Schema validation

```bash
npm install
node bin/arwp.mjs validate examples/minimal.site-profile.json
```

The validator checks the v0.1 JSON Schema plus small semantic warnings.

### Live verification

```bash
node bin/arwp.mjs verify https://example.com/ai/site-profile.json
```

or:

```bash
node bin/arwp.mjs verify ai/site-profile.json --json
```

The verifier probes declared URLs, follows redirects, checks final HTTPS status and reports basic media-type mismatches. It distinguishes hard failures from warnings.

### Reusable GitHub Action

An adopting repository can validate its profile in CI:

```yaml
- name: Validate Agent-Ready Web Profile
  uses: dkharlanau/agent-ready-web-profile@main
  with:
    profile: ai/site-profile.json
```

`main` is acceptable while v0.1 is experimental. Production consumers should pin a tag or commit once stable releases exist.

### Generic read-only MCP gateway

ARWP includes a profile-driven stdio MCP gateway for static knowledge sites:

```bash
ARWP_PROFILE=https://example.com/ai/site-profile.json npm run mcp:start
```

It exposes a deliberately small baseline:

- `get_site_profile`
- `list_declared_resources`
- `fetch_declared_resource`
- `search_retrieval`
- `get_record`

The gateway accepts only profile-declared HTTPS resources, applies origin allow-listing, re-checks redirects, limits response size and never accepts an arbitrary URL from the MCP caller. See [`docs/GATEWAY.md`](docs/GATEWAY.md).

Domain-specific MCP servers remain preferable when the knowledge model needs reviewed operations such as evidence lookup, ontology traversal, safety-aware routing or semantic comparison.

## Real reference suite

v0.1 is tested against five real public knowledge-site architectures:

- Dzmitryi Kharlanau SAP knowledge site;
- Brali Practical Knowledge Library;
- Cognitive Biases Knowledge Library;
- CBT Cards public reflection resource;
- Metkagram.

The fixtures live under [`examples/reference/`](examples/reference/). They intentionally model different capability combinations instead of forcing every site into the same shape.

For example, a static MCP-compatible JSON description is kept under data metadata unless an actual MCP runtime exists; a standard `SKILL.md` is declared as an Agent Skill, while a publisher-specific skill routing catalog can be declared without pretending every entry is a portable skill.

The reference profiles are schema-tested on every change. A separate scheduled workflow probes their public resources and uploads machine-readable verification reports so reference drift is visible without making ordinary pull requests depend on external network availability.

## Repository map

- [`SPEC.md`](SPEC.md) — normative experimental v0.1 specification.
- [`schema/site-profile.schema.json`](schema/site-profile.schema.json) — JSON Schema 2020-12 contract.
- [`bin/arwp.mjs`](bin/arwp.mjs) — validation and live-verification CLI.
- [`lib/validator.mjs`](lib/validator.mjs) — reusable schema validator.
- [`lib/verifier.mjs`](lib/verifier.mjs) — declared-resource verifier.
- [`gateway/`](gateway/) — generic read-only MCP gateway.
- [`action.yml`](action.yml) — reusable validation action.
- [`examples/`](examples/) — generic and real-site profiles.
- [`docs/CONFORMANCE.md`](docs/CONFORMANCE.md) — capability-based conformance model.
- [`docs/STANDARDS-MAP.md`](docs/STANDARDS-MAP.md) — relationship to upstream standards/conventions.
- [`docs/GATEWAY.md`](docs/GATEWAY.md) — MCP gateway contract and security model.
- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — deterministic CI.
- [`.github/workflows/reference-verification.yml`](.github/workflows/reference-verification.yml) — scheduled live reference checks.

## Principles

- Prefer existing standards over ARWP-specific fields.
- Declare only capabilities that actually exist.
- Keep canonical identity stable across HTML, data, retrieval and agent surfaces.
- Preserve provenance, review state, licensing and citations with retrieved records.
- Prefer read-only public integrations unless mutation is necessary.
- Make abstention and `no_match` explicit where unsupported answers would be harmful or misleading.
- Keep security and authorization at runtime; metadata is never permission.
- Treat experimental browser/runtime features as experimental.
- Version contracts before consumers depend on them.
- Prefer evidence from working implementations over speculative fields.

## Standards and conventions tracked by v0.1

ARWP is designed to coexist with:

- normal web/search technical requirements;
- `llms.txt` v2 as a community proposal/convention;
- Agent Skills / `SKILL.md`;
- WebMCP as an experimental browser capability;
- Model Context Protocol and the official MCP Registry;
- A2A Agent Card discovery;
- OpenAPI;
- JSON Schema 2020-12;
- Schema.org structured data;
- MLCommons Croissant;
- standard sitemaps, feeds, robots controls and HTTP link relations.

See [`docs/STANDARDS-MAP.md`](docs/STANDARDS-MAP.md) for the current upstream map and status notes.

## Roadmap

The implemented v0.1 baseline already includes schema validation, live URL verification, a reusable GitHub Action, a generic read-only MCP gateway and five real reference profiles.

Next work should focus on interoperability evidence rather than adding metadata fields:

- protocol-specific checks using upstream Agent Skills, WebMCP, MCP and A2A tooling;
- a stateless Streamable HTTP form of the generic gateway;
- profile generation/adoption tooling for static-site builds;
- better release and compatibility policy before a stable version;
- WebMCP reference implementations and agentic-browser evals;
- evidence for or against proposing a future registered discovery location.

Contributions should start from a concrete integration failure, missing interoperability case or working implementation.
