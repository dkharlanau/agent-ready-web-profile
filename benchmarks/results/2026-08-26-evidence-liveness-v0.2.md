# Reviewed evidence liveness — 2026-08-26

This is a durable engineering record of the transport-level evidence check from GitHub Actions run `32919617644` at commit `1c9509a5ebc600f223a4fb8ee3810849191824f5`.

The check is intentionally narrower than semantic ground-truth review. It observes whether recorded public HTTPS targets respond and whether they redirect; it does not treat a successful response as proof that the page still supports the benchmark claim.

## Result

- Independent fixtures: 20
- Deduplicated targets checked: 57
- HTTP 2xx: 52
- Restricted or method-specific (`401`, `403`, `405`, `429`): 5
- Missing (`404`, `410`): 0
- Other unhealthy HTTP responses: 0
- Probe errors: 0
- Redirected targets: 13
- Stale `reviewedAt` dates at the configured 90-day threshold: 0

The five restricted/method-specific targets were:

| Fixture | HTTP | Target | Interpretation |
| --- | ---: | --- | --- |
| cloudflare-docs | 405 | `https://docs.mcp.cloudflare.com/mcp` | MCP endpoint responds; plain GET is not a protocol-conformance check. |
| fastmcp-docs | 405 | `https://gofastmcp.com/mcp` | MCP endpoint responds; plain GET is not a protocol-conformance check. |
| langchain-docs | 405 | `https://docs.langchain.com/mcp` | MCP endpoint responds; plain GET is not a protocol-conformance check. |
| supabase-docs | 401 | `https://mcp.supabase.com/mcp` | Endpoint requires authentication; transport observation does not establish tool semantics. |
| vercel-docs | 401 | `https://mcp.vercel.com/` | Official remote MCP endpoint requires OAuth; transport observation does not establish tool semantics. |

No recorded target returned `404` or `410` after the ground-truth corrections below.

## Ground-truth corrections triggered by the first liveness pass

The first observational pass exposed three recorded URLs that needed independent semantic re-review. Resolver output was not used as the authority for these changes.

- `cloudflare-docs`: refreshed a stale Cloudflare style-guide evidence URL to the current AI consumability guidance. Accepted interfaces did not change.
- `mintlify-docs`: refreshed a stale Mintlify blog slug to the current official llms.txt article. Accepted interfaces did not change.
- `vercel-docs`: removed the previously accepted `https://mcp.vercel.com/mcp` variant after it returned `404` and current Vercel documentation specified the remote MCP endpoint as `https://mcp.vercel.com`. The current official documentation evidence URL was also refreshed.

These changes are corpus maintenance, not evidence that ARWP adoption or interoperability improved.

## Benchmark guardrail

The same workflow completed the external resolver benchmark successfully after the corrections:

- 20/20 independent sites resolved (100% resolution coverage)
- ordinary-web: 74/100
- llms-aware: 89/100
- agents-aware: 71/100
- protocol-native: 63/100
- arwp-profile-only: 71/100
- resolver-union: 81/100

The aggregate therefore did not improve merely because ground truth was corrected. Resolver-backed federation also remained 4/4 expected interfaces executed, with query hits on all four corpus sites.

## Reproducibility and artifact

The workflow completed successfully and uploaded `arwp-external-benchmark-32919617644` (artifact ID `9589390833`, SHA-256 digest `f7e91f6157926e7e7cf1a681622fba46d500aafb73c2724bf950f3b588452e97`). The artifact contains `evidence.json`, `external.json`, `external-public.json`, and `federation.json`.

The evidence probe uses bounded concurrency, validates every destination as public HTTPS, revalidates redirect targets, and cancels response bodies after headers/status so liveness monitoring does not require downloading large third-party resources.
