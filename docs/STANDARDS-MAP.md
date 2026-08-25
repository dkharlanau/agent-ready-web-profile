# Standards map

This document records which external standards and conventions ARWP v0.1 composes, what each one is responsible for, and what ARWP deliberately does not duplicate.

Status snapshot: 25 August 2026. Upstream specifications remain authoritative.

| Concern | Upstream mechanism | ARWP role |
| --- | --- | --- |
| Search indexing and AI search eligibility | Google Search technical requirements, sitemaps, canonical URLs, semantic HTML, structured data | Point to discoverable resources; never claim ARWP affects ranking |
| Crawler access | `robots.txt` and crawler-specific controls | Point to the policy resource; ARWP grants no permission |
| LLM-oriented site map | `llms.txt` v2 proposal | Point to the applicable file |
| Page-to-Markdown discovery | `llms.txt` v2 link-relation guidance | Do not invent a conflicting mirror convention |
| Portable agent procedures | Agent Skills / `SKILL.md` | Point to real skill manifests and optional catalogs; do not copy skill instructions |
| Browser-agent tools | WebMCP | Declare only pages where tools really exist |
| External tools/data protocol | Model Context Protocol | Link to real MCP servers and Registry metadata |
| MCP public discovery | Official MCP Registry and `server.json` | Link; do not duplicate Registry-specific installation metadata |
| Agent-to-agent discovery | A2A Agent Card | Declare only when a real agent exists |
| HTTP API contract | OpenAPI | Link to the OpenAPI document |
| Data validation | JSON Schema | Link to schema index or collection |
| Web semantics | Schema.org / JSON-LD | Keep on the human/data surfaces; ARWP does not replace it |
| ML dataset metadata | MLCommons Croissant | Link to Croissant metadata for dataset-shaped assets |
| Citation/provenance/review | Domain-specific contracts, PROV-O/Croissant where appropriate | Link and require preservation through retrieval |
| Releases | Publisher versioning/release manifests | Link to immutable/versioned releases |

## Google Search and AI features

Google Search Central states that AI Overviews and AI Mode have no additional technical requirements beyond normal Search eligibility. Google also explicitly says that new machine-readable AI files, Markdown copies, `llms.txt`, or special AI markup are not required for Google Search.

ARWP therefore treats Search as a parallel channel. A technically perfect ARWP profile cannot compensate for thin, inaccessible, duplicated or low-value human content.

Upstream:

- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide

## `llms.txt`

`llms.txt` is a community proposal/convention, not an IETF or W3C standard.

Version 2 of the proposal was published in August 2026. It adds scoped files and standard link-relation discovery for the applicable `llms.txt` and Markdown alternatives.

ARWP stores only the URL of the applicable `llms.txt`. It does not copy the document into `site-profile.json`.

Chrome Lighthouse's Agentic browsing category has an `llms.txt` audit. A missing file currently makes that audit not applicable rather than failing the site; the resource remains optional.

Upstream:

- https://llmstxt.org/
- https://llmstxt.org/changes.html
- https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt

## Agent Skills

Agent Skills are portable procedural capability bundles centered on a `SKILL.md` file. The open specification defines required frontmatter and a progressive-disclosure directory structure for optional scripts, references and assets.

ARWP treats skills as instructions rather than tool transports:

- `agentSkills.catalog` may point to a publisher's discovery surface;
- `agentSkills.skills[].url` should point directly to a real `SKILL.md`;
- `agentSkills.skills[].source` may point to the containing source directory or repository;
- skill names follow the lowercase hyphenated Agent Skills naming contract.

A skill may explain how to use a website, API or MCP server, but it does not make those interfaces exist. ARWP therefore keeps Agent Skills, WebMCP and MCP separate.

The Agent Skills format is supported across multiple agent products. OpenAI documents Skills in ChatGPT/Codex as following the Agent Skills open standard.

Upstream:

- https://agentskills.io/
- https://agentskills.io/specification
- https://github.com/agentskills/agentskills
- https://help.openai.com/en/articles/20001063-skills-in-chatgpt

## WebMCP

WebMCP lets web applications expose structured tools to browser agents instead of forcing an agent to infer every action from UI geometry and text.

As of this snapshot:

- WebMCP is experimental;
- Chrome 149 provides an origin trial;
- both imperative and declarative APIs are documented;
- current Chrome documentation uses `document.modelContext`; `navigator.modelContext` is deprecated in Chrome 150;
- security and eval guidance are part of the upstream documentation.

ARWP does not serialize WebMCP tool schemas. It declares where the tools exist and may list tool names for orientation. The page remains authoritative.

Upstream:

- https://developer.chrome.com/docs/ai/webmcp
- https://developer.chrome.com/docs/ai/webmcp/imperative-api
- https://developer.chrome.com/docs/ai/webmcp/declarative-api
- https://developer.chrome.com/docs/ai/webmcp/secure-tools
- https://developer.chrome.com/docs/ai/webmcp/evals

## Model Context Protocol

MCP connects clients to external tools and data. This is different from WebMCP, which exposes capabilities from a web page to a browser agent, and from Agent Skills, which package procedural instructions.

ARWP may describe local or remote MCP servers, but it does not replace MCP discovery/installation metadata.

The official MCP Registry is currently in preview. Registry server metadata uses standardized `server.json`. Remote MCP servers can be represented through the Registry `remotes` property; current documentation supports `streamable-http` remote transports.

A static GitHub Pages JSON endpoint is not a remote MCP server. It may still be an excellent data source for an MCP adapter running elsewhere. For local stdio implementations, ARWP can point to installable package metadata or a public source location.

Upstream:

- https://modelcontextprotocol.io/
- https://modelcontextprotocol.io/registry/about
- https://modelcontextprotocol.io/registry/quickstart
- https://modelcontextprotocol.io/registry/remote-servers

## A2A

A2A is for agent-to-agent interoperability. Its standardized discovery location is:

```text
/.well-known/agent-card.json
```

The Agent Card describes a real agent's capabilities, protocols, authentication requirements and skills.

ARWP deliberately makes A2A optional. A knowledge repository, static API or MCP server is not automatically an A2A agent.

Upstream:

- https://a2a-protocol.org/latest/specification/

## JSON Schema

ARWP v0.1 itself uses JSON Schema Draft 2020-12. Domain sites are encouraged to publish their own schemas for canonical records when those records have stable machine-readable contracts.

Upstream:

- https://json-schema.org/draft/2020-12

## OpenAPI

If a site exposes a conventional HTTP API, ARWP should link to the real OpenAPI contract instead of adding endpoint-level metadata to the profile.

Upstream:

- https://www.openapis.org/

## Schema.org

Schema.org remains useful for expressing visible web semantics and dataset/catalog metadata. ARWP does not attempt to mirror JSON-LD page entities.

A knowledge site can therefore use both:

- JSON-LD/Schema.org in pages and datasets;
- ARWP for cross-interface discovery.

Upstream:

- https://schema.org/

## MLCommons Croissant

Croissant 1.1 is useful when a public asset is genuinely a dataset rather than merely a JSON API. It adds machine-actionable provenance, vocabulary interoperability and usage-policy support on top of dataset metadata.

ARWP only links to the Croissant description. Croissant remains authoritative for dataset structure, provenance and policy semantics.

Upstream:

- https://docs.mlcommons.org/croissant/docs/croissant-spec-1.1.html
- https://mlcommons.org/working-groups/data/croissant/

## Why ARWP does not define another `.well-known` URL yet

The web already has several registered or established discovery mechanisms. Creating a new `.well-known` suffix before there is adoption would add another guessable URL without proving interoperability.

v0.1 therefore uses `/ai/site-profile.json` as a project convention and supports explicit discovery/configuration. A future proposal for a registered discovery location should require evidence from multiple independent implementations and consumers.

## Change policy

When an upstream mechanism changes:

1. implementation guidance should be updated first;
2. the ARWP schema should change only if the discovery contract itself needs a new field or meaning;
3. experimental browser/runtime details should not be frozen into the core schema unless interoperability requires it;
4. existing standards should be linked rather than copied whenever possible.
