# External Resolver Pilot — Initial Engineering Baseline

Workflow run: `32898518601`  
Head: `e43b6b0e6397537ddd4ff6bb2c98d4f6f2b98fe4`  
Generated: `2026-08-25T21:00:42.325Z`

> This is a preserved engineering baseline **before ground-truth correction**. It is not a product-performance claim. Several fixtures were subsequently found to under-declare real A2A/llms surfaces, so the accuracy numbers below must not be marketed.

## Aggregate

| Strategy | Correct | Total | Accuracy |
| --- | ---: | ---: | ---: |
| ordinary-web | 33 | 45 | 73.3% |
| llms-aware | 37 | 45 | 82.2% |
| agents-aware | 31 | 45 | 68.9% |
| protocol-native | 27 | 45 | 60.0% |
| arwp-profile-only | 31 | 45 | 68.9% |
| resolver-union | 33 | 45 | 73.3% |

Independent sites: **10**; resolved: **9**; failed: **1**.

## Site-level Resolver-union misses

- **a2a-docs** — read: wrong-interface (`llms.txt` → `https://a2a-protocol.org/llms.txt`)
- **agent-skills-docs** — agent: false-positive (`A2A` → `https://agentskills.io/.well-known/agent-card.json`)
- **cloudflare-docs** — search: missed-interface; structured: wrong-interface (`RFC9727` → `https://developers.cloudflare.com/openapi.json`); tools: wrong-interface (`MCP` → `https://ai-gateway.mcp.cloudflare.com/mcp`)
- **crewai-enterprise-docs** — agent: false-positive (`A2A` → `https://enterprise-docs.crewai.com/.well-known/agent-card.json`)
- **fastmcp-docs** — search/tools missed; agent: false-positive (`A2A` → `https://gofastmcp.com/.well-known/agent-card.json`)
- **langchain-docs** — resolution failed: `Response exceeds maxBytes (524288).`
- **mcp-docs** — agent: false-positive (`A2A` → `https://modelcontextprotocol.io/.well-known/agent-card.json`)
- **ruff-docs** — read: path-scoped `llms.txt` was missed; canonical HTML selected
- **uv-docs** — read: path-scoped `llms.txt` was missed; canonical HTML selected

## Immediate review findings

- Resolver union was **not** automatically the best strategy in the initial pilot. That result is preserved rather than hidden.
- `a2a-protocol.org` actually publishes a root `llms.txt`; the original fixture accepted only HTML, so that ground truth was too strict.
- `agentskills.io` publishes a real A2A Agent Card; the original fixture incorrectly treated the docs site as having no agent interface.
- Other Mintlify-style documentation sites also surfaced A2A cards and require individual ground-truth review before their `agent` score is considered evidence.
- `uv` and Ruff publish path-scoped `llms.txt`; this is a real systematic discovery gap in the baseline resolver.
- LangChain Docs exceeded the baseline 512 KiB homepage scan bound. That is a real operational failure to handle explicitly, not a site to silently remove from the corpus.

## Evidence policy

The raw GitHub Actions artifact for the run is retained separately. Ground truth is manually reviewed public evidence; Resolver output is never allowed to become its own ground truth. Network metrics are attributed only to the actual Resolver run, while subset strategies remain selection-only projections over that observation.
