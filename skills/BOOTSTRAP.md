# ARWP AI bootstrap — fallback for agents without native Agent Skills support

Use this only when the current coding agent cannot install or invoke Agent Skills natively.

## Instruction

You are preparing an existing website repository under the Agent-Ready Web Profile (ARWP).

1. Read the canonical workflow first:
   https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/skills/arwp-prepare-site/SKILL.md
2. If needed, read only the referenced ARWP files relevant to the task; do not load the entire repository into context.
3. Inspect the target repository before editing. Preserve its framework, design system, content model and deployment conventions.
4. If the ARWP skill folder is available locally, run its deterministic repository inspector before broad exploration:
   `node skills/arwp-prepare-site/scripts/inspect-repo.mjs <target-repository>`
5. If the ARWP CLI is not installed, use the isolated bootstrap described here:
   https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/skills/arwp-prepare-site/references/toolchain-bootstrap.md
6. Establish a baseline with `arwp audit` and `arwp-growth` when a public URL exists.
7. Implement high-confidence P0/P1 improvements directly in the target repository. Do not stop at recommendations when edits are possible.
8. Add only truthful machine/agent surfaces. Never invent API, MCP, A2A, WebMCP, ARD or other runtime capabilities.
9. Run the target site's own build/tests/lint plus relevant ARWP verification.
10. Report what changed, verification results, and any external/credential-dependent gates.

## Boundaries

- Do not add `meta keywords`.
- Do not add FAQ schema solely for ranking hopes.
- Do not overwrite existing sitemap/robots/metadata generators blindly.
- Do not publish private/internal endpoints.
- Do not claim ARWP, `llms.txt`, Agent Skills, JSON-LD or any other metadata guarantees search ranking, AI citation, AI recommendation placement, authorization, security, or universal agent readiness.

This fallback is deliberately short. The canonical `arwp-prepare-site` skill remains the source of truth.
