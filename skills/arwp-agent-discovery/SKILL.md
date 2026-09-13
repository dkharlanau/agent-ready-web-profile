---
name: arwp-agent-discovery
description: Add or repair machine-readable agent discovery and interoperability surfaces for a website. Use when asked to expose llms.txt, AGENTS.md, Agent Skills, ARD, MCP, A2A, WebMCP, OpenAPI, API catalogs, agent-readable sitemaps, or an ARWP site profile. Discover what the site truly supports, prefer upstream standards, and never advertise capabilities that do not exist.
license: PolyForm-Strict-1.0.0
compatibility: Requires repository access; live verification is optional but preferred when a deployed site exists.
metadata:
  standard: agent-skills
  arwp-role: interoperability
---

# ARWP Agent Discovery

Use this skill to make a website easier for agents to discover and operate without inventing a competing protocol or fake capability.

## Decision order

Prefer existing upstream mechanisms before adding ARWP-native metadata:

1. ordinary semantic HTML and stable canonical URLs;
2. OpenAPI / RFC API Catalog where real APIs exist;
3. Agent Skills for reusable procedures;
4. A2A Agent Card for real agent endpoints;
5. MCP metadata/runtime for actual MCP servers;
6. WebMCP only for real browser-exposed tools;
7. ARD for agentic-resource discovery when appropriate;
8. ARWP publisher profile as an optional service map tying real surfaces together.

## Workflow

1. Inventory actual interfaces.
   - Search code/config for API routes, OpenAPI, MCP, A2A, skills, WebMCP, feeds, search endpoints, data exports and auth metadata.
   - Distinguish documentation mentioning a protocol from an implemented capability.

2. Add lightweight readability surfaces.
   - `llms.txt`: concise canonical routes/resources; do not duplicate the whole site.
   - `AGENTS.md`: repository instructions for coding agents when developer-facing.
   - `sitemap.md`: optional compact navigation map.
   - Preserve normal XML sitemap/canonical SEO independently.

3. Add Agent Skills for repeatable tasks.
   - Folder name is kebab-case.
   - File must be exactly `SKILL.md`.
   - Frontmatter must include `name` and trigger-rich `description`.
   - Keep the main skill concise and use `references/`, `scripts/`, or `assets/` for progressive disclosure.
   - Skills should execute a real workflow, not merely restate documentation.

4. Add structured discovery only where backed by implementation.
   - OpenAPI URLs must describe real endpoints.
   - A2A discovery URLs are metadata; do not treat a card URL as the callable endpoint unless the spec says so.
   - MCP server cards/metadata are evidence, not authorization.
   - ARD resources are discovery evidence; relevance is not trust.
   - Never expose internal/private endpoints in public discovery files.

5. If adopting ARWP, create/update `ai/site-profile.json`.
   - Point to real resources.
   - Keep it optional and valid.
   - Do not claim profile presence improves ranking.
   - Run ARWP validation and compare profile declarations with observable interfaces.

6. Add machine classification.
   - Use Schema.org JSON-LD for the real product/application/entity class.
   - Add explicit comparison/category pages when product class could be confused with adjacent tools.
   - Keep canonical terminology consistent across README/site/JSON-LD/profile/citation surfaces.

7. Verify.
   - Validate JSON/YAML/Markdown syntax.
   - Run relevant ARWP resolver/audit/assert checks.
   - Verify public paths after build if possible.
   - Runtime-only protocols stay `not-assessed` without runtime evidence.

## Security boundary

Discovery metadata never grants permission. Do not make state-changing calls, bypass authentication, expose credentials, crawl private networks, or convert an unverified metadata URL into an executable route.
