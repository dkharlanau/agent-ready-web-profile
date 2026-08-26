# Iteration 3 — Resolver Dominance & External Trust

ARWP has enough discovery breadth to stop optimizing for feature count.

The next milestone is about decision quality, compatibility, distribution and independently verifiable evidence.

## Product objective

> **ARWP Resolver should be safer and more useful than any single discovery strategy, while preserving evidence and abstaining when the evidence does not justify a recommendation.**

The current frozen 20-site independent benchmark is the immediate forcing function:

- `llms-aware`: 89 / 100
- `resolver-union`: 81 / 100
- union mismatches: 19
  - 10 over-selection
  - 6 discovery gaps
  - 3 selection gaps

The reviewed fixture ground truth stays frozen while the first dominance work is evaluated. Fixing the benchmark by editing accepted results to match Resolver output is explicitly prohibited.

## R4 exit criteria

R4 is complete only when all of the following are true:

1. Resolver union no longer underperforms the strongest simpler strategy on the frozen reviewed corpus.
2. Over-selection is reduced through general scope/evidence rules, not site-specific deny lists.
3. Ambiguous evidence can produce an explicit abstention rather than a confident bad route.
4. A2A planning routes to callable interfaces from Agent Cards, never to the metadata document itself.
5. Current MCP runtime/discovery behavior is revalidated against the 2026-07-28 protocol generation and independent implementations.
6. A2A 1.0.x shape/signature behavior is exercised against independent SDK/TCK evidence.
7. The 0.2.x package and primary Resolver MCP artifact are publicly installable.
8. The bounded hosted Resolver is live and the Pages UI can resolve at least one owned and one independent site.
9. Benchmark/evidence results have durable, indexable publication URLs and provenance.
10. At least one independent downstream client consumes Resolver output; three independent adopter/consumer records remain the broader target.

## Execution order

### P0 — Decision quality

1. Fix protocol-semantic correctness defects before ranking tuning.
2. Eliminate OpenAPI-as-search inference unless search semantics are explicitly evidenced.
3. Add scope-aware eligibility for root-wide discovery when resolving a path-scoped target.
4. Treat temporary/signed interface URLs as unstable evidence: preserve them, but do not recommend them as durable interfaces by default.
5. Add explicit `ambiguous` / `insufficient-evidence` planning outcomes when competing evidence cannot justify one route.
6. Add benchmark regret diagnostics: cases where a simpler strategy is correct and resolver-union is not.
7. Rerun the same 20 fixtures after every general policy change and preserve before/after results.

### P0 — Upstream compatibility

1. Revalidate MCP 2026-07-28 discovery/runtime behavior and keep legacy compatibility isolated.
2. Build an MCP implementation matrix using independent SDK/server implementations.
3. Revalidate A2A 1.0.x Agent Card shape, callable endpoints and signature canonicalization.
4. Add an upstream compatibility watcher for material MCP, A2A, Agent Skills and RFC changes.

### P1 — Productization

1. Complete public npm + Official MCP Registry publication (#4).
2. Complete public bounded Resolver deployment (#5).
3. Add `arwp assert` for agent-facing interface contract checks in CI.
4. Add evidence receipts that record target, observation time, resolver version, selected/rejected interfaces, conflicts and digests.
5. Turn benchmark results into an indexable history with per-strategy and per-intent views.

### P2 — External evidence

1. Expand to a stratified 50-site independent corpus only after the current dominance gate improves.
2. Keep separate cohorts for documentation, developer/API portals, public knowledge bases, datasets/research and agent-native sites.
3. Collect external consumers/adopters and concrete friction (#6).
4. Observe real structural drift before expanding drift taxonomy.
5. Decide whether a public resolver registry is justified only from external usage.

## Product rules

- Do not add site-specific exceptions to improve benchmark percentages.
- Do not turn source authority into authorization or business trust.
- Do not infer search semantics merely because an OpenAPI description exists.
- Do not infer a callable A2A endpoint from the Agent Card URL; use the card's declared interfaces.
- Do not execute OpenAPI/MCP/A2A operations when operation semantics or permission are unknown.
- Preserve negative results and cases where a simpler strategy wins.
- Keep owner-controlled reference results separate from independent interoperability evidence.
- Keep ARWP Profile changes evidence-gated; the Resolver remains the primary product.

## First loop

The first R4 branch is `r4-resolver-dominance`.

Its initial defect fix changes A2A adaptation so a valid Agent Card contributes its declared callable `supportedInterfaces[]` endpoints while retaining `agentCardUrl` as provenance. This fixes a protocol-semantics error before benchmark-specific ranking work begins.
