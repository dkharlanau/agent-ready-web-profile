# Agent-Ready Web Profile

[![ARWP validation](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml)
[![Reference verification](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml)

**Resolve how a website can actually be used by agents.**

Modern websites may expose HTML, `llms.txt`, datasets, retrieval indexes, OpenAPI, Agent Skills, MCP, A2A, OAuth resource metadata, `agents.json` and other discovery surfaces. A client should not need site-specific code — or guess which manifest is authoritative — to understand them.

ARWP now has two complementary parts:

1. **ARWP Profile** — an experimental publisher-maintained service map at `/ai/site-profile.json`.
2. **ARWP Resolver** — an interoperability engine that reads ARWP plus existing upstream/community discovery, preserves evidence and conflicts, and selects an interface for a concrete intent.

The profile is useful. It is **not** required to use the resolver and it is not intended to replace upstream standards.

Public project site: https://dkharlanau.github.io/agent-ready-web-profile/

Profile contract: **experimental v0.1**. Released validator/Action: [`v0.1.0`](https://github.com/dkharlanau/agent-ready-web-profile/releases/tag/v0.1.0). The current `main` toolchain is version **0.2.0**; npm publication remains an external release gate and must not be described as complete until it succeeds.

## The problem

A site can legitimately publish several independent discovery surfaces:

```text
                         WEBSITE
                            |
       +--------------------+---------------------+
       |          |         |        |            |
   ARWP profile  agents.*  API     A2A Card   Agent Skills
                          Catalog
       |                    |                     |
       +------------- MCP / OAuth / web ----------+
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

The resolver does not ask every ecosystem to converge on one file. It answers:

> **What does this website actually expose, where did each claim come from, do the claims conflict, and which interface should a client use for this task?**

## Resolve a site

```bash
node bin/arwp.mjs resolve https://example.com
```

Machine-readable output:

```bash
node bin/arwp.mjs resolve https://example.com --json
```

The resolver currently normalizes evidence from:

- ordinary web discovery from the bounded scanner;
- valid ARWP profiles;
- `/agents.txt` and `/agents.json` as a community convention;
- RFC 9727 `/.well-known/api-catalog`;
- RFC 9728 root Protected Resource Metadata;
- A2A `/.well-known/agent-card.json`;
- Agent Skills `/.well-known/agent-skills/index.json`;
- experimental MCP AI Catalog / Server Card discovery.

Experimental/community sources remain explicitly labeled. Static metadata is never silently upgraded into runtime conformance.

See [`docs/RESOLVER.md`](docs/RESOLVER.md).

## Explain what was found

```bash
node bin/arwp.mjs explain https://example.com
```

Example shape:

```text
Example Knowledge Site
Canonical: https://example.com/
Evidence: 5/8 discovery sources resolved; 1 conflict(s).

Content: 2
Retrieval: 1
APIs: 2
Tools: 1

Conflicts:
- MCP declarations differ between agents.txt and agents.json.

Recommended interfaces:
- read: https://example.com/llms.txt
- search: https://example.com/search.json
- structured: https://example.com/openapi.json
- tools: https://example.com/mcp
```

## Plan for an intent

```bash
node bin/arwp.mjs plan https://example.com --intent=search
```

Supported intents:

- `read`
- `search`
- `structured`
- `tools`
- `agent`

The planner returns the selected interface, its evidence source/authority and fallbacks. It uses deterministic routing heuristics — not a hidden quality or readiness score.

## Source authority stays visible

Resolver output distinguishes the origin/status of a claim:

| Authority | Example |
| --- | --- |
| `ietf-standard` | RFC 9727 / RFC 9728 |
| `upstream-standard` | A2A Agent Card |
| `upstream-convention` | Agent Skills discovery |
| `community-convention` | agents.txt / agents.json |
| `experimental-upstream` | current MCP Server Card / AI Catalog work |
| `project-profile` | ARWP publisher profile |
| `observed-web` | directly observed ordinary web evidence |

Authority is not authorization. Security and permission decisions remain with the real protocol/runtime.

## ARWP Profile

Publishers that want one explicit service map can still expose:

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

A reusable validation Action is available:

```yaml
- name: Validate Agent-Ready Web Profile
  uses: dkharlanau/agent-ready-web-profile@v0.1.0
  with:
    profile: ai/site-profile.json
```

[`templates/github-actions/propose-arwp-profile.yml`](templates/github-actions/propose-arwp-profile.yml) provides an opt-in profile-update PR workflow.

## Bounded hosted discovery service

The same server runtime exposes only fixed expensive operations:

```text
GET  /health
POST /scan
POST /resolve
POST /explain
POST /plan
```

It includes HTTPS-only target rules, DNS/private-network rejection, redirect revalidation, response/request bounds, explicit browser Origin allow-listing and shared rate limiting. It is not an arbitrary URL proxy.

```bash
ARWP_SCANNER_ALLOWED_ORIGINS=https://dkharlanau.github.io \
npm run scanner:http
```

A container artifact is in [`scanner-service/`](scanner-service/). Public hosting remains an external deployment gate.

## Resolver as MCP

Agents can consume the resolver itself:

```bash
npm run resolver:mcp
```

Tools:

- `resolve_site`
- `explain_site`
- `plan_site_interface`

The existing ARWP profile gateway remains available separately for reading one profile's declared resources:

```bash
ARWP_PROFILE=https://example.com/ai/site-profile.json npm run mcp:start
```

Remote Streamable HTTP gateway:

```bash
ARWP_PROFILE=https://example.com/ai/site-profile.json \
ARWP_HTTP_ALLOWED_HOSTS=mcp.example.com \
npm run mcp:http
```

See [`docs/GATEWAY.md`](docs/GATEWAY.md).

## Directory and federation

The initial five-site ARWP Directory remains a reference/adoption registry:

```bash
node bin/arwp.mjs directory
node bin/arwp.mjs directory --capability=retrieval
node bin/arwp.mjs federated-search "outside view"
```

Public directory JSON:

```text
https://dkharlanau.github.io/agent-ready-web-profile/directory.json
```

The next federation step is resolver-backed: sites should eventually be resolvable even when they do not publish an ARWP profile but do expose usable upstream discovery.

See [`docs/DIRECTORY.md`](docs/DIRECTORY.md).

## Real reference suite

Five public knowledge-site architectures currently publish ARWP profiles and are live-verified:

- Dzmitryi Kharlanau — SAP Knowledge;
- Brali Practical Knowledge Library;
- Cognitive Biases Knowledge Library;
- CBT Cards;
- Metkagram.

They intentionally expose different combinations of data, retrieval, OpenAPI, Agent Skills, MCP and trust metadata. Owned references are implementation evidence, **not independent adoption evidence**.

## Benchmark before marketing claims

```bash
npm run benchmark:resolver
```

The current benchmark is synthetic deterministic regression coverage. It compares HTML-only, `llms.txt`, ARWP-only, agents-only, upstream-native and Resolver-union strategies over reviewed fixtures.

It explicitly does **not** prove token savings, latency savings, ranking, adoption or answer quality.

The next evidence milestone is a reproducible 20–50-site external corpus measuring:

- requests and bytes until a usable interface is identified;
- correct/missed interface selection;
- false-positive capabilities;
- conflicts detected;
- canonical identity/provenance preservation;
- fallbacks required.

Raw negative results must be published too. See [`docs/BENCHMARK.md`](docs/BENCHMARK.md).

## What ARWP deliberately does not replace

ARWP should resolve and preserve upstream semantics rather than reimplement them.

Do not create ARWP-native replacements for:

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
resolve / validate / normalize it

UPSTREAM DOES NOT EXIST
      ↓
collect a real interoperability failure

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
- metadata never grants permission;
- URL reachability never proves MCP/WebMCP/A2A runtime conformance;
- conflicts remain visible instead of being hidden by a score.

## Development direction

The North Star is:

> **How many external sites can ARWP correctly resolve and route without site-specific integration code?**

Current Iteration 2 priorities:

1. publish/install/deploy the 0.2.x resolver toolchain;
2. build the external utility benchmark corpus;
3. obtain three independent adopters;
4. reconcile static MCP evidence with live `server/discover` behavior;
5. verify A2A card signatures when present;
6. build resolver snapshots and drift/conflict monitoring;
7. use evidence to decide whether a new ARWP profile-contract version is needed at all.

See [`ROADMAP.md`](ROADMAP.md).

## Repository map

- [`SPEC.md`](SPEC.md) — experimental ARWP profile contract.
- [`schema/site-profile.schema.json`](schema/site-profile.schema.json) — profile JSON Schema.
- [`bin/arwp.mjs`](bin/arwp.mjs) — CLI.
- [`lib/scanner.mjs`](lib/scanner.mjs) — bounded website scanner.
- [`lib/resolver.mjs`](lib/resolver.mjs) — multi-standard resolver and planner.
- [`lib/resolver-adapters.mjs`](lib/resolver-adapters.mjs) — upstream/community adapters.
- [`lib/public-fetch.mjs`](lib/public-fetch.mjs) — bounded public-HTTPS fetch primitives.
- [`resolver/server.mjs`](resolver/server.mjs) — resolver MCP server.
- [`scanner-service/`](scanner-service/) — bounded hosted scan/resolve service.
- [`gateway/`](gateway/) — generic ARWP-profile MCP gateway.
- [`router/`](router/) — directory federation.
- [`registry/`](registry/) — initial public ARWP Directory.
- [`benchmarks/`](benchmarks/) — resolver regression/evidence work.
- [`docs/RESOLVER.md`](docs/RESOLVER.md) — resolver model.
- [`docs/BENCHMARK.md`](docs/BENCHMARK.md) — benchmark rules.
- [`ROADMAP.md`](ROADMAP.md) — evidence-driven next iteration.

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
