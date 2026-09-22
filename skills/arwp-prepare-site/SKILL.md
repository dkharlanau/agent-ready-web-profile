---
name: arwp-prepare-site
description: Prepare, upgrade, migrate, or comprehensively audit a website repository with the Agent-Ready Web Profile (ARWP). Use when asked to make a site agent-ready, AI-search-ready, easier for AI agents to understand, improve search/discovery quality, add ARWP metadata, apply the ARWP profile, or check a website deeply/end-to-end. Build a reconciled page inventory first, run page-complete applicable checks instead of treating bounded samples as whole-site proof, inspect repository/build/deployed/rendered evidence, implement safe changes autonomously, verify them, and leave explicit coverage evidence.
license: PolyForm-Strict-1.0.0
compatibility: Requires a repository/filesystem and a Node.js environment for ARWP CLI verification. Network and browser access are useful for live/runtime audits but are not required for static preparation.
metadata:
  standard: agent-skills
  arwp-role: bootstrap
---

# ARWP Prepare Site

Use this skill to turn an existing website repository into a high-quality, evidence-backed ARWP implementation and to audit that implementation without silently sampling away problems.

## Outcome

Deliver a working repository change when mutation is authorized, not merely a checklist. Preserve the site's product identity and framework while improving discoverability, citation readiness, agent readability, machine classification, freshness, accessibility, page experience, trust and agent interoperability.

ARWP must never be presented as a guaranteed Google ranking or AI recommendation mechanism. The goal is to remove technical blockers, implement current platform guidance, expose useful machine-readable surfaces, improve the actual site, and make both implementation coverage and later outcomes measurable.

## Public language is human-first

ARWP should improve a site without making the site sound like an audit report. For reader-facing copy:

- use clear, semi-formal, approachable language with concrete verbs and short explanations;
- lead with what the visitor can understand, do or decide, not with the implementation behind it;
- avoid provider names, tag managers, frameworks, schema/protocol names, internal checks and similar implementation detail in primary copy unless that fact materially changes the visitor's decision or is required for truthful disclosure;
- keep implementation-specific detail in technical documentation, source/configuration or a clearly secondary technical note;
- write consent and measurement prompts in human terms first: explain the choice and why it may be useful before implementation vocabulary;
- simplify wording without hiding material data-use behavior, uncertainty or evidence limits.

Technical documentation can stay precise. Public pages, prompts and notices should read like useful product writing rather than configuration output.

## Execution is manifest-driven

Before choosing specialist workflows, load `registry/site-execution-manifest.json`. It is the canonical machine-readable composition contract for applying ARWP to a site.

Do not create or invoke one Agent Skill per checklist item. The execution model is:

`rules → audit domains/contracts → execution modules → optional specialist skills → arwp-prepare-site → site applicability matrix → repair/verify/re-audit → Surface Integrity → receipt`

Every site-wide application must create an applicability row for every execution module. An omitted module is not `not-applicable`. Use an explicit applicability/state/reason/evidence record, and keep unresolved applicability visible instead of converting uncertainty into a pass.

Specialist skills contribute evidence to their owning execution module. They do not replace whole-site coverage. Add a new specialist skill only when the reusable workflow itself has distinct inputs, evidence semantics, references/tests, verification or rollback boundaries; add individual checks to their canonical registry/module instead.

See `docs/SITE-EXECUTION-MODEL.md` for the maintenance contract and `schema/site-execution-manifest.schema.json` for the machine-readable shape.

## Coverage is a first-class result

When the user asks to apply ARWP to a site, do **not** treat a bounded `site-gate`, Technical Integrity, Internal Discovery, Growth or other sampled report as evidence that the entire site was checked.

Load `references/comprehensive-audit.md` and `registry/comprehensive-site-audit.json` before claiming a thorough, deep, complete, end-to-end or whole-site audit.

A full audit starts with a reconciled inventory and must report one of these coverage states:

- `runtime-complete` — every in-scope canonical page received deterministic and rendered/runtime coverage;
- `complete` — every in-scope canonical page received all applicable deterministic checks and all required system surfaces were checked;
- `template-runtime-complete` — deterministic checks cover every canonical page, while rendered/runtime checks cover every route archetype/template plus every changed/high-risk page;
- `partial` — some pages or checks were sampled, capped, rate-limited or skipped;
- `unknown` — inventory or an important evidence layer cannot be reconciled.

Never call `partial` or `unknown` a full audit. Never convert a bounded sample into a whole-site pass by implication.

For every canonical page keep a page ledger or equivalent machine-readable record with at least:

`url | canonicalOwner | routeArchetype | templateOrLayout | locale | inventorySources | expectedIndexability | auditState | findings | evidence`

## Evidence stack

Keep these layers distinct:

1. **Repository** — source routes, content, templates, generators, redirects and configuration.
2. **Build** — the actual generated HTML/assets/sitemaps/feeds/metadata.
3. **Deployed HTTP** — public status, redirects, headers, content types and body.
4. **Rendered browser** — runtime DOM, console/network health, layout, keyboard/focus and interaction.
5. **Owner/platform evidence** — Search Console, Bing, field Core Web Vitals, analytics, crawler logs, AI referrals and task/conversion outcomes.

A declaration at one layer is not proof of another. If the evidence layers disagree, deployment/runtime drift is itself a finding.

## Fast start

Run the deterministic repository inspector before broad manual exploration when executable skill scripts are available:

```bash
node scripts/inspect-repo.mjs <target-repository>
```

The helper reads only repository signals plus `package.json`, uses no network, and does not read secrets. Use its framework/public-root/source-of-truth hints to decide where changes belong; do not treat the report as deployed-site evidence.

If the skill is installed but the ARWP CLI/templates are not present, read `references/toolchain-bootstrap.md` and use an isolated temporary ARWP checkout rather than improvising commands or templates.

## Load references only when needed

- Read `registry/site-execution-manifest.json` for every site-wide ARWP application; use it to build the module applicability matrix and decide which specialists to compose.
- Read `docs/SITE-EXECUTION-MODEL.md` when changing ARWP composition, adding checks/modules/skills, or diagnosing why a rule was not executed.
- Read `references/comprehensive-audit.md` for any deep/complete/whole-site ARWP application or audit. This is mandatory before a full-audit claim.
- Read `references/stack-detection.md` when the framework/deployment/public-root model is unclear.
- Read `references/file-matrix.md` before creating new machine-readable/public files so you do not cargo-cult every ARWP surface into every site.
- Read `references/page-semantics.md` when the site needs structured data, entity identity, authors, events, datasets, terms, canonical cleanup or localization.
- Read `references/toolchain-bootstrap.md` when the ARWP CLI/templates are not already available in the target environment.
- Load `arwp-site-focus` when problem territory, audience, site thesis or information architecture is unclear.
- Load `arwp-ai-search-content` when the main work is article/docs/comparison/answer quality.
- Load `arwp-search-release` before calling a public hostname Search-ready.
- Load `arwp-technical-seo-critic` after the ordinary technical/Search pass for adversarial false-green review.
- Load `arwp-internal-discovery` for internal crawl paths, semantic relations, breadcrumbs and continuation.
- Load `arwp-image-discovery` for meaningful image Search/Images/Discover surfaces.
- Load `arwp-index-worthiness` before broad generated-page publication.
- Load `arwp-measurement-os` when Search/AI outcomes need provider-native evidence.
- Load `arwp-agent-discovery` when the main work is protocol/agent discovery.
- Load `arwp-evidence-ci` when the main work is CI, contracts, receipts or ongoing monitoring.

## Workflow

### 0. Compile the execution plan

- Load `registry/site-execution-manifest.json` before selecting specialist skills.
- Create one applicability-matrix row for every manifest module with `moduleId`, `applicability`, `reason`, `state`, `evidenceClasses`, `evidence`, `findings`, `verification` and `remediation`.
- Evaluate every conditional-pack trigger from `registry/comprehensive-site-audit.json`; activated packs contribute checks to their owning modules rather than automatically becoming new skills.
- Keep the manifest's evidence classes distinct: deterministic, heuristic, runtime and owner-platform.
- Do not silently omit modules. If applicability cannot yet be resolved, record `unknown` and keep the overall coverage claim partial/unknown until the evidence boundary is resolved.

### 1. Inspect the repository before editing

- Run the local inspector if available, then verify its signals against the actual project.
- Identify framework, build system, deployment target, public root, routes, metadata conventions, sitemap/robots ownership and content model.
- Read existing `AGENTS.md`, SEO config, JSON-LD, manifests, feeds, `llms.txt`, skills, API/OpenAPI/MCP/A2A/WebMCP surfaces and analytics hooks.
- Reuse the existing design system and content architecture.
- Identify source-to-build-to-deploy boundaries before changing generated output.

### 2. Build and reconcile the complete page inventory before sampling

Collect route candidates from every available source:

- repository route manifests, content collections and data-driven page generators;
- deterministic build output;
- `robots.txt` sitemap declarations, sitemap indexes and leaf sitemaps;
- same-origin crawlable links;
- canonical and `hreflang` targets;
- feeds when they expose first-party page URLs;
- first-party page URLs declared in structured data or machine-readable catalogs;
- redirects, pagination, locale variants, generated filters/states and utility routes.

Normalize and classify each discovered URL as a canonical owner, alias, redirect, intentional noindex/utility route, non-HTML resource, error state or unexplained route.

Reconcile counts between repository, build, sitemap and live discovery. A sitemap-only, build-only or navigation-only URL is not discarded; it is a finding to explain.

Assign every in-scope canonical page a route archetype, layout/template and locale. Preserve real query-state routes where they are part of the product or Search surface.

### 3. Establish layered baselines

If the public site is reachable, bounded ARWP diagnostics remain useful early warnings:

```bash
node bin/arwp.mjs technical-integrity https://example.com/ --max-pages=20 --max-link-targets=24 --json
node bin/arwp-growth.mjs https://example.com --vertical=<vertical> --json
```

Run `arwp audit <url> --json` where the legacy recommendation audit is relevant.

But label these results as bounded/preflight evidence. They do not replace the complete page ledger.

For small sites, prefer checking every canonical page at repository/build/public/runtime layers.

For larger sites, run deterministic repository/build checks page-complete, batch public HTTP checks conservatively, then render every distinct route archetype/template and every changed/high-risk page. If runtime coverage is not every page, say so explicitly and use `template-runtime-complete` or `partial` as appropriate.

### 4. Run the comprehensive applicable audit matrix

Load `registry/comprehensive-site-audit.json` and address every applicable domain through the owning module in `registry/site-execution-manifest.json`. Do not silently omit domains because the original task sounded like “SEO”.

The default whole-site matrix includes:

- inventory/deployment integrity;
- HTTP, redirects, crawl/index/canonical/sitemap/hreflang;
- head metadata, Search appearance, favicon and social cards;
- structured data, entity identity and provenance;
- content usefulness, duplication, freshness and claim/evidence boundaries;
- internal discovery, information architecture, breadcrumbs, continuation and broken internal links/assets;
- WCAG 2.2 accessibility structure plus manual keyboard/focus/interaction review where browser evidence exists;
- performance/delivery including field-vs-lab Core Web Vitals distinction;
- mobile/responsive/visual behavior;
- JavaScript/runtime functionality, console/network failures and raw-vs-rendered parity;
- security/privacy delivery basics and deeper application-security gating when the site has accounts/uploads/forms/transactional flows;
- images, video, audio and downloads;
- localization/internationalization;
- trust, publisher/author identity and conditional legal surfaces;
- analytics/measurement/observability;
- AI/agent readiness and crawler-purpose separation;
- feeds, manifests, APIs and machine-readable surfaces when present;
- freshness/lifecycle/regression integrity.

Activate conditional packs when applicable: ecommerce/product, editorial/news, dataset/research, tool/app/account, local-business and media-heavy.

“Comprehensive” means exhaustive over the site's applicable surfaces. It does not mean adding irrelevant technology or markup.

### 5. Classify the page inventory before generating metadata

- Load the current Page Semantics Profile from `registry/page-semantics-profiles.json` or its published copy.
- Identify stable site/publisher entities and the main content/page archetypes.
- Assign important routes a primary profile such as site-home, organization, article-editorial, author-profile, event, dataset, software-application, product, video-watch, glossary-term, glossary-index, community-qa or collection-list.
- Decide which missing pages have independent user value. Do not create thin author, event, glossary or landing pages solely to host markup.
- Reuse stable absolute `@id` values for the same WebSite, Organization, Person, Product, Dataset or DefinedTerm identity.

### 6. Implement P0/P1 improvements first

- Search crawl/index eligibility: HTTP/canonical/noindex/robots issues.
- Broken runtime/functionality issues on important routes.
- Canonical/sitemap consistency: canonical absolute URLs only, truthful meaningful `lastmod`, no accidental redirects/noindex/duplicate variants in the canonical inventory.
- Localized variants: reciprocal/self `hreflang` when real localized routes exist; choose one maintainable declaration mechanism.
- Stable canonical URLs and addressable section anchors.
- Correct title/description and framework-native social metadata.
- Search-result identity: coherent site name, favicon and canonical-host signals.
- Site identity: coherent `WebSite` plus real publisher `Organization`/`Person` where applicable.
- Page-specific JSON-LD from the Page Semantics Profile, using only facts grounded in visible first-party content.
- Clear authorship/provenance/date information for content that benefits from it; use real profile pages when recurring authors already have enough first-party identity data.
- Event leaf pages only for real events; Dataset markup only for genuine dataset-shaped assets; DefinedTerm/DefinedTermSet only for real terminology systems.
- Internal links from hub pages to important answer, comparison, evidence, product, author, event and term pages when those relationships are real.
- Accessibility, responsive/runtime and delivery defects that materially block use.
- Preview controls such as `data-nosnippet` or `max-image-preview` only when they match explicit publisher intent.

### 7. Add agent-facing surfaces only when useful

- `llms.txt` for concise content routing when appropriate.
- `AGENTS.md` for repository/agent instructions when the project is developer-facing.
- `sitemap.md` as an optional human/agent-readable map.
- ARWP `ai/site-profile.json` only when the publisher chooses to adopt ARWP.
- Agent Skills only for repeatable procedures that genuinely help an agent.
- ARD/MCP/A2A/WebMCP/OpenAPI only when the site actually exposes those interfaces; never invent capabilities.

### 8. Apply Growth Profile opportunities selectively

- Preferred Sources CTA only for publisher/editorial use cases where it makes sense.
- Content Signals / Content-Usage only when the publisher has an explicit AI-use policy and the hosting/CDN supports the mechanism.
- IndexNow only for participating engines and real update workflows.
- Social/video Search Console properties only when the brand owns those properties.
- Do not add obsolete SEO cargo cult such as `meta keywords`, sitelinks-search `SearchAction`, universal FAQ/HowTo schema or synthetic reviews/ratings.
- Do not maximize Schema.org type count. Accuracy, visible parity and entity consistency matter more than markup volume.

### 9. Convert findings into bounded remediation tasks

For each material problem record:

`problem → evidence layer → affected pages/archetypes → risk → recommendedChange → files → autofix → verification → source`

- Autofix only when required facts already exist in the repository or visible page.
- Missing author biography, organization/legal facts, event details, prices, availability, ratings, reviews, dataset identifiers/licenses or publication history are owner-data gates, not values to invent.
- Prefer the smallest reversible framework-native change that fixes the observed problem.
- When a shared template changes, expand the affected cohort to every route actually touched by that template.

### 10. Add measurement and contracts

- Add `arwp assert` when the site has interfaces that must not disappear silently.
- Add a scheduled/manual Growth Profile workflow when GitHub Actions is available.
- Use Evidence Receipts for important baseline or before/after observations.
- Keep Google/Bing/ChatGPT visibility metrics as external evidence; never infer causation from ARWP adoption alone.
- Re-audit changed pages and affected templates/archetypes after implementation.

### 11. Verify, re-audit and reconcile Surface Integrity before completion

- Run the site's existing tests/build/lint.
- Inspect deterministic build output, not just source templates.
- Run relevant ARWP validation/audit/growth checks.
- Parse generated JSON-LD and compare its facts with rendered visible pages.
- Verify canonical/indexability/sitemap/hreflang consistency for changed routes and the full canonical inventory when feasible.
- Validate all internal links and critical first-party assets when the inventory makes that feasible.
- Use current feature-specific external validators or Search Console/Bing tooling where owner access exists.
- Verify generated/public metadata paths actually deploy where intended.
- Compare the deployed artifact/revision with the tested repository revision when that evidence is available.
- Check browser rendering, console/network health, mobile/responsive behavior, keyboard/focus paths and interactive controls for the required runtime cohort.
- Re-run every affected execution module after remediation; do not assume the first fix closed the finding.
- Run the final cross-module Surface Integrity pass so canonical, hreflang, sitemap, JSON-LD, social/preferred-image, feed, internal-link and agent-facing representations cannot each be locally green while disagreeing globally.
- Repeat repair → verify → re-audit → Surface Integrity for safely resolvable required `fail`, `missing`, `stale` or `incomplete` states.
- Do not mark runtime/browser checks as passed without runtime evidence.
- Do not mark accessibility/security/Search/AI outcomes as proven by a generic automated score.

## Required completion report

A whole-site ARWP application must report:

- coverage state: `runtime-complete`, `complete`, `template-runtime-complete`, `partial` or `unknown`;
- exact counts for discovered routes, in-scope canonical pages, deterministic audited pages, rendered/browser-tested pages, redirects/aliases, excluded/non-HTML/utility routes and unknowns;
- the complete execution-module applicability matrix, including explicit reasons for `not-applicable`, `not-assessed` or unresolved/unknown decisions;
- inventory reconciliation gaps, including URLs seen only in repository/build/sitemap/navigation/live evidence;
- the per-page ledger or a durable machine-readable equivalent;
- which ARWP/Search/AI/agent/accessibility/performance/runtime/security/privacy/content problems were fixed;
- which page-semantics profiles were applied and which schemas/features were intentionally not added;
- which changes were autofixed versus blocked on owner/runtime data;
- final Surface Integrity status and any cross-module inconsistency that remains blocked;
- which checks remain manual/external and exactly which surfaces were not checked;
- verification commands/results plus the tested revision/deployment identity where available;
- any intentionally skipped feature and why.

Do not stop at a plan when repository edits are possible and authorized. Make the highest-confidence reversible changes, verify them, and leave consequential or credential-dependent items as explicit follow-up gates.

Do not use one composite SEO, AI, accessibility, security or quality score as a substitute for the evidence and coverage ledger.
