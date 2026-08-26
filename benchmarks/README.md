# Benchmarks

ARWP benchmark work is evidence-oriented, not a readiness-score system.

- [`resolver-regression.mjs`](resolver-regression.mjs) — deterministic synthetic regression coverage; safe for CI, not real-world product evidence.
- [`external-runner.mjs`](external-runner.mjs) — live reviewed external-site benchmark; the raw report keeps bounded resolver diagnostics for engineering audit.
- [`selection-diagnostics.mjs`](selection-diagnostics.mjs) — turns resolver-union mismatches into explicit engineering buckets without changing ground truth: `discovery-gap`, `selection-gap`, `over-selection`, or `resolution-failure`. Its URL fields use the publication sanitizer and it omits free-form failure text.
- [`publication-report.mjs`](publication-report.mjs) — converts a raw external report into a durable per-intent publication view. It keeps reviewed ground truth, selections, classifications and bounded numeric metrics while dropping free-form runtime diagnostics, removing URL userinfo and redacting sensitive query parameter values.
- [`federation-runner.mjs`](federation-runner.mjs) — independent resolver-backed federation smoke corpus.
- [`corpus/`](corpus/) — reviewed external-site ground truth. Resolver output is never allowed to define the accepted interfaces.
- [`results/`](results/) — durable engineering observations committed only after the corresponding workflow has completed successfully.
- [`../docs/BENCHMARK.md`](../docs/BENCHMARK.md) — methodology, metrics, ground-truth and publication rules.

Generate a publication-safe external report from a raw benchmark result with:

```bash
node benchmarks/publication-report.mjs \
  --input=benchmark-results/external.json \
  --output=benchmark-results/external-public.json
```

Generate an engineering diagnosis of the same reviewed mismatches with:

```bash
node benchmarks/selection-diagnostics.mjs \
  --input=benchmark-results/external-public.json \
  --output=benchmark-results/external-diagnostics.json
```

The diagnostic report preserves the reviewed `accepted` values and the actual selection for every mismatch after URL sanitization. `missed-interface` is labeled a discovery gap, `wrong-interface` a selection/ranking gap, `false-positive` an over-selection gap, and a full resolver failure a resolution failure for all five scored intents. These labels are triage aids only; they never rewrite fixture evidence. The CLI also sanitizes URLs when given a raw engineering report directly, and it deliberately omits free-form resolver failure text.

Both publication sanitization and mismatch diagnostics have deterministic regression coverage. The external benchmark workflow produces raw, sanitized and diagnostic JSON artifacts; diagnostics are generated from the sanitized publication view.

Do not present synthetic fixture accuracy, live selection percentages, diagnostic categories or federation query hits as evidence of token savings, latency improvements, search ranking, adoption or answer quality.
