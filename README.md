# Agent-Ready Web Profile

[![ARWP validation](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml)
[![Reference verification](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml)

**Resolve how a website can actually be used by agents.**

Modern websites may expose HTML, Markdown negotiation, HTTP `Link` discovery, `llms.txt`, datasets, retrieval indexes, OpenAPI, Agent Skills, MCP, A2A, OAuth resource metadata, `agents.json` and other surfaces. A client should not need site-specific code — or guess which manifest is authoritative — to understand them.

ARWP now has two complementary parts:

1. **ARWP Profile** — an experimental publisher-maintained service map at `/ai/site-profile.json`.
2. **ARWP Resolver** — an interoperability engine that reads ARWP plus existing upstream/community/web discovery, preserves evidence and conflicts, and selects an interface for a concrete intent.

The profile is useful. It is **not** required to use the Resolver and it is not intended to replace upstream standards.

Public project site: https://dkharlanau.github.io/agent-ready-web-profile/

Profile contract: **experimental v0.1**. Released validator/Action: [`v0.1.0`](https://github.com/dkharlanau/agent-ready-web-profile/releases/tag/v0.1.0). The current `main` toolchain is version **0.2.0**; npm publication remains an external release gate and must not be described as complete until it succeeds.

## The problem

A site can legitimately publish several independent discovery surfaces:

```text
                         WEBSITE
                            |
      +---------------------+----------------------+
      |          |          |         |            |
    HTTP       ARWP      agents.*   API/A2A    Agent Skills
 Link/HTML    profile                metadata
      |                     |                      |
      +-------------- MCP / OAuth / web ---------+
                            |
                       ARWP RESOLVER
                            |
                 evidence-backed service map
                            |
               +------------+-------------+
               |            |             |
             read         search         tools
             data       structured       agent
```

The Resolver does not ask every ecosystem to converge on one file. It answers:

> **What does this website actually expose, where did each claim come from, do the claims conflict, and which interface should a client use for this task?**

## Resolve, explain and plan

```bash
node bin/arwp.mjs resolve https://example.com
node bin/arwp.mjs explain https://example.com
node bin/arwp.mjs plan https://example.com --intent=search
```

Machine-readable output is available with `--json`.

Supported planning intents:

- `read`
- `search`
- `structured`
- `tools`
- `agent`

Planning is deterministic. It preserves source authority and fallbacks rather than hiding decisions behind a readiness score.

For `read`, richer publisher surfaces such as `llms.txt` or Markdown can be preferred, while ordinary canonical HTML remains an honest low-priority fallback. A plain website is therefore not treated as unusable merely because it has no AI-specific metadata.

See [`docs/RESOLVER.md`](docs/RESOLVER.md).

## Discovery surfaces

The Resolver currently normalizes evidence from:

- canonical HTML and bounded ordinary web discovery;
- HTTP `Link` relations including `api-catalog`, `service-desc`, `service-doc`, Markdown `alternate` and ARWP `describedby`;
- `Accept: text/markdown` content-negotiation observation;
- valid ARWP profiles;
- `/agents.txt` and `/agents.json` as a community convention;
- RFC 9727 API Catalog;
- RFC 9728 root Protected Resource Metadata;
- A2A `/.well-known/agent-card.json`;
- Agent Skills `/.well-known/agent-skills/index.json`;
- experimental MCP AI Catalog / Server Card discovery.

Experimental/community sources remain explicitly labeled. Static metadata is never silently upgraded into runtime conformance.

## Source authority stays visible

| Authority | Example |
| --- | --- |
| `ietf-standard` | RFC 8288 / RFC 9727 / RFC 9728 |
| `upstream-standard` | A2A Agent Card |
| `upstream-convention` | Agent Skills discovery |
| `community-convention` | agents.txt / agents.json |
| `experimental-upstream` | current MCP Server Card / AI Catalog work |
| `project-profile` | ARWP publisher profile |
| `observed-web` | directly observed HTML/HTTP evidence |

Authority is not authorization or a security trust rank.

## Batch resolution

Inventory/research workflows can resolve several sites without site-specific wrappers:

```bash
node bin/arwp.mjs resolve-many targets.txt
node bin/arwp.mjs resolve-many targets.json --concurrency=4 --json
```

The library primitive is bounded to 100 targets and max concurrency 10. Same-origin work is serialized inside a batch and failures are isolated per site.

## Snapshots and drift

Create compact operational state:

```bash
node bin/arwp.mjs snapshot https://example.com --output=example.snapshot.json
```

Compare two observations:

```bash
node bin/arwp.mjs drift before.snapshot.json after.snapshot.json --json
```

Snapshots keep identity, discovery sources, normalized interfaces, conflicts and deterministic intent plans. They do **not** copy canonical datasets.

Drift distinguishes added/removed/changed sources, interfaces, conflicts, identity and routing-plan changes. Observation time alone is not drift.

## Resolver monitoring

A small monitor runtime builds on the same snapshots:

```bash
cp monitor/example.config.json arwp-resolver-monitor.json
npm run monitor:resolver
```

A monitor may fail only on selected operational classes:

- `identity`
- `source-removed`
- `interface-removed`
- `conflict-added`
- `plan-changed`
- `resolution-failed`
- `any`

[`templates/github-actions/resolver-monitor.yml`](templates/github-actions/resolver-monitor.yml) provides a scheduled workflow with cached operational snapshots and always-uploaded drift reports.

## Runtime evidence is opt-in

A normal `resolve` remains static/bounded discovery and does not open MCP sessions or perform cryptographic trust checks.

The Resolver MCP exposes explicit verification tools when deeper evidence is wanted.

### MCP runtime reconciliation

`verify_mcp_runtime`:

- sends real modern `server/discover` where supported;
- falls back to legacy `initialize` + `notifications/initialized` lifecycle;
- records negotiated/self-reported server metadata;
- reports `authorization-required` separately from runtime failure;
- blocks cross-origin runtime redirects;
- never invokes MCP tools;
- never sends credentials discovered from metadata automatically;
- surfaces static/runtime identity mismatches as conflicts.

### A2A signature verification

`verify_a2a_signatures`:

- validates the current v1 Agent Card required shape;
- treats unsigned cards as `unsigned`, not invalid;
- retrieves explicitly declared public HTTPS JWKS under the same network bounds;
- verifies RS256 and ES256 signatures by `kid`;
- distinguishes `signature-verified`, `signature-invalid`, `key-unavailable`, `unsupported-algorithm`, `invalid-card` and `not-assessed`.

Internal RSA/EC fixtures and tampering detection pass CI. Broad **cross-SDK interoperability is still an explicit external gate** because current A2A implementations have had canonicalization/default-field inconsistencies. A cryptographically valid signature also does not by itself make a signer trustworthy.

## Resolver as MCP

```bash
npm run resolver:mcp
```

Current tools:

- `resolve_site`
- `resolve_sites`
- `search_resolved_sites`
- `explain_site`
- `plan_site_interface`
- `verify_mcp_runtime`
- `verify_a2a_signatures`

The prepared Official MCP Registry artifact launches this Resolver and does not require an ARWP profile.

The older ARWP-profile gateway remains available separately:

```bash
ARWP_PROFILE=https://example.com/ai/site-profile.json npm run mcp:start
```

Remote Streamable HTTP profile gateway:

```bash
ARWP_PROFILE=https://example.com/ai/site-profile.json \
ARWP_HTTP_ALLOWED_HOSTS=mcp.example.com \
npm run mcp:http
```

See [`docs/GATEWAY.md`](docs/GATEWAY.md).

## Resolver-backed federation

The original directory federation remains available:

```bash
node bin/arwp.mjs directory
node bin/arwp.mjs federated-search "outside view"
```

The newer Resolver MCP `search_resolved_sites` starts from canonical site URLs. It does not require ARWP profiles.

Generic federation deliberately executes only resolved static JSON/JSONL/NDJSON retrieval indexes. It does not invent OpenAPI, MCP or A2A calls when operation semantics are unknown. Each result preserves source site, discovery source/authority and selected interface.

Public ARWP reference directory:

```text
https://dkharlanau.github.io/agent-ready-web-profile/directory.json
```

See [`docs/DIRECTORY.md`](docs/DIRECTORY.md).

## ARWP Profile

Publishers that want one explicit service map can expose:

```text
/ai/site-profile.json
```

Minimal profile:

```json
{
  "$schema": "https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/v0.1.0/schema/site-profile.schema.json",
  "profileVersion": "0.1",
  "id": "example-knowledge-site",
  "name": "Example Knowledge Site",
  "canonicalUrl": "https://example.com/",
  "description": "A reviewed public knowledge library.",
  "web": {
    "sitemap": "https://example.com/sitemap.xml",
    "llms": "https://example.com/llms.txt"
  }
}
```

Optional HTML advertisement:

```html
<link rel="describedby" type="application/json" href="/ai/site-profile.json">
```

This is an ARWP convention, not a registered `.well-known` location. See [`SPEC.md`](SPEC.md).

## Adopt ARWP from an existing website

```bash
node bin/arwp.mjs scan https://example.com
node bin/arwp.mjs init https://example.com
node bin/arwp.mjs validate ai/site-profile.json
node bin/arwp.mjs verify https://example.com/ai/site-profile.json
node bin/arwp.mjs health https://example.com
```

`scan` observes bounded public evidence. `init` generates a conservative profile and does not invent unverified MCP, WebMCP, Skills or A2A capabilities.

Reusable Action:

```yaml
- name: Validate Agent-Ready Web Profile
  uses: dkharlanau/agent-ready-web-profile@v0.1.0
  with:
    profile: ai/site-profile.json
```

[`templates/github-actions/propose-arwp-profile.yml`](templates/github-actions/propose-arwp-profile.yml) provides an opt-in profile-update PR workflow.

## Bounded hosted discovery service

The server runtime exposes only fixed operations:

```text
GET  /health
POST /scan
POST /resolve
POST /explain
POST /plan
```

It includes HTTPS-only target rules, DNS/private-network rejection, redirect revalidation, request/response bounds, explicit browser Origin allow-listing and shared rate limiting. It is not an arbitrary URL proxy.

```bash
ARWP_SCANNER_ALLOWED_ORIGINS=https://dkharlanau.github.io \
npm run scanner:http
```

A container artifact is in [`scanner-service/`](scanner-service/). Public hosting remains an external deployment gate.

## Real reference suite

Five owner-controlled public knowledge-site architectures publish ARWP profiles and are live-verified:

- Dzmitryi Kharlanau — SAP Knowledge;
- Brali Practical Knowledge Library;
- Cognitive Biases Knowledge Library;
- CBT Cards;
- Metkagram.

They are implementation/regression evidence, **not independent adoption evidence**.

## Benchmark before marketing claims

Synthetic regression:

```bash
npm run benchmark:resolver
```

Independent-corpus runner:

```bash
npm run benchmark:external -- --output=benchmark-results/external.json
```

The external runner has a strict reviewed fixture schema. Aggregate results count only `ownership=independent`. Ground truth is manually reviewed public evidence and cannot be generated from Resolver output itself.

Subset strategy comparisons are selection-only projections over the same observed resolution. Request/byte/time metrics are attributed only to the actual Resolver network run.

The frozen decision-quality corpus contains 20 independently owned documentation sites and deliberately includes ordinary HTML controls and path-scoped discovery that the Resolver may miss. It is a reviewed engineering sample, not a representative survey of the web. Expansion to a stratified 50-site corpus is gated on improving the current decision-quality baseline without changing ground truth to fit Resolver output.

No benchmark result is evidence of token savings, search ranking, adoption or answer quality. Raw negative results must remain visible. See [`docs/BENCHMARK.md`](docs/BENCHMARK.md).

## What ARWP deliberately does not replace

Do not create ARWP-native replacements for:

- RFC 8288 Web Linking;
- RFC 9727 API Catalog;
- RFC 9728 Protected Resource Metadata;
- A2A Agent Cards;
- MCP runtime discovery / Server Cards;
- Agent Skills;
- crawler AI-use preferences;
- payment/commerce protocols.

Project rule:

```text
UPSTREAM EXISTS
      ↓
resolve / verify / normalize it

UPSTREAM DOES NOT EXIST
      ↓
collect a concrete interoperability failure

ONLY THEN
      ↓
consider an ARWP-specific extension
```

## Security boundaries

- public HTTPS targets only;
- private/reserved/link-local targets rejected;
- redirect destinations revalidated;
- bounded requests and responses;
- no URL credentials;
- generic federation does not invent operations;
- metadata never grants permission;
- static reachability never proves runtime conformance;
- runtime probes are opt-in and do not invoke MCP tools;
- signature verification does not establish signer trust;
- conflicts remain visible instead of being hidden by a score.

## Development direction

The North Star is:

> **How many external sites can ARWP correctly resolve and route without site-specific integration code?**

Immediate work is increasingly external/evidence-driven:

1. improve Resolver decision quality against the frozen 20-site corpus without site-specific exceptions;
2. make ambiguity, rejected evidence and scope decisions explicit;
3. revalidate MCP and A2A behavior against independent implementations;
4. publish/install the 0.2.x Resolver package and MCP Registry artifact;
5. deploy the bounded public HTTPS discovery service;
6. add durable assertion and evidence-receipt workflows;
7. obtain independent downstream consumers before treating owner-controlled examples as adoption;
8. decide from evidence whether the ARWP Profile contract needs another version at all.

See [`ROADMAP.md`](ROADMAP.md).

## Repository map

- [`SPEC.md`](SPEC.md) — experimental ARWP profile contract.
- [`schema/site-profile.schema.json`](schema/site-profile.schema.json) — profile JSON Schema.
- [`bin/arwp.mjs`](bin/arwp.mjs) — CLI for profile, Resolver and operations.
- [`lib/scanner.mjs`](lib/scanner.mjs) — bounded website scanner.
- [`lib/resolver.mjs`](lib/resolver.mjs) — multi-standard resolver and planner.
- [`lib/resolver-core.mjs`](lib/resolver-core.mjs) — pure normalization and planning policy used by the network-facing resolver.
- [`lib/http-discovery.mjs`](lib/http-discovery.mjs) — RFC 8288 / Markdown HTTP discovery.
- [`lib/mcp-runtime.mjs`](lib/mcp-runtime.mjs) — opt-in MCP runtime reconciliation.
- [`lib/a2a-signature.mjs`](lib/a2a-signature.mjs) — bounded A2A signature verification.
- [`lib/resolver-snapshot.mjs`](lib/resolver-snapshot.mjs) — compact snapshots/drift.
- [`lib/resolver-batch.mjs`](lib/resolver-batch.mjs) — bounded multi-site resolution.
- [`lib/resolver-monitor.mjs`](lib/resolver-monitor.mjs) — operational drift monitoring.
- [`resolver/server.mjs`](resolver/server.mjs) — Resolver MCP server.
- [`scanner-service/`](scanner-service/) — bounded hosted scan/resolve service.
- [`gateway/`](gateway/) — generic ARWP-profile MCP gateway.
- [`router/`](router/) — profile and Resolver-backed federation.
- [`monitor/`](monitor/) — monitor runner/config schema.
- [`registry/`](registry/) — initial public ARWP Directory.
- [`benchmarks/`](benchmarks/) — synthetic and independent evidence tooling.
- [`docs/RESOLVER.md`](docs/RESOLVER.md) — Resolver model.
- [`docs/BENCHMARK.md`](docs/BENCHMARK.md) — benchmark rules.
- [`docs/README-R4.md`](docs/README-R4.md) — decision-quality and external-trust engineering notes.
- [`ROADMAP.md`](ROADMAP.md) — evidence-driven roadmap.

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
