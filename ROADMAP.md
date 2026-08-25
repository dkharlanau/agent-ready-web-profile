# ARWP Roadmap

ARWP has completed its first build-out: profile contract, validation, scanning, health reporting, public examples, directory/federation and generic MCP gateways exist.

The next iteration changes the center of gravity.

> **ARWP should not win by becoming another universal agent manifest. It should become the interoperability resolver that tells software what a website actually exposes, where that evidence came from, and which interface is appropriate for the task.**

## North Star

The primary measure is no longer “how many sites publish ARWP?”

The North Star is:

> **How many external sites can ARWP correctly resolve and route without site-specific integration code?**

Supporting metrics:

1. resolved external sites;
2. correct-interface selection rate for a reviewed intent;
3. discovery requests / bytes until a usable interface is identified;
4. conflicts detected between independent discovery sources;
5. downstream integrations that actually consume resolver output.

Schema field count, readiness scores and owned reference sites are not North Star metrics.

## Status vocabulary

- **implemented** — code/docs/tests exist in this repository and pass CI;
- **prepared** — implementation/deployment/submission artifacts exist, but an external action has not completed;
- **external** — success depends on hosting, a registry, or an independent adopter;
- **evidence-gated** — deliberately blocked until a real interoperability failure or benchmark result justifies it.

---

# Iteration 2 — Resolver utility

## R0 — Prove the project is useful

| Initiative | Status | Why it matters | Definition of done |
| --- | --- | --- | --- |
| Publish installable 0.2.x package | prepared / external | Users must be able to use the tool without cloning the repository | `npx agent-ready-web-profile ...` works from the public registry |
| Public bounded discovery service | prepared / external | Removes local installation from onboarding | public HTTPS `/scan`, `/resolve`, `/explain`, `/plan` deployment |
| Public demo resolver MCP | prepared / external | Proves agents can use the resolver directly | hosted or documented installable MCP artifact consumed by an external client |
| 3 independent adopters | external | Separates project usefulness from owner-controlled examples | 3 sites outside the original reference suite publish/use discovery surfaces and report friction |
| Synthetic resolver regression benchmark | implemented | Prevents intent-routing coverage regressions | `npm run benchmark:resolver` stays deterministic and explicit about its limits |
| External utility benchmark | external / next | Tests the actual product thesis | 20–50 reviewed public sites, raw results and reproducible runner |
| Publish negative results too | evidence-gated policy | Prevents benchmark-as-marketing | cases where Resolver is slower/worse remain visible in raw results |

### R0 decision gate

Do not add a new ARWP core field to manufacture an advantage if the external benchmark does not show resolver utility. Reduce scope instead.

---

## R1 — Resolver core

| Initiative | Status | Notes |
| --- | --- | --- |
| `arwp resolve URL` | implemented | normalized evidence-backed service map |
| `arwp explain URL` | implemented | human-readable explanation of discovered interfaces and conflicts |
| `arwp plan URL --intent=...` | implemented | deterministic routing for `read`, `search`, `structured`, `tools`, `agent` |
| Public-HTTPS SSRF boundaries | implemented | DNS validation, reserved/private IP rejection, redirect revalidation, time/size bounds |
| ARWP profile adapter | implemented | ARWP becomes one resolver input rather than the only possible source |
| agents.txt / agents.json adapter | implemented | community convention, explicitly not treated as ratified standard |
| RFC 9727 API Catalog adapter | implemented | native IETF discovery is preserved, not duplicated |
| RFC 9728 root protected-resource adapter | implemented | root-origin OAuth resource metadata |
| A2A Agent Card adapter | implemented | reads v1.0 `supportedInterfaces` and legacy v0.3 shape |
| Agent Skills discovery-index adapter | implemented | preserves skill artifact/digest metadata when available |
| Experimental MCP AI Catalog / Server Card adapter | implemented | explicitly marked experimental-upstream |
| Source authority model | implemented | `ietf-standard`, `upstream-standard`, `upstream-convention`, `community-convention`, `experimental-upstream`, `project-profile`, observed web |
| Narrow conflict engine | implemented | identity, agents.txt/json capability mismatches, MCP endpoint/card mismatch |
| Hosted `/resolve`, `/explain`, `/plan` routes | implemented | same bounded runtime as scanner; no arbitrary proxy route |
| Resolver MCP server | implemented | `resolve_site`, `explain_site`, `plan_site_interface` |
| MCP live `server/discover` reconciliation | next | verify static MCP evidence against runtime without treating static metadata as authoritative |
| A2A Agent Card signature verification | next | verify JWS when present; do not make unsigned cards invalid by default |
| RFC 9728 path-scoped resources | evidence-gated | add only when a concrete protected-resource use case requires non-root resource identifiers |
| Link-header discovery | next | use RFC 8288 `api-catalog`, `describedby`, alternate surfaces where directly observable |
| Content negotiation observation | next | record `Accept: text/markdown` availability without turning it into a universal requirement |

### Resolver principle

If an upstream protocol has discovery metadata, parse and preserve it. Do not copy its semantics into new ARWP core fields unless a concrete interoperability gap cannot be represented otherwise.

---

## R2 — From one site to a resolvable web

| Initiative | Status | Notes |
| --- | --- | --- |
| ARWP-owned profile directory | implemented | remains useful as adoption/reference registry |
| Federated retrieval over ARWP sites | implemented | preserves source site/profile/index identity |
| Federated MCP router | implemented | current directory-backed multi-site search |
| Resolver-aware corpus | next | corpus may include sites with no ARWP profile if upstream/community discovery is sufficient |
| Resolved-site snapshots | next | persist public normalized snapshots with observation timestamp and source URLs |
| Drift diff | next | show added/removed/changed capabilities between resolver runs |
| Conflict monitoring | next | alert on endpoint/identity changes, not just HTTP 404 drift |
| `resolve_many` batch API | next | bounded batch resolution for research/inventory, with concurrency and domain limits |
| Resolver-backed federation | next | search/route across resolved sites, not only sites that published an ARWP profile |
| Compatibility export to agents.json | next / guarded | only map semantics that are representable; report lossy fields explicitly |
| Compatibility export to ARWP profile | next / guarded | generate a conservative publisher draft from resolved evidence, never silently promote unverified runtime claims |

The existing ARWP Directory should not be mutated into a universal Internet registry before there is external demand. A separate reviewed resolver corpus is preferable for experimentation.

---

## R3 — Evidence, maintenance and governance

| Initiative | Status | Notes |
| --- | --- | --- |
| Resolver methodology documentation | implemented | `docs/RESOLVER.md` |
| Benchmark evidence rules | implemented | `docs/BENCHMARK.md` |
| Upstream-status labeling | implemented | experimental/community sources stay labeled honestly |
| Automated upstream watcher | next | detect material MCP/A2A/Agent Skills/agents.txt/RFC-adapter drift |
| Real-site conformance fixtures | next | 20–50 reviewed snapshots across docs/research/open-data/technical portals |
| Failure taxonomy | next | false positive, missed discovery, identity conflict, stale declaration, runtime mismatch, unsupported mapping |
| Public resolver changelog | next | record upstream behavior changes separately from ARWP profile-contract changes |
| SchemaStore submission | evidence-gated | editor discovery is valuable only after independent profile adoption |
| New ARWP profile version | evidence-gated | requires real consumer failure not solvable through an upstream standard or extension |
| Registered ARWP `.well-known` URI | evidence-gated | do not create a format war around discovery paths without demonstrated need |
| Naming / positioning review | next | assess collision with other “AgentReady” projects; preserve `ARWP` identity while leading with “resolver” rather than “readiness standard” |

---

# Product wedge

The first resolver corpus should deliberately focus on sites where ARWP's existing architecture is strongest:

- technical documentation;
- research and evidence libraries;
- public knowledge bases;
- open datasets;
- product/developer portals;
- professional knowledge sites.

Do not broaden into commerce/payments/checkout orchestration merely because another agent-web specification contains those fields. ARWP can observe/link those ecosystems later if a resolver use case requires them.

# What ARWP should not build next

Do not create ARWP-native replacements for:

- OAuth Protected Resource Metadata;
- API Catalog;
- A2A Agent Cards;
- MCP Server Cards / runtime discovery;
- Agent Skills packages/discovery;
- crawler AI-use preference standards;
- payment protocols.

Prefer:

```text
UPSTREAM EXISTS
      ↓
resolve / validate / normalize it

UPSTREAM DOES NOT EXIST
      ↓
collect a real interoperability failure

ONLY THEN
      ↓
consider an ARWP-specific extension or profile field
```

# Immediate execution order

1. keep main CI green for resolver + package + hosted routes;
2. update public product page to lead with Resolver value, not “new standard” framing;
3. complete issue #4: npm/GitHub/MCP distribution gates;
4. complete issue #5: deploy the bounded discovery service and wire the live project UI;
5. create a reviewed external benchmark corpus and runner;
6. recruit three independent sites and record adoption friction in issue #6;
7. add MCP runtime reconciliation and A2A signature verification;
8. build resolved-site snapshots/drift monitoring only after the public resolver is being used;
9. use benchmark/adopter evidence to decide whether an ARWP profile v0.2 contract is needed at all.

# Release gate

Before the next public toolchain release:

1. resolver tests are green;
2. packed npm artifact contains resolver modules/docs/MCP server;
3. hosted service tests prove fixed routes, rate limiting, CORS and no arbitrary proxy behavior;
4. synthetic benchmark is reproducible and labeled as synthetic;
5. upstream statuses are current at release time;
6. release notes distinguish implemented code from external evidence/adoption claims.
