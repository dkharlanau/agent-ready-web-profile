# ARWP Growth Experiments

Growth hypotheses become useful only when implementation and outcome evidence can be connected without pretending that correlation proves causality.

`arwp-growth-experiment` creates a durable record for one hypothesis and the concrete Growth actions being tested.

## Evidence chain

```text
Growth hypothesis
      ↓
active site action(s)
      ↓
before Growth snapshot
      ↓
implementation commit / change URI
      ↓
after Growth snapshot
      ↓
optional owner-side visibility before/after
      ↓
explicit human review: keep / revise / revert / retire / continue measuring
```

A Growth snapshot measures observed implementation state. A visibility snapshot records aggregate owner-side Search/AI/referral signals. Neither one proves ranking impact. The experiment record keeps those evidence classes separate and only joins them for review.

## Create an experiment

First create the normal Growth baseline and immutable Growth snapshot. Then bind a known hypothesis to one or more actions that are actually active in that baseline:

```bash
arwp-growth-experiment create before.growth.snapshot.json \
  --id=entity-identity-001 \
  --hypothesis=entity-identity \
  --actions=growth:entity-identity \
  --commit=abcdef1 \
  --before-visibility=before.visibility.json \
  --output=experiment.json
```

The CLI rejects action IDs that were not present in the before snapshot. This prevents retrospective experiments from being attached to work that was never part of the observed baseline.

## Evaluate

After the implementation has had a useful observation window, capture another Growth snapshot. If owner-side evidence is available, capture matching visibility snapshots as well.

```bash
arwp-growth-experiment evaluate experiment.json \
  before.growth.snapshot.json \
  after.growth.snapshot.json \
  --before-visibility=before.visibility.json \
  --after-visibility=after.visibility.json \
  --output=experiment.measured.json
```

The evaluation records:

- whether each tested Growth action resolved, changed or remains open;
- high-priority implementation-debt movement;
- the count and direction of comparable owner-side metric changes;
- whether outcome evidence is unavailable, positive, negative, mixed or unchanged as an **observation**;
- a mandatory `reviewRequired: true` marker.

ARWP does not automatically promote a hypothesis from a positive metric delta.

## Review

```bash
arwp-growth-experiment review experiment.measured.json \
  --decision=keep \
  --notes="Keep the implementation; continue the observation window." \
  --output=experiment.reviewed.json
```

Supported decisions are `keep`, `revise`, `revert`, `retire`, and `continue-measuring`.

Negative and neutral results must remain in history. A methodology that only preserves wins turns quickly into folklore.

## Guardrails

Every v0.1 experiment record requires these invariants:

- no ranking guarantee;
- no causality inference;
- preserve negative results;
- human review before hypothesis promotion.

This layer is designed for longitudinal learning, not for manufacturing an ARWP effectiveness score.
