# Resolver decision-quality status

Started: 2026-08-26

Integrated into: `main`

## Implemented

- froze the current 20-site independent benchmark as the initial dominance gate;
- documented resolver regret and decision-quality rules;
- documented protocol support/evidence boundaries;
- documented assertion, evidence receipt and future stratified-corpus directions;
- fixed A2A adaptation so a valid Agent Card contributes callable `supportedInterfaces[]` endpoints while keeping the Agent Card URL as provenance;
- added regression assertions for A2A callable endpoint planning;
- separated discovery normalization from planner policy in `lib/resolver-core.mjs`;
- stopped treating generic OpenAPI descriptions as search evidence;
- added deterministic eligibility-before-ranking policy tests;
- added Resolver-regret, live-capability-drift and ground-truth-review tooling;
- preserved the no-gain A2A path-scope experiment as a negative result instead of claiming an improvement.

## Next bounded implementation slice

1. add explicit `ambiguous` and `insufficient-evidence` planner outcomes;
2. preserve unstable or presigned URLs as evidence without selecting them as durable defaults;
3. improve target-scope modeling only when the frozen corpus shows a general rule with measurable gain;
4. revalidate MCP and A2A behavior against independent implementations;
5. rerun the same frozen corpus after each general policy change and publish both gains and regressions.

Package publication, MCP Registry publication, public Resolver hosting and independent downstream use remain external gates. Repository tests do not prove those outcomes.
