---
name: arwp-evidence-ci
description: Add ARWP verification, regression contracts, evidence receipts, scheduled audits, and CI to a website repository. Use when asked to continuously check ARWP quality, prevent agent/search regressions, monitor public interfaces, generate evidence, or prove that an ARWP implementation remains consistent over time. Keep checks read-only and distinguish observation integrity from ranking, trust, or adoption claims.
license: PolyForm-Strict-1.0.0
compatibility: Best with GitHub Actions and Node.js; concepts also apply to other CI systems.
metadata:
  standard: agent-skills
  arwp-role: verification
---

# ARWP Evidence and CI

Use this skill after a site has been prepared or when a team wants ARWP quality to remain stable over time.

## Workflow

1. Establish the contract.
   - Identify public interfaces the publisher expects to remain available.
   - Use `arwp assert` for required/optional/forbidden intents and protocol expectations.
   - Avoid a universal readiness score.

2. Add recurring quality checks.
   - Run `arwp audit` for source-backed Search/AI/agent recommendations.
   - Run `arwp-growth` to create a prioritized improvement backlog.
   - Run site build/lint/tests first when local metadata generation is part of the deployment.
   - Use a weekly cadence unless the site changes so rapidly that another cadence is justified.

3. Capture durable evidence for important states.
   - Use `arwp-receipt capture <url>` for explicit higher-evidence observations.
   - Preserve receipt IDs and immutable historical records.
   - Separate `project-reference`, `independent-benchmark`, and other evidence classes.
   - Never treat observation of a public site as proof that the publisher adopted ARWP.

4. Track drift.
   - Use resolver snapshots and `arwp drift` when interface selection/canonical identity matters.
   - Fail CI on explicit contract breakage, not on optional opportunities.
   - Preserve negative results and regressions instead of silently removing them.

5. Attach provenance carefully.
   - Record commit/workflow/release IDs only when actually available.
   - Link SBOM/attestation evidence only to the exact matching artifact.
   - A valid SHA-256 receipt proves receipt integrity, not truth, authorization, publisher endorsement, or security.

6. Keep platform metrics external.
   - Google Search Console generative AI metrics, Bing AI Performance, ChatGPT referral data and similar owner-only analytics are evidence inputs.
   - Store before/after observations with dates and scope.
   - Do not claim ARWP caused ranking/citation changes without controlled evidence.

7. Verify CI quality.
   - Pin/approve action versions according to repository policy.
   - Keep permissions read-only unless a specific write is required.
   - Never place secrets in artifacts, fixtures, receipts or logs.
   - Ensure generated public artifacts reproduce with zero diff where practical.

## Recommended GitHub Actions outputs

Publish artifacts such as:

- `arwp-audit.json`
- `arwp-growth.json`
- `arwp-receipt.json`
- resolver snapshot/drift reports

Use the job summary for concise P0/P1 findings. Do not fail the build because a purely optional feature such as Preferred Sources or an experimental protocol is absent.
