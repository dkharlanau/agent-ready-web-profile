# ARWP Roadmap

This roadmap separates code that exists from external ecosystem steps that require hosting, registry acceptance or independent adopters.

Status vocabulary:

- **implemented** — code/docs/tests exist in this repository and are expected to pass CI;
- **prepared** — the submission/deployment artifact exists, but an external action has not been completed;
- **external** — success depends on a third-party registry, hosting environment or independent adopter;
- **evidence-gated** — deliberately blocked until real adoption shows the step is useful.

## P0 — Understand and adopt

| Initiative | Status | Evidence |
| --- | --- | --- |
| Value-first homepage | implemented | `docs/index.html` leads with the site-owner/agent problem rather than protocol terminology |
| Without ARWP / With ARWP explanation | implemented | Public homepage comparison flow |
| Five real reference examples | implemented | `registry/sites.json`, public reference cards, five deployed profiles |
| Interactive profile example | implemented | Reference cards update the canonical profile URL demo |
| Scanner onboarding UX | implemented | CLI scanner + public UI that generates commands |
| Generated `site-profile.json` download path | implemented | UI activates download when a hosted scanner endpoint is configured |
| GitHub Action validation path | implemented | released reusable Action + adopter docs |
| Automatic profile update PR | implemented | `templates/github-actions/propose-arwp-profile.yml` |

## P1 — Install, verify and connect

| Initiative | Status | Evidence / gate |
| --- | --- | --- |
| Package-ready CLI | implemented | `package.json`, `bin/arwp.mjs`, `npm pack/install` smoke test |
| `scan` / `init` | implemented | bounded evidence scanner and conservative generation |
| `health` capability report | implemented | observed/declared/verified/warning/failing/not-assessed states |
| Protocol artifact checks | implemented | Agent Skill, Registry metadata and Agent Card checks; runtime protocols stay `not-assessed` when appropriate |
| Local read-only MCP gateway | implemented | stdio gateway |
| Remote read-only MCP gateway | implemented | guarded Streamable HTTP runtime |
| Hosted scanner service code | implemented | fixed `/scan` service, CORS, bounds, rate limit, Dockerfile |
| Neutral profile badge | implemented | `docs/arwp-profile.svg`; availability only, not certification |
| Publish npm package | prepared / external | trusted-publishing workflow exists; npm account/package publisher configuration must succeed |
| Deploy public scanner endpoint | prepared / external | service/container exists; requires an HTTPS runtime and DNS/hosting configuration |
| Deploy public demo MCP endpoint | prepared / external | container/runtime exists; requires hosting and public hostname |

## P2 — Discover and federate

| Initiative | Status | Evidence / gate |
| --- | --- | --- |
| Public ARWP Directory | implemented | `registry/sites.json` + Pages `directory.json` |
| Directory JSON Schema | implemented | `registry/directory.schema.json` |
| Capability filtering | implemented | public UI + `arwp directory --capability=...` |
| Federated retrieval | implemented | `arwp federated-search` preserves site/profile/index source identity |
| Multi-profile MCP router | implemented | `router/server.mjs` |
| Protocol-specific checks | implemented | conservative artifact checks without fake runtime conformance |
| Official MCP Registry metadata | prepared | root `server.json` and matching npm `mcpName` |
| Official MCP Registry publication | prepared / external | npm package must be published first; gated GitHub OIDC workflow exists |
| Directory query service | evidence-gated | static JSON is sufficient until real consumers require server-side queries |

## P3 — Ecosystem adoption

| Initiative | Status | Evidence / gate |
| --- | --- | --- |
| Independent adopter kit | implemented | `docs/ADOPTION.md`, automation template, contribution criteria |
| Machine-readable directory/discovery contract | implemented | versioned directory JSON + schema |
| SchemaStore catalog entry | prepared | `ecosystem/schemastore-catalog-entry.json` |
| SchemaStore upstream inclusion | external / evidence-gated | submit after independent adoption justifies editor auto-discovery |
| First 3 external adopters | external | must be independent public sites outside the original five reference sites |
| Adoption evidence log | implemented structure | GitHub adoption issue template + concrete-failure decision rule |
| Curated ecosystem-list submissions | external / evidence-gated | only after independent adoption |
| Registered `.well-known` location or new link relation | evidence-gated | do not invent until current explicit URL + `/ai/site-profile.json` + `describedby` prove insufficient |

## Next release gate

A `0.2.0` release should require all of the following:

1. main CI green, including package, scanner service, directory, router, protocol and public-site tests;
2. release notes distinguish implemented code from external publication status;
3. npm package contents match the tested `npm pack` artifact;
4. `server.json` name/version remain aligned with package metadata;
5. the five reference profiles continue to pass scheduled live verification.

Independent adoption should drive the next profile-contract revision. New core fields should normally start from a concrete integration failure that cannot be represented by the existing ARWP profile or an upstream standard.
