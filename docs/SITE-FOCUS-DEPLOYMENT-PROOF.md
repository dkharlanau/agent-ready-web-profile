# Site Focus deployment proof

A Site Focus source check and a Site Focus production check answer different questions.

- **Source check:** does the repository still satisfy the owner-declared Site Focus contract?
- **Production check:** does the public site that was actually deployed from a specific commit satisfy that contract?

Do not collapse them into one push-triggered live crawl.

## Why this matters

A push can start Site Focus and a Pages deployment in parallel. The live crawl may finish first and inspect the previous production release while the workflow is labelled with the new commit SHA.

That creates false lineage: a green report appears to validate the new release even though the public bytes came from an older release.

This was observed during Brali dogfood on 2026-09-09. A Site Focus report was generated before the matching GitHub Pages deployment finished and still contained the previous homepage description. The defect was found by comparing report generation time, deploy completion time, and the observed public metadata.

## Required proof chain

For repositories that want deployment evidence, use two phases.

### Phase 1 — source-focus

Run on `pull_request` and `push`.

Validate only evidence available from the checked-out source:

- the Site Focus profile parses and validates;
- local contract invariants hold;
- source-level regression checks pass;
- no production state is inferred.

A source-focus result may block a bad change, but it is not proof that the public site contains the change.

### Phase 2 — production-focus

Run only after the repository's deployment workflow completes successfully.

Use `workflow_run` and check out the deployment workflow's exact `head_sha`.

Then:

1. re-run any important source invariants at that SHA;
2. crawl the public site;
3. compare it with the Site Focus profile from the deployed SHA;
4. attach deployment lineage to the report;
5. store the report as a durable CI artifact.

Minimal lineage extension:

```json
{
  "deploymentEvidence": {
    "commitSha": "<deployed commit>",
    "deployWorkflowRunId": 123456789,
    "verifiedAfterSuccessfulDeploy": true
  }
}
```

This extension is operational evidence. It is not a search-ranking, citation, conversion, or performance claim.

## GitHub Actions pattern

Replace `Deploy GitHub Pages` with the exact workflow name used by the target repository.

```yaml
name: Cite Goose Site Focus

on:
  pull_request:
  push:
    branches: [main]
  workflow_run:
    workflows: ['Deploy GitHub Pages']
    types: [completed]
    branches: [main]

permissions:
  contents: read

jobs:
  source-focus:
    if: github.event_name != 'workflow_run'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '24'
      - name: Validate local Site Focus contract
        run: node scripts/check-site-focus-source.mjs

  production-focus:
    if: github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          ref: ${{ github.event.workflow_run.head_sha }}

      - uses: actions/checkout@v6
        with:
          repository: dkharlanau/agent-ready-web-profile
          ref: <PINNED_CITE_GOOSE_COMMIT>
          path: .tools/arwp

      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          cache: npm
          cache-dependency-path: .tools/arwp/package-lock.json

      - name: Install Cite Goose runtime
        working-directory: .tools/arwp
        run: npm ci --ignore-scripts

      - name: Compare declared focus with deployed public site
        run: >-
          node .tools/arwp/bin/arwp-focus.mjs
          https://example.com/
          --focus-profile=.arwp/site-focus.json
          --max-pages=30
          --output="$RUNNER_TEMP/site-focus-report.json"

      - name: Attach deployment lineage
        env:
          REPORT: ${{ runner.temp }}/site-focus-report.json
          DEPLOYED_SHA: ${{ github.event.workflow_run.head_sha }}
          DEPLOY_RUN_ID: ${{ github.event.workflow_run.id }}
        run: |
          node --input-type=module <<'NODE'
          import fs from 'node:fs';
          const report = JSON.parse(fs.readFileSync(process.env.REPORT, 'utf8'));
          report.deploymentEvidence = {
            commitSha: process.env.DEPLOYED_SHA,
            deployWorkflowRunId: Number(process.env.DEPLOY_RUN_ID),
            verifiedAfterSuccessfulDeploy: true
          };
          fs.writeFileSync(process.env.REPORT, JSON.stringify(report, null, 2) + '\n');
          NODE

      - uses: actions/upload-artifact@v4
        with:
          name: site-focus-production-${{ github.event.workflow_run.head_sha }}
          path: ${{ runner.temp }}/site-focus-report.json
          if-no-files-found: error
```

## Verification rules

A production Site Focus artifact is deployment-linked only when all of these are true:

1. the deployment workflow concluded `success`;
2. production-focus was triggered by that deployment workflow, not merely by the original push;
3. the checked-out profile/source SHA equals `workflow_run.head_sha`;
4. the public crawl started after the successful deploy event;
5. the stored artifact records both the deployed SHA and deploy workflow run id.

If these conditions are not met, label the result as a source or observational diagnostic, not production proof.

## What this still does not prove

Even a correctly sequenced production Site Focus report does **not** prove:

- indexing;
- search ranking changes;
- AI citation or recommendation changes;
- traffic or conversion changes;
- Core Web Vitals field performance;
- efficacy of the site's content or protocols.

Those require their own evidence surfaces and measurement windows.
