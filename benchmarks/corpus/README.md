# External Resolver Corpus

This directory is reserved for reviewed public-site benchmark fixtures.

Owned/reference sites may be used for engineering coverage, but they must be labeled `ownership: project-reference` and must not count toward independent adoption or external utility claims.

Target initial external corpus: **20–50 public sites** focused on documentation, research, public knowledge, open data and developer/technical portals.

Each fixture should record:

```json
{
  "id": "example-docs",
  "url": "https://example.com/",
  "ownership": "independent",
  "reviewedAt": "YYYY-MM-DD",
  "accepted": {
    "read": ["https://example.com/llms.txt"],
    "search": ["https://example.com/search.json"],
    "structured": ["https://example.com/openapi.json"],
    "tools": [],
    "agent": []
  },
  "evidence": [
    {
      "kind": "api-catalog",
      "url": "https://example.com/.well-known/api-catalog",
      "note": "Public RFC 9727 catalog points to the accepted OpenAPI description."
    }
  ]
}
```

Ground truth must come from reviewed public evidence or protocol-native runtime evidence. It must not be copied from Resolver output without independent review.

A site may have multiple accepted URLs for one intent.

## Semantic review receipts

`benchmarks/reviews/semantic-review-v0.2.json` records completed manual semantic reviews separately from transport-level liveness checks. Each receipt pins the exact Git blob SHA of the fixture that was reviewed and names the current fixture evidence used as the review basis.

`npm run test:benchmark` fails if a byte-pinned reviewed fixture changes without a new semantic review receipt. This prevents an old `reviewedAt` date from silently covering later ground-truth edits.

The receipt set may intentionally cover only part of the independent corpus while review is in progress; the test reports the reviewed count explicitly. Resolver output must not be used as the review basis.

Do not commit credentials, private URLs, private benchmark targets or browsing-history data.
