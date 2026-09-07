# Future Search Lab

Canonical HTML: https://dkharlanau.github.io/agent-ready-web-profile/future-search/

ARWP Future Search Lab keeps current platform requirements separate from mechanisms that may improve future machine retrieval, semantic understanding and browser-agent operation.

The working rule is simple: **a useful open-web semantic mechanism does not need to be a documented ranking factor to be worth a bounded experiment, but it must describe reality and remain verifiable.**

## Core layers

- broader applicable Schema.org semantics beyond today's rich-result requirements;
- stable page/entity identity and relation graphs;
- optional aggregate semantic index compiled from canonical pages and reusable entities;
- explicit evidence relations between publications, methods, datasets, software and other real artifacts;
- owner-observed intent → canonical page → evidence feedback using Search Console and Bing AI evidence;
- native semantic HTML and accurate ARIA for interactive browser-agent compatibility;
- truthful change notification and persistent identifiers where applicable.

## Semantic index

```bash
node bin/arwp-semantic-index.mjs build \
  registry/page-manifest.json \
  registry/entity-catalog.jsonld \
  --output=semantic-index.jsonld
node bin/arwp-semantic-index.mjs check semantic-index.jsonld
```

The index is optional. Canonical HTML, visible navigation, sitemap and page-local truthful JSON-LD remain primary.

## Maturity

- `foundation`: useful on interoperability merits when applicable;
- `experiment`: bounded test with verification and rollback;
- `watch`: research/prototype, not a default requirement.

Canonical experiment registry: `registry/future-search-experiments.json`.

## Boundary

Future Search does not authorize schema volume for its own sake, hidden facts, invented citations/identifiers/actions, query-variant page factories, fake freshness, or claims that the semantic index is a Google/Bing/OpenAI ranking requirement.
