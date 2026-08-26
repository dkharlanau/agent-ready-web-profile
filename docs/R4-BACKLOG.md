# R4 Backlog — Resolver Dominance & External Trust

This backlog complements `ROADMAP.md` and `docs/ITERATION-3.md`. Existing external gates remain in #4, #5 and #6.

## P0 — Resolver decision quality

### D1. Scope-aware abstention

- distinguish discovery evidence from evidence eligible for the current target scope;
- do not infer docs search from generic OpenAPI availability;
- preserve root-wide API catalogs as evidence while avoiding path-scoped over-selection;
- preserve temporary/signed interface URLs but mark them unstable for durable planning;
- represent `insufficient-evidence` / `ambiguous` explicitly;
- regression-test all policies without hostname-specific branches.

Exit: current 10 over-selection mismatches materially reduced without increasing total regret.

### D2. Path-scoped planning

- model target path scope explicitly;
- distinguish root, path and explicitly-linked evidence;
- fix extensionless documentation paths such as `/docs` when probing path-local discovery;
- keep fallback HTML available;
- add scope details to explanations and receipts.

Exit: path-scoped read/selection cases are deterministic and explainable.

### D3. Resolver regret metrics

- calculate cases where a simpler strategy is correct and union is wrong;
- calculate cases where union is uniquely correct;
- report by intent and strategy;
- publish before/after history on frozen corpus.

Exit: every ranking change can be evaluated without relying on one headline accuracy percentage.

## P0 — Protocol compatibility

### C1. MCP 2026-07-28 compatibility pass

- verify modern `server/discover` semantics;
- verify stateless lifecycle and routing metadata;
- isolate legacy initialize/session compatibility;
- exercise independent implementations;
- document supported protocol generations.

### C2. A2A 1.0.x interoperability

- route Agent Cards to callable `supportedInterfaces[]` endpoints;
- validate 1.0.x card shape against independent SDK output;
- exercise signature verification against independent signed cards;
- retain card URL as provenance, not callable endpoint;
- test tampering/canonicalization across SDKs.

### C3. Upstream watcher

- monitor material MCP/A2A/Agent Skills/RFC changes;
- open compatibility evidence rather than silently changing semantics;
- version the support matrix.

## P1 — Productization

### P1. `arwp assert`

Provide a deploy/CI contract such as:

```json
{
  "target": "https://example.com/docs/",
  "expect": {
    "read": true,
    "tools": { "protocol": "MCP" },
    "agent": false
  }
}
```

CI should fail on disappearance, wrong route or newly ambiguous evidence according to policy.

### P2. Evidence receipts

Generate compact durable receipts containing:

- target and observed timestamp;
- Resolver version;
- source evidence and authority;
- selected/rejected interface summary;
- conflicts/ambiguities;
- benchmark/assertion policy version;
- artifact/content digests.

### P3. Public inspector

Complete hosted Resolver deployment (#5), then show:

`target -> discovered evidence -> eligible evidence -> selected interface -> rejected alternatives -> conflicts`

No readiness score.

### P4. Distribution

Complete #4 only after current protocol-compatibility tests are green:

- npm 0.2.x;
- Official MCP Registry;
- real-client installation smoke;
- immutable matching GitHub release.

## P2 — External proof

### E1. 50-site stratified corpus

Expand only after the current 20-site dominance gate improves. Keep strata visible rather than mixing everything into one aggregate.

### E2. Independent consumers

Continue #6. A downstream client consuming Resolver output is more valuable than another owner-controlled profile example.

### E3. Real drift

Keep scheduled drift monitoring active and wait for an actual external structural change before adding more taxonomy.

### E4. Registry decision

Do not build a universal resolver registry until an external consumer has a concrete need for registry semantics.
