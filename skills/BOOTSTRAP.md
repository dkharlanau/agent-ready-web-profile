# ARWP AI bootstrap — fallback for agents without native Agent Skills support

Use this only when the current coding agent cannot install or invoke Agent Skills natively.

## Instruction

You are preparing an existing website repository under the Agent-Ready Web Profile (ARWP).

1. Read the canonical workflow first:
   https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/skills/arwp-prepare-site/SKILL.md
2. Read the canonical site-execution composition before choosing specialist workflows:
   https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/registry/site-execution-manifest.json
3. For deep/complete/whole-site work, also read the canonical audit-domain contract:
   https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/registry/comprehensive-site-audit.json
4. Build an explicit module applicability matrix. Do not create or invoke one skill per checklist item; use the manifest's modules and invoke specialist skills only when their trigger applies.
5. If needed, read only the referenced ARWP files relevant to the task; do not load the entire repository into context.
6. Inspect the target repository before editing. Preserve its framework, design system, content model and deployment conventions.
7. If the ARWP skill folder is available locally, run its deterministic repository inspector before broad exploration:
   `node skills/arwp-prepare-site/scripts/inspect-repo.mjs <target-repository>`
8. If the ARWP CLI is not installed, use the isolated bootstrap described here:
   https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/skills/arwp-prepare-site/references/toolchain-bootstrap.md
9. Establish a baseline with `arwp audit` and `arwp-growth` when a public URL exists, but keep bounded results separate from whole-site coverage.
10. Implement high-confidence P0/P1 improvements directly in the target repository. Do not stop at recommendations when edits are possible.
11. Add only truthful machine/agent surfaces. Never invent API, MCP, A2A, WebMCP, ARD or other runtime capabilities.
12. Run the target site's own build/tests/lint plus relevant ARWP verification, re-audit affected cohorts, then run the final Surface Integrity reconciliation.
13. Report coverage state, the module applicability matrix, what changed, verification results, tested revision/deployment identity when available, and any external/credential-dependent gates.

## Boundaries

- Do not add `meta keywords`.
- Do not add FAQ schema solely for ranking hopes.
- Do not overwrite existing sitemap/robots/metadata generators blindly.
- Do not publish private/internal endpoints.
- Do not silently omit a module: use an explicit `not-applicable`, `not-assessed` or other manifest state with evidence/reason.
- Do not create a new Agent Skill merely for one metadata field, HTML attribute, validator assertion or checklist item.
- Do not claim ARWP, `llms.txt`, Agent Skills, JSON-LD or any other metadata guarantees search ranking, AI citation, AI recommendation placement, authorization, security, or universal agent readiness.

This fallback is deliberately short. The canonical `arwp-prepare-site` skill remains the workflow source of truth; the execution manifest is the machine-readable composition source of truth.
