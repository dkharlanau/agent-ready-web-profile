# Iteration 2 — ARWP Resolver

## Product thesis

ARWP should not compete as another universal “agent-ready manifest.”

Its stronger role is an interoperability resolver:

> Given a public website, discover the useful machine/agent interfaces it actually exposes, preserve where every claim came from, detect contradictions, and choose an interface for a concrete task.

An ARWP profile remains a useful publisher-maintained input. It is not required for resolution and it does not replace protocol-native discovery.

## Product wedge

Focus the initial external corpus on:

- documentation;
- research/evidence libraries;
- public knowledge bases;
- open datasets;
- developer/product portals;
- professional knowledge sites.

Do not expand into payment/checkout/commerce semantics merely because other agent-web manifests include them.

## North Star

**External sites correctly resolved and routed without site-specific integration code.**

Supporting metrics:

- correct-interface selection;
- requests / bytes required to discover a usable interface;
- conflicts detected;
- canonical identity/provenance retained;
- downstream integrations consuming resolver output.

## Implemented baseline

- `arwp resolve`
- `arwp explain`
- `arwp plan`
- ARWP, agents.txt/json, RFC 9727, RFC 9728, A2A, Agent Skills and experimental MCP-card adapters
- source-authority model
- bounded network layer
- conflict detection
- hosted `/resolve`, `/explain`, `/plan`
- Resolver MCP server
- synthetic regression benchmark
- external benchmark methodology/corpus format

## Immediate gates

1. publish/install the 0.2.x toolchain;
2. deploy the bounded public discovery service;
3. build a reviewed 20–50-site external corpus;
4. obtain three independent adopters;
5. reconcile MCP static metadata with live `server/discover`;
6. verify signed A2A cards when present;
7. add resolver snapshots, drift/conflict monitoring and resolver-backed federation;
8. only then decide whether the ARWP profile contract itself needs another revision.

## Field rule

If an upstream protocol already has the metadata, resolve it.

If it does not, first collect a concrete interoperability failure.

Only add an ARWP-specific field when the failure cannot be represented by an upstream standard, an existing ARWP field or a namespaced extension.
