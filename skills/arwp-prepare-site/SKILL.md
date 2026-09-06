---
name: arwp-prepare-site
description: Prepare, upgrade, or migrate a website repository to the Agent-Ready Web Profile (ARWP). Use when asked to make a site agent-ready, AI-search-ready, easier for AI agents to understand, improve search/discovery quality, add ARWP metadata, or apply the ARWP profile to an existing site. Inspect the repository, implement safe changes autonomously, run ARWP audit/growth/assert checks, and leave evidence instead of only giving recommendations.
license: Apache-2.0
compatibility: Requires a repository/filesystem and a Node.js environment for ARWP CLI verification. Network access is useful for live audits but not required for static preparation.
metadata:
  standard: agent-skills
  arwp-role: bootstrap
---

# ARWP Prepare Site

Use this skill to turn an existing website repository into a high-quality, evidence-backed ARWP implementation.

## Outcome

Deliver a working repository change, not a checklist. Preserve the site's product identity and framework while improving discoverability, citation readiness, agent readability, machine classification, freshness and agent interoperability.

ARWP must never be presented as a guaranteed Google ranking or AI recommendation mechanism. The goal is to remove technical blockers, implement current platform guidance, expose useful machine-readable surfaces and make improvement measurable.

## Workflow

1. Inspect the repository before editing.
   - Identify framework, build system, deployment target, public root, routes, metadata conventions, sitemap/robots ownership and content model.
   - Read existing `AGENTS.md`, SEO config, JSON-LD, manifests, feeds, `llms.txt`, skills, API/OpenAPI/MCP/A2A/WebMCP surfaces and analytics hooks.
   - Reuse the existing design system and content architecture.

2. Establish a baseline.
   - If the public site is reachable, run `arwp audit <url> --json` and `arwp-growth <url> --json`.
   - If a live site is not available, inspect static files and use the same rules manually.
   - Separate hard technical blockers from optional opportunities, runtime-only checks and owner-data measurement.

3. Implement P0/P1 improvements first.
   - Search crawl/index eligibility: HTTP/canonical/noindex/robots issues.
   - Sitemap and meaningful `lastmod` where the framework can maintain it accurately.
   - Stable canonical URLs and addressable section anchors.
   - Correct title/description and framework-native social metadata.
   - Entity/product classification using JSON-LD where appropriate.
   - Clear authorship/provenance/date information for content that benefits from it.
   - Internal links from hub pages to important answer, comparison, evidence and product pages.

4. Add agent-facing surfaces only when useful.
   - `llms.txt` for concise content routing when appropriate.
   - `AGENTS.md` for repository/agent instructions when the project is developer-facing.
   - `sitemap.md` as an optional human/agent-readable map.
   - ARWP `ai/site-profile.json` only when the publisher chooses to adopt ARWP.
   - Agent Skills only for repeatable procedures that genuinely help an agent.
   - ARD/MCP/A2A/WebMCP/OpenAPI only when the site actually exposes those interfaces; never invent capabilities.

5. Apply Growth Profile opportunities selectively.
   - Preferred Sources CTA only for publisher/editorial use cases where it makes sense.
   - Content Signals / Content-Usage only when the publisher has an explicit AI-use policy and the hosting/CDN supports the mechanism.
   - IndexNow only for participating engines and real update workflows.
   - Social/video Search Console properties only when the brand owns those properties.
   - Do not add obsolete SEO cargo cult such as `meta keywords` or generic FAQ schema solely for ranking hopes.

6. Add measurement and contracts.
   - Add `arwp assert` when the site has interfaces that must not disappear silently.
   - Add a scheduled/manual Growth Profile workflow when GitHub Actions is available.
   - Use Evidence Receipts for important baseline or before/after observations.
   - Keep Google/Bing/ChatGPT visibility metrics as external evidence; never infer causation from ARWP adoption alone.

7. Verify before completion.
   - Run the site's existing tests/build/lint.
   - Run relevant ARWP validation/audit/growth checks.
   - Verify generated/public metadata paths actually deploy where intended.
   - Check mobile/responsive rendering if page templates changed.
   - Do not mark runtime/browser checks as passed without runtime evidence.

## Required completion report

Report:

- what was changed;
- which ARWP/Search/AI/agent quality problems were fixed;
- which checks remain manual or external;
- verification commands/results;
- any intentionally skipped feature and why.

Do not stop at a plan when repository edits are possible. Make the highest-confidence reversible changes, verify them, then leave consequential or credential-dependent items as explicit follow-up gates.
