# Intent Ownership

Status: experimental operational layer · v0.1 · reviewed 2026-09-08

Intent Ownership turns the existing ARWP principle

`observed intent → canonical answer → evidence asset`

into a deterministic review contract.

The problem is not “how many keywords does this site cover?” The problem is whether a real intent family has one inspectable canonical owner, useful supporting pages and evidence, without manufacturing one URL for every query variation.

## Why this layer exists

Google's current generative Search guidance describes **query fan-out** as a retrieval technique that issues related queries, while explicitly warning publishers not to create separate content for every possible query or fan-out variation. Existing Search fundamentals still require clear, indexable, canonical pages and useful original content.

ARWP therefore treats a query/grounding phrase as **observation evidence**, not as an instruction to mint a new page.

This layer operationalizes the existing `intent-to-evidence-feedback-graph` Future Search experiment. It does not claim that explicit intent ownership is a Google/Bing ranking factor.

## Contract

A ledger records:

- owner-controlled site identity;
- the reviewed canonical-page inventory and index state;
- bounded intent families;
- the intent disposition: serve it or deliberately decline ownership;
- zero, one or multiple reviewed owner candidates;
- supporting pages;
- real evidence assets;
- provider-scoped Search/AI observations;
- disclosure class and anti-leak guardrails.

Run:

```bash
node bin/arwp-intent-ownership.mjs check \
  benchmarks/intent-ownership/public-fixture.json

node bin/arwp-intent-ownership.mjs report \
  benchmarks/intent-ownership/public-fixture.json
```

## Ownership states

`owned`
: Exactly one declared owner exists and its reviewed page state is `indexable`.

`unowned`
: The site intends to serve the family, but no owner is declared. Review whether an existing page can own it before considering a new URL.

`declined`
: The family was reviewed and the site deliberately does not claim it. This is appropriate for query mismatch, another product's navigational intent, or a user job the site should not serve. A declined family must have no owner and must retain a reason.

`fragmented`
: Multiple owner candidates are declared. This is a review queue, not automatic evidence that pages should be merged, redirected or canonicalized.

`blocked-owner`
: Exactly one owner is declared but the reviewed page state is `noindex`, `redirect` or `unknown`.

## Deliberate non-ownership

Zero owners does not always mean a content gap. Dogfood on real owner-query maps exposed an important failure mode: a lexically related page can receive impressions for a phrase that does not match the page's actual job. Turning every such phrase into `review-owner-gap` recreates the thin-page factory this layer is meant to prevent.

Use:

```json
{
  "intentDisposition": "decline",
  "dispositionReason": "The phrase is navigational for another product; current pages only overlap lexically.",
  "ownerUrls": []
}
```

`intentDisposition` defaults to `serve` for backward compatibility. `decline` is a reviewed architecture decision, not a negative ranking claim. It can be revisited when the product scope changes or stronger user evidence appears.

## Owner-side observations

A family may retain observations from Search Console, Bing AI Performance, referral analytics or a reviewed manual surface. Each observation keeps its provider, surface, phrase class, timestamp, landing/cited page and evidence reference.

The report intentionally does not add provider metrics together.

If an observation lands on a page other than the declared owner, the report emits `review-observed-off-owner`. That means only:

> observed retrieval/landing behavior differs from the reviewed ownership contract.

It does **not** prove keyword cannibalization, ranking loss or a need for redirects.

## Production surface proof

Source/repository truth is not enough to mark a canonical owner technically eligible on the public web. ARWP therefore supports a bounded production-surface proof:

```bash
node bin/arwp-intent-ownership.mjs probe \
  intent-ownership.json \
  --proof-output=surface-proof.json \
  --ledger-output=intent-ownership.observed.json
```

The probe checks every declared canonical page with bounded public HTTPS requests. For HTML pages, `indexable` means only that the current observation found:

- HTTP `200`;
- Googlebot allowed for that URL under the observed `robots.txt` rules;
- no `noindex` in robots meta or `X-Robots-Tag`;
- textual HTML content;
- no declared `rel=canonical` pointing away from the owner URL.

A same-origin redirect becomes `redirect`; an observed `noindex` becomes `noindex`. Network/robots uncertainty, non-HTML content, cross-origin redirects, non-200 responses and conflicting declared canonicals stay `unknown`.

This is deliberately a **technical eligibility proof**, not an indexing receipt. Google's own technical requirements say that eligibility does not guarantee indexing. Likewise, `rel=canonical` is a canonical preference signal; Google can select a different canonical. Actual Google indexing and Google-selected canonical require owner-side Search Console/URL Inspection evidence.

Primary references:

- <https://developers.google.com/search/docs/essentials/technical>
- <https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec>
- <https://developers.google.com/search/docs/crawling-indexing/canonicalization>

The proof also sets `deploymentCommitProven:false`. Public HTTP evidence proves what was observed at the URL, not which repository commit produced it. Use Change Receipts/deployment evidence separately when source→production parity matters.

For deterministic/offline use, apply an already captured proof:

```bash
node bin/arwp-intent-ownership.mjs apply-proof \
  intent-ownership.json \
  surface-proof.json \
  --output=intent-ownership.observed.json
```

The proof must cover exactly the canonical-page inventory in the ledger. This prevents a partial or stale surface sample from silently rewriting only convenient pages.

## Readiness gate

A successful `probe` means the bounded observation was captured and validated. It does **not** mean the site's served intent ownership is ready.

Gate the observed ledger separately:

```bash
node bin/arwp-intent-ownership.mjs gate \
  intent-ownership.observed.json
```

The gate passes only when every intent family whose disposition is `serve` has exactly one owner and that owner's current ledger state is `indexable`. It fails on `unowned`, `fragmented` and `blocked-owner` families. Reviewed `decline` families are intentionally excluded from the readiness requirement.

This split is deliberate:

- `probe` is observational and should preserve evidence even when production is unhealthy;
- `gate` is deterministic policy over the resulting ledger and is appropriate for CI/release decisions;
- deployment-commit parity remains a separate receipt because a technically healthy URL does not identify the source revision that produced it.

The gate still does not prove actual Google indexing, ranking, AI citation or Google-selected canonical, and it authorizes no production mutation.

## Action semantics

The report can queue:

- `review-owner-gap` — a served intent has no owner;
- `review-fragmented-ownership` — multiple owner candidates exist;
- `review-blocked-owner` — the declared owner is not currently indexable in the reviewed ledger;
- `review-observed-off-owner` — provider evidence reaches another canonical page;
- `strengthen-evidence-path` — a valid owner has no recorded first-party evidence assets;
- `measure-owner` — ownership exists but external visibility evidence is still absent.

A `declined` family creates no owner-gap action by itself. These are review actions. None authorizes production mutation.

## Privacy and disclosure

Detailed owner query/grounding cohorts can be commercially valuable and may expose private product strategy. The schema therefore distinguishes:

- `public-methodology`;
- `public-fixture`;
- `commercial-private`;
- `confidential-rd`.

Public records must set `containsLiveQueries:false`. Real portfolio query cohorts should stay in the private target repository or another private evidence store.

## Relationship to Search Maturity

Use Intent Ownership before turning a Search Maturity gap into new content:

1. define the intent family;
2. decide whether the site should actually serve that user job;
3. inspect current canonical ownership;
4. inspect owner-side query/grounding observations when available;
5. decline semantic/query mismatches instead of manufacturing a page;
6. strengthen the existing owner and evidence path first;
7. create a new canonical page only when a genuinely distinct, in-scope user job remains unserved;
8. verify canonical/internal-link/sitemap behavior;
9. capture public production-surface technical eligibility separately from actual Search indexing;
10. gate served owners on the observed ledger without treating a successful probe as readiness;
11. measure Search/AI outcomes separately.

This avoids a common failure mode: converting query fan-out or long-tail observations into a thin page factory.

## Hard boundaries

- Query variation does not automatically create a URL.
- A deliberately declined intent does not create a URL.
- An off-owner observation does not prove cannibalization.
- A public surface proof does not prove actual Google indexing, Google-selected canonical, ranking or deployed commit identity.
- A readiness gate does not prove actual Google indexing, ranking, AI citation or deployment commit identity.
- A declared owner does not prove Search ranking, AI citation or retrieval.
- Google/Bing/referral metrics remain provider-scoped.
- Redirects, canonicals and production content changes require review.
- Public fixtures must not leak live query cohorts or learned private priors.
