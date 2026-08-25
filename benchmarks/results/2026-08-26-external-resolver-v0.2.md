# External resolver benchmark — 2026-08-26

This is a durable engineering record of GitHub Actions run `32904297894` at commit `79ad1319be80052141329dce4440a5522b6a4ba9`.

The run used benchmark v0.2 and the reviewed `ownership=independent` corpus. Resolver output was scored against the fixture ground truth; it was not used to create or modify ground truth. These numbers are engineering benchmark evidence, not adoption evidence.

## Coverage

- Independent sites: 20
- Resolved sites: 20
- Failed sites: 0
- Resolution coverage: 100%
- Scored intent decisions: 100 (5 intents × 20 sites)

The previous 20-site run resolved 19/20 because the Stripe Docs homepage exceeded the resolver's 1 MiB base-scan body limit. Commit `b20bd8c74de9fd042ad1a79aca5cda251afb9770` changed only homepage HTML discovery to inspect a bounded prefix and cancel the remaining body while preserving strict full-body limits for structured/text discovery resources. In this run `stripe-docs` resolved successfully and scored 5/5 under `resolver-union`.

## Primary aggregate

| Strategy | Correct | Total | Accuracy |
| --- | ---: | ---: | ---: |
| ordinary-web | 74 | 100 | 74% |
| llms-aware | 89 | 100 | 89% |
| agents-aware | 71 | 100 | 71% |
| protocol-native | 63 | 100 | 63% |
| arwp-profile-only | 71 | 100 | 71% |
| resolver-union | 81 | 100 | 81% |

The primary denominator includes full-site resolver failures as incorrect decisions. This run had no such failures, so primary and resolved-only denominators are identical.

## Resolver-union by site

| Fixture | Status | Correct / 5 |
| --- | --- | ---: |
| a2a-docs | resolved | 4 |
| agent-skills-docs | resolved | 5 |
| anthropic-platform-docs | resolved | 5 |
| bun-docs | resolved | 5 |
| cloudflare-docs | resolved | 4 |
| crewai-enterprise-docs | resolved | 5 |
| deno-docs | resolved | 5 |
| fastmcp-docs | resolved | 2 |
| langchain-docs | resolved | 2 |
| mcp-docs | resolved | 5 |
| mintlify-docs | resolved | 2 |
| perplexity-docs | resolved | 4 |
| pinecone-docs | resolved | 4 |
| ruff-docs | resolved | 5 |
| stripe-docs | resolved | 5 |
| supabase-docs | resolved | 2 |
| ty-docs | resolved | 5 |
| uv-docs | resolved | 5 |
| vercel-docs | resolved | 2 |
| vite-docs | resolved | 5 |

The remaining misses are therefore interface-selection/discovery gaps on resolved sites rather than transport-level site failures. They should be investigated against the fixture evidence individually before changing adapters or ground truth.

## Reproducibility and artifact

The workflow validated 21 fixture files, of which 20 independent fixtures counted toward the aggregate. The raw report was uploaded by GitHub Actions as artifact `arwp-external-benchmark-32904297894` (artifact ID `9584235345`, SHA-256 digest `58de4d0e7b9edd3272d2bcb0f1d9d921d61f3e45762c643081a2298ffe8d778c`). The workflow completed successfully.

The external benchmark workflow now treats `lib/scanner.mjs` as a material resolver dependency, so future scanner changes trigger this corpus run rather than relying only on the contract-test suite.
