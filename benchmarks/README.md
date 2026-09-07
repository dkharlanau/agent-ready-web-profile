# Benchmarks

ARWP benchmark work is evidence-oriented, not a readiness-score system.

- [`resolver-regression.mjs`](resolver-regression.mjs) — deterministic synthetic regression coverage; safe for CI, not real-world product evidence.
- [`external-runner.mjs`](external-runner.mjs) — live reviewed external-site benchmark; the raw report keeps bounded resolver diagnostics for engineering audit.
- [`selection-diagnostics.mjs`](selection-diagnostics.mjs) — turns resolver-union mismatches into explicit engineering buckets without changing ground truth: `discovery-gap`, `selection-gap`, `over-selection`, or `resolution-failure`. Its URL fields use the publication sanitizer and it omits free-form failure text.
- [`publication-report.mjs`](publication-report.mjs) — converts a raw external report into a durable per-intent publication view. It keeps reviewed ground truth, selections, classifications and bounded numeric metrics while dropping free-form runtime diagnostics, removing URL userinfo and redacting sensitive query parameter values.
- [`federation-runner.mjs`](federation-runner.mjs) — independent resolver-backed federation smoke corpus.
- [`corpus/`](corpus/) — reviewed benchmark ground truth. `ownership=independent` fixtures count toward external evidence; `ownership=project-reference` fixtures are owner-controlled implementation checks and remain separate.
- [`search-maturity/`](search-maturity/) — timestamped independent reference observations for the Search Maturity Benchmark. Observable patterns remain correlations unless stronger evidence exists.
- [`results/`](results/) — durable engineering observations committed only after the corresponding workflow has completed successfully.
- [`../docs/BENCHMARK.md`](../docs/BENCHMARK.md) — Resolver benchmark methodology, metrics, ground-truth and publication rules.
- [`../docs/SEARCH-MATURITY-BENCHMARK.md`](../docs/SEARCH-MATURITY-BENCHMARK.md) — reference-cohort methodology for observable Search/AI maturity patterns.
- [`../docs/REFERENCE-BENCHMARK.md`](../docs/REFERENCE-BENCHMARK.md) — separate benchmark cohort for the five owner-controlled GitHub Pages reference sites.

Generate a publication-safe external report from a raw Resolver benchmark result with:

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

The diagnostic report preserves the reviewed `accepted` values and the actual selection for every mismatch after URL sanitization. `missed-interface` is labeled a discovery gap, `wrong-interface` a selection/ranking gap, `false-positive` an over-selection gap, and a full resolver failure a resolution failure for all five scored intents. These labels are triage aids only; they never rewrite fixture evidence. The CLI also sanitizes URLs when given a raw engineering report directly, and it deliberately omits free-form Resolver failure text.

Both publication sanitization and mismatch diagnostics have deterministic regression coverage. The external benchmark workflow produces raw, sanitized and diagnostic JSON artifacts; diagnostics are generated from the sanitized publication view.

## Search Maturity reference cohort

The Search Maturity Benchmark asks a different question from the Resolver benchmark:

> Which observable, evidence-bearing characteristics repeatedly occur on pages currently visible for a relevant Search/AI intent, and which of those characteristics are missing from a target site?

Run the reviewed pilot with:

```bash
node benchmarks/search-maturity-test.mjs
node bin/arwp-search-maturity.mjs check \
  benchmarks/search-maturity/pilot-2026-09-07.json
node bin/arwp-search-maturity.mjs cohort \
  benchmarks/search-maturity/pilot-2026-09-07.json \
  --intent=ai-search-optimization
```

The benchmark keeps 16 dimensions separate instead of producing one magic score. Missing measurements are `unknown`, not zero. A numeric rank is invalid without explicit rank evidence. Publication date plus a retrieval observation is recorded as age-at-observation, not time-to-rank.

A repeated reference pattern is still observational evidence. It does not become a Google/Bing ranking factor and it does not authorize copying competitor content, design or link patterns. Accepted gaps must pass the normal Growth/Upgrade/Proof gates and later outcome measurement.

## Project-reference cohort

Five owner-controlled sites are part of the Resolver corpus with `ownership=project-reference`:

- `https://dkharlanau.github.io/`
- `https://brali-lifeos.github.io/`
- `https://cognitive-biases.github.io/`
- `https://cbt-cards.github.io/`
- `https://metkagram.github.io/`

Run them through the dedicated `.github/workflows/reference-benchmark.yml` workflow. It uses the same Resolver and strategy scoring as the external benchmark but produces a separate reference report and never adds these sites to the independent aggregate.

This cohort answers whether our own ARWP publication patterns resolve as intended. It is useful regression and implementation-quality evidence, not independent adoption evidence.

Do not present synthetic fixture accuracy, live selection percentages, reference-site results, diagnostic categories, federation query hits, Search Maturity cohort patterns or age-at-retrieval observations as evidence of token savings, latency improvements, search ranking, adoption or answer quality.
