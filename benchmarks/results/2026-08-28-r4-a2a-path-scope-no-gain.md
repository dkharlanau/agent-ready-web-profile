# R4 A2A path-scope experiment: no measured gain

Date: 2026-08-28

## Question

Would rejecting a root-discovered A2A Agent Card as the default `agent` route for a path-scoped target reduce the remaining Resolver over-selection without changing reviewed ground truth?

## Experiment

A general eligibility rule was added after ranking-independent discovery:

- keep root A2A evidence visible;
- for a path-scoped target, do not select that root A2A endpoint by default without target-scoped corroboration;
- root targets retained existing A2A behavior.

The rule passed deterministic policy/contract tests. The unchanged 20-site independent corpus was then resolved live with the existing external runner. No ground-truth record was edited.

## Frozen-corpus result

Coverage: **20 / 20 sites resolved**.

| Strategy | Correct / 100 |
| --- | ---: |
| ordinary-web | 74 |
| llms-aware | **89** |
| agents-aware | 71 |
| protocol-native | 71 |
| arwp-profile-only | 71 |
| resolver-union | **86** |

Resolver-union diagnostics remained:

- incorrect: **14**;
- discovery gaps: **7**;
- over-selection: **5**;
- selection gaps: **2**;
- Resolver regret: **6**;
- Resolver uniquely correct: **0**.

This is unchanged from the preceding reviewed R4 state.

## Why the hypothesis did not address the measured regret

The four A2A false-positive cases that motivated the hypothesis (`fastmcp-docs`, `langchain-docs`, `perplexity-docs`, `pinecone-docs`) are frozen-corpus **root targets**, not path-scoped targets. A path-scope rule therefore cannot correct those decisions.

The experiment exposed a mismatch between a plausible architectural concern and the actual measured error shape. Green policy tests were insufficient evidence of benchmark value.

## Decision

**Do not adopt this A2A path-scope rule as an R4 improvement.**

The experimental rule and its temporary live-corpus CI step were removed after measurement. R4 remains at the measured `resolver-union` **86 / 100**, below `llms-aware` **89 / 100**, with regret **6** and uniquely-correct **0**.

Next work must start from the remaining root-target regret evidence or completed human ground-truth re-review, not from additional scope heuristics that do not match the error cases.
