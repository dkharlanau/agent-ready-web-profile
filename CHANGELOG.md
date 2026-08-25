# Changelog

ARWP is pre-stable. Until the first tagged release, entries describe the current `main` development line rather than a compatibility promise.

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

### MCP gateway

- Added a generic read-only stdio MCP gateway driven by an ARWP profile.
- Added deterministic JSON/JSONL/NDJSON retrieval support.
- Added stable-record lookup and explicit no-match behavior.
- Restricted network access to profile-declared HTTPS resources and explicit allowed origins.
- Added redirect re-validation, response-size limits and in-memory caching.

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

## Next

The next milestone should prioritize interoperability evidence over additional metadata fields:

- upstream/protocol-specific validation adapters;
- a stateless Streamable HTTP gateway deployment shape;
- profile-generation/adoption tooling;
- compatibility and release policy;
- WebMCP reference implementations and browser-agent evals;
- independent adopters before proposing any new registered discovery location.
