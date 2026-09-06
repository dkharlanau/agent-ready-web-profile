# ARWP Agent Skills

ARWP ships portable Agent Skills so coding agents can prepare and maintain a website without requiring the user to restate the methodology in every prompt.

## Install

Using the open `skills` CLI:

```bash
npx skills add dkharlanau/agent-ready-web-profile
```

Then select the ARWP skill(s) supported by your agent. The exact install target is controlled by the `skills` CLI and the agent environment.

The default orchestration skill is:

```text
arwp-prepare-site
```

Specialists:

```text
arwp-ai-search-content
arwp-agent-discovery
arwp-evidence-ci
```

## Recommended use

Ask the agent to apply `arwp-prepare-site` to the current repository. It should inspect the stack, establish an audit/growth baseline, implement the highest-confidence P0/P1 improvements, add only truthful machine/agent surfaces, verify the site, and leave external/credential-dependent work as explicit gates.

Load the specialist skills when the task is primarily content, interoperability/discovery, or verification/CI.

## Design

ARWP follows the Agent Skills progressive-disclosure model:

- lightweight name/description metadata helps agents decide when a skill applies;
- the full `SKILL.md` loads only when needed;
- specialist skills keep unrelated methodology out of the active context;
- scripts/assets can be added later where deterministic execution is more valuable than prose instructions.

Skills do not claim that ARWP adoption guarantees Google ranking, AI citations, recommendation placement, or universal agent readiness.
