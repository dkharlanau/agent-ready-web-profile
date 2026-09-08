# Editorial fixtures

These educational examples demonstrate a useful page, precise claim attribution, a dated comparison, and a small consistent entity graph. They are not reports of ranking gains or live customer adoption.

- [Article](article.html) and [receipt](article.receipt.json): a source-backed answer with an original, explicitly proposed verification sequence.
- [Comparison](comparison.html) and [receipt](comparison.receipt.json): documented capabilities of publishing approaches, cell-level sources, explicit editorial fit judgments, and clear limits.
- [Entity graph](entity-graph.jsonld): the same graph embedded in the article, with stable IDs and a visible fictional publisher identity.
- [Shared presentation](editorial.css): readable responsive HTML; citations work without JavaScript.

The examples use a reserved example.com canonical and `noindex`. Example Documentation is a visibly labeled fictional publisher. Replace those fixture values and review the actual publishing and indexing policy before adapting the pattern. The receipt's review date describes the source review for this fixture, not production publication, independent human review, or measured product outcomes.

From a repository checkout, validate receipt consistency:

```sh
node bin/arwp.mjs editorial-check examples/editorial/article.receipt.json --json
node bin/arwp.mjs editorial-check examples/editorial/comparison.receipt.json --json
```

Also inspect the actual page: each receipt anchor must exist, its claim must be visible, and its source must support it. JSON validation cannot establish those facts. For a real product comparison, replace the approach comparison with current evidence for the named products; preserve unknown values, relationships, method, date, and source links.

Open the HTML in a browser or serve the repository with a local static server. The examples make no network requests beyond a user's source-link navigation.
