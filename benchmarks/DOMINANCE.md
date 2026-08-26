# Resolver dominance policy

R4 uses the current reviewed 20-site independent corpus as a frozen decision-quality gate.

## Baseline

| Strategy | Correct / 100 |
| --- | ---: |
| `llms-aware` | 89 |
| `resolver-union` | 81 |

Resolver-union currently has 19 mismatches:

- 10 over-selection;
- 6 discovery gaps;
- 3 selection gaps.

## Regret

A **resolver regret** is an intent decision where at least one simpler strategy is correct but `resolver-union` is incorrect.

Regret is more actionable than aggregate accuracy alone because a union resolver should not become less useful simply by observing more evidence.

Future reports should record:

- total resolver regrets;
- regret by intent;
- regret by simpler strategy;
- cases where Resolver is uniquely correct;
- over-selection / discovery-gap / selection-gap counts.

## Guardrails

A dominance improvement is valid only when:

1. reviewed accepted interfaces are unchanged unless new independent publisher evidence requires a separately reviewed fixture correction;
2. the rule is general and explainable, not keyed to a benchmark hostname;
3. raw negative results remain visible;
4. new abstention behavior is scored as a miss when a reviewed accepted interface exists;
5. source discovery and interface selection remain distinguishable in diagnostics.

The immediate engineering priority is to reduce over-selection before adding broad new discovery heuristics.
