# AI Crawler & Access Matrix maintenance

The crawler matrix is a dated publisher-control reference for AI/search systems. It intentionally separates three questions:

1. may a system crawl/index content for search or answer grounding;
2. may a system fetch content because a user explicitly requested it;
3. may content be used for model training or related model-development purposes.

Do not collapse these questions into a single `aiAllowed` flag.

## Update rule

When vendor documentation changes:

- update `crawlers.json` only after reviewing official sources;
- add a new immutable file under `history/YYYY-MM-DD.json`;
- append that snapshot to `history/index.json`;
- preserve conflicting official statements as `official-source-conflict` until the provider clearly resolves them;
- do not infer behavior from crawler names, third-party lists or observed traffic alone;
- keep copyright/reuse permission separate from technical crawler access.

## Reusable policies

`policies/search-yes-training-no.robots.txt` is a conservative example for publishers that want AI/search discoverability but want to opt out of the documented training crawlers/product tokens covered by the matrix.

`policies/search-and-training-yes.robots.txt` is an example for publishers that intentionally allow both discovery and the documented training-related access surfaces covered by the matrix.

These are examples, not universal legal or ranking recommendations. Review vendor documentation and site policy before copying them to another site.
