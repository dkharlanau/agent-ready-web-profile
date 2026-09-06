# Growth owner review receipts

Status: operational contract · v0.1 · reviewed 2026-09-06

ARWP intentionally keeps some Growth checks manual because a public HTTP scanner cannot honestly decide originality, editorial usefulness, commercial control or site-reputation boundaries. A site that has already completed one of those reviews can publish an owner review receipt at `ai/growth-review.json` so the same manual task does not reappear in every Growth backlog.

The receipt is workflow evidence only. It is **owner-controlled**, never independent evidence, a quality certification, or proof of ranking, indexing, citation, recommendation, traffic or conversion impact.

## Contract

Use `schema/growth-owner-review.schema.json` and start from `templates/growth/owner-review.json`.

A valid receipt must:

- identify the canonical HTTPS site;
- use `evidenceClass: owner-controlled`;
- preserve the three guardrails `notIndependentEvidence`, `noRankingClaim` and `manualJudgmentPreserved` as `true`;
- identify the exact `growth:*` action reviewed;
- record `status: completed`, a review date, a decision, a plain-language summary, scoped URLs and public evidence URLs;
- avoid future-dated reviews and duplicate action IDs.

`keep` and `retire` decisions can close a matching action whose current ARWP status is `manual`. `revise` and `revert` remain visible because they imply unresolved follow-up.

## Safety boundary

A receipt can close only a matching **manual** Growth action. It cannot close:

- technical failures or crawl blockers;
- implementation recommendations that ARWP still observes as missing;
- authenticated owner-data tasks such as Search Console, Bing or Google AI visibility measurements;
- provider controls that require authenticated verification;
- independent-evidence requirements.

ARWP keeps the applied receipt in `ownerReviewEvidence` with `independentEvidence: false` and `rankingImpactClaimed: false`, even after the repeated manual action is removed from the active backlog.

## Why this exists

Without a receipt, the safe behavior is to ask for the human review on every audit because the crawler cannot see that it happened. With a receipt, ARWP can distinguish:

```text
manual judgment required
        ↓
owner completes review
        ↓
public owner-controlled receipt
        ↓
ARWP validates scope + evidence class
        ↓
manual task leaves active backlog
        ↓
receipt remains visible as owner-controlled evidence
```

This reduces repetitive work without turning self-attestation into an authority signal.
