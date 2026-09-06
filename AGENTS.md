# Agent-Ready Web Profile — agent instructions

This repository implements ARWP, an evidence-backed agentic-web interoperability resolver plus an optional publisher profile. The core design goal is to discover how a public website can actually be used by agents without requiring every website to adopt one ARWP-specific manifest.

## Install and verify

```bash
npm ci
npm test
npm run quickstart
```

Run the focused resolver tests while changing discovery logic:

```bash
npm run test:resolver
npm run test:benchmark
```

Run the Search/Agent and classification checks while changing public metadata, recommendations or comparison pages:

```bash
npm run test:recommendations
node scripts/classification-test.mjs
npm run test:site
```

## Agent Skills routing

ARWP ships portable Agent Skills under `skills/`. Use them instead of inventing a new ad-hoc site-optimization workflow.

- `arwp-prepare-site` — default orchestrator for preparing/upgrading an existing website repository under ARWP, Search/AI-search quality guidance and agent interoperability.
- `arwp-ai-search-content` — specialist for useful, original, evidence-backed articles/docs/comparison/answer pages.
- `arwp-agent-discovery` — specialist for truthful llms.txt, Agent Skills, ARD, OpenAPI/MCP/A2A/WebMCP and ARWP publisher surfaces.
- `arwp-evidence-ci` — specialist for assertion contracts, scheduled audits, receipts and drift-safe CI.

Portable install:

```bash
npx skills add dkharlanau/agent-ready-web-profile
```

If the task is to prepare another website, prefer `arwp-prepare-site`, inspect the target repository first, implement high-confidence reversible changes autonomously, run verification, and leave credential-dependent or consequential gates explicit. Do not stop at a recommendation list when repository edits are possible.

## Core product rules

1. Prefer upstream standards/specifications over new ARWP-native fields.
2. Keep the ARWP publisher profile optional; the Resolver must remain useful for ordinary websites with no ARWP profile.
3. Preserve source authority and contradictions instead of collapsing them into a single readiness score.
4. Static metadata is evidence of a declaration, not runtime conformance, authorization, security or trust.
5. Do not add hostname-specific exceptions to improve benchmarks.
6. Do not rewrite reviewed benchmark ground truth to match Resolver output.
7. Preserve negative results and historical snapshots.
8. Never claim search ranking, AI citation, token savings, adoption or answer-quality benefits without direct evidence.
9. Treat Internet-Drafts, Community Group work and vendor/multivendor proposals at their actual maturity level.
10. For agentic-resource discovery, consume ARD semantics where they solve the problem rather than inventing a competing catalog format.

## Resolver changes

The main network-facing flow is in `lib/resolver-core.mjs`; protocol normalization lives in `lib/resolver-adapters.mjs`.

When adding a discovery source:

- keep public-HTTPS and private-network protections intact;
- bound requests and response sizes;
- preserve the original source URL and authority;
- normalize conservatively;
- do not make a newly discovered metadata URL callable unless the upstream protocol says it is callable;
- add fixtures for malformed, missing and conflicting evidence;
- rerun the frozen decision-quality benchmark after planner-policy changes.

### ARD boundary

The current reviewed ARD proposal is v0.91 (2026-08-26).

Current canonical static discovery:

- `/.well-known/ard.json`;
- HTTP/HTML `rel="ard"`;
- JSON-LD description layer with base context/namespaces;
- additional routes may include in-page JSON-LD, robots `Agentmap`, DNS/SVCB and registries.

The predecessor `/.well-known/ai-catalog.json` and `rel="ai-catalog"` remain compatibility signals, not the current canonical names.

ARWP currently supports the canonical `ard.json` probe, HTTP `rel=ard`, predecessor fallback and conservative typed evidence. MCP Server Cards may use the existing server-card path. A2A card references, registries, nested catalogs, Skills and arbitrary typed artifacts are preserved as evidence. Full in-page JSON-LD namespace interpretation and ARD registry federation/search are not yet claimed.

## Public site and metadata

The GitHub Pages source is `docs/`.

Keep these surfaces synchronized where applicable:

- `docs/index.html`
- `docs/llms.txt`
- `docs/sitemap.xml`
- `docs/sitemap.md`
- `docs/AGENTS.md`
- `docs/ai/site-profile.json`
- `docs/ai/ai-search-profile.json`
- `docs/ai/product-classification.json`
- `docs/ai/product.jsonld`
- `docs/citation-index.json`
- `docs/compare/alternatives.json`
- `docs/observatory/protocols.json`
- `docs/growth/`
- `docs/skills/`

Canonical source copies also exist outside `docs/` for some machine-readable artifacts. Tests should fail when public and source copies drift.

Do not add `<meta name="keywords">`; structured keywords belong in JSON-LD or other machine-readable metadata. Do not claim that special AI files are Google ranking requirements.

## Comparison policy

Competitor and adjacent-product comparisons are source-backed category maps, not winner rankings. Unknown capabilities must not be presented as absent. The closest current adjacent product family is AgentReady/Ora. Agent Ready (`agent-ready.dev`) is an adjacent validator/research corpus. ARD is an upstream discovery proposal, not a product competitor.

Create a new immutable comparison/observatory snapshot when facts materially change rather than silently editing historical evidence.

## Security

Do not bypass access controls or automate side-effectful agent actions from discovery metadata. Do not place credentials, API keys, cookies or private URLs in fixtures, receipts or examples. Runtime evidence must remain opt-in and clearly scoped.
