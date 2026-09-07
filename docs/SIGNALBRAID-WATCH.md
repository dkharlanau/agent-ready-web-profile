# SignalBraid Watch — Reverse Impact

Status: **v0.1 foundation · 2026-09-07**

SignalBraid Watch turns BraidGraph from a provenance/explanation graph into a maintenance queue.

Instead of re-auditing every site after every Search/AI/platform change, Watch asks:

```text
changed source / rule
        ↓
recorded BraidGraph dependencies
        ↓
affected recommendations
        ↓
previous transforms / Change Receipts
        ↓
exact repository paths + public surfaces
        ↓
review classification + explicit priority factors
```

Impact means **candidate for re-review**. It does not mean the implementation is broken, does not prove a ranking/citation effect and never authorizes production mutation.

## Target manifest

Watch operates on already-built BraidGraph artifacts.

```json
{
  "$schema": "https://raw.githubusercontent.com/dkharlanau/agent-ready-web-profile/main/schema/watch-targets.schema.json",
  "version": "0.1",
  "sites": [
    {
      "id": "site-a",
      "graph": "graphs/site-a.braid.json",
      "importance": "high",
      "enabled": true,
      "portfolioSiteId": "site-a"
    }
  ]
}
```

`importance` is explicit operator metadata: `critical`, `high`, `normal` or `low`. Watch does not infer business importance from traffic, rankings, domain authority or AI visibility.

CLI graph paths are relative to the manifest directory and cannot escape it through `..`, absolute paths or symlink traversal.

## Explicit impact

```bash
node bin/arwp-watch.mjs impact watch-targets.json \
  --rule=canonical-discovery \
  --portfolio=registry/portfolio-sites.json \
  --out=watch-impact.json
```

or by exact source URL:

```bash
node bin/arwp-watch.mjs impact watch-targets.json \
  --source=https://example.org/current-guidance \
  --out=watch-impact.json
```

When historical rule/source versions coexist, Watch prefers the non-historical current node for an explicit selector. Historical nodes remain reachable as provenance.

## Changed since

```bash
node bin/arwp-watch.mjs changed-since watch-targets.json \
  --since=2026-09-07T00:00:00Z \
  --out=watch-impact.json
```

`changed-since` is deliberately evidence-strict. It reacts to dated `supersedes` edges already recorded in BraidGraph.

It does **not** invent a change date from:

- lexical version strings;
- page modification times without a recorded rule/source revision;
- Git history alone;
- a source being currently `review-due` with no dated transition event.

For current `review-due` or `retired` states without a recorded revision event, use explicit `impact --rule` or `impact --source`.

## Proof portfolio queues

Reverse impact answers “what implementation may be affected by an upstream rule/source change?”. Proof queues answer the separate operational question “which already executed changes need attention now?”.

```bash
node bin/arwp-watch.mjs proof-queues watch-targets.json \
  --portfolio=registry/portfolio-sites.json \
  --out=watch-proof-queues.json
```

The mode consumes the latest Change Receipt revision for every `changeId` already indexed in each target BraidGraph and aggregates the existing Proof queues:

- `failedVerification`;
- `missingVerification`;
- `reReviewRequired`;
- `mergedButUnmeasured`;
- `rolledBack`.

A change can belong to more than one queue. Watch emits it once and preserves every membership in `queues[]` plus an explicit reason/priority per queue. This prevents a deployed change that is both unmeasured and due for knowledge re-review from becoming duplicate portfolio rows.

Priority remains a decision tree, not a hidden score. It combines the queue type with the operator-declared target importance. Examples:

- failed verification on a critical/high target → `P0`;
- missing verification or knowledge re-review on a high target → `P1`;
- merged-but-unmeasured on a high/normal target → `P2`;
- low-importance measurement/re-review gaps → `P3`.

Every row keeps `priorityFactors[]`, the full receipt state, all queue memberships and a prose rationale. Missing owner outcome evidence stays `unknown`; it is never converted to zero or failure.

The machine contract is `schema/watch-proof-queue-bundle.schema.json` and can be checked with:

```bash
node bin/arwp-watch.mjs validate-proof-queues watch-proof-queues.json
```

For a compact human view use `--text`.

## Review classifications

Watch emits one of four reverse-impact review classes:

### `re-review`

The trigger applies, but the graph does not justify assuming an update is required.

Typical case: a current rule is `review-due`, or a revision has no recorded transform downstream.

### `likely-update`

A dated supersession/revision reaches existing transform or Change Receipt evidence.

This means an implementation probably deserves comparison with current guidance. It is still not automatic breakage.

### `retire-candidate`

The current rule is explicitly `retired` and recorded implementations depend on it.

Retirement does not itself authorize deletion or rollback.

### `blocked-owner-review`

Affected work crosses a policy/editorial/owner-platform/runtime boundary or a policy node.

Examples:

- crawler/content-use policy;
- editorial claims/authorship decisions;
- Search Console/Merchant/Business Profile state;
- browser/runtime/security behavior.

These stay human/owner-gated even if the dependency graph is exact.

Proof portfolio rows use narrower operational classifications instead: `verification-failure`, `verification-gap`, `knowledge-re-review`, `measurement-gap`, and `rollback-review`.

## Priority is a decision tree, not a score

Watch does not create another opaque 0–100 urgency metric.

Priority is `P0`–`P3` using inspectable factors such as:

- trigger state (`retired`, `review-due`, recorded supersession);
- explicit site importance;
- whether a transform exists;
- whether an executed Change Receipt exists;
- whether owner/policy review is required.

Examples:

- critical site + recorded revision + executed change → `P0`;
- superseded/retired dependency with executed change → `P1`;
- review-due dependency with an implementation → `P1/P2` depending on explicit importance;
- no transform recorded → typically `P3` informational re-review.

Every impact row carries `priorityFactors[]` and a prose `rationale` explaining the classification.

## Exact impact surfaces

Where BraidGraph has the evidence, Watch includes:

- affected recommendation IDs and automation classes;
- transform operation IDs/states;
- exact repository paths from Repository Mapper / Transformation evidence;
- public surface identifiers;
- Change Receipt revisions and their mutation/verification/outcome/re-review/review states;
- policy node IDs;
- historical/superseded evidence node IDs.

This is why Map and Proof matter: reverse impact can point to `index.html`, a canonical surface and a prior negative outcome instead of only saying “SEO rule changed.”

## Preserve previous negative/no-change reviews

Watch does not delete a prior `negative`, `neutral`, `keep`, `revert` or other reviewed outcome merely because a new upstream event occurred.

Historical evidence remains in the reachable Change Receipt/BraidGraph chain so reviewers can see:

- whether the same implementation was already reviewed;
- whether an earlier change produced no external movement;
- whether the previous decision was to keep/revert/continue measuring;
- whether the current event is genuinely a new source/rule revision.

The v0.1 bundle does not silently suppress repeated alerts from that history; it preserves the evidence for deterministic review. A future suppression/deduplication layer must be evidence-keyed to an exact trigger version/event, not a fuzzy “we saw this before” heuristic.

## Portfolio integration

`--portfolio=registry/portfolio-sites.json` enriches reverse-impact and Proof queue rows with a matching `portfolioSiteId` when the Watch target matches by explicit ID, canonical URL or repository. Proof queue rows also retain the matched portfolio name when present.

Watch does not duplicate Portfolio Rollout proposal logic from the Growth layer. Portfolio metadata annotates graph evidence; it does not create target-site mutations.

## Unaffected / excluded sites

Unaffected reverse-impact targets are omitted from `impacts[]` and listed separately in `excludedSites[]` with an inspectable reason:

- `disabled`;
- `trigger-not-present`;
- `no-recorded-change-since`.

Proof queue mode uses:

- `disabled`;
- `no-change-receipts`;
- `no-proof-queue-items`.

This keeps the actionable portfolio compact without hiding why a member was excluded.

## Output

The reverse-impact machine contract is:

`schema/watch-impact-bundle.schema.json`

Validate it:

```bash
node bin/arwp-watch.mjs validate-bundle watch-impact.json
```

Human reverse-impact review view:

```bash
node bin/arwp-watch.mjs changed-since watch-targets.json \
  --since=2026-09-07T00:00:00Z \
  --text
```

## Guardrails

- impact is not breakage proof;
- Proof queue membership is not outcome causality;
- production mutation is always false in Watch output;
- priority is explainable and non-composite;
- history remains versioned;
- missing owner outcome evidence remains unknown, not zero;
- negative/no-change evidence remains visible;
- owner/policy/editorial/runtime work stays gated;
- no ranking/citation guarantee or causal claim is produced by graph reachability or Proof queue membership.
