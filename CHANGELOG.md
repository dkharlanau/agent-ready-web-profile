# Changelog

ARWP is pre-stable. The `main` branch may contain work intended for the next v0.x release; tagged releases are immutable compatibility points.

## Unreleased — intended for 0.2.0

### Product and public site

- Reframed the project around a simple user outcome: **make your website understandable to AI agents**.
- Added a value-first public homepage that explains the difference between human navigation and machine service discovery before introducing protocol terminology.
- Added explicit “Without ARWP / With ARWP” integration flows and the principle that ARWP removes guessing rather than making a model smarter.
- Added concrete outcomes for site owners, AI agents, developers and trusted-knowledge consumers.
- Added live reference cards for the five real ARWP sites and an interactive canonical profile-URL example.
- Added public capability filtering, adoption/connect flows and P0–P3 implementation status.
- Added practical use-case and adoption guides.
- Added a neutral `ARWP profile available` badge that is deliberately not a certification or readiness score.

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

### Hosted scanner runtime

- Added a small HTTP service that reuses the same bounded scanner implementation instead of introducing a browser crawler.
- Exposed only `GET /health`, `POST /scan` and `OPTIONS /scan`.
- Added explicit browser Origin allow-listing, request-body limits and in-memory rate limiting.
- Kept arbitrary user-supplied browser fetches prohibited; the static Pages UI calls only a fixed configured scanner endpoint.
- Added generated profile download support to the public UI when a real hosted scanner endpoint is configured.
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

### Protocol checks

- Added conservative inspectable-artifact checks for Agent Skill frontmatter, declared MCP Registry metadata and A2A Agent Cards.
- Added `arwp protocol-checks` CLI access to those checks.
- Remote MCP and WebMCP runtime behavior remains explicitly `not-assessed` when a real protocol session/browser runtime has not been exercised; URL reachability is not upgraded into protocol conformance.

### Distribution

- Prepared the root project as public npm package `agent-ready-web-profile` version `0.2.0` while retaining ARWP profile contract `0.1`.
- Expanded the single `arwp` executable with validate, verify, scan, init, health, protocol checks, directory, federated search, stdio MCP, Streamable HTTP MCP and federated-router entry points.
- Added an explicit npm `files` allow-list so development fixtures/tests are not distributed.
- Added matching npm `mcpName: io.github.dkharlanau/agent-ready-web-profile` metadata.
- Added a real `npm pack` smoke test that installs the tarball into a clean consumer project, checks the executable/version/directory and validates through the bundled schema.
- Added scanner, directory, health, protocol, router, site and package tests to CI.
- Added Docker deployment artifacts for the remote MCP gateway and scanner plus a local compose example.
- Added a gated npm trusted-publishing workflow using GitHub OIDC; no long-lived npm token is embedded in the repository.

### MCP ecosystem preparation

- Added root `server.json` for the generic read-only gateway with package metadata aligned to the npm `mcpName`.
- Added a gated Official MCP Registry publication job using GitHub OIDC and `mcp-publisher`.
- Kept Registry publication separate from the ARWP profile contract and documented package-first publication order.
- Registry support is prepared but must not be claimed as published until the external registry accepts it.

### Ecosystem preparation

- Added a candidate SchemaStore catalog entry for `**/ai/site-profile.json`.
- Added explicit evidence gates: SchemaStore/curated-list submissions and any registered discovery URI/link relation should wait for independent adoption evidence.
- Added `ROADMAP.md` separating `implemented`, `prepared`, `external` and `evidence-gated` work.
- Updated the public backlog issues so npm/MCP Registry, hosted scanner deployment and independent adoption are the only remaining external gates.

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

## Remaining external gates for 0.2.0

The repository implementation is substantially complete. Remaining work depends on external systems or independent users:

- publish the tested `0.2.0` npm package through trusted publishing;
- publish the prepared MCP metadata to the Official MCP Registry after npm publication;
- deploy the hosted scanner (and optional public demo MCP endpoint) on an HTTPS runtime;
- connect the project UI to that real scanner endpoint;
- obtain at least three independent adopters outside the original reference suite and record concrete integration failures;
- evaluate/submit SchemaStore and curated ecosystem entries only when adoption evidence justifies them.
