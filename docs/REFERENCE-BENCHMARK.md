# ARWP Project-Reference Benchmark

ARWP keeps owner-controlled implementation sites in a separate benchmark cohort.

These sites are useful because they exercise the complete publication pattern that ARWP is designed to resolve: ordinary web discovery, `llms.txt`, ARWP Profile, structured data, retrieval surfaces, OpenAPI, Agent Skills, MCP declarations and trust metadata.

They are **not independent adoption evidence**. They must never be merged into the headline external benchmark aggregate.

## Current reference cohort

| Fixture | Site | Primary ARWP evidence | Purpose |
| --- | --- | --- | --- |
| `reference-dkharlanau` | https://dkharlanau.github.io/ | `/ai/site-profile.json` | Main professional knowledge site; retrieval, structured data, Agent Skills and local MCP references |
| `reference-brali` | https://brali-lifeos.github.io/ | `/ai/site-profile.json` | Knowledge library with static retrieval, OpenAPI and local MCP |
| `reference-cognitive-biases` | https://cognitive-biases.github.io/ | `/ai/site-profile.json` | Knowledge library with NDJSON retrieval, schemas, provenance and local MCP |
| `reference-cbt-cards` | https://cbt-cards.github.io/ | `/ai/site-profile.json` | Multilingual reviewed knowledge resource with retrieval, Agent Skill and trust surfaces |
| `reference-metkagram` | https://metkagram.github.io/ | `/ai/site-profile.json` | Language/NLP knowledge site with retrieval, OpenAPI, schemas and provenance |

The fixtures live in `benchmarks/corpus/reference-*.json` and use `ownership: "project-reference"`.

## What is scored

The reference cohort uses the same five Resolver planning intents as the independent corpus:

- `read`
- `search`
- `structured`
- `tools`
- `agent`

The expected interfaces are reviewed from the public publisher-controlled surfaces. Resolver output is not allowed to rewrite the fixture simply because a selection differs.

A local `stdio` MCP declaration may be accepted as a `tools` discovery result when the site explicitly publishes it through the ARWP profile. This is discovery evidence only; it does not prove remote runtime availability. A static MCP-compatible JSON description is not accepted as a live MCP tool.

Agent Skills are kept distinct from the callable `agent` intent. A site does not receive an A2A/agent success merely because it publishes a Skill.

## Strategies

The same strategy views are compared:

1. `ordinary-web`
2. `llms-aware`
3. `agents-aware`
4. `protocol-native`
5. `arwp-profile-only`
6. `resolver-union`

This makes the cohort useful for a specific product question:

> When a publisher follows the ARWP reference publication patterns, does the Resolver actually discover and route the interfaces the publisher intended to expose?

It also shows whether ARWP Profile adds useful discovery beyond ordinary web/`llms.txt`, without pretending that owner-controlled results demonstrate broader ecosystem adoption.

## Automated run

The GitHub Actions workflow `.github/workflows/reference-benchmark.yml` runs the corpus and publishes two 90-day artifacts:

- `with-references.json` — the normal benchmark result with non-independent fixtures included;
- `reference-sites.json` — a compact project-reference cohort report with aggregate and per-site strategy results.

The workflow summary prints strategy accuracy and per-site `resolver-union` correctness.

## Baseline — 2026-08-26

The first successful reference-cohort run resolved all five sites and scored 25 planning decisions per strategy.

| Strategy | Correct | Accuracy |
| --- | ---: | ---: |
| `ordinary-web` | 7 / 25 | 28% |
| `llms-aware` | 12 / 25 | 48% |
| `agents-aware` | 7 / 25 | 28% |
| `protocol-native` | 7 / 25 | 28% |
| `arwp-profile-only` | 20 / 25 | 80% |
| `resolver-union` | **25 / 25** | **100%** |

Each of the five sites scored **5 / 5** under `resolver-union` and **4 / 5** under `arwp-profile-only`.

All five profile-only misses were the `read` intent: the profile view selected a structured catalog/feed surface while the reviewed preferred read interface was `llms.txt`. Adding normal observed-web discovery let the union select `llms.txt` correctly.

That is a useful result rather than a defect to hide. It demonstrates the intended composition model on the owner-controlled reference suite: ARWP Profile contributes explicit retrieval/structured/tool declarations, while ordinary web discovery still contributes useful readable surfaces.

Durable result: [`benchmarks/results/2026-08-26-project-reference-v0.1.md`](../benchmarks/results/2026-08-26-project-reference-v0.1.md).

## How to interpret results

A high `arwp-profile-only` or `resolver-union` result means the reference sites publish machine-readable surfaces coherently enough for ARWP to resolve them.

It does **not** prove:

- independent adoption;
- search-engine ranking gains;
- AI recommendation or citation gains;
- answer quality;
- runtime MCP/A2A conformance;
- security trust;
- ecosystem standardization.

Reference results should instead be used as an implementation quality gate. If one of these sites changes and Resolver correctness falls, investigate whether the site publication changed, the Resolver regressed, or the fixture itself needs a human re-review.

## Relationship to the independent benchmark

The independent benchmark remains the primary external evidence layer and counts only `ownership=independent` fixtures.

The two cohorts answer different questions:

| Cohort | Question |
| --- | --- |
| `independent` | Can ARWP resolve heterogeneous sites that were not built around ARWP? |
| `project-reference` | Do sites deliberately publishing ARWP-compatible surfaces resolve as intended? |

Both are valuable, but only the first can support claims about external interoperability coverage.
