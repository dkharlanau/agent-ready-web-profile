# Repository map — Goose ARWP

Use this map after `AGENTS.md`. Its unit is **task -> canonical source -> coupled surface -> focused verification**. It is a routing aid, not a substitute for reading current source or scoped instructions at the observed ref.

Run commands from the repository root unless a row says otherwise. CI currently uses Node.js 24. Install with `npm ci` before local checks.

| Task / user-visible behavior | Canonical first reads | Coupled files / outputs | Focused verification |
| --- | --- | --- | --- |
| Current Search/AI growth rules, trends and hypotheses | `registry/search-agent-recommendations.json`, `registry/trends.json`, `registry/growth-hypotheses.json`, `skills/arwp-growth-loop/SKILL.md` | `lib/growth-profile.mjs`, `lib/growth-plan.mjs`, `bin/arwp-growth.mjs`, `docs/GROWTH-LOOP.md`, public Growth/Trends/Recommendations surfaces | `npm run test:growth`; `npm run test:trends`; `node bin/arwp-hypotheses.mjs check`; `node bin/arwp-trends.mjs check` |
| Search release / result presentation / GitHub Pages host identity | `registry/search-release-practices.json`, `docs/SEARCH-RELEASE-GATE.md`, `skills/arwp-search-release/SKILL.md`, `docs/SEARCH-APPEARANCE.md` | final generated homepage HTML; `lib/search-appearance.mjs`, `bin/arwp-search-appearance.mjs`; canonical host, favicon assets, robots/sitemap, redirects, hreflang, deployment and owner-side Search observations | `node scripts/search-appearance-test.mjs`; run `node bin/arwp-search-appearance.mjs <final-homepage.html> --url=<canonical-root> --strict`; combine with Technical Integrity/Internal Discovery; inspect production separately; never treat a green repository check as proof of the displayed site name/title/snippet/favicon |
| Regional Search surface applicability | `registry/regional-search-surfaces.json`, `docs/REGIONAL-SEARCH-SURFACES.md` | `lib/regional-search-surfaces.mjs`, `bin/arwp-regional-search.mjs`; owner-declared company base/query type/business role; feature-specific provider instructions | `node scripts/regional-search-surfaces-test.mjs`; `node bin/arwp-regional-search.mjs --check`; this is an applicability/eligibility gate, not ranking proof |
| Technical Integrity / Growth preflight | `registry/technical-integrity-rules.json`, `lib/technical-integrity.mjs`, `lib/internal-link-target-health.mjs` | `bin/arwp-technical-integrity.mjs`, `bin/arwp.mjs`, `docs/TECHNICAL-INTEGRITY.md`, Growth skill, managed blocks in `AGENTS.md` and `docs/AGENTS.md` | `node scripts/technical-integrity-test.mjs`; `node scripts/internal-link-target-health-test.mjs`; `node scripts/technical-preflight-instructions-test.mjs` |
| Internal discovery / page distribution / crawl-path evidence | `registry/internal-discovery-distribution-practices.json`, `docs/INTERNAL-DISCOVERY-DISTRIBUTION-LAYER.md`, `docs/INTERNAL-DISCOVERY-EVIDENCE.md`, `skills/arwp-internal-discovery/SKILL.md`, `schema/internal-discovery-report.schema.json` | `lib/internal-discovery.mjs`, `bin/arwp-internal-discovery.mjs`; bounded Site Gate cohort; rendered HTML owner/alias/link-class graph; target-site relation source, breadcrumbs, continuation and utility surfaces | `node scripts/internal-discovery-test.mjs`; `node scripts/internal-discovery-distribution-layer-test.mjs`; `node bin/arwp-internal-discovery.mjs <site> --max-pages=20 --json`; never convert partial anchor coverage into orphan evidence, a graph/SEO score or a claim that Share/Save/Cite controls improve ranking |
| Strict content/detail page quality / social preview / sharing | `registry/content-page-quality-contract.json`, `docs/CONTENT-PAGE-QUALITY-CONTRACT.md`, `registry/comprehensive-site-audit.json`, `skills/arwp-internal-discovery/SKILL.md` | `lib/content-page-quality.mjs`, `bin/arwp-content-page-quality.mjs`, final generated content/detail HTML, representative share images, end-of-content Share/Copy/direct-provider footer, optional real feedback sink | `node scripts/content-page-quality-test.mjs`; `node bin/arwp.mjs content-page-quality <html-or-build-root> --base-url=<canonical-root> --strict`; enumerate every applicable content/detail page for deterministic checks and runtime-test each distinct distribution implementation; this is a mandatory complete-audit contract, not an optional skill |
| Revision-bound sitemap freshness integrity | `docs/FRESHNESS-INTEGRITY.md`, `schema/freshness-snapshot.schema.json`, `schema/freshness-comparison.schema.json` | `lib/freshness-integrity.mjs`, `bin/arwp-freshness.mjs`, `bin/arwp.mjs`; two Repository Mapper Site State Graph revisions + explicit leaf sitemap snapshots | `node scripts/freshness-integrity-test.mjs`; `node bin/arwp.mjs freshness --help`; use only longitudinally, keep incomplete mapping `unknown`, and never infer significant page change from source/build timestamps or a digest alone |
| Verified deploy → discovery notification / changed canonical handoff | `registry/deploy-discovery-loop-practices.json`, `docs/DEPLOY-DISCOVERY-LOOP.md`, `skills/arwp-growth-loop/SKILL.md` | `lib/deploy-discovery-loop.mjs`, `bin/arwp-deploy-discovery.mjs`; before/after final Search artifacts; Production Search Build Gate live report; `arwp-indexnow` ready-URL handoff; sitemap/feed evidence; provider-native owner measurement queue | `npm run test:deploy-discovery`; require complete exact revision/live deployment evidence before ready output; added/updated candidates also require live byte equality; byte-only rebuild churn and unverified removals stay `watch`; actual IndexNow submission remains a separate owner-key action and never proves indexing/ranking |
| Route-level treatment cohort integrity | `docs/TREATMENT-COHORT-INTEGRITY.md`, `schema/treatment-cohort-integrity.schema.json` | `lib/treatment-cohort-integrity.mjs`, `bin/arwp-treatment-cohort.mjs`, `bin/arwp.mjs`; before/after Site State Graphs + optional canonical treatment URL list | `node scripts/treatment-cohort-integrity-test.mjs`; `node bin/arwp.mjs treatment-cohort --help`; shared mapped inputs may expand actual treatment scope; unresolved ownership, changed mapping basis and dirty same-commit drift must fail closed to `unknown` |
| Search Maturity reference/cohort analysis | `docs/SEARCH-MATURITY-BENCHMARK.md`, `skills/arwp-search-maturity/SKILL.md`, `benchmarks/search-maturity/` | `bin/arwp-search-maturity.mjs`, benchmark schemas/tests and accepted public-safe observations | `node benchmarks/search-maturity-test.mjs`; `node bin/arwp-search-maturity.mjs check benchmarks/search-maturity/pilot-2026-09-07.json` |
| Future Search experiments / semantic index | `registry/future-search-experiments.json`, `docs/FUTURE-SEARCH-LAB.md`, `skills/arwp-future-search/SKILL.md` | `lib/semantic-index.mjs`, `bin/arwp-semantic-index.mjs`, future-search public surfaces | `node scripts/future-search-test.mjs`; when the semantic index changes, run its `build`/`check` flow from the Future Search docs |
| Resolver and interoperability behavior | `SPEC.md`, `docs/RESOLVER.md`, relevant `lib/resolver*.mjs` | `resolver/server.mjs`, `gateway/`, `scanner-service/`, schemas, protocol adapters and examples | `npm run test:resolver`; add `npm run test:gateway` / `npm run test:scanner` when those surfaces change |
| Target-site transformation | `docs/TARGET-SITE-TRANSFORMATION.md`, `skills/arwp-target-transformation/SKILL.md`, `lib/transformation-engine.mjs` | `bin/arwp-transform.mjs`, transformation schemas, receipts and target fixtures | `npm run test:transform`; preserve branch/PR-first production target delivery and the absence of direct-main target transformation |
| Portfolio inspection / rollout / proposals | `docs/PORTFOLIO-FLEET.md`, `docs/PORTFOLIO-ROLLOUT.md`, `skills/arwp-portfolio-fleet/SKILL.md` | `lib/portfolio-*.mjs`, `bin/arwp-portfolio.mjs`, portfolio workflows and fixtures | `npm run test:portfolio-workspace`; `node scripts/portfolio-rollout-test.mjs`; broader `npm test` when proposal/guardrail semantics change |
| Product/public content pages | `content/pages/*.md` where a page manifest names it as `sourceMarkdown`; otherwise the relevant canonical `docs/*.md`; `registry/page-manifest.json` | Published `docs/**/*.html`, `docs/page-manifest.json`, sitemap/entity surfaces and linked JSON-LD | `npm run test:site`; `node scripts/test.mjs`; when the route is a content/detail page also apply the Content Page Quality contract; inspect the relevant generator/sync command before editing published output directly |
| Discoverability pattern library | `knowledge/discoverability-corpus.json`, discoverability templates/scripts, `docs/DISCOVERABILITY-VERSIONING.md` | `docs/discoverability.html`, `docs/knowledge/discoverability-corpus.json`, routes/sitemaps | `npm run build:discoverability`; `npm run test:discoverability` |
| Agent Skills | Canonical `skills/*/SKILL.md` and `skills/README.md` | Published `docs/skills/` mirrors and `.github/workflows/agent-skills.yml` | Use the existing skill validation/workflow plus `npm test`; do not hand-edit a published mirror when a canonical skill source owns it |
| Maturity, identity, datasets, trust | `docs/MATURITY-PROFILE.md`, `CONTRIBUTING.md`, relevant `docs/trust/` sources | `docs/maturity/profile.json`, entity/catalog surfaces, dataset/DOI records | `node scripts/maturity-profile-test.mjs --site`; `node bin/arwp-maturity.mjs check docs/maturity/profile.json` |
| Core package/schema changes | `SPEC.md`, relevant `schema/`, `lib/`, `bin/`, examples | `README.md`, standards docs, package exports, public examples | Focused package/schema tests plus `npm test`; `npm run test:package` for package-surface changes |
| Repository stewardship / safe cleanup / source-output maps / agent navigation | `docs/REPOSITORY-STEWARDSHIP.md`, `skills/arwp-repository-stewardship/SKILL.md`, then current `AGENTS.md` / `REPO_MAP.md` / roadmap-state sources | target repository canonical/generated/public boundaries, `.gitignore`, `AGENTS.md`, `REPO_MAP.md`, scoped guides, tests/fixtures/schemas/evidence and lightweight structural drift checks | Audit/classify before mutation; apply the skill's deletion gates; run target-focused checks plus the repository's normal build/test boundary; keep unresolved purpose as `unknown`; never use file count or a grep miss as deletion proof |
| Repository memory / navigation | `AGENTS.md`, `REPO_MAP.md`, `ROADMAP.md`, live GitHub issues | `README.md`, `docs/LOOP-STATUS.md`, historical milestone docs, `.gitignore` | `node scripts/repository-memory-test.mjs`; keep task routing pointed at existing paths, keep workstation-local paths out of repository memory, and do not let historical milestone docs become a second current backlog |
| Repository CI / validation | `scripts/validation-contract.mjs`, `scripts/validation-contract-test.mjs`, `.github/workflows/ci.yml` | `package.json`, focused workflows, test scripts, action pins | `npm run test:validation-contract`; `npm test`; use `node scripts/validation-contract.mjs --list core` to inspect the broad contract without running it. Keep live/network and external SDK setup explicit in workflows; after publication, match results to the exact commit SHA. Do not weaken checks to make the run pass. |
| npm / MCP publication | `.github/workflows/publish-ecosystem.yml` | npm tarball / Official MCP Registry metadata | Manual only. The workflow validates first, and publication inputs default false. Do not dispatch or automate publication without explicit authorization. |
| Technical Integrity instruction synchronization | `scripts/sync-technical-preflight-instructions.mjs` | `AGENTS.md`, `docs/AGENTS.md`, `.github/workflows/technical-integrity.yml` | `node scripts/technical-preflight-instructions-test.mjs`. The workflow has `contents: write` and may push a synchronization commit on `main` if the managed block drifts. |
| Backlog / resume | live GitHub issues, `ROADMAP.md`, `docs/LOOP-STATUS.md` | Relevant issue acceptance criteria and last verified repository state | Reconcile with current HEAD and affected checks; no code check proves backlog freshness |

## Source-to-output rules

The repository contains both canonical source and public/generated artifacts. Do not assume every file under `docs/` is generated: many `docs/*.md` files are canonical documentation. Use the owning manifest/script or page metadata to decide.

For data-driven public pages, prefer this route when it exists:

```text
canonical data/content
-> schema/validation
-> generator/template/sync script
-> docs/ public output
-> focused site/output test
```

Examples:

- page content can be owned by `content/pages/*.md`, declared by `registry/page-manifest.json`, and published as `docs/.../index.html`;
- content/detail route families additionally evaluate `registry/content-page-quality-contract.json` against final artifacts and runtime distribution controls;
- discoverability is owned by its corpus/templates and rebuilt with `npm run build:discoverability`;
- canonical Agent Skills live under `skills/`, while `docs/skills/` is a public mirror;
- the Technical Integrity block in root/public agent instructions is owned by `scripts/sync-technical-preflight-instructions.mjs`.

Preserve public URLs, stable IDs, ordering contracts and source/output links. A structural split that changes those contracts is a migration, not agent housekeeping.

## Not first reads

These paths may be useful for diagnosis, but normally inspect their owner/source first:

- `node_modules/` or other dependency output in a local checkout;
- published/generated `docs/**/*.html` when the page names a canonical source or generator;
- `docs/skills/` when the canonical skill exists under `skills/`;
- historical benchmark/result artifacts when the task concerns current benchmark logic rather than a historical result.

Do not ignore them universally. Generated output may be the correct evidence when diagnosing a build/publication defect.

## Verification contract

Repository-memory validation is intentionally lightweight and dependency-free:

```bash
node scripts/repository-memory-test.mjs
```

Validation routing is also dependency-free and can be inspected without executing the suite:

```bash
node scripts/validation-contract-test.mjs
node scripts/validation-contract.mjs --list core
```

Broad deterministic repository validation:

```bash
npm ci
npm test
npm run quickstart
```

`npm test` delegates to the `core` validation group. Its command/order fingerprint is guarded so consolidation cannot silently drop or reorder coverage. Live/reference/network checks and owner-side Google/Bing/referral measurements remain separate evidence.

Remote validation is primarily `.github/workflows/ci.yml` on `main` pushes and pull requests, plus focused workflows for specific surfaces. Main CI routes deterministic Node-only phases through the same validation contract while keeping live dogfood, external SDK installation and reusable-action execution explicit in YAML. Check the actual tested revision; a green result for another SHA is not evidence for the current change.

Publication is separate from validation. In particular, `.github/workflows/publish-ecosystem.yml` is manual and must remain so unless an explicitly authorized release task changes that policy.