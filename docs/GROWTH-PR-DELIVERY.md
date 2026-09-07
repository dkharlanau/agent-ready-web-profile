# ARWP Growth PR delivery

Status: review-only delivery v0.1 · reviewed 2026-09-07

ARWP can turn a validated Growth remediation manifest into a **review-only pull request** in an explicitly authorized target GitHub repository.

This is deliberately not an autofix mode.

## Boundary

The v0.1 PR mode may commit only files under:

```text
.arwp/proposals/
```

It never writes production website paths.

In particular it does not apply:

- `robots.txt` or crawler policy;
- Organization/Person/Product/Dataset JSON-LD to live pages;
- editorial or governance copy;
- application code or deployment configuration;
- Merchant/feed/Search Console/Business Profile or other authenticated owner-side settings.

Those remain normal human-reviewed repository or platform changes after the proposal has been evaluated.

## Input

PR delivery consumes a validated `growth-remediation-manifest.schema.json` v0.1 manifest produced by `arwp-growth-remediation`.

This preserves the existing remediation dispositions and review gates:

- `policy-review`;
- `structured-data-proposal`;
- `template-proposal`;
- `external-link-proposal`;
- `external-owner-review`;
- `manual-review`;
- `advisory`;
- `blocked-unsafe-reference`.

The PR-delivery layer cannot promote any of those to an automatic production mutation.

## Prepare without GitHub mutation

```bash
node bin/arwp-growth-pr.mjs prepare \
  arwp-growth-remediation.json \
  --repository=owner/site \
  --base=main \
  --output=arwp-growth-pr.json
```

`prepare` is local/read-only. It creates a validated delivery bundle describing:

- the target repository;
- deterministic proposal branch name;
- source remediation-manifest digest;
- PR title/body;
- review artifacts to commit;
- all gated actions;
- explicit safety guardrails.

The bundle itself can be checked with:

```bash
node bin/arwp-growth-pr.mjs validate arwp-growth-pr.json
```

## Open the review-only PR

Opening the PR requires both:

1. a GitHub token with appropriate target-repository permission in `GITHUB_TOKEN`;
2. the exact explicit authorization argument:

```text
--authorize=target-repository-pr
```

Example:

```bash
GITHUB_TOKEN=... node bin/arwp-growth-pr.mjs open-pr \
  arwp-growth-remediation.json \
  --repository=owner/site \
  --base=main \
  --authorize=target-repository-pr
```

Without either gate, the command stops before making any GitHub request.

## What the PR contains

Typical files:

```text
.arwp/proposals/README.md
.arwp/proposals/growth-remediation.json
.arwp/proposals/snippets/growth-entity-identity.jsonld
.arwp/proposals/snippets/growth-cloudflare-content-signals.txt
```

The snippets are review material only. Their location under `.arwp/proposals/` is part of the contract.

For example, a robots suggestion may appear as a `.txt` review snippet, but the delivery mode never writes `/robots.txt`. A structured-data proposal may be carried as `.jsonld`, but it is not inserted into a live page.

## Git safety

The implementation uses GitHub Git Data APIs to create one proposal commit from the target base tree, then opens a PR.

Guardrails:

- proposal branch must not already exist;
- no force push or ref update exists in this flow;
- every created tree path is rechecked to start with `.arwp/proposals/` immediately before blobs/tree/commit are written;
- the target base branch is read before the proposal commit;
- no GitHub Contents write is used for arbitrary production paths;
- v0.1 supports only `https://api.github.com`;
- opening/merging the proposal does not authorize subsequent production changes.

## Why not write fixes directly?

Several high-value Growth actions are policy or truth decisions, not mechanical edits.

Examples:

- robots access must match the publisher's distribution and rights policy;
- structured data must match visible, real facts;
- author/entity identity cannot be invented;
- editorial quality and first-hand evidence require human judgment;
- authenticated owner-platform state cannot be inferred from public crawling.

A review-artifact PR gives the target repository a durable, inspectable handoff without pretending those decisions are safe to automate.

## Verification

CI covers:

- schema validation;
- deterministic manifest digest and branch naming;
- production-path rejection;
- explicit authorization/token checks before network access;
- new-branch-only behavior;
- no force push;
- Git tree path enforcement;
- mocked end-to-end GitHub PR creation;
- refusal when the proposal branch already exists.

## Product boundary

This feature improves implementation delivery workflow. It does not claim that accepting an ARWP proposal causes Search ranking, AI citation, recommendation, traffic or conversion gains.
