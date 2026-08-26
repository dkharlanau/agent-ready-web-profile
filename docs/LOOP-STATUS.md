# R4 loop status

Started: 2026-08-26

Branch: `r4-resolver-dominance`

## Completed in loop 1

- froze the current 20-site independent benchmark as the initial dominance gate;
- documented resolver regret and decision-quality rules;
- documented protocol support/evidence boundaries;
- documented assertion, evidence receipt and future stratified-corpus directions;
- fixed A2A adaptation so a valid Agent Card contributes callable `supportedInterfaces[]` endpoints while keeping the Agent Card URL as provenance;
- added regression assertions for A2A callable endpoint planning.

## Next implementation slice

1. eligibility-before-ranking in `planResolvedSite`;
2. remove generic OpenAPI-as-search inference;
3. add scope-aware handling of root-wide API Catalog evidence on path-scoped targets;
4. reject unstable/presigned URLs as default durable plan selections while preserving them as evidence;
5. add explicit planner outcome/confidence semantics;
6. rerun the same external corpus and record before/after mismatch movement.
