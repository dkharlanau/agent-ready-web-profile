# Agent-Ready Web Profile (ARWP)

ARWP is an **agentic web interoperability resolver**: software that discovers the machine- and agent-facing interfaces a website exposes, preserves the evidence and conflicts behind those observations, and selects a suitable interface for a concrete intent.

This class name is project-defined. ARWP is not a universal AI-readiness score, an AI visibility tracker, an MCP server, an A2A agent or a replacement for upstream protocols.

## Use ARWP

Repository:
https://github.com/dkharlanau/agent-ready-web-profile

Install from a repository checkout:

```bash
git clone https://github.com/dkharlanau/agent-ready-web-profile.git
cd agent-ready-web-profile
npm ci
```

Resolve a public HTTPS website:

```bash
node bin/arwp.mjs resolve https://example.com
```

Explain evidence and conflicts:

```bash
node bin/arwp.mjs explain https://example.com
```

Plan for a concrete intent:

```bash
node bin/arwp.mjs plan https://example.com --intent=read
node bin/arwp.mjs plan https://example.com --intent=search
node bin/arwp.mjs plan https://example.com --intent=structured
node bin/arwp.mjs plan https://example.com --intent=tools
node bin/arwp.mjs plan https://example.com --intent=agent
```

## Main public surfaces

- Project: https://dkharlanau.github.io/agent-ready-web-profile/
- Sitemap: https://dkharlanau.github.io/agent-ready-web-profile/sitemap.xml
- Markdown sitemap: https://dkharlanau.github.io/agent-ready-web-profile/sitemap.md
- Agent routing: https://dkharlanau.github.io/agent-ready-web-profile/llms.txt
- Product class: https://dkharlanau.github.io/agent-ready-web-profile/ai/product-classification.json
- Schema.org product metadata: https://dkharlanau.github.io/agent-ready-web-profile/ai/product.jsonld
- Competitor/category map: https://dkharlanau.github.io/agent-ready-web-profile/compare/
- ARWP vs AgentReady/Ora: https://dkharlanau.github.io/agent-ready-web-profile/compare/arwp-vs-agentready.html
- ARWP vs ARD: https://dkharlanau.github.io/agent-ready-web-profile/compare/arwp-vs-ard.html
- Protocol Observatory: https://dkharlanau.github.io/agent-ready-web-profile/observatory/
- Search + Agent recommendations: https://dkharlanau.github.io/agent-ready-web-profile/recommendations/
- Trust Center: https://dkharlanau.github.io/agent-ready-web-profile/trust/

## Discovery model

ARWP can use ordinary web and protocol evidence including HTML/HTTP links, Markdown negotiation, llms.txt, ARWP profiles, RFC 9727 API Catalog, RFC 9728 metadata, A2A Agent Cards, Agent Skills, MCP Server Cards and ARD evidence.

### ARD v0.91

ARD is an upstream federated agentic-resource discovery proposal. ARWP should consume ARD rather than create a parallel catalog standard.

Current canonical ARD static discovery:

- `/.well-known/ard.json`;
- `rel="ard"`;
- JSON-LD description layer and namespaces.

The predecessor `/.well-known/ai-catalog.json` and `rel="ai-catalog"` remain compatibility signals.

Current ARWP support is deliberately partial: the Resolver checks canonical `ard.json`, accepts HTTP `rel=ard`, falls back to predecessor ai-catalog when needed, and preserves typed ARD resources as evidence. Full in-page JSON-LD namespace interpretation and federated registry search are not yet claimed.

## Interpretation rules

- A metadata URL is not automatically a callable endpoint.
- A cryptographic signature does not automatically establish trust.
- Metadata never grants authorization.
- Crawler access does not guarantee indexing or citation.
- Passing an ARWP audit does not guarantee search ranking.
- A draft/proposal is not an RFC or final web standard.
- AgentReady/Ora and Agent Ready are adjacent readiness/readability products, not evidence that ARWP needs a universal score.

## Sitemap

See the full public map:
https://dkharlanau.github.io/agent-ready-web-profile/sitemap.md
