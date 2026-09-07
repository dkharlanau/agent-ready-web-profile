# Entity remediation reference repository

Synthetic first-party repository fixture used to demonstrate ARWP's proposal-only entity remediation behavior.

- `source/facts.jsonld` contains grounded Dataset creator/license facts.
- `public/dataset.jsonld` represents a separate structured-data target missing those facts.
- `public/guide.jsonld` intentionally lacks Article.author and has no grounded author elsewhere.

Run with the public synthetic gap report:

```bash
node bin/arwp-entity-remediation.mjs docs/entities/gaps/reference-report.json \
  --repo-root=examples/entity-remediation \
  --output=entity-remediation.json
```

Expected behavior: creator/license may become grounded JSON Patch proposals; the missing article author remains manual. No fixture file is modified.
