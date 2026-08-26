# External resolver benchmark — sanitized per-intent publication report

Observed on 2026-08-26 from GitHub Actions run `32917475674` at commit `ea1fb0d8dac61020b4f74b101ff318cf44bff09d`.

The workflow completed the reviewed 20-site external corpus, generated the raw engineering report, passed the publication-sanitizer regression test, generated a sanitized publication view, and then completed the independent resolver-backed federation corpus.

## External corpus result

- Independent sites: 20
- Resolved: 20
- Failed: 0
- Resolution coverage: 100%
- `ordinary-web`: 74 / 100
- `llms-aware`: 89 / 100
- `agents-aware`: 71 / 100
- `protocol-native`: 63 / 100
- `arwp-profile-only`: 71 / 100
- `resolver-union`: 81 / 100

These are interface-selection results against the reviewed corpus. They are not adoption, answer-quality, latency, token-saving, or search-ranking claims.

## Durable publication artifact

The sanitized per-intent JSON is committed as [`2026-08-26-external-resolver-v0.2-public.json.gz`](2026-08-26-external-resolver-v0.2-public.json.gz). It is gzip-compressed only to keep the repository snapshot compact.

```bash
gzip -dc benchmarks/results/2026-08-26-external-resolver-v0.2-public.json.gz > /tmp/arwp-external-public.json
```

Integrity:

- uncompressed sanitized JSON SHA-256: `1300310d924ed3bdf1d103ad470a50cb259ddd0c06db0aa6b7a14d4aabfee0b7`
- deterministic gzip (`gzip -n -9`) SHA-256: `68675dc10a1985544d721531727ea2b3093c213de432fdb148b3819bac203c44`
- GitHub Actions artifact: `arwp-external-benchmark-32917475674`, artifact ID `9588692437`
- GitHub Actions artifact digest: `sha256:02b8beb311054f71aa813be4c6787787d7cd957f7731df455c2c8512cac0691b`

The publication view keeps reviewed ground truth, per-intent selections, classifications and bounded allowlisted metrics. It omits resolver source diagnostics and free-form runtime errors, removes URL userinfo/fragments, and redacts sensitive query-parameter values. The raw engineering artifact remains available through the workflow retention window but is not treated as the publication surface.

## Federation check from the same run

The independent four-site federation corpus completed 4 / 4 expected JSON Feed interface executions, with query hits on all four sites. Hit counts are smoke-test evidence only, not answer-quality measurements.
