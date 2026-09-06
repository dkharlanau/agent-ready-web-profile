# ARWP Trend History

Trend Radar is useful only if it preserves how guidance changes over time. `arwp-trend-history` creates deterministic snapshots of the versioned Trend registry and compares them without rewriting previous evidence.

## Snapshot

```bash
arwp-trend-history snapshot \
  --observed-at=2026-09-06T10:00:00Z \
  --tool-version=0.2.0 \
  --output=.arwp/trends/2026-09-06.json
```

A snapshot stores the stable state needed to recognize:

- stage;
- confidence and maturity;
- primary source and source review date;
- action and measurement references;
- a digest of the trend's human-readable content and applicability.

Input order does not affect the snapshot ID.

## Diff

```bash
arwp-trend-history diff \
  .arwp/trends/2026-09-06.json \
  .arwp/trends/2026-09-13.json
```

The diff reports:

- new trends;
- removed trends, which remain visible in history;
- source changes;
- source-review-date changes;
- content/applicability changes;
- action/measurement reference changes;
- lifecycle transitions such as `watch->adopt`.

A lifecycle transition is registry state, not outcome evidence. `WATCH -> ADOPT` means ARWP's evidence/review threshold for recommending the mechanism changed. `ADOPT -> MEASURED` must still be backed by real longitudinal experiment evidence; the history tool does not create that evidence itself.

## Why append-only history matters

Search and AI guidance changes quickly. Without dated snapshots, a project can accidentally present today's advice as if it had always been known, erase retired tactics, or lose the source change that justified a recommendation. Trend history makes the provenance of ARWP's own recommendations auditable.
