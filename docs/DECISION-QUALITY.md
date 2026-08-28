# Resolver decision quality

Resolver quality is not the number of discovered surfaces. It is the quality of the final decision for a concrete intent.

## States

Planning should evolve from a binary `selected / none` model toward four explainable outcomes:

- `selected` — evidence is sufficient to recommend one interface;
- `ambiguous` — multiple materially conflicting candidates remain and policy cannot justify one;
- `insufficient-evidence` — interfaces may exist, but discovered evidence is not strong/scoped/stable enough to recommend them;
- `none` — no suitable interface was discovered.

The distinction matters because adding discovery can otherwise make a union resolver worse by creating confident false positives.

## Eligibility before ranking

Candidates should pass eligibility before score/rank:

1. protocol semantics fit the requested intent;
2. evidence scope fits the target URL/site scope;
3. the candidate is stable enough for the requested use;
4. the evidence actually declares a usable interface rather than only metadata about one;
5. known conflicts/identity mismatches are surfaced rather than hidden by score.

Only then should authority and preference rank eligible candidates.

## Examples

- OpenAPI is a structured API description, not automatically a search interface.
- A root-wide API Catalog may be useful evidence, but a path-scoped docs target should not automatically inherit every vendor API as its structured interface.
- A presigned temporary object URL may prove that an API description exists, but is a poor durable recommendation.
- An A2A Agent Card is metadata; its `supportedInterfaces[]` entries are the callable interfaces.
- MCP can satisfy search only when search/retrieval semantics are actually evidenced; generic tool availability is insufficient.

## Benchmark consequence

Abstention is not free. If reviewed ground truth contains a usable interface, `ambiguous` or `insufficient-evidence` still counts as an incorrect benchmark decision. The policy exists to reduce unjustified selection, not to hide misses.

## Resolver regret

R4 also tracks a stricter decision-quality metric: **resolver regret**.

A union decision has regret when it is wrong for an intent while at least one simpler strategy was correct on the same frozen ground truth. A union result is **uniquely correct** only when the union is right and every simpler strategy is wrong.

This prevents “more protocols discovered” from being treated as product progress when a simpler resolver would have made a better decision.

The first measured eligibility correction removed generic OpenAPI descriptions from search selection without changing the reviewed 20-site corpus. The result moved `resolver-union` from 81/100 to **86/100** and reduced over-selection from 10 to **5**, but `llms-aware` remains **89/100**. The same run measured **6 regret cases** and **0 uniquely-correct union cases**. See [`benchmarks/results/2026-08-28-r4-openapi-search-eligibility.md`](../benchmarks/results/2026-08-28-r4-openapi-search-eligibility.md).

Therefore `resolver-union` remains an experimental strategy in R4. It should not become the default recommendation merely because it discovers more protocol surfaces. The gate for dominance is evidence-based: reduce regret and match or exceed the best simpler strategy on unchanged reviewed ground truth.

## Frozen truth versus live capability drift

A live benchmark has a second failure mode: the website may have changed after the last human ground-truth review.

For example, a publisher may begin serving a valid same-origin standard discovery resource such as an A2A Agent Card or an RFC 9727 API Catalog after the benchmark expectation was reviewed. If frozen truth still says `correct-none`, Resolver must continue to score as wrong until a human re-review occurs. Otherwise the system would be grading itself by silently changing the answer key.

At the same time, a live same-origin standard-native publisher signal should not be automatically suppressed just to improve the old score. Current diagnostics therefore separate two statements:

1. **benchmark result** — selected interface is wrong against frozen reviewed truth;
2. **ground-truth review candidate** — live publisher evidence may indicate that the reviewed truth is stale and needs human re-validation.

`selection-diagnostics.mjs` flags a ground-truth review candidate only when the current mismatch is an over-selection/false-positive against `correct-none`, the discovered source is a recognized standard-native discovery class, and the selected interface stays on the target origin. The flag does not change `correct`, `regret`, `accepted`, or any historical score.

Human re-review must classify the case as one of:

- `resolver-error` — live evidence does not actually establish a suitable interface for the target/intent;
- `publisher-capability-drift` — the publisher now exposes a suitable interface and frozen truth should be superseded by a new reviewed revision;
- `ambiguous-or-insufficient` — evidence exists but is not yet strong enough to change either Resolver policy or ground truth.

The current pending queue is stored in [`benchmarks/results/2026-08-28-r4-ground-truth-review-queue.json`](../benchmarks/results/2026-08-28-r4-ground-truth-review-queue.json). It is derived from the measured regret/provenance run and contains no automatic verdicts.

### Build a read-only review card

The review helper assembles the frozen expectation, pinned semantic-review receipt, previous evidence basis and current standard discovery class. It has no mutation or approval command.

```bash
node benchmarks/ground-truth-review.mjs \
  --site=fastmcp-docs \
  --intent=agent \
  --format=markdown
```

Or inspect the complete queue in JSON:

```bash
node benchmarks/ground-truth-review.mjs --format=json
```

A card includes the conventional standard probe that should be inspected during re-review, but the tool cannot change the fixture. A new reviewed ground-truth revision must remain a separate explicit commit with review date, evidence basis and reason.

If ground truth changes, preserve the old reviewed corpus and score history. Publish a new review revision/date/reason rather than rewriting past benchmark evidence in place.
