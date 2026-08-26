# Project-reference resolver benchmark — 2026-08-26

Observed by GitHub Actions workflow `Reference-site resolver benchmark`, run `32973875472`, at commit `b4afed8e852e09a9924ed187120b5f2f6e96c8da`.

This run evaluates the five owner-controlled GitHub Pages reference sites with the same five planning intents and strategy projections used by the external resolver benchmark. The cohort uses `ownership=project-reference` and is excluded from the independent aggregate.

## Cohort

- `https://dkharlanau.github.io/`
- `https://brali-lifeos.github.io/`
- `https://cognitive-biases.github.io/`
- `https://cbt-cards.github.io/`
- `https://metkagram.github.io/`

All five sites resolved successfully: **5 / 5**, with no site-level resolution failures.

## Strategy result

| Strategy | Correct | Total | Accuracy |
| --- | ---: | ---: | ---: |
| `ordinary-web` | 7 | 25 | 28% |
| `llms-aware` | 12 | 25 | 48% |
| `agents-aware` | 7 | 25 | 28% |
| `protocol-native` | 7 | 25 | 28% |
| `arwp-profile-only` | 20 | 25 | 80% |
| `resolver-union` | **25** | **25** | **100%** |

## Per-site Resolver result

| Fixture | Resolver union | ARWP profile only |
| --- | ---: | ---: |
| `reference-dkharlanau` | 5 / 5 | 4 / 5 |
| `reference-brali` | 5 / 5 | 4 / 5 |
| `reference-cognitive-biases` | 5 / 5 | 4 / 5 |
| `reference-cbt-cards` | 5 / 5 | 4 / 5 |
| `reference-metkagram` | 5 / 5 | 4 / 5 |

## What the five profile-only misses mean

Every `arwp-profile-only` miss is the `read` intent.

For each site, the profile-only projection selected a structured publisher surface such as a catalog/feed rather than the reviewed `llms.txt` read surface. When ordinary observed-web evidence is restored in `resolver-union`, the Resolver selects `llms.txt` and all five read decisions become correct.

This is useful architectural evidence for the current design:

> **ARWP Profile is complementary publisher metadata, not a replacement for ordinary web discovery.**

The profile contributes high-value retrieval, structured-data and tool declarations; normal web discovery contributes the preferred readable surface. The union performs better than either source family alone on this reference cohort.

This observation should not be turned into a claim that ARWP Profile improves arbitrary external sites. The sites were deliberately built to publish ARWP-compatible surfaces.

## Artifact

GitHub Actions artifact:

- name: `arwp-reference-benchmark-32973875472`
- artifact ID: `9608688155`
- digest: `sha256:68623e1f59877359d74d7013b83f348bcc99e658118b17d1d254a18b835617cc`
- retention: 90 days

The artifact contains:

- `with-references.json` — the complete benchmark run with non-independent fixtures included while the primary external aggregate remains independent-only;
- `reference-sites.json` — the compact five-site reference-cohort report.

## Evidence boundary

These results are implementation/regression evidence only. They do **not** establish independent adoption, search ranking, AI recommendation/citation likelihood, answer quality, token savings, runtime MCP/A2A conformance, security trust or ecosystem standardization.

Their practical purpose is to detect whether the reference sites and Resolver continue to agree about the interfaces intentionally published by those sites.
