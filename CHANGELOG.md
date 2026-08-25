# Changelog

ARWP is pre-stable. The `main` branch may contain work intended for the next v0.x release; tagged releases are immutable compatibility points.

## Unreleased — intended for 0.2.0

### Resolver interoperability layer

- Reframed the toolchain so an ARWP profile is one useful publisher input rather than a required universal manifest.
- Added `arwp resolve` to normalize heterogeneous public discovery into one evidence-backed service map.
- Added `arwp explain` for a human-readable account of discovered interfaces, source evidence, conflicts and recommended routes.
- Added `arwp plan --intent=read|search|structured|tools|agent` with deterministic selected/fallback interfaces.
- Added bounded reusable public-HTTPS fetch primitives with DNS/private-address checks, redirect revalidation, response/time limits and optional request/byte metrics.
- Added resolver adapters for valid ARWP profiles, `agents.txt`, `agents.json`, RFC 9727 API Catalog, RFC 9728 root Protected Resource Metadata, A2A Agent Cards, Agent Skills discovery indexes and experimental MCP AI Catalog / Server Cards.
- Preserve source authority as `ietf-standard`, `upstream-standard`, `upstream-convention`, `community-convention`, `experimental-upstream`, `project-profile` or directly observed web evidence.
- Added explicit conflict reporting for canonical identity disagreement, agents.txt/agents.json capability mismatches and experimental MCP Server Card endpoint mismatches.
- Added a dedicated stdio Resolver MCP server with `resolve_site`, `explain_site` and `plan_site_interface`.
- Extended the bounded hosted discovery runtime with fixed `/resolve`, `/explain` and `/plan` routes alongside `/scan`; it remains explicitly not an arbitrary URL proxy.
- Updated the project's own ARWP profile to advertise the resolver MCP implementation.
- Added deterministic cross-standard resolver tests and npm-pack requirements for resolver modules/docs/MCP entry point.

### Benchmark and evidence discipline

- Added a deterministic synthetic resolver regression benchmark comparing HTML-only, llms-only, ARWP-only, agents-only, upstream-native and resolver-union strategies across reviewed fixtures.
- Run the synthetic benchmark in CI as regression coverage.
- Added a public benchmark methodology for a future 20–50-site independent corpus measuring requests, bytes, correct/missed interface selection, conflicts and source/provenance preservation.
- Benchmark documentation explicitly prohibits presenting synthetic fixtures as evidence of real-world token, latency, ranking, adoption or answer-quality gains.
- Reframed `ROADMAP.md` around the North Star: external sites correctly resolved/routed without site-specific integration code.
- New ARWP profile fields, registered discovery locations and broad ecosystem expansion are evidence-gated rather than roadmap defaults.

### Product and public site

- Reframed the public project around **resolve how a website can actually be used by agents**, while retaining the original goal of making sites understandable to software.
- Replaced manifest-first positioning with “one site → many discovery surfaces → ARWP Resolver → evidence-backed service map → intent plan”.
- Explain that existing RFC, A2A, Agent Skills and MCP semantics remain upstream rather than being redefined in ARWP.
- Added source-authority and benchmark/evidence sections to the public Pages site.
- Added resolver/explain/plan CLI setup directly to the public website UI.
- Keep the initial five live ARWP sites as implementation fixtures while explicitly separating them from independent adoption evidence.
- Added live reference cards, interactive profile examples, directory filtering and a neutral profile-availability badge without certification/readiness claims.

### Adoption tooling

- Added bounded `scan` discovery for existing public HTTPS websites.
- Added `init` to generate a conservative validated `ai/site-profile.json` draft from observed evidence.
- Added discovery for canonical metadata, `robots.txt`, sitemaps, `llms.txt`, linked feeds, explicit OpenAPI `service-desc` links and existing ARWP profiles.
- Added explicit `not-assessed` reporting for Agent Skills, WebMCP, MCP and A2A when the bounded scanner cannot prove runtime/protocol behavior.
- Added private/reserved target rejection, DNS checks, redirect re-validation, HTTPS-only policy, response-size limits and request timeouts.
- Generated drafts reference the immutable v0.1.0 schema URL.
- Added deterministic scanner tests with mocked network evidence and private-target/redirect rejection cases.
- Added `arwp health` to distinguish observed, declared, verified, warning/failing, not-declared and not-assessed states without a single readiness score.
- Added a copyable GitHub workflow template that scans a public site, regenerates/validates its conservative profile and opens a pull request only when the profile changes.
- Added an ARWP adoption-report issue template focused on concrete interoperability failures.

### Hosted discovery runtime

- Added a small HTTP service that reuses the same bounded scanner/resolver implementation instead of introducing a browser crawler.
- Exposes only `GET /health`, `POST /scan`, `POST /resolve`, `POST /explain`, `POST /plan` and their bounded CORS preflight.
- Added explicit browser Origin allow-listing, request-body limits and shared in-memory rate limiting across expensive routes.
- Kept arbitrary user-supplied browser fetches prohibited; the static Pages UI calls only a fixed configured service endpoint.
- Added standalone Node and Docker deployment artifacts plus service-boundary tests.

### Directory and federation

- Added `registry/sites.json` as the initial public ARWP Directory with the five real reference sites.
- Added `registry/directory.schema.json` and a synchronized GitHub Pages `directory.json` copy.
- Added capability-based directory filtering in the UI and CLI.
- Added aggregate directory statistics derived only from public declarations; no visitor, scan-history or user tracking is collected for adoption metrics.
- Added `arwp directory` and `arwp federated-search` CLI commands.
- Added a federated retrieval layer that selects only sites declaring retrieval, reads their declared indexes and preserves source site/profile/index identity in every result.
- Added a multi-site stdio MCP router with `list_arwp_sites` and `search_arwp_sites` tools.
- Deliberately kept the directory as discovery metadata rather than a new canonical knowledge store.
- Resolver-backed federation across heterogeneous non-ARWP sites is the next iteration; it is not yet claimed as implemented.

### Protocol checks

- Added conservative inspectable-artifact checks for Agent Skill frontmatter, declared MCP Registry metadata and A2A Agent Cards.
- Added `arwp protocol-checks` CLI access to those checks.
- Remote MCP and WebMCP runtime behavior remains explicitly `not-assessed` when a real protocol session/browser runtime has not been exercised; URL reachability is not upgraded into protocol conformance.
- Resolver support for MCP Server Card / AI Catalog remains explicitly `experimental-upstream`; the next runtime step is reconciliation with live MCP `server/discover` behavior.

### Distribution

- Prepared the root project as public npm package `agent-ready-web-profile` version `0.2.0` while retaining ARWP profile contract `0.1`.
- Expanded the single `arwp` executable with validate, verify, scan, init, health, resolve, explain, plan, protocol checks, directory and federated search commands.
- Added profile gateway, federated-router and resolver stdio MCP entry points plus the existing Streamable HTTP gateway.
- Added an explicit npm `files` allow-list so development fixtures/tests are not distributed while resolver modules/docs are included.
- Added matching npm `mcpName: io.github.dkharlanau/agent-ready-web-profile` metadata.
- Added a real `npm pack` smoke test that installs the tarball into a clean consumer project, checks executable/version/directory/resolver help and validates through the bundled schema.
- Added scanner, resolver, directory, health, protocol, router, site, benchmark and package tests to CI.
- Added Docker deployment artifacts for the remote MCP gateway and bounded discovery service plus a local compose example.
- Added a gated npm trusted-publishing workflow using GitHub OIDC; no long-lived npm token is embedded in the repository.

### MCP ecosystem preparation

- Added root `server.json` for the generic read-only gateway with package metadata aligned to the npm `mcpName`.
- Added a gated Official MCP Registry publication job using GitHub OIDC and `mcp-publisher`.
- Kept Registry publication separate from the ARWP profile contract and documented package-first publication order.
- Registry support is prepared but must not be claimed as published until the external registry accepts it.

### Ecosystem preparation

- Added a candidate SchemaStore catalog entry for `**/ai/site-profile.json`.
- Added explicit evidence gates: SchemaStore/curated-list submissions and any registered ARWP discovery URI/link relation should wait for independent adoption evidence.
- Added `ROADMAP.md` separating `implemented`, `prepared`, `external` and `evidence-gated` work.
- Updated the public backlog issues so npm/MCP Registry, hosted service deployment and independent adoption remain external gates.

## 0.1.0 — experimental baseline

### Profile contract

- Added the ARWP v0.1 specification and JSON Schema 2020-12 contract.
- Defined separate capability groups for web/search discovery, data, retrieval, Agent Skills, WebMCP, MCP, A2A, identity and trust.
- Added extension namespacing without allowing extensions to redefine core fields.
- Required truthful capability declarations rather than planned or inferred integrations.
- Required real URLs for remote Streamable HTTP MCP declarations and package/source metadata for local stdio MCP declarations.
- Added Agent Skills discovery while keeping `SKILL.md`, WebMCP and MCP semantics separate.

### Tooling

- Added an Ajv-based local validator.
- Added a live verifier for declared HTTPS resources, redirects, HTTP status and basic media-type checks.
- Added a reusable GitHub Action for profile validation.
- Added deterministic positive, negative and conditional contract tests.

### MCP gateways

- Added a shared profile/retrieval/tool factory used by all gateway transports.
- Added a generic read-only stdio MCP gateway driven by an ARWP profile.
- Added a stateless Streamable HTTP MCP handler using the MCP v2 server SDK.
- Added a standalone Node HTTP launcher for hosted/container deployments.
- Added fail-closed remote Host validation, optional browser Origin allow-listing and a fixed MCP endpoint path.
- Added deterministic JSON/JSONL/NDJSON retrieval support.
- Added stable-record lookup and explicit no-match behavior.
- Restricted source-data network access to profile-declared HTTPS resources and explicit allowed origins.
- Added redirect re-validation, response-size limits and in-memory caching.
- Added tests for missing Host configuration, wrong path, rejected Host and rejected Origin.

### Reference implementations

Added real-site reference profiles for:

- Dzmitryi Kharlanau SAP knowledge site;
- Brali Practical Knowledge Library;
- Cognitive Biases Knowledge Library;
- CBT Cards public reflection resource;
- Metkagram.

The reference suite includes deliberately different capability combinations so schema evolution is tested against real architectures rather than one synthetic example.

### Operations

- Added deterministic CI on push and pull request.
- Added scheduled/manual live verification of reference resources with JSON report artifacts.
- Added Apache-2.0 licensing and contribution guidelines.
- Added a committed npm lockfile and switched CI/runtime installs to reproducible `npm ci`.
- Added an integration test that exercises the repository as the reusable GitHub Action.
- Added a release and distribution policy for Marketplace, semantic tags and future npm/MCP Registry publication.

## Remaining external / evidence gates for 0.2.x

Repository implementation now includes the resolver iteration. The highest-value remaining work depends on external systems or independent evidence:

- publish the tested npm package through trusted publishing and create the corresponding immutable GitHub release;
- publish the prepared MCP package metadata after the npm artifact exists;
- deploy the bounded `/scan|resolve|explain|plan` service on a public HTTPS runtime and wire the Pages UI;
- obtain at least three independent adopters outside the original reference suite;
- build and publish the reviewed 20–50-site external resolver benchmark corpus, including negative results;
- reconcile static MCP metadata against live `server/discover` behavior and verify A2A Agent Card signatures when present;
- add resolver snapshots/drift/conflict monitoring after a public resolver service is being used;
- decide whether any new ARWP profile-contract version is needed only from external benchmark/adopter failures.
