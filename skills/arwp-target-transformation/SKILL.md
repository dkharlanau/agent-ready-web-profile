---
name: arwp-target-transformation
description: Convert an ARWP Adaptive Site Upgrade graph into deterministic, digest-gated changes in a target website repository. Use after the agent has inspected the target repository and can resolve exact production files, grounded facts and verification conditions. Compile explicit path-allowlisted transformations, simulate them, apply locally with rollback or open a new production-path GitHub PR. Never auto-promote policy, editorial, owner-platform, runtime or stale-knowledge recommendations.
license: Apache-2.0
compatibility: Requires a target website repository/filesystem for local application or GitHub credentials for production PR delivery. Node.js 20+.
metadata:
  standard: agent-skills
  arwp-role: target-transformation
---

# ARWP Target Transformation

Use this skill after `arwp-adaptive-upgrade` has answered **what should change** and the next job is **resolve and deliver the exact repository change**.

## Goal

Turn applicable, current ARWP recommendations into a small deterministic change set with:

`recommendation → exact file → grounded inputs → before digest → after digest → verification → rollback/PR`

Do not treat an upgrade recipe as mutation authority.

## Workflow

1. **Load the Adaptive Upgrade graph.** Reject any recommendation whose `knowledgeState` is `review-due` until the upstream guidance is reviewed again.

2. **Inspect the target repository.** Resolve the actual source files that own the public behavior. Do not patch generated output if the source template/config should be changed instead.

3. **Classify mutation eligibility.**
   - `mechanical`: may become deterministic if the exact target is known.
   - `grounded-template`: may become deterministic only after first-party facts are found and recorded as grounding evidence.
   - `policy-gated`, `editorial`, `owner-platform`, `runtime`: keep gated; do not turn them into executable operations.

4. **Resolve exact operations.** Prefer one operation per file. Supported v0.1 operations are `create-file`, `replace-file`, `replace-exact`, `insert-before-exact`, and `insert-after-exact`.

5. **Pin preconditions.** Capture the exact current file content or absence, the target base commit SHA, and an explicit `allowedPaths` list. Never use broad `**` mutation permissions.

6. **Compile and simulate.**

```bash
node bin/arwp-transform.mjs compile adaptive-upgrade.json target-transform-spec.json --output=transform.bundle.json
node bin/arwp-transform.mjs simulate transform.bundle.json
```

Read the gated-recommendations section before delivery. A large gated list is normal; the engine is designed to automate only what is safe and resolved.

7. **Deliver.** Prefer production PR delivery for shared repositories:

```bash
GITHUB_TOKEN=... node bin/arwp-transform.mjs open-pr transform.bundle.json \
  --authorize=target-repository-transform-pr
```

For an explicitly authorized local workspace:

```bash
node bin/arwp-transform.mjs apply transform.bundle.json \
  --root=/path/to/site \
  --authorize=local-production-transform \
  --receipt=/private/path/transform-receipt.json
```

8. **Verify the real site.** Run the target project's own build/tests/lint and the relevant ARWP checks. Compare rendered public facts with the repository facts used as grounding evidence.

9. **Measure separately.** Deployment success is not Search/AI outcome evidence. Use owner-side Search Console/Bing/referral/agent-eval evidence after a sensible observation window.

10. **Rollback when necessary.** Local rollback is allowed only when post-transform file digests still match the receipt. GitHub delivery is branch/PR based; use normal Git revert/PR review rather than rewriting history.

## Hard rules

- Never write directly to the target base branch through this engine.
- Never force push.
- Never mutate `.git/`, `.github/workflows/` or `.github/actions/` through transformation bundles.
- Never invent Person, Organization, Product, Dataset, author, rating, price, date or credential facts to make a recommendation executable.
- Never choose crawler/training/content-use policy on behalf of the publisher.
- Never execute arbitrary shell commands stored in a transformation bundle.
- Never claim a ranking/citation uplift from a successful mutation alone.

## Done when

A transformation cycle is complete when the exact repository change has been delivered, technical verification is recorded, unresolved/gated recommendations remain explicit, and the next measurement/learning step is identified.
