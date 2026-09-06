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

## Fast start

Run the deterministic repository inspector before broad manual exploration when executable skill scripts are available:

```bash
node scripts/inspect-repo.mjs <target-repository>
```

The helper reads only repository signals plus `package.json`, uses no network, and does not read secrets. Use its framework/public-root/source-of-truth hints to decide where changes belong; do not treat the report as deployed-site evidence.

If the skill is installed but the ARWP CLI/templates are not present, read `references/toolchain-bootstrap.md` and use an isolated temporary ARWP checkout rather than improvising commands or templates.

## Load references only when needed

- Read `references/stack-detection.md` when the framework/deployment/public-root model is unclear.
- Read `references/file-matrix.md` before creating new machine-readable/public files so you do not cargo-cult every ARWP surface into every site.
- Read `references/page-semantics.md` when the site needs structured data, entity identity, authors, events, datasets, terms, canonical cleanup or localization.
- Read `references/toolchain-bootstrap.md` when the ARWP CLI/templates are not already available in the target environment.
- Load `arwp-ai-search-content` when the main work is article/docs/comparison/answer quality.
- Load `arwp-agent-discovery` when the main work is protocol/agent discovery.
- Load `arwp-evidence-ci` when the main work is CI, contracts, receipts or ongoing monitoring.

## Workflow

1. Inspect the repository before editing.
   - Run the local inspector if available, then verify its signals against the actual project.
   - Identify framework, build system, deployment target, public root, routes, metadata conventions, sitemap/robots ownership and content model.
   - Read existing `AGENTS.md`, SEO config, JSON-LD, manifests, feeds, `llms.txt`, skills, API/OpenAPI/MCP/A2A/WebMCP surfaces and analytics hooks.
   - Reuse the existing design system and content architecture.

2. Establish a baseline.
   - If the public site is reachable, run `arwp audit <url> --json` and `arwp-growth <url> --json`.
   - If a live site is not available, inspect static files and use the same rules manually.
   - Separate hard technical blockers from optional opportunities, runtime-only checks and owner-data measurement.

3. Classify the page inventory before generating metadata.
   - Load the current Page Semantics Profile from `registry/page-semantics-profiles.json` or its published copy.
   - Identify the stable site/publisher entities and the main content/page archetypes.
   - Assign important routes a primary profile such as site-home, organization, article-editorial, author-profile, event, dataset, software-application, product, video-watch, glossary-term, glossary-index, community-qa or collection-list.
   - Decide which missing pages have independent user value. Do not create thin author, event, glossary or landing pages solely to host markup.
   - Reuse stable absolute `@id` values for the same WebSite, Organization, Person, Product, Dataset or DefinedTerm identity.

4. Implement P0/P1 improvements first.
   - Search crawl/index eligibility: HTTP/canonical/noindex/robots issues.
   - Canonical/sitemap consistency: canonical absolute URLs only, truthful meaningful `lastmod`, no accidental redirects/noindex/duplicate variants in the canonical inventory.
   - Localized variants: reciprocal/self `hreflang` when real localized routes exist; choose one maintainable declaration mechanism.
   - Stable canonical URLs and addressable section anchors.
   - Correct title/description and framework-native social metadata.
   - Site identity: coherent `WebSite` plus real publisher `Organization`/`Person` where applicable.
   - Page-specific JSON-LD from the Page Semantics Profile, using only facts grounded in visible first-party content.
   - Clear authorship/provenance/date information for content that benefits from it; use real profile pages when recurring authors already have enough first-party identity data.
   - Event leaf pages only for real events; Dataset markup only for genuine dataset-shaped assets; DefinedTerm/DefinedTermSet only for real terminology systems.
   - Internal links from hub pages to important answer, comparison, evidence, product, author, event and term pages when those relationships are real.
   - Preview controls such as `data-nosnippet` or `max-image-preview` only when they match an explicit publisher intent.

5. Add agent-facing surfaces only when useful.
   - `llms.txt` for concise content routing when appropriate.
   - `AGENTS.md` for repository/agent instructions when the project is developer-facing.
   - `sitemap.md` as an optional human/agent-readable map.
   - ARWP `ai/site-profile.json` only when the publisher chooses to adopt ARWP.
   - Agent Skills only for repeatable procedures that genuinely help an agent.
   - ARD/MCP/A2A/WebMCP/OpenAPI only when the site actually exposes those interfaces; never invent capabilities.

6. Apply Growth Profile opportunities selectively.
   - Preferred Sources CTA only for publisher/editorial use cases where it makes sense.
   - Content Signals / Content-Usage only when the publisher has an explicit AI-use policy and the hosting/CDN supports the mechanism.
   - IndexNow only for participating engines and real update workflows.
   - Social/video Search Console properties only when the brand owns those properties.
   - Do not add obsolete SEO cargo cult such as `meta keywords`, sitelinks-search `SearchAction`, universal FAQ/HowTo schema or synthetic reviews/ratings.
   - Do not maximize Schema.org type count. Accuracy, visible parity and entity consistency matter more than markup volume.

7. Convert findings into bounded remediation tasks.
   - For each material problem record: `problem`, `evidence`, `risk`, `recommendedChange`, `files`, `autofix`, `verification`, `source`.
   - Autofix only when required facts already exist in the repository or visible page.
   - Missing author biography, organization/legal facts, event details, prices, availability, ratings, reviews, dataset identifiers/licenses or publication history are owner-data gates, not values to invent.
   - Prefer the smallest reversible framework-native change that fixes the observed problem.

8. Add measurement and contracts.
   - Add `arwp assert` when the site has interfaces that must not disappear silently.
   - Add a scheduled/manual Growth Profile workflow when GitHub Actions is available.
   - Use Evidence Receipts for important baseline or before/after observations.
   - Keep Google/Bing/ChatGPT visibility metrics as external evidence; never infer causation from ARWP adoption alone.

9. Verify before completion.
   - Run the site's existing tests/build/lint.
   - Run relevant ARWP validation/audit/growth checks.
   - Parse generated JSON-LD and compare its facts with the rendered visible page.
   - Verify canonical/indexability/sitemap/hreflang consistency for changed routes.
   - Use current feature-specific external validators or Search Console/Bing tooling where owner access exists.
   - Verify generated/public metadata paths actually deploy where intended.
   - Check mobile/responsive rendering if page templates changed.
   - Do not mark runtime/browser checks as passed without runtime evidence.

## Required completion report

Report:

- what was changed;
- which ARWP/Search/AI/agent quality problems were fixed;
- which page-semantics profiles were applied and which schemas were intentionally not added;
- which changes were autofixed versus blocked on owner data;
- which checks remain manual or external;
- verification commands/results;
- any intentionally skipped feature and why.

Do not stop at a plan when repository edits are possible. Make the highest-confidence reversible changes, verify them, then leave consequential or credential-dependent items as explicit follow-up gates.
