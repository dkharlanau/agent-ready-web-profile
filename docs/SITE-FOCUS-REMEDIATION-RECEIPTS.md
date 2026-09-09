# Site Focus Remediation Receipts v0.1

A **Site Focus Remediation Receipt** records a reviewed Site Focus finding that was patched directly, deployed, and re-measured without pretending that a SignalBraid transformation happened.

It fills the proof gap between:

`Site Focus report → reviewed direct patch → deployment → production Site Focus report`

and the stronger transformation lineage required by a formal SignalBraid Change Receipt.

## When to use it

Use a Site Focus Remediation Receipt when all of the following are true:

- a Site Focus finding led to a deliberate repository change;
- the change was made directly rather than through a Transformation Bundle;
- source checks passed;
- the target commit was successfully deployed;
- production Site Focus ran **after** that deployment;
- there is at least one transparent before/after diagnostic;
- important outcomes that were not measured remain explicitly unknown.

Do not use it as a ranking, citation, traffic, conversion, accessibility, performance, or efficacy claim unless those outcomes have their own evidence.

## Schema

`schema/site-focus-remediation-receipt-v0.1.schema.json`

The receipt carries:

- canonical site and repository;
- baseline commit and optional baseline report evidence;
- reviewed findings and decisions;
- exact change commits and paths;
- source-check workflow evidence;
- deploy workflow evidence;
- production Site Focus workflow and artifact digest;
- before/after diagnostics with an interpretation for each metric;
- mandatory known unknowns;
- keep / revert / review outcome;
- explicit relationship to a formal SignalBraid Change Receipt.

## Relationship to SignalBraid Change Receipts

A Site Focus Remediation Receipt is **not** a weaker-looking alias for a Change Receipt.

SignalBraid Change Receipts require transformation lineage such as the relevant Transformation Bundle and BraidGraph. If that lineage does not exist, do not invent it after the fact.

Use:

```json
{
  "formalChangeReceipt": {
    "status": "not-applicable",
    "reason": "The remediation was a reviewed direct patch and did not execute through a Transformation Bundle/BraidGraph path."
  }
}
```

If the same remediation later goes through the transformation engine and satisfies Change Receipt lineage requirements, the Site Focus Remediation Receipt may point to the generated formal receipt by setting `status` to `generated` and providing `receiptId`.

## Deployment proof requirement

The `productionFocus` evidence requires:

- the exact deployed commit SHA;
- a successful production-focus workflow run;
- a SHA-256 artifact digest;
- `verifiedAfterSuccessfulDeploy: true`.

The recommended sequencing is defined in `docs/SITE-FOCUS-DEPLOYMENT-PROOF.md`.

## Measurement rule

Before/after values must describe only what was actually observed.

Good examples:

- `dynamic evidence metadata fields`: `0 / 3 → 3 / 3`;
- `Site Focus thesis token coverage`: `0.184 → 0.245`;
- `unclassified route roles in a fixed sample`: `8 → 0`;
- `stale protocol-specific claims possible after matcher change`: `true → false`.

Bad examples without separate evidence:

- “SEO improved”;
- “AI recommendations increased”;
- “users trust the site more”;
- “conversion improved”;
- “Core Web Vitals improved”.

## Review outcome

`outcome` is one of:

- `keep` — evidence supports retaining the patch;
- `revert` — evidence supports rolling it back;
- `review` — evidence is insufficient or conflicting.

This is an operational decision about the remediation, not a universal quality score.
