# Evidence receipts — design direction

An ARWP Evidence Receipt is a durable observation produced by a Resolver run. It is not a publisher manifest and does not become a new discovery standard.

## Minimal receipt

```json
{
  "receiptVersion": "0.1",
  "target": "https://example.com/",
  "observedAt": "2026-08-26T00:00:00Z",
  "resolverVersion": "0.2.0",
  "plans": {},
  "sources": [],
  "conflicts": [],
  "digests": {}
}
```

## Required properties

A receipt should make it possible to answer:

1. what target was observed;
2. with which Resolver/tool version;
3. what public evidence was resolved;
4. which interfaces were selected, rejected or ambiguous;
5. which conflicts were observed;
6. what immutable artifact/digest can be used to verify the published observation.

## Trust boundary

A receipt proves what a specific Resolver observation recorded. It does not prove that:

- the publisher endorses ARWP;
- a runtime is secure;
- an Agent Card signer is trustworthy;
- an MCP/A2A operation is authorized;
- a website will rank higher in search or AI systems.

Where practical, release/workflow provenance and artifact attestations can strengthen the integrity chain without changing this semantic boundary.
