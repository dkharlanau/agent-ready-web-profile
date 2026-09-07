# SignalBraid Change Receipts

Status: **v0.1 foundation · 2026-09-07**

A Change Receipt is the durable **Proof** object for one exact target-site transformation.

It answers:

- which source/rule versions justified the change;
- which recommendation selected it;
- which repository/base commit and exact paths were involved;
- what the before/after SHA-256 values were;
- which automation class and grounding evidence applied;
- whether the change was only planned, applied locally, opened as a PR, merged, deployed or rolled back;
- which verification checks were expected and observed;
- which Search/AI/runtime/owner outcomes were expected and observed;
- whether later rule/source state makes the old change a re-review candidate;
- whether a reviewer chose to keep, revise, revert, retire or continue measuring it.

A Change Receipt does **not** claim that implementation caused Search ranking, AI citation, recommendation traffic or business outcomes.

## Why this is separate from Evidence Receipts

ARWP already has immutable **Evidence Receipts** for Resolver observations.

Those receipts answer a different question: what public interfaces/protocol evidence did the Resolver observe at a specific time?

Change Receipts do not copy that payload. They store only a verified reference:

```text
receiptId + payload digest + role + canonical URL + observation time
```

This keeps the Evidence Receipt independently verifiable and avoids duplicating its source/interface payload inside every change record.

## Why this is separate from local rollback receipts

`arwp-transform apply` can return private rollback material containing previous repository content.

Change Receipts never embed that content. When a local apply receipt is supplied, Change Receipt stores only:

- the execution receipt digest;
- exact before/after file digests already present in the Transformation Bundle;
- `rollback.state = private-material-available`.

The private rollback receipt stays outside the public/portable Change Receipt.

## Content identity and revisions

Every Change Receipt is content-addressed:

- `changeId` is derived from the immutable Transformation Bundle digest;
- `receiptId` is derived from the complete Change Receipt payload;
- revision 1 has `previousReceiptId: null`;
- every later revision points to the immediately preceding immutable receipt.

A new measurement or rule re-review **does not edit revision 1**. It creates revision 2, 3, and so on.

Stable change facts cannot be rewritten across revisions:

- site/repository identity;
- Transformation Bundle identity;
- exact mutation operations and before/after digests;
- original source/rule lineage.

Evidence can be appended and state can advance.

## Create a receipt

A valid Transformation Bundle and the BraidGraph compiled from that exact bundle are required.

```bash
node bin/arwp-change-receipt.mjs create \
  transform.bundle.json \
  braid.json \
  --out=change-receipt.r1.json
```

The BraidGraph requirement is intentional: it prevents a Change Receipt from inventing source/rule lineage after the fact.

Optional evidence can be supplied:

```bash
node bin/arwp-change-receipt.mjs create \
  transform.bundle.json braid.json \
  --execution-kind=github-pr \
  --execution=transform-pr-result.json \
  --evidence-receipt=resolver-before.receipt.json \
  --evidence-role=pre-change-resolver-observation \
  --verifications=verification.json \
  --out=change-receipt.r1.json
```

## Revise append-only evidence

```bash
node bin/arwp-change-receipt.mjs revise \
  change-receipt.r1.json \
  --deployment=deployment.json \
  --outcomes=owner-outcome.json \
  --review=review.json \
  --out=change-receipt.r2.json
```

Verify the chain:

```bash
node bin/arwp-change-receipt.mjs verify-revision \
  change-receipt.r1.json change-receipt.r2.json
```

## Rule/source re-review

A later BraidGraph can be compared against the original rule identities:

```bash
node bin/arwp-change-receipt.mjs revise \
  change-receipt.r2.json \
  --braid=current-braid.json \
  --out=change-receipt.r3.json
```

If a current rule is `review-due`, retired/superseded, missing, or has a different version/state than the one that justified the change, the new receipt revision sets:

```json
{"knowledge":{"reReviewRequired":true}}
```

That means **review this historical implementation again**. It does not mean the site is automatically broken and does not authorize an automatic rollback.

## Verification and outcome evidence remain different

Verification evidence answers whether implementation worked technically:

- build/test/lint;
- ARWP re-audit;
- runtime check;
- exact rendered-state verification.

Outcome evidence answers what was later observed externally:

- Search visibility/indexing evidence;
- AI citation/grounding observations;
- referrals/traffic;
- agent/runtime outcomes;
- business metrics.

A passing build never closes an outcome requirement.

Negative and neutral outcomes are retained as observations. They are not converted to missing data simply because the result was undesirable.

## BraidGraph integration

```bash
node bin/arwp-change-receipt.mjs braid \
  braid.json change-receipt.r1.json \
  --out=braid-with-receipt.json
```

The receipt becomes a compact `change-receipt` graph node. It uses existing graph relations deliberately:

```text
change-receipt --depends-on--> exact transform
verification --verifies------> change-receipt
measurement --observes-------> change-receipt
new receipt --supersedes-----> prior receipt
```

Because `depends-on`, `verifies`, `observes` and `supersedes` already participate in BraidGraph traversal, the existing graph can answer:

```text
rule -> recommendation -> transform -> change receipt -> measurement
```

without adding a parallel provenance model.

## Missing-evidence queues

```bash
node bin/arwp-change-receipt.mjs braid-report braid-with-receipts.json
```

The report keeps separate queues for:

- merged/deployed changes with no outcome observation;
- executed changes with no verification evidence;
- receipts requiring knowledge re-review;
- failed/mixed verification;
- rolled-back changes.

Missing owner evidence is `unknown`, never zero.

## Review decisions

Supported explicit review states are:

- `pending`;
- `keep`;
- `revise`;
- `revert`;
- `retire`;
- `continue-measuring`.

Review state is evidence about the owner/team decision, not proof of ranking/citation impact.

## Guardrails

- Change Receipt is not mutation authorization;
- historical revisions are immutable;
- rollback content is not embedded;
- external Evidence Receipt payloads are referenced, not copied;
- verification is not outcome evidence;
- negative/neutral evidence is preserved;
- missing outcome evidence remains unknown;
- later rule change creates a re-review candidate, not automatic breakage;
- no ranking/citation guarantee is encoded in the receipt.
