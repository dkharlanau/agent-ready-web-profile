# ARWP Target-Site Transformation Engine

Status: **v0.1 · production-PR-first · 2026-09-07**

The Transformation Engine closes the gap between “ARWP knows what should change” and “the target repository contains the verified change.”

```text
current best-practice intelligence
        ↓
Adaptive Site Upgrade graph
        ↓
agent resolves exact target files + grounded facts
        ↓
Transformation Bundle
        ↓
SHA-256 + path + base-commit preconditions
        ↓
local apply / production-path PR
        ↓
build + ARWP re-audit + owner measurement
        ↓
keep / revise / rollback / retire
```

This is not generic autonomous editing. ARWP deliberately separates **recommendation intelligence** from **mutation authority**.

## What can become executable

Two Adaptive Upgrade automation classes may produce transformation operations:

- `mechanical` — deterministic repository changes with no new factual/policy judgment;
- `grounded-template` — only after the agent has inspected the target repository, resolved an exact target and recorded the first-party evidence grounding every factual value.

The following classes are never auto-promoted by v0.1:

- `policy-gated` — publisher rights/crawler/policy choices;
- `editorial` — experience, expertise, analysis and content quality judgments;
- `owner-platform` — Search Console, Bing Webmaster, Merchant Center, Business Profile and similar authenticated state;
- `runtime` — browser-agent interaction behavior that requires runtime evaluation.

A recommendation whose source knowledge is `review-due` also cannot execute until the knowledge is re-reviewed.

## Deterministic operation set

v0.1 deliberately supports a small auditable mutation language:

- `create-file`;
- `replace-file`;
- `replace-exact`;
- `insert-before-exact`;
- `insert-after-exact`.

Each file may have only one compiled operation in a v0.1 bundle. Agents should combine multiple intended edits into one deterministic after-state rather than relying on order-sensitive patch chains.

Every executable operation contains:

- recommendation ID and automation class;
- exact repository-relative path;
- explicit path allowlist membership;
- before-state SHA-256 or an explicit “must not exist” precondition;
- exact-match count where applicable;
- complete after-state content and SHA-256;
- grounding evidence for `grounded-template` changes;
- verification contract;
- whether human review remains required.

## Compile

Create a target-specific transformation spec after inspecting the repository. The spec is intentionally not generated from web crawling alone because crawling cannot tell ARWP which source template/file owns a rendered value.

```bash
node bin/arwp-transform.mjs compile \
  adaptive-upgrade.json \
  target-transform-spec.json \
  --output=transform.bundle.json
```

The spec must explicitly provide:

```json
{
  "repository": {
    "fullName": "owner/site",
    "baseRef": "main",
    "baseCommitSha": "40-character-git-sha"
  },
  "allowedPaths": ["index.html", "data/dataset.jsonld"],
  "operations": []
}
```

An empty `allowedPaths` list is a hard failure.

Default blocked paths include Git internals and executable GitHub workflow/action directories. A target agent cannot opt those defaults out by merely adding them to `allowedPaths`.

## Simulate

```bash
node bin/arwp-transform.mjs simulate transform.bundle.json
```

Simulation reports exactly which files and digests would change. It never predicts ranking, AI citation, traffic or conversion uplift.

## Local apply with rollback

Local production-file writes require an exact authorization string:

```bash
node bin/arwp-transform.mjs apply transform.bundle.json \
  --root=../target-site \
  --authorize=local-production-transform \
  --receipt=.arwp-private/transform-receipt.json
```

Before any file is written, **all** operation preconditions are checked. If one file drifted, the entire staging pass stops before writes begin.

The local receipt contains rollback material. It may therefore contain target-repository content and should be treated as private operational evidence rather than blindly committed.

Rollback is also digest-gated:

```bash
node bin/arwp-transform.mjs rollback .arwp-private/transform-receipt.json \
  --root=../target-site \
  --authorize=local-production-transform
```

Rollback refuses to overwrite a file that changed after the transformation.

## Production GitHub PR

A production-path PR requires:

1. `repository.baseCommitSha` pinned to the audited/inspected base;
2. `GITHUB_TOKEN` with target-repository rights;
3. the exact authorization argument `--authorize=target-repository-transform-pr`.

```bash
GITHUB_TOKEN=... node bin/arwp-transform.mjs open-pr transform.bundle.json \
  --authorize=target-repository-transform-pr
```

The delivery flow:

1. reads the current base ref;
2. refuses delivery if the base commit moved since compilation;
3. re-fetches every target file and verifies the before-state SHA-256/existence contract;
4. refuses any blocked or non-allowlisted path before bundle compilation;
5. creates new blobs and a tree based on the pinned base;
6. creates one new commit;
7. creates a **new** `arwp/transform-*` branch;
8. opens a PR containing the verification contract;
9. never merges the PR and never updates the base ref.

There is no force-push or direct-main function in this engine.

## Why this matters

Most website-audit tools stop at a score or issue list. ARWP's intended product boundary is different:

```text
knowledge → applicability → exact change → preconditions → delivery → verification → measurement → learning
```

That lets ARWP become an adaptive website improvement system while preserving the distinction between technical automation and decisions that require a real owner/editor/reviewer.

## Verification after delivery

A merged transformation is still only implementation evidence. The target workflow should then:

1. run the site's build, tests and lint;
2. re-run the applicable ARWP Growth/Adaptive Upgrade checks;
3. verify rendered facts against source facts;
4. deploy;
5. collect the relevant owner-side Search/AI/agent outcome evidence;
6. keep, revise or roll back based on technical and outcome evidence.

## Security and trust boundary

The Transformation Engine does not:

- invent author/entity/product/dataset facts;
- choose publisher crawler/training policy;
- modify authenticated platform settings;
- turn editorial suggestions into manufactured “expert” copy;
- execute arbitrary shell commands from a bundle;
- mutate GitHub Actions workflows;
- claim that successful repository mutation caused ranking or citation gains.

Those constraints are product features, not missing automation.
