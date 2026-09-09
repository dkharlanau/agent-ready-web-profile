# Repository map — Goose ARWP

Use this map after `AGENTS.md`. Its unit is **task -> canonical source -> coupled surface -> focused verification**. It is a routing aid, not a substitute for reading current source or scoped instructions at the observed ref.

Run commands from the repository root unless a row says otherwise. CI currently uses Node.js 24. Install with `npm ci` before local checks.

| Task / user-visible behavior | Canonical first reads | Coupled files / outputs | Focused verification |
| --- | --- | --- | --- |
| Current Search/AI growth rules, trends and hypotheses | `registry/search-agent-recommendations.json`, `registry/trends.json`, `registry/growth-hypotheses.json`, `skills/arwp-growth-loop/SKILL.md` | `lib/growth-profile.mjs`, `lib/growth-plan.mjs`, `bin/arwp-growth.mjs`, `docs/GROWTH-LOOP.md`, public Growth/Trends/Recommendations surfaces | `npm run test:growth`; `npm run test:trends`; `node bin/arwp-hypotheses.mjs check`; `node bin/arwp-trends.mjs check` |
| Technical Integrity / Growth preflight | `registry/technical-integrity-rules.json`, `lib/technical-integrity.mjs`, `lib/internal-link-target-health.mjs` | `bin/arwp-technical-integrity.mjs`, `bin/arwp.mjs`, `docs/TECHNICAL-INTEGRITY.md`, Growth skill, managed blocks in `AGENTS.md` and `docs/AGENTS.md` | `node scripts/technical-integrity-test.mjs`; `node scripts/internal-link-target-health-test.mjs`; `node scripts/technical-preflight-instructions-test.mjs` |
| Search Maturity reference/cohort analysis | `docs/SEARCH-MATURITY-BENCHMARK.md`, `skills/arwp-search-maturity/SKILL.md`, `benchmarks/search-maturity/` | `bin/arwp-search-maturity.mjs`, benchmark schemas/tests and accepted public-safe observations | `node benchmarks/search-maturity-test.mjs`; `node bin/arwp-search-maturity.mjs check benchmarks/search-maturity/pilot-2026-09-07.json` |
| Future Search experiments / semantic index | `registry/future-search-experiments.json`, `docs/FUTURE-SEARCH-LAB.md`, `skills/arwp-future-search/SKILL.md` | `lib/semantic-index.mjs`, `bin/arwp-semantic-index.mjs`, future-search public surfaces | `node scripts/future-search-test.mjs`; when the semantic index changes, run its `build`/`check` flow from the Future Search docs |
| Resolver and interoperability behavior | `SPEC.md`, `docs/RESOLVER.md`, relevant `lib/resolver*.mjs` | `resolver/server.mjs`, `gateway/`, `scanner-service/`, schemas, protocol adapters and examples | `npm run test:resolver`; add `npm run test:gateway` / `npm run test:scanner` when those surfaces change |
| Target-site transformation | `docs/TARGET-SITE-TRANSFORMATION.md`, `skills/arwp-target-transformation/SKILL.md`, `lib/transformation-engine.mjs` | `bin/arwp-transform.mjs`, transformation schemas, receipts and target fixtures | `npm run test:transform`; preserve branch/PR-first production target delivery and the absence of direct-main target transformation |
| Portfolio inspection / rollout / proposals | `docs/PORTFOLIO-FLEET.md`, `docs/PORTFOLIO-ROLLOUT.md`, `skills/arwp-portfolio-fleet/SKILL.md` | `lib/portfolio-*.mjs`, `bin/arwp-portfolio.mjs`, portfolio workflows and fixtures | `npm run test:portfolio-workspace`; `node scripts/portfolio-rollout-test.mjs`; broader `npm test` when proposal/guardrail semantics change |
| Product/public content pages | `content/pages/*.md` where a page manifest names it as `sourceMarkdown`; otherwise the relevant canonical `docs/*.md`; `registry/page-manifest.json` | Published `docs/**/*.html`, `docs/page-manifest.json`, sitemap/entity surfaces and linked JSON-LD | `npm run test:site`; `node scripts/test.mjs`; inspect the relevant generator/sync command before editing published output directly |
| Discoverability pattern library | `knowledge/discoverability-corpus.json`, discoverability templates/scripts, `docs/DISCOVERABILITY-VERSIONING.md` | `docs/discoverability.html`, `docs/knowledge/discoverability-corpus.json`, routes/sitemaps | `npm run build:discoverability`; `npm run test:discoverability` |
| Agent Skills | Canonical `skills/*/SKILL.md` and `skills/README.md` | Published `docs/skills/` mirrors and `.github/workflows/agent-skills.yml` | Use the existing skill validation/workflow plus `npm test`; do not hand-edit a published mirror when a canonical skill source owns it |
| Maturity, identity, datasets, trust | `docs/MATURITY-PROFILE.md`, `CONTRIBUTING.md`, relevant `docs/trust/` sources | `docs/maturity/profile.json`, entity/catalog surfaces, dataset/DOI records | `node scripts/maturity-profile-test.mjs --site`; `node bin/arwp-maturity.mjs check docs/maturity/profile.json` |
| Core package/schema changes | `SPEC.md`, relevant `schema/`, `lib/`, `bin/`, examples | `README.md`, standards docs, package exports, public examples | Focused package/schema tests plus `npm test`; `npm run test:package` for package-surface changes |
| Repository CI / validation | `.github/workflows/ci.yml` and the workflow touching the changed surface | Test scripts, action pins, package scripts | Validate the existing command locally when available; after publication, match the workflow result to the exact commit SHA. Do not weaken checks to make the run pass. |
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

Broad deterministic repository validation:

```bash
npm ci
npm test
npm run quickstart
```

`npm test` is the broad repository contract, not proof of production Search/AI outcomes. Live/reference/network checks and owner-side Google/Bing/referral measurements remain separate evidence.

Remote validation is primarily `.github/workflows/ci.yml` on `main` pushes and pull requests, plus focused workflows for specific surfaces. Check the actual tested revision; a green result for another SHA is not evidence for the current change.

Publication is separate from validation. In particular, `.github/workflows/publish-ecosystem.yml` is manual and must remain so unless an explicitly authorized release task changes that policy.
