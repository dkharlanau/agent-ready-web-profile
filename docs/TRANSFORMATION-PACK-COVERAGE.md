# Transformation Pack portfolio coverage

SignalBraid Patch should grow from observed portfolio friction, not from framework popularity or a large fixture count. The coverage report answers a narrow question:

> For transformation preparations that were actually attempted, how often did the current mapper + pack return `ready`, `no-op`, or `blocked`, and why?

It is deliberately not a Search/GEO score, a site quality score, a ranking prediction, or production mutation authorization.

## Input

Create a manifest containing raw results returned by `arwp-transform-pack prepare` plus the site identity used for the observation:

```json
{
  "version": "0.1",
  "observedAt": "2026-09-07T19:30:00Z",
  "portfolioId": "owned-sites-2026-09",
  "observations": [
    {
      "siteId": "example-site",
      "canonicalUrl": "https://example.com/",
      "repository": "owner/example-site",
      "adapter": "nextjs",
      "evidenceRef": "change-receipt-or-run-ref",
      "result": {
        "version": "0.1",
        "packId": "nextjs-app-router-v0.1",
        "recipeId": "machine-surface-replace",
        "status": "ready",
        "path": "src/app/sitemap.ts"
      }
    }
  ]
}
```

Only observed preparations belong in the denominator. A site that was never evaluated is not a failure.

## CLI

```bash
node bin/arwp-transform-pack.mjs coverage portfolio-coverage.json
```

Use `--out=coverage-report.json` to retain the report as evidence.

The report preserves:

- total `ready`, `no-op`, and `blocked` counts;
- covered count (`ready + no-op`) and a transparent ratio;
- per-site, per-adapter, per-pack and per-recipe breakdowns;
- exact blocked reasons;
- blocker classes with an inspectable next-step hint.

## Blocker classes

The classifier is intentionally simple and explainable:

- `ownership`: improve Repository Mapper evidence first;
- `review-boundary`: owner/policy/editorial review remains required;
- `grounding`: source-backed reviewed facts are missing;
- `drift`: mapped source content changed and must be re-read;
- `input-evidence`: the attempted preparation is incomplete;
- `unsupported-coverage`: observed demand may justify another adapter or pack;
- `other`: inspect the exact reason rather than guessing.

Do not use blocker frequency to weaken safety boundaries. For example, many `mutation-class-not-allowed` results are evidence that the policy gate is working, not evidence that it should be removed.

## How to use the report

Prefer the next adapter/pack investment that closes repeated real `unsupported-coverage` or ownership gaps on important owned sites. Preserve `no-op` results because they prove the pack can recognize already-correct state. Preserve blocked and negative outcomes because they are the evidence needed to avoid speculative automation.

For real changes, pair the preparation result with a Change Receipt so implementation verification, deployment evidence and later Search/AI outcome evidence remain separate from this technical coverage report.
