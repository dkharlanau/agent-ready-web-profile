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

Do not commit credentials, private URLs, private benchmark targets or browsing-history data.
