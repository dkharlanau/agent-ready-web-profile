# ARWP site preparation file matrix

Use this reference only after inspecting the target repository. Do not create every file mechanically.

| Surface | Use when | Typical location | Boundary |
| --- | --- | --- | --- |
| Canonical/title/description | Almost every public site | framework metadata/head | Normal Search hygiene; not ARWP-specific |
| XML sitemap | Indexable multi-page site | framework plugin/generated public root | `lastmod` must reflect meaningful change |
| robots.txt | Origin owner can control crawler policy | origin root | Project subpaths do not replace origin-root robots semantics |
| JSON-LD Organization | Organization/brand identity matters | site layout/home/about | Use real entity data; avoid keyword stuffing |
| JSON-LD Article/TechArticle | Article/docs content has author/date/provenance | article template | Match visible content |
| Comparison page | Product class could be confused with alternatives | `/compare/` or equivalent | Source-backed category map, not winner claims |
| About/history/changelog | Trust/provenance/freshness benefits from explicit history | existing information architecture | Keep dates and claims factual |
| llms.txt | Concise machine content routing is useful | public root or documented project path | Supporting convention; not a Google requirement |
| AGENTS.md | Developer-facing repository/site | repository root, optionally public docs | Coding-agent instructions, not SEO metadata |
| sitemap.md | Compact human/agent navigation is useful | public docs root | Optional readability surface |
| `ai/site-profile.json` | Publisher explicitly adopts ARWP | public `ai/` directory | Must point to real surfaces; no ranking claim |
| `ai/product*.json*` | Product/entity class needs machine clarity | public `ai/` directory | Prefer Schema.org vocabulary where applicable |
| Agent Skills | Repeatable agent workflows exist | `skills/<name>/SKILL.md` | Workflow, not generic documentation |
| ARD | Real agentic resources need discovery | upstream-defined discovery surfaces | Preserve proposal maturity and evidence boundaries |
| OpenAPI | Site exposes real HTTP API | standard project convention | Never create fake API definitions |
| MCP/A2A/WebMCP | Real runtime/tool/agent capability exists | protocol-defined location/runtime | Static declaration is not runtime conformance |
| Preferred Sources CTA | Publisher/editorial brand wants opt-in followers | relevant visible page | User-preference opportunity, not ranking guarantee |
| IndexNow | Site publishes frequent changes and can submit URLs | deploy/update workflow | Only participating engines; submission ≠ indexing |
| Content-Usage/Content-Signal | Publisher has explicit AI-use policy and infrastructure supports it | robots/header/CDN policy | Policy signal; not a discoverability requirement |
| Evidence Receipt | Important baseline/change needs durable observation | CI artifact/public evidence area | Receipt integrity ≠ truth/adoption/trust |
| `arwp assert` contract | Public interface must not silently disappear/change | CI config/workflow | Fail explicit contracts, not optional opportunities |

## Avoid cargo cult files

Do not add a file solely because ARWP knows how to recognize it. Every surface should have a concrete user/agent/operational purpose and a valid deployment path.
