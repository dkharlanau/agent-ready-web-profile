# Search loop — 2026-09-05

This note records material findings from the 2026-09-05 external research pass that changed ARWP code or product positioning.

## Material findings

### ARD v0.91

Agentic Resource Discovery is the closest upstream discovery architecture to ARWP. The reviewed v0.91 proposal uses canonical `/.well-known/ard.json`, `rel="ard"` and a JSON-LD description layer. The predecessor `/.well-known/ai-catalog.json` / `rel="ai-catalog"` remains compatibility evidence.

Impact on ARWP:
- Resolver now probes canonical `ard.json` first and falls back to predecessor ai-catalog only when needed.
- HTTP `rel=ard` is recognized.
- typed ARD artifact references are normalized conservatively.
- Observatory moved to r3 without rewriting r1/r2.
- dedicated ARWP-vs-ARD comparison and compatibility documentation were added.

### AgentReady / Ora

Closest adjacent readiness product family. Its readiness specification, broad scanner, scoring and real-agent journeys clarify ARWP's product boundary: interoperability resolution/provenance/conflicts/intent routing rather than one universal readiness score.

### Agent Ready (agent-ready.dev)

A strong adjacent validator/research model with a large empirical corpus. The key product lesson is the reproducible measurement loop and frozen/live datasets, not the 0-100 score.

Impact on ARWP:
- competitor landscape expanded;
- State of Agentic Web corpus becomes a stronger moat candidate;
- immutable competitor snapshots added.

### Vercel Agent Readability

Useful agent-readability guidance includes `llms.txt`, canonical/meta/JSON-LD, sitemaps, `sitemap.md`, `AGENTS.md`, Markdown mirrors/content negotiation and related developer surfaces.

Impact on ARWP:
- root coding `AGENTS.md` added;
- public `docs/AGENTS.md` added;
- public `docs/sitemap.md` added;
- these remain optional agent-readability surfaces, not Google ranking requirements.

### DNS-AID, Web Bot Auth, AIPREF, NLWeb and auth.md

These mechanisms solve distinct discovery, client identity, content-usage preference, conversational-interface and agent-registration concerns. They were added to the Protocol Observatory at their actual maturity and are not automatically ARWP requirements.

## Guardrail

Search results become implementation only when the upstream source and maturity are sufficiently clear. Draft/proposal work remains labeled as such. Historical snapshots preserve what ARWP previously published rather than being rewritten after every discovery.
