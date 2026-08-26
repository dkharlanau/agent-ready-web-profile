# Protocol support matrix

This matrix records what ARWP claims to understand. It is intentionally stricter than a feature checklist.

| Surface | Authority used by ARWP | Current implementation | External proof still required |
| --- | --- | --- | --- |
| RFC 8288 Web Linking | IETF standard | discovery/normalization | continued real-site regression |
| RFC 9727 API Catalog | IETF standard | discovery/normalization | scope-aware planning on path targets |
| RFC 9728 Protected Resource Metadata | IETF standard | root-resource metadata | path-scoped resource use case before expansion |
| MCP 2026-07-28 | upstream standard/current generation | `server/discover` runtime probe foundation | independent implementation matrix + modern lifecycle/routing review |
| legacy MCP initialize lifecycle | upstream legacy compatibility | initialize + initialized fallback | keep isolated from modern behavior |
| A2A 1.0.x Agent Card | upstream standard | shape validation + discovery | independent SDK/TCK card corpus |
| A2A signatures | upstream standard feature | RS256/ES256 internal verification | independent signed-card/canonicalization proof |
| Agent Skills discovery | upstream convention / evolving | index adapter | keep status conservative until upstream discovery convention stabilizes |
| agents.txt / agents.json | community convention | adapter | no standards claim |
| MCP AI Catalog / Server Card work | experimental upstream | adapter + runtime reconciliation | track upstream status before authority promotion |
| ARWP Profile 0.1 | project profile | optional adapter | independent adoption before contract expansion |

## Claim rule

`implemented` means ARWP has code and tests for a behavior. It does not mean broad interoperability has been proven.

A protocol moves from internal support to externally supported interoperability only when independent implementation evidence is recorded and reproducible.
