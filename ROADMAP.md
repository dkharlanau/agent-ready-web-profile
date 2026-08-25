# ARWP Roadmap

ARWP has moved beyond its first profile/specification build-out. The project now has two complementary layers:

1. **ARWP Profile** — optional publisher-maintained service-map metadata;
2. **ARWP Resolver** — the primary product direction: discover, normalize, verify and route the machine/agent interfaces a public website actually exposes.

> **ARWP should not win by becoming another universal agent manifest. It should become the interoperability resolver that tells software what a website actually exposes, where that evidence came from, and which interface is appropriate for the task.**

## North Star

> **How many external sites can ARWP correctly resolve and route without site-specific integration code?**

Supporting measures:

1. resolved independent sites;
2. correct-interface selection against manually reviewed ground truth;
3. discovery requests / bytes / duration for the real Resolver run;
4. real conflicts detected between independent discovery surfaces;
5. downstream integrations that actually consume Resolver output.

Owned reference sites, schema field count, GitHub stars and readiness scores are not North Star metrics.

## Status vocabulary

- **implemented** — code/docs/tests exist and are kept green in CI;
- **prepared** — deployment/publication artifacts exist but the external action has not completed;
- **external** — success depends on hosting, a registry or independent users/sites;
- **evidence-gated** — intentionally blocked until external evidence justifies the work.

---

# R0 — Prove utility outside the project

| Initiative | Status | Current gate |
| --- | --- | --- |
| Package-ready 0.2.x Resolver | implemented / prepared | npm trusted-publishing configuration + external publication |
| Prepared Official MCP Registry Resolver artifact | implemented / prepared | npm publication first, then Registry acceptance |
| Public bounded discovery service code | implemented / prepared | external HTTPS runtime + edge controls + Pages wiring |
| Synthetic resolver regression benchmark | implemented | remains engineering-only, never marketed as external evidence |
| External benchmark fixture schema + runner | implemented | first 10 reviewed independent fixtures created; pilot run in progress |
| 20–50-site independent benchmark | external / next | expand reviewed corpus after the pilot exposes fixture/resolver problems |
| 3 independent adopters | external | collect real use/friction rather than owner-controlled demos |
| Publish negative results | policy | misses, failures and cases where simpler discovery wins stay visible |

### R0 decision rule

If independent evidence does not show useful resolution/routing gains, reduce scope. Do not add ARWP fields merely to manufacture an advantage.

---

# R1 — Resolver core and evidence ladder

| Initiative | Status | Notes |
| --- | --- | --- |
| `arwp resolve URL` | implemented | evidence-backed normalized service map |
| `arwp explain URL` | implemented | human-readable interfaces/conflicts/plans |
| `arwp plan URL --intent=...` | implemented | deterministic `read/search/structured/tools/agent` routing |
| Canonical HTML read fallback | implemented | ordinary web remains a valid low-priority read interface |
| Public HTTPS / SSRF / redirect / size / timeout boundaries | implemented | shared bounded network primitives |
| ARWP profile adapter | implemented | optional resolver input, not a prerequisite |
| agents.txt / agents.json | implemented | community convention with explicit authority label |
| RFC 8288 HTTP Link discovery | implemented | `api-catalog`, `service-desc`, `service-doc`, Markdown alternate, ARWP `describedby` |
| Markdown content negotiation observation | implemented | `Accept: text/markdown` HEAD observation; not a universal requirement |
| RFC 9727 API Catalog | implemented | conventional and explicit Link discovery |
| RFC 9728 root protected-resource metadata | implemented | root-origin metadata only |
| A2A Agent Card | implemented | current v1 + legacy compatibility parsing |
| Agent Skills discovery index | implemented | artifact/digest metadata preserved |
| Experimental MCP AI Catalog / Server Cards | implemented | remains explicitly `experimental-upstream` |
| Source-authority model | implemented | upstream/project/community/observed evidence remains distinct |
| Static conflict engine | implemented | identity, agents.*, MCP endpoint/card conflicts |
| Hosted `/scan`, `/resolve`, `/explain`, `/plan` | implemented | fixed bounded routes; no arbitrary proxy |
| Resolver MCP | implemented | resolve, batch resolve, resolved federation, explain, plan and opt-in verification tools |
| MCP modern runtime `server/discover` | implemented | opt-in; no tool invocation |
| MCP legacy initialize lifecycle | implemented | initialize + session + initialized notification |
| MCP static/runtime reconciliation | implemented | self-reported runtime identity mismatch becomes conflict |
| A2A v1 shape validator | implemented | current required shape checked before signature work |
| A2A RS256 / ES256 verifier | implemented internally | bounded JWKS, unsigned/verified/invalid/unavailable states |
| A2A cross-SDK signed-card interoperability | external / next | must prove canonicalization against independent upstream signatures |
| RFC 9728 path-scoped protected resources | evidence-gated | implement only for a real resource-level use case |

### Evidence ladder

ARWP should continue to distinguish:

```text
declared-static
observed-web / verified-artifact
runtime-observed
signature-verified (when cryptographically proven)
conflict
not-assessed / unsupported
```

A successful runtime probe or signature does not by itself establish business/security trust.

---

# R2 — Operational Resolver

| Initiative | Status | Notes |
| --- | --- | --- |
| `arwp resolve-many` / `resolveMany` | implemented | max batch, bounded concurrency, same-origin serialization, isolated failures |
| Resolver MCP `resolve_sites` | implemented | bounded multi-site inventory |
| Compact resolver snapshots | implemented | no canonical datasets copied |
| `arwp snapshot` | implemented | versioned deterministic operational state |
| Machine-readable drift diff | implemented | identity/source/interface/conflict/plan changes |
| `arwp drift` | implemented | explicit drift exit state |
| Resolver monitor engine | implemented | baseline/stable/drift/failure states |
| Selective fail classes | implemented | identity/removal/conflict/plan/resolution policies |
| Monitor config schema/example | implemented | copyable operational contract |
| Scheduled GitHub Actions monitor template | implemented | cached snapshots + always-uploaded report |
| Existing ARWP-profile federation | implemented | original reference/use path retained |
| Resolver-backed federation from canonical URLs | implemented | ARWP profile no longer required |
| Safe static-index execution | implemented | generic federation only executes resolved JSON/JSONL/NDJSON retrieval indexes |
| Resolver MCP `search_resolved_sites` | implemented | preserves source/discovery/interface provenance |
| Advanced redirect/version drift classification | next | needs observed real-world drift evidence |
| Notification-oriented compact monitor summaries | next | add only after monitor use shows what is actionable |
| Public universal resolver registry | evidence-gated | a reviewed corpus is sufficient until external clients need registry semantics |

Generic federation must not invent OpenAPI, MCP or A2A operations when the semantic search/action contract is unknown.

---

# R3 — Evidence, benchmarking and governance

| Initiative | Status | Notes |
| --- | --- | --- |
| Resolver methodology | implemented | `docs/RESOLVER.md` |
| Benchmark evidence rules | implemented | `docs/BENCHMARK.md` |
| Strict benchmark fixture JSON Schema | implemented | independent/reference/example ownership is explicit |
| External benchmark runner | implemented | raw site/strategy/intent output; aggregate only independent fixtures |
| Network-metric attribution policy | implemented | request/byte/time claims only for actual Resolver run; subset strategies remain selection projections |
| First 10 independent fixtures | implemented as reviewed pilot corpus | deliberately includes ordinary HTML and path-scoped discovery misses |
| 20–50 independent fixtures | next | expand after reviewing first pilot results |
| Upstream status labeling | implemented | experimental/community inputs are not promoted to standards |
| Failure taxonomy through issues | implemented foundation | real interoperability failures should drive changes |
| Automated upstream compatibility watcher | next | detect material MCP/A2A/Skills/RFC changes |
| A2A cross-SDK crypto fixtures | next | required before broad interoperability claim |
| Public resolver change log separate from profile contract | next | useful once upstream-driven adapter changes accelerate |
| SchemaStore inclusion | evidence-gated | only after independent profile adoption justifies editor discovery |
| ARWP Profile v0.2 | evidence-gated | requires consumer failure not solvable through upstream metadata or extension |
| Registered ARWP `.well-known` URI | evidence-gated | do not create a discovery-path format war without demonstrated need |
| Naming/positioning review | next | continue leading with `ARWP Resolver`, not “readiness certification” |

---

# Product wedge

Initial evidence remains focused on:

- technical documentation;
- research/evidence libraries;
- public knowledge bases;
- open datasets;
- developer/product portals;
- professional knowledge sites.

Do not broaden into commerce, payments, checkout or transaction orchestration merely because adjacent agent-web formats contain those fields.

# What ARWP should not build

Do not create ARWP-native replacements for:

- OAuth Protected Resource Metadata;
- API Catalog;
- A2A Agent Cards;
- MCP runtime discovery / Server Cards;
- Agent Skills packages/discovery;
- crawler AI-use preference standards;
- payment protocols.

Prefer:

```text
UPSTREAM EXISTS
      ↓
resolve / verify / normalize it

UPSTREAM DOES NOT EXIST
      ↓
collect a concrete interoperability failure

ONLY THEN
      ↓
consider an ARWP extension or profile field
```

# Immediate execution order

1. keep main CI green after the operational/runtime/crypto expansion;
2. complete the first 10-site external pilot and publish raw negative/positive results;
3. fix systematic discovery gaps only after the baseline result is preserved;
4. rerun the same corpus to show before/after without changing ground truth;
5. expand the corpus to 20–50 independent sites;
6. complete #4 npm + MCP Registry publication;
7. complete #5 public HTTPS resolver deployment;
8. obtain three independent consumers/adopters in #6;
9. prove A2A signature interoperability against upstream/second-language signed cards;
10. decide from evidence whether ARWP Profile itself needs another version.

# Next release gate

Before a public 0.2.x toolchain release:

1. all resolver/monitor/federation/runtime/crypto tests are green;
2. npm pack/install smoke proves all shipped modules and the Resolver MCP entry point;
3. hosted service tests prove fixed routes, CORS/rate limits and no arbitrary proxy behavior;
4. synthetic benchmark remains reproducible and labeled synthetic;
5. the independent pilot benchmark is preserved with raw failures, not just a headline score;
6. current upstream protocol statuses are rechecked;
7. release notes distinguish implemented code from external hosting/registry/adoption claims.
