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

## Prepare a website with an AI agent

ARWP publishes portable Agent Skills. Default workflow:

```text
arwp-prepare-site
```

Install the skill package where supported:

```bash
npx skills add dkharlanau/agent-ready-web-profile
```

Skill catalog:
https://dkharlanau.github.io/agent-ready-web-profile/skills/

Specialists:

- `arwp-ai-search-content` — useful/original/evidence-backed content for retrieval and citation;
- `arwp-agent-discovery` — truthful agent/machine discovery surfaces;
- `arwp-evidence-ci` — contracts, audits, receipts and CI.

The preparation skill should inspect the target repository, establish an audit/growth baseline, implement high-confidence P0/P1 improvements, verify the site's own build/tests plus ARWP checks, and leave credential-dependent work explicit. It must not claim that ARWP or metadata guarantees ranking or AI recommendations.

## Main public surfaces

- Project: https://dkharlanau.github.io/agent-ready-web-profile/
- Sitemap: https://dkharlanau.github.io/agent-ready-web-profile/sitemap.xml
- Markdown sitemap: https://dkharlanau.github.io/agent-ready-web-profile/sitemap.md
- Agent routing: https://dkharlanau.github.io/agent-ready-web-profile/llms.txt
- Agent Skills: https://dkharlanau.github.io/agent-ready-web-profile/skills/
- Growth Profile: https://dkharlanau.github.io/agent-ready-web-profile/growth/
- Product class: https://dkharlanau.github.io/agent-ready-web-profile/ai/product-classification.json
- Schema.org product metadata: https://dkharlanau.github.io/agent-ready-web-profile/ai/product.jsonld
- Competitor/category map: https://dkharlanau.github.io/agent-ready-web-profile/compare/
- ARWP vs AgentReady/Ora: https://dkharlanau.github.io/agent-ready-web-profile/compare/arwp-vs-agentready.html
- ARWP vs ARD: https://dkharlanau.github.io/agent-ready-web-profile/compare/arwp-vs-ard.html
- Protocol Observatory: https://dkharlanau.github.io/agent-ready-web-profile/observatory/
- Search + Agent recommendations: https://dkharlanau.github.io/agent-ready-web-profile/recommendations/
- Evidence Receipts: https://dkharlanau.github.io/agent-ready-web-profile/evidence/receipts/
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
