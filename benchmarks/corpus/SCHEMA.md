# Corpus fixture semantics

Required fields for reviewed benchmark entries:

- `id` — stable local fixture identifier;
- `url` — canonical public site URL under review;
- `ownership` — `independent`, `project-reference`, or `example-only`;
- `reviewedAt` — review date;
- `accepted` — arrays of acceptable public interfaces for `read`, `search`, `structured`, `tools`, `agent`;
- `evidence` — public evidence that supports the accepted-interface ground truth.

Only `ownership: independent` entries may count toward external utility/adoption evidence.

A fixture can accept multiple URLs for one intent when multiple interfaces are genuinely equivalent.
