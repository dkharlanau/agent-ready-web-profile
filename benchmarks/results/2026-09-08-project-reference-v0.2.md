# Project-reference ARWP loop benchmark — 2026-09-08

This snapshot records the 2026-09-08 cross-site Agent-Ready Web Profile maintenance loop across the five owner-controlled GitHub Pages reference sites:

- `https://brali-lifeos.github.io/`
- `https://metkagram.github.io/`
- `https://cognitive-biases.github.io/`
- `https://cbt-cards.github.io/`
- `https://dkharlanau.github.io/`

The cohort uses `ownership=project-reference`. It is regression and implementation evidence only and is excluded from independent adoption evidence.

## What changed in the loop

All five sites were aligned to the same reproducible ARWP validator implementation, pinned to commit `a60be6a057f6ffe07a85ed884e89c91d2d4d740f` (package version `0.2.0` at that commit), with current checkout actions in the ARWP validation workflows.

Site commits:

| Site | Commit | Change |
| --- | --- | --- |
| Brali | `1b68c22772dc54a1be1661530fb9c566679d4655` | Sync ARWP validator workflow |
| Metkagram | `0d25c675d2281fb6b011ee5fe4702901b1424785` | Sync ARWP validator workflow |
| Cognitive Biases | `7b83d05b396ec9a3aee1db50bcd83b97095f8117` | Sync ARWP validator workflow |
| CBT Cards | `45b9280971e9c027251e6f9f91ae77165a03bde3` | Sync ARWP validator workflow |
| Dzmitryi Kharlanau site | `62850c77ebde3aab95d7d0db126c2a2ef4b96e5f` | Sync ARWP validator workflow and schema pin |

The first refreshed reference run then exposed two Metkagram interface regressions instead of silently passing them:

1. `retrieval.search` selected the capability-routing document `/api/v1/discovery.json` instead of the canonical retrieval index `/api/v1/search-index.json`.
2. The ARWP profile declared a stale MCP source path even though the repository contains the local read-only stdio bridge under `public/connectors/metkagram-mcp.mjs`.

Metkagram remediation:

- `b573b81b81ff2be0edb02b3ac5a8605e60bfa3b1` — align retrieval and MCP declarations with the real published/repository surfaces.
- `baec6920cdc5095c9fc290c87b61c9df6c90cfce` — strengthen production ARWP smoke tests so `retrieval.search`, retrieval-index membership, discovery routing and the local MCP source path are locked as deployment contracts.

The corrected Metkagram Pages deployment and production release contract completed successfully before the final benchmark was run.

ARWP benchmark changes:

- `a478e6fb132f611506a10cf7dbbf169d2cad4de0` — refresh the five project-reference fixtures to `reviewedAt=2026-09-08`.
- `198c5371c4aab577532a4f1be26c1e59ec3674aa` — align Metkagram fixture ground truth with the verified local stdio MCP surface.
- `c7931daefbe911953f8ba2ff82229ee1d6c2f5f1` — add a machine-readable AI-search module-state matrix to the reference benchmark.

## Resolver benchmark

### Previous durable baseline — 2026-08-26

| Strategy | Correct | Total | Accuracy |
| --- | ---: | ---: | ---: |
| `ordinary-web` | 7 | 25 | 28% |
| `llms-aware` | 12 | 25 | 48% |
| `agents-aware` | 7 | 25 | 28% |
| `protocol-native` | 7 | 25 | 28% |
| `arwp-profile-only` | 20 | 25 | 80% |
| `resolver-union` | **25** | **25** | **100%** |

### Regression detection run — 2026-09-08

Run `34194004279` at commit `a478e6fb132f611506a10cf7dbbf169d2cad4de0` deliberately used the refreshed production fixtures before the Metkagram remediation.

| Strategy | Correct | Total | Accuracy |
| --- | ---: | ---: | ---: |
| `ordinary-web` | 7 | 25 | 28% |
| `llms-aware` | 12 | 25 | 48% |
| `agents-aware` | 7 | 25 | 28% |
| `protocol-native` | 7 | 25 | 28% |
| `arwp-profile-only` | 18 | 25 | 72% |
| `resolver-union` | **23** | **25** | **92%** |

The two resolver-union misses were both on Metkagram (`search` and `tools`). This run is retained as useful negative/regression evidence.

### Final remediation run — 2026-09-08

GitHub Actions workflow `Reference-site resolver benchmark`, run `34195009305`, at commit `c7931daefbe911953f8ba2ff82229ee1d6c2f5f1`.

All five sites resolved successfully: **5 / 5**, with no site-level resolution failures.

| Strategy | Correct | Total | Accuracy |
| --- | ---: | ---: | ---: |
| `ordinary-web` | 6 | 25 | 24% |
| `llms-aware` | 11 | 25 | 44% |
| `agents-aware` | 6 | 25 | 24% |
| `protocol-native` | 6 | 25 | 24% |
| `arwp-profile-only` | **20** | **25** | **80%** |
| `resolver-union` | **25** | **25** | **100%** |

Per-site final result:

| Fixture | Resolver union | ARWP profile only |
| --- | ---: | ---: |
| `reference-brali` | 5 / 5 | 4 / 5 |
| `reference-metkagram` | 5 / 5 | 4 / 5 |
| `reference-cognitive-biases` | 5 / 5 | 4 / 5 |
| `reference-cbt-cards` | 5 / 5 | 4 / 5 |
| `reference-dkharlanau` | 5 / 5 | 4 / 5 |

The five profile-only misses remain the `read` intent: profile-only selection prefers another structured publisher surface, while the union can use observed-web discovery to select the reviewed `llms.txt` surface. This continues to support the design boundary that ARWP publisher metadata complements ordinary web discovery rather than replacing it.

The weaker standalone observed-web strategy projections are lower than the 2026-08-26 snapshot and are intentionally preserved as a follow-up signal. They do not change the final resolver-union result and are not hidden or normalized away.

## AI-search module-state matrix

The final workflow also generated `reference-profile-matrix.json` by fetching each production site's `/ai/ai-search-profile.json`.

There are 105 declared module slots across the five profiles:

- active: **45**
- planned: **50**
- not applicable: **10**
- other: **0**

| Site | Active | Planned | N/A | P1 planned |
| --- | ---: | ---: | ---: | --- |
| Brali | 8 | 11 | 2 | `agentFetchLab`, `aiVisibility`, `evidenceReceipts`, `localization`, `softwareProvenance` |
| Metkagram | 7 | 11 | 3 | `agentFetchLab`, `aiVisibility`, `claimsRegistry`, `trustCenter` |
| Cognitive Biases | 9 | 10 | 2 | `claimsRegistry` |
| CBT Cards | 13 | 6 | 2 | `evidenceReceipts` |
| Dzmitryi Kharlanau site | 8 | 12 | 1 | `claimsRegistry`, `comparisonPages` |

These counts are descriptive inventory, not a maturity/readiness/ranking/trust/adoption/quality score. `planned` and `not-applicable` are legitimate states; the benchmark must not incentivize activating modules without real supporting surfaces.

## Artifact

GitHub Actions artifact:

- name: `arwp-reference-benchmark-34195009305`
- artifact ID: `10043578509`
- digest: `sha256:ef0aaa20ad7a2d57b8cf4aede4581065c91b32aecae3440ddbf0db2d40d092ad`
- retention until: `2026-12-07`

The artifact contains:

- `with-references.json` — complete benchmark run including non-independent fixtures while the primary external aggregate remains independent-only;
- `reference-sites.json` — compact five-site resolver report;
- `reference-profile-matrix.json` — per-site AI-search module-state inventory and P1 planned surfaces.

## Evidence boundary

This is owner-controlled implementation and regression evidence. It does **not** establish independent ARWP adoption, search-ranking improvement, AI recommendation or citation probability, answer quality, runtime MCP/A2A conformance, external trust, or ecosystem standardization.

The practical result is narrower and useful: the five reference sites are synchronized to the same validator implementation, their intended retrieval/structured/tool interfaces are regression-tested, a real semantic drift was detected and repaired, and the cohort now has a durable machine-readable benchmark for both interface resolution and profile-module state.
