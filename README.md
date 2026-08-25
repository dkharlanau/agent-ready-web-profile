# Agent-Ready Web Profile

[![ARWP validation](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/ci.yml)
[![Reference verification](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml/badge.svg)](https://github.com/dkharlanau/agent-ready-web-profile/actions/workflows/reference-verification.yml)

**Make your website understandable to AI agents.**

A website has navigation for people. An external AI client may still have to guess whether it should scrape HTML, read a dataset, use a retrieval index, call an API, load an Agent Skill, connect to MCP, or trust a particular provenance/review surface.

Agent-Ready Web Profile (ARWP) gives those existing interfaces one small machine-readable service map:

```text
https://example.com/ai/site-profile.json
```

ARWP does not make an AI smarter. **It removes guessing about how a website can be used.**

Public project site: https://dkharlanau.github.io/agent-ready-web-profile/

Profile contract: **experimental v0.1**. The first public GitHub/Marketplace release is [`v0.1.0`](https://github.com/dkharlanau/agent-ready-web-profile/releases/tag/v0.1.0). The current `main` toolchain is version **0.2.0** and adds scanner/init, health reporting, directory/federation and public-service deployment code. The npm package is prepared but must not be described as published until the registry publication succeeds.

## The problem in one picture

Without a discovery map:

```text
Agent
  → search
  → scrape HTML
  → guess URLs
  → maybe discover an API/dataset
  → maybe lose canonical identity/provenance
```

With ARWP:

```text
Agent
  → /ai/site-profile.json
  → see declared interfaces
  → choose the best available source
  → verify it
  → retrieve with source identity intact
```

ARWP is a thin discovery contract over existing interfaces. It does **not** replace SEO, `llms.txt`, Agent Skills, WebMCP, Model Context Protocol (MCP), A2A, OpenAPI, JSON Schema, Schema.org, Croissant, sitemaps, feeds or crawler controls.

## What changes after adding ARWP?

| User | Without ARWP | With ARWP |
| --- | --- | --- |
| Site owner | Every AI integration rediscovers the site differently | One stable machine entry point describes the real interfaces |
| AI agent | Starts from search/HTML and guesses | Can prefer structured data, retrieval or tools when declared |
| RAG system | Re-crawls and re-chunks by default | Can discover a publisher-maintained retrieval distribution |
| Developer | Searches docs/repos for API/schema/tool locations | Gets explicit OpenAPI/schema/MCP/Skill locations |
| Trusted knowledge consumer | Provenance/licensing/review may be separate | Trust surfaces are part of the same discovery map |

A small truthful profile is better than a large speculative one.

## Start with a website you already have

```bash
npm ci
node bin/arwp.mjs scan https://example.com
node bin/arwp.mjs init https://example.com
```

`scan` reports bounded public evidence it can actually observe. `init` writes a conservative valid draft to `ai/site-profile.json` by default.

The scanner looks for high-confidence evidence such as:

- canonical site metadata;
- `robots.txt` and sitemaps;
- `llms.txt`;
- explicitly linked RSS, Atom and JSON feeds;
- explicitly linked OpenAPI contracts;
- an existing `/ai/site-profile.json` when present.

It deliberately does **not** infer Agent Skills, WebMCP, MCP or A2A from marketing text or filenames alone.

See [`docs/SCANNER.md`](docs/SCANNER.md) for its security and evidence model.

## Validate, verify and inspect health

Schema validation:

```bash
node bin/arwp.mjs validate ai/site-profile.json
```

Live verification of every declared public URL:

```bash
node bin/arwp.mjs verify https://example.com/ai/site-profile.json
```

Evidence-oriented site health:

```bash
node bin/arwp.mjs health https://example.com
```

`health` separates states such as:

- observed;
- declared;
- verified;
- warning/failing;
- not declared;
- not assessed.

It does not collapse them into an opaque “AI readiness” score.

## Minimal profile

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
    "robots": "https://example.com/robots.txt",
    "llms": "https://example.com/llms.txt"
  }
}
```

Recommended location:

```text
/ai/site-profile.json
```

This is an ARWP convention, **not** a registered `.well-known` URI.

A publisher may additionally advertise it with:

```html
<link rel="describedby" type="application/json" href="/ai/site-profile.json">
```

See [`SPEC.md`](SPEC.md) for the normative experimental contract.

## Real reference suite

The project is tested against five public knowledge-site architectures that now publish ARWP profiles themselves:

- **Dzmitryi Kharlanau — SAP Knowledge** — data, retrieval, Agent Skills discovery and local MCP implementations;
- **Brali Practical Knowledge Library** — static API/OpenAPI, retrieval and local MCP;
- **Cognitive Biases Knowledge Library** — versioned data, RAG/provenance and local reference MCP;
- **CBT Cards** — reviewed retrieval, explicit safety/trust surfaces and a real Agent Skill;
- **Metkagram** — multilingual data, OpenAPI and retrieval without pretending a static MCP-shaped JSON file is a live server.

The reference fixtures live in [`examples/reference/`](examples/reference/). Their public URLs are probed by a scheduled workflow.

## ARWP Directory

The repository now includes a small machine-readable directory:

```text
registry/sites.json
```

Public Pages copy:

```text
https://dkharlanau.github.io/agent-ready-web-profile/directory.json
```

List sites by capability:

```bash
node bin/arwp.mjs directory
node bin/arwp.mjs directory --capability=retrieval
node bin/arwp.mjs directory --capability=mcp
```

Directory inclusion means only that a public ARWP profile can be discovered and inspected. It is not a ranking or endorsement.

See [`docs/DIRECTORY.md`](docs/DIRECTORY.md).

## Federated retrieval without centralizing the knowledge

Search declared retrieval indexes across directory sites:

```bash
node bin/arwp.mjs federated-search "outside view"
```

Or expose the same discovery/search layer as a local MCP server:

```bash
npm run router:mcp
```

The router preserves each result's source site, profile and retrieval index. It does not create a new canonical knowledge database.

## Generic read-only MCP gateway

A static GitHub Pages site can host canonical HTML, JSON/NDJSON, schemas, retrieval indexes and Agent Skills. It cannot execute a remote MCP server itself.

ARWP's generic gateway lets the knowledge stay static while a small runtime exposes bounded tools.

Local stdio:

```bash
ARWP_PROFILE=https://example.com/ai/site-profile.json npm run mcp:start
```

Remote Streamable HTTP:

```bash
ARWP_PROFILE=https://example.com/ai/site-profile.json \
ARWP_HTTP_ALLOWED_HOSTS=mcp.example.com \
npm run mcp:http
```

The gateway exposes:

- `get_site_profile`
- `list_declared_resources`
- `fetch_declared_resource`
- `search_retrieval`
- `get_record`

It accepts only profile-declared HTTPS resources, applies origin allow-listing, re-checks redirects and limits response size. The remote layer additionally validates Host, Origin and endpoint path.

Domain-specific MCP servers remain preferable when a knowledge model needs reviewed semantic operations, authorization, safety-aware routing or mutation.

See [`docs/GATEWAY.md`](docs/GATEWAY.md).

## Hosted scanner service

`scanner-service/` exposes the same bounded scanner semantics through only:

- `GET /health`
- `POST /scan`
- `OPTIONS /scan`

It is not a general URL proxy. Browser origins are explicit, response/request behavior is bounded, and repeated clients are rate-limited.

```bash
ARWP_SCANNER_ALLOWED_ORIGINS=https://dkharlanau.github.io \
npm run scanner:http
```

Container deployment is included in [`scanner-service/Dockerfile`](scanner-service/Dockerfile). The static project page stays in CLI mode until a real hosted endpoint is configured; it does not pretend GitHub Pages can run server-side scanning.

## Automatic adoption PRs

[`templates/github-actions/propose-arwp-profile.yml`](templates/github-actions/propose-arwp-profile.yml) can be copied into another GitHub repository. A manual run scans that repository's public site, regenerates the conservative profile, validates it and opens a pull request only when the profile changed.

See [`docs/ADOPTION.md`](docs/ADOPTION.md) for the adopter workflow and neutral “profile available” badge.

## Protocol-specific artifact checks

`lib/protocol-checks.mjs` adds conservative checks for inspectable protocol artifacts such as:

- Agent Skill `SKILL.md` frontmatter;
- declared MCP Registry metadata URLs;
- A2A Agent Card structure;
- explicit `not-assessed` results where real MCP/WebMCP runtime behavior would require a protocol session or browser runtime.

This intentionally does not upgrade URL reachability into protocol conformance.

## Reusable GitHub Action

An adopting repository can keep its profile valid in CI:

```yaml
- name: Validate Agent-Ready Web Profile
  uses: dkharlanau/agent-ready-web-profile@v0.1.0
  with:
    profile: ai/site-profile.json
```

Pin an exact release or commit when reproducibility matters.

## Capability groups

ARWP keeps different mechanisms separate:

1. **Web** — crawlable HTML, sitemaps, robots policy, feeds and optional `llms.txt`.
2. **Data** — stable records, schemas, APIs, releases and dataset metadata.
3. **Retrieval** — bounded search/RAG distributions with identity, citations and abstention where relevant.
4. **Agent Skills** — portable `SKILL.md` procedures; instructions, not a tool transport.
5. **Agent Web** — WebMCP capabilities exposed by actual browser pages.
6. **MCP** — real local or remote MCP servers. Static JSON is not a remote MCP server.
7. **Agent** — A2A discovery only when a real agent service exists.
8. **Identity and trust** — stable IDs, aliases, licensing, citation, provenance, review and security surfaces.

More capability groups do not automatically make a site better.

## Ecosystem publication status

Prepared in the repository:

- npm package shape and `npm pack` install smoke tests;
- npm trusted-publishing workflow gate;
- `mcpName` package ownership metadata;
- Official MCP Registry `server.json`;
- GitHub OIDC MCP Registry publication workflow;
- SchemaStore catalog-entry candidate;
- external adopter kit;
- versioned directory/discovery contract.

External acceptance/publication must not be claimed before it actually succeeds.

See [`ecosystem/README.md`](ecosystem/README.md).

## Design principle

**One source of truth, many representations.**

```text
                         CANONICAL KNOWLEDGE
                                 |
             +-------------------+-------------------+
             |                   |                   |
         HUMAN / SEO          DATA / RAG         AGENT LAYER
             |                   |                   |
         HTML pages            JSON/NDJSON          Agent Skills
         sitemap               JSON Schema          WebMCP
         JSON-LD               OpenAPI              MCP
         feeds                 releases             A2A (if real)
                               provenance
             \___________________|___________________/
                                 |
                         site-profile.json
```

ARWP describes these surfaces. It should not become another source of domain content.

## Boundaries

- **Not an SEO ranking mechanism.** Search still depends on ordinary content, crawlability and indexing.
- **Not a permission layer.** Metadata never grants crawler access, authorization or execution rights.
- **Not another MCP.** MCP is one capability ARWP may point to; the generic gateway is one ARWP consumer.
- **Not an Agent Card badge.** A2A is declared only for a real agent service.
- **Not a speculative catalog.** New core fields should normally come from concrete interoperability failures.
- **Not a single readiness score.** Evidence states remain inspectable instead of being hidden behind a number.

## Repository map

- [`SPEC.md`](SPEC.md) — normative experimental v0.1 specification.
- [`schema/site-profile.schema.json`](schema/site-profile.schema.json) — JSON Schema 2020-12 profile contract.
- [`bin/arwp.mjs`](bin/arwp.mjs) — CLI for scan/init/validate/verify/health/directory/federation.
- [`lib/scanner.mjs`](lib/scanner.mjs) — bounded evidence-based website discovery.
- [`lib/health.mjs`](lib/health.mjs) — evidence/declaration/verification health report.
- [`lib/protocol-checks.mjs`](lib/protocol-checks.mjs) — conservative protocol artifact checks.
- [`gateway/`](gateway/) — local and remote generic MCP gateway.
- [`scanner-service/`](scanner-service/) — bounded hosted scanner runtime.
- [`router/`](router/) — directory loader, federated search and multi-site MCP router.
- [`registry/`](registry/) — directory data and JSON Schema.
- [`server.json`](server.json) — prepared Official MCP Registry metadata.
- [`templates/`](templates/) — adopter automation templates.
- [`docs/`](docs/) — public site and deeper guides.
- [`ecosystem/`](ecosystem/) — external submission artifacts and publication gates.

## P0–P3 development status

**P0 — Understand & adopt:** value-first homepage, real examples, scanner/init UX, generated profile download path and CI adoption are implemented.

**P1 — Install & connect:** package-ready CLI, health report, local/remote MCP gateway, hosted-scanner runtime, badge and deployment examples are implemented. Actual npm/runtime publication remains an external operation.

**P2 — Discover & federate:** public directory, directory schema, capability filtering, federated search, multi-site MCP router, adopter PR automation and MCP Registry metadata are implemented/prepared.

**P3 — Ecosystem adoption:** SchemaStore submission artifact, independent-adopter kit and static discovery API contract are prepared. External acceptance and independent adoption are deliberately not fabricated.

## Principles

- Prefer existing standards over ARWP-specific fields.
- Declare only capabilities that actually exist.
- Keep canonical identity stable across HTML, data, retrieval and agent surfaces.
- Preserve provenance, review state, licensing and citations with retrieved records.
- Prefer read-only public integrations unless mutation is necessary.
- Make abstention and `no_match` explicit where unsupported answers would be harmful or misleading.
- Keep security and authorization at runtime; metadata is never permission.
- Treat experimental browser/runtime features as experimental.
- Version contracts before consumers depend on them.
- Prefer evidence from working implementations over speculative fields.

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
