# Benchmark result history

Durable benchmark observations live here only after the corresponding workflow has completed successfully.

## R4 dominance gate

The frozen reviewed 20-site independent corpus is the first Iteration 3 gate.

Baseline:

- `llms-aware`: 89 / 100
- `resolver-union`: 81 / 100
- union mismatches: 10 over-selection, 6 discovery gaps, 3 selection gaps

Until Resolver union matches or exceeds the strongest simpler strategy without changing reviewed ground truth, new discovery breadth is lower priority than selection quality.

Every R4 decision-quality change should preserve a before/after observation against the same corpus and explain which mismatch class moved. Site-specific allow/deny rules are not acceptable benchmark fixes.

See [`../../docs/ITERATION-3.md`](../../docs/ITERATION-3.md) and [`2026-08-26-selection-diagnostics-v0.2.md`](2026-08-26-selection-diagnostics-v0.2.md).
