# Goose ARWP — repository work

This is the root entry point for repository work. Goose ARWP is the product-facing layer; Agent-Ready Web Profile (ARWP) is the repository/package and interoperability foundation. The project combines evidence-backed website growth, Search Maturity reference analysis, governed future-search experiments and a Resolver/interoperability layer.

Do not treat this file as automatically loaded in ordinary ChatGPT chat. A repository session must fetch it, `REPO_MAP.md` and the relevant scoped source/instructions from the actual observed GitHub ref.

## Start here — ChatGPT + GitHub

1. Resolve the actual repository, default branch/ref and current HEAD before editing.
2. Read this file and [`REPO_MAP.md`](REPO_MAP.md), then fetch the canonical source, coupled files and focused verification for the task.
3. Read applicable scoped instructions before mutation, especially the relevant file under [`skills/`](skills/README.md) and the linked product/specification documentation.
4. Preserve the current user's authority and all explicit branch, push, merge, deployment and publication restrictions. Never infer wider authority from tool availability or from this file.
5. Before the first remote mutation, identify the intended paths, cheapest credible check and any publication effect. Reconcile if HEAD moved; never force-push over concurrent work.
6. Prefer canonical data/templates/source over generated or published output. Treat truncated GitHub reads as incomplete evidence.
7. Keep a coherent change together and verify the exact published SHA when the available tools expose that evidence.

Current source and applicable scoped instructions override a stale route in this file or the map. Fix an affected stale route in the same authorized change rather than following it blindly.

## Repository authority and publication boundaries

- Normal repository validation is defined by existing workflows. Do not disable CI, remove useful checks or weaken security/review gates to make an agent run faster.
- [`.github/workflows/publish-ecosystem.yml`](.github/workflows/publish-ecosystem.yml) is an explicit manual publication boundary for npm and the Official MCP Registry. Do not make those publications automatic and do not dispatch them during ordinary repository work unless the user explicitly authorizes that publication.
- `docs/` contains the public GitHub Pages surface. A change to public output is a publication-relevant change; inspect the source/output relationship in `REPO_MAP.md` before editing it.
- [`.github/workflows/technical-integrity.yml`](.github/workflows/technical-integrity.yml) can synchronize the managed Technical Integrity block below and push that synchronization on `main`. Keep the managed markers and canonical block intact unless the task explicitly changes that contract.
- Target-site transformation has a narrower delivery policy than ordinary maintainer work in this repository: production target delivery is branch/PR-first and direct-main target transformation is intentionally absent. See [`docs/TARGET-SITE-TRANSFORMATION.md`](docs/TARGET-SITE-TRANSFORMATION.md).
- Portfolio rollout/proposal artifacts remain non-mutating: preserve `githubMutationAllowed: false`, `productionMutationAllowed: false` and the requirement for separate target-repository authorization. See [`docs/PORTFOLIO-ROLLOUT.md`](docs/PORTFOLIO-ROLLOUT.md).
- Never publish credentials, cookies, private customer/owner evidence, proprietary live corpora or confidential R&D merely because this repository is public.

## Core project invariants

- Platform requirements and primary-source evidence outrank optional tactics, correlations and project experiments.
- A passing implementation check does not prove indexing, ranking, citation, recommendation traffic or business impact.
- Preserve neutral, negative and counterexample evidence; do not curate evidence only to support a preferred theory.
- Do not create fake freshness, fake authorship, decorative structured data, thin query-variant pages or unsupported ranking claims.
- Static metadata is evidence of a declaration, not runtime conformance, authorization, security or trust.
- Prefer upstream standards to ARWP-specific fields when an established mechanism already expresses the capability. The optional ARWP publisher profile must not become a prerequisite for the Resolver.
- Keep public methodology, commercial/private evidence and confidential R&D at their intended disclosure boundaries. [`CONTRIBUTING.md`](CONTRIBUTING.md) is canonical for that classification gate.
- Preserve canonical IDs, public URLs, schema contracts and source-to-output relationships when restructuring data or generated surfaces.

## Install and verify

Run from the repository root. CI currently uses Node.js 24 and the committed npm lockfile.

```bash
npm ci
npm test
npm run quickstart
```

Use the focused checks in [`REPO_MAP.md`](REPO_MAP.md) for the surface you changed, then use `npm test` when the change crosses several areas or when the normal validation boundary requires it.

These checks validate repository behavior. They do not by themselves prove the live GitHub Pages deployment, Search/AI visibility, crawler behavior outside the bounded test, owner-platform metrics or causal impact.

<!-- BEGIN GOOSE TECHNICAL PREFLIGHT -->
## Technical preflight

Before optional Search/GEO/content/agent tactics on a public target, run the bounded Technical Integrity audit:

```bash
node bin/arwp.mjs technical-integrity https://example.com/ --max-pages=20 --json
```

Interpret the result conservatively:

- `FAIL` — a bounded source-backed blocker was observed; fix it or explicitly resolve why it is intentional before optional acquisition work;
- `WATCH` — investigate context, rendered/runtime behavior or audit limits; do not automatically call it a defect;
- `PASS` — no issue was observed by that detector in the bounded sample; this is not indexing, ranking or citation proof;
- `not-applicable` — the check does not apply to the observed representation.

A bounded fetch failure remains unknown rather than becoming an indexability failure. Non-HTML resources are not required to carry HTML-only canonical markup. If dogfood exposes a detector false positive, repair the detector/evidence boundary instead of editing the target site to satisfy a bad check.

Use Technical Integrity before optional tactics and again after the changed public/deployed surface is observable.
<!-- END GOOSE TECHNICAL PREFLIGHT -->

## Read next by task

- Repository routing and verification: [`REPO_MAP.md`](REPO_MAP.md)
- Contribution, truthfulness and disclosure rules: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Core ARWP contract: [`SPEC.md`](SPEC.md)
- Product priorities and stop rules: [`docs/PRODUCT-LINE.md`](docs/PRODUCT-LINE.md)
- Growth workflow: [`docs/GROWTH-LOOP.md`](docs/GROWTH-LOOP.md) and [`skills/arwp-growth-loop/SKILL.md`](skills/arwp-growth-loop/SKILL.md)
- Search Maturity: [`docs/SEARCH-MATURITY-BENCHMARK.md`](docs/SEARCH-MATURITY-BENCHMARK.md) and [`skills/arwp-search-maturity/SKILL.md`](skills/arwp-search-maturity/SKILL.md)
- Future Search: [`docs/FUTURE-SEARCH-LAB.md`](docs/FUTURE-SEARCH-LAB.md) and [`skills/arwp-future-search/SKILL.md`](skills/arwp-future-search/SKILL.md)
- Resolver/interoperability: [`docs/RESOLVER.md`](docs/RESOLVER.md)
- Maturity/trust evidence: [`docs/MATURITY-PROFILE.md`](docs/MATURITY-PROFILE.md)
- Security: [`SECURITY.md`](SECURITY.md)

## Resume unfinished work

Use live GitHub issues for actionable work, [`ROADMAP.md`](ROADMAP.md) for durable direction and [`docs/LOOP-STATUS.md`](docs/LOOP-STATUS.md) for the existing loop status. Do not create a parallel roadmap or checkpoint system merely for an agent session. On resume, reconcile those records with current HEAD and the exact state of the affected files/checks before continuing.
