# External corpus semantic review — 2026-08-26

This record documents the separate human semantic review of benchmark v0.2 ground truth. It complements, rather than replaces, transport-level evidence liveness checks and Resolver execution results.

## Method

- Reviewed all 20 fixtures with `ownership=independent` against publisher-controlled public evidence or protocol-native evidence.
- Re-checked whether each currently accepted interface is semantically justified for its benchmark intent; documentation about a protocol was not treated as an executable protocol endpoint by itself.
- Resolver output was not used to create, confirm or broaden accepted ground truth.
- Each completed review is recorded in `benchmarks/reviews/semantic-review-v0.2.json` and pins the exact Git blob SHA of the reviewed fixture.
- `benchmarks/corpus-test.mjs` now fails if a reviewed fixture changes byte-for-byte without refreshing its semantic review receipt, so an old review date cannot silently cover later ground-truth edits.

## Review coverage

| Fixture | Review | Current reviewed blob |
| --- | --- | --- |
| a2a-docs | confirmed | `f30fac8b8539995601718dd4b512c61e74e361b2` |
| agent-skills-docs | confirmed | `0e662dd17f378d108c8d24ab8dc21df9ab98fce7` |
| anthropic-platform-docs | confirmed | `e74c6e90e12578982b7bfff399b115480fcc2c78` |
| bun-docs | confirmed | `8640926efa10f8f722478477c9174b7537adf8d7` |
| cloudflare-docs | confirmed | `f55f070fc1b7846eff31f61cb6446f898f28b1bf` |
| crewai-enterprise-docs | confirmed | `26cde5c83587c2605f84f818786e413e79142784` |
| deno-docs | confirmed | `d059907f7ccb552cbd14dbba7ab5a08c23278977` |
| fastmcp-docs | confirmed | `43b04aed8a1b6d1eddb89fbe6a988cc420e4d9e1` |
| langchain-docs | confirmed | `c1968303a9a507c4f36995cb1ab9564e44d6e39d` |
| mcp-docs | confirmed | `fdaf900ebf0b86d6284c4a834ac0fe14c988c528` |
| mintlify-docs | confirmed | `9ebf7df920485b8c423971e36e4a8cc4c5255a3f` |
| perplexity-docs | confirmed | `59d1f13c37993d52c7b71f7b4d116b194bc08190` |
| pinecone-docs | confirmed | `0a43f9dd7b1c7af6103236fa62b7d203c808fa6a` |
| ruff-docs | confirmed | `8589d6910739461d3cf30b1b7ebc7f04879a3257` |
| stripe-docs | confirmed | `d37175d5f0b627c63975d4bd592f5c0b98efe21d` |
| supabase-docs | confirmed | `686b011e9cefd772893c04ccd25b7faf8c99bb31` |
| ty-docs | confirmed | `2bada3e47aa35ff033abfd7e849fdcc5c8d7e9ca` |
| uv-docs | confirmed | `31361d7c7aba9646ff6ea87faa227a7f02fe07de` |
| vercel-docs | confirmed | `406c5d510e37297fc1d31f249a0e3e87a5732cfe` |
| vite-docs | confirmed | `8579d8392bca31cdb9844b0af21b6748b3edbc73` |

Coverage: **20 / 20 independent fixtures**.

## Outcome

The current accepted ground truth for all 20 fixtures was confirmed by this semantic pass. No additional fixture ground-truth edits were required during this pass.

The immediately preceding evidence re-review had already corrected stale public evidence before this pass: a Cloudflare evidence location, a Mintlify article URL, and Vercel's accepted MCP endpoint. Those corrections were based on current publisher-controlled evidence, not Resolver output.

Transport liveness remains a separate observation. The latest durable liveness record for this corpus is `benchmarks/results/2026-08-26-evidence-liveness-v0.2.md`; a reachable URL does not by itself establish semantic correctness, and a restricted/method-specific protocol endpoint is not automatically unhealthy.

This review is benchmark-quality evidence only. It does not establish independent adoption, answer quality, token savings, latency improvement, search ranking improvement, or production interoperability beyond the tests explicitly recorded elsewhere in the repository.
