# R4 — generic OpenAPI search eligibility

Date: 2026-08-28

## Change

Generic OpenAPI/API-description evidence is no longer treated as a search interface. Search selection now requires explicit search/retrieval semantics already represented by the resolver adapters.

Ground truth and the reviewed 20-site corpus were not edited.

## Frozen-corpus result

| Strategy | Correct / 100 |
| --- | ---: |
| llms-aware | 89 |
| resolver-union | 86 |

Resolver-union mismatches: 14.
Over-selection: 5.
Discovery gaps: 7.
Selection gaps: 2.
Resolution failures: 0.
Resolver regret: 6.
Resolver uniquely correct: 0.

## Gate

This is an eligibility correction, not permission to make resolver-union the default strategy. The union remains experimental until it demonstrably reduces regret and matches or exceeds the simpler best strategy on unchanged reviewed evidence.

> External HTTP liveness can change between runs. Aggregate scores remain comparable only when the frozen corpus shape is intact; detailed URLs stay in workflow artifacts rather than this committed summary.
