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
