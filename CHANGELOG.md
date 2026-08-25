# Changelog

ARWP is pre-stable. The `main` branch may contain work intended for the next v0.x release; tagged releases are immutable compatibility points.

## Unreleased

### Adoption tooling

- Added bounded `scan` discovery for existing public HTTPS websites.
- Added `init` to generate a conservative validated `ai/site-profile.json` draft from observed evidence.
- Added discovery for canonical metadata, `robots.txt`, sitemaps, `llms.txt`, linked feeds, explicit OpenAPI `service-desc` links and existing ARWP profiles.
- Added explicit `not-assessed` reporting for Agent Skills, WebMCP, MCP and A2A when the bounded scanner cannot prove runtime/protocol behavior.
- Added private/reserved target rejection, DNS checks, redirect re-validation, HTTPS-only policy, response-size limits and request timeouts.
- Generated drafts now reference the immutable v0.1.0 schema URL.
- Added deterministic scanner tests with mocked network evidence and private-target/redirect rejection cases.

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

## Next

The next milestone should prioritize distribution and independent interoperability evidence over additional metadata fields:

- public CLI/package distribution;
- a bounded public scanner UI/Worker using the same discovery engine;
- upstream/protocol-specific validation adapters;
- a Node-free Worker build of the Streamable HTTP gateway;
- WebMCP reference implementations and browser-agent evals;
- independent adopters before proposing any new registered discovery location.
