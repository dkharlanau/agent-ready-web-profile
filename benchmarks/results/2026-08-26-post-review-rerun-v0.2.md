# External resolver benchmark — post-review rerun

Observed on 2026-08-26 from GitHub Actions run `32921583517` at commit `68ba9dcb30c6adf63962a5ba20a3ce283ef5be65`, after the benchmark evidence corrections and semantic-review receipt guardrail were in place.

## Result

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

The aggregate is unchanged from the earlier publication snapshot, but this rerun used the corrected current corpus, including the current reviewed Vercel MCP ground truth.

## Resolver-union mismatch taxonomy

Across the 100 intent decisions, Resolver union produced 19 mismatches on 9 sites:

- false-positive interface: 10
- missed interface: 6
- wrong interface: 3

The concentration is useful engineering evidence rather than a reason to change ground truth. Current mismatches cluster around three general problems: overly broad protocol/API selection, independently documented MCP interfaces that ordinary discovery does not yet surface, and read-interface scope selection on path-scoped documentation.

Sites with at least one Resolver-union mismatch in this observation: `a2a-docs`, `cloudflare-docs`, `fastmcp-docs`, `langchain-docs`, `mintlify-docs`, `perplexity-docs`, `pinecone-docs`, `supabase-docs`, `vercel-docs`.

## Same-run federation observation

The independent federation corpus again executed the reviewed expected JSON Feed interface on 4 / 4 sites, with query hits on all four. Hit counts remain smoke-test evidence only.

## Artifact provenance

GitHub Actions artifact: `arwp-external-benchmark-32921583517`, artifact ID `9590020739`.

Artifact digest reported by GitHub Actions:

`sha256:6489bd40fe6a78520a60ee9d46f2e24162f4633274e2d5fc324bdbd5b4f22d81`

Contained-file SHA-256 values:

- `external-public.json`: `cd06f7d0c978b02f11818f3fbd6e95c1684a9d77eed2927b350e49f91eb2187a`
- `external.json`: `4cc6201df64216a8301336f3e1d6877ad5f6337952dec03ee846bc8d988675c5`
- `evidence.json`: `7ce2eda74629e915c0cc3d47e6145f57a21d55c088e280fdc5afc187f56d1f2f`
- `federation.json`: `f3d0fecdcbdf8c08f03059e53197de6ccd585cbdb11ed6afcff8c8b8c71cf801`

This is engineering benchmark evidence. It does not establish independent adoption, answer quality, token savings, latency improvement, search ranking improvement or production interoperability beyond the tests explicitly recorded in the repository.
