# Reference profiles

These profiles map real public knowledge sites to ARWP v0.1.

They are interoperability fixtures, not endorsements and not claims that every optional agent technology is implemented.

## Sites

| Profile | Primary reference role |
| --- | --- |
| `dkharlanau.site-profile.json` | Professional/domain knowledge with datasets, a compact retrieval index, publisher skill discovery and local read-only MCP implementations |
| `brali.site-profile.json` | Evidence-aware protocol knowledge with stable IDs, versioned static API/search surfaces and a local read-only MCP server |
| `cognitive-biases.site-profile.json` | Evidence/decision knowledge with versioned RAG releases and a local reference MCP adapter |
| `cbt-cards.site-profile.json` | Safety-sensitive static knowledge with explicit abstention, schemas, RAG data and a portable Agent Skill |
| `metkagram.site-profile.json` | Multilingual learning/NLP data with static API, OpenAPI, schemas and search index, including a static MCP-compatible description that is intentionally **not** declared as a live MCP server |

## Snapshot policy

A reference profile describes the public implementation that could be verified from the corresponding repository at the time it was added.

Rules:

1. Do not add planned capabilities.
2. Do not infer a remote MCP endpoint from server source code alone.
3. Do not call arbitrary Markdown files Agent Skills; only standard `SKILL.md` distributions belong under `agentSkills.skills`.
4. A publisher-specific skill catalog may be declared as a catalog without claiming that every catalog entry is a portable Agent Skill.
5. Keep static MCP-like tool metadata under `data.distributions` when no actual MCP runtime is proven.
6. Remove stale declarations rather than preserving them for appearance.

## Validation

All reference profiles are schema-tested in the main CI suite.

Live public URLs are checked separately because network verification is inherently less deterministic:

```bash
for profile in examples/reference/*.site-profile.json; do
  node bin/arwp.mjs verify "$profile"
done
```

The scheduled reference-verification workflow performs this check against the current public sites and uploads the JSON results as a CI artifact.

A live verification warning (for example an unusual but successful `Content-Type`) is not the same as a schema failure. A hard HTTP/HTTPS failure is treated as reference drift that should be investigated.
