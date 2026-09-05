# ARD v0.91 compatibility in ARWP

Reviewed: 2026-09-05

ARWP treats Agentic Resource Discovery (ARD) as an upstream discovery architecture, not as a competing ARWP-native manifest.

## Current implemented scope

The Resolver currently supports a deliberately bounded subset of the reviewed ARD v0.91 proposal:

- probes the canonical `/.well-known/ard.json` manifest;
- recognizes HTTP `Link` discovery with `rel="ard"`;
- falls back to the predecessor `/.well-known/ai-catalog.json` when the canonical manifest is unavailable;
- accepts predecessor `rel="ai-catalog"` as compatibility discovery;
- preserves typed references to MCP Server Cards, A2A Agent Cards, Agent Skills, ARD registries, nested ARD catalogs and arbitrary typed artifacts;
- routes inline MCP Server Cards through the existing MCP metadata adapter;
- keeps A2A Agent Card URL references as metadata/evidence rather than treating the card URL as a callable endpoint;
- keeps ARD evidence out of planner ranking unless the underlying artifact has protocol semantics the existing planner already understands.

This scope is tested and should not be described as full ARD v0.91 conformance.

## Not implemented yet

- full JSON-LD base-context and namespace interpretation;
- extraction of ARD entries embedded as in-page JSON-LD;
- HTML `<link rel="ard">` parsing in the bounded homepage scanner (HTTP `Link` is supported separately);
- robots `Agentmap` parsing;
- DNS/SVCB ARD discovery;
- ARD registry `POST /search` federation/referrals;
- recursive nested-catalog traversal;
- trust-policy evaluation across ARD registries;
- universal mapping of arbitrary namespaced resource types to callable ARWP interfaces.

## Safety and decision-quality rules

1. Discovery metadata never grants authorization.
2. A resource description URL is not automatically callable.
3. Registry search must be explicit/opt-in before any future implementation; normal site resolution must remain bounded.
4. Nested catalogs must never produce unbounded recursive crawling.
5. Unsupported JSON-LD namespaces should be preserved as evidence rather than guessed.
6. Planner policy changes require frozen-corpus reruns and must not use hostname-specific exceptions.
7. ARD proposal changes create new Observatory snapshots rather than rewriting history.

## Primary sources

- https://agenticresourcediscovery.org/spec/
- https://github.com/ards-project/ard-spec
- https://developers.googleblog.com/announcing-the-agentic-resource-discovery-specification/

Canonical comparison:
https://dkharlanau.github.io/agent-ready-web-profile/compare/arwp-vs-ard.html
