# Benchmarks

ARWP benchmark work is evidence-oriented, not a readiness-score system.

- [`resolver-regression.mjs`](resolver-regression.mjs) — deterministic synthetic regression coverage; safe for CI, not real-world product evidence.
- [`external-runner.mjs`](external-runner.mjs) — live reviewed external-site benchmark; the raw report keeps bounded resolver diagnostics for engineering audit.
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

The sanitizer has deterministic regression coverage in `publication-report-test.mjs`, and the external benchmark workflow now produces both raw and sanitized JSON artifacts.

Do not present synthetic fixture accuracy, live selection percentages or federation query hits as evidence of token savings, latency improvements, search ranking, adoption or answer quality.
