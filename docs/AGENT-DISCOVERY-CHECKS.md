# Check representations, AI access and Bing Topics Portfolio

These are three bounded operator checks. They do not change publisher preferences, connect accounts, create pages or establish Search/AI outcomes. Existing Surface Integrity continues to own representation expectations; the representation review supplies passage/link/identity observations, not another semantic score. `representationSurfaceObservation` maps a review into the existing Surface Integrity observation contract.

## Representations

`node bin/arwp.mjs representations --manifest=/private/site.json --output=/private/review.json --captures=/private/captures.json`

The manifest has `version: "0.1"`, an exact HTTPS `site`, and 1–20 same-property `pages`. A page contains `url`, optional same-origin `markdownUrl`, and optional `contract` with `requiredText` (`role` and exact `text`), `requiredLinks`, `requiredEntityIds`, and `markdownRequired`. Use source-owned passages for the answer, limits and evidence. A source passage absent from HTML is unknown, not a Markdown failure. With no contract, delivery alone remains a watch. Captured bodies and original owner contracts stay private; derived reports retain hashes and results.

HTML fallback to `Accept: text/markdown` is unknown, not a universal site defect. Explicit Markdown endpoints are supported. Checks cover declared passages/links/JSON-LD identities and exact unambiguous entity definitions only; they do not prove full semantic equivalence, accessibility or live bot behavior. Negotiated variants also receive a bounded `Vary: Accept` review. `--input=/private/captures.json` replays captures without network and preserves their original dates.

[Cloudflare Markdown for Agents](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/) documents negotiation and Content-Signal behavior. Preserve the publisher's actual policy; do not silently adopt training permissions from a converter default.

## AI access

`node bin/arwp.mjs ai-access --manifest=/private/site.json --owner=/private/owner-controls.json --output=/private/access.json`

Robots policies for Google Search, Google-Extended, Bing Search, OAI-SearchBot and GPTBot remain separate from ordinary HTTP access, page directives, content-use declarations, user-triggered access and Google Search generative AI inclusion. A successful audit-client GET is not a verified visit from a provider IP. The optional owner input is `version: "0.1"`, exact origin `site`, and `googleSearchGenerativeAi` with `value` (`include`, `exclude`, `inherit`, `unknown`), optional resolved `effectiveValue`, `observedAt`, `source: "owner-observation"` and SHA-256 `evidenceSha256`. Inheritance without a resolved value remains unknown. Owner reports are not independently authenticated by Goose.

[OpenAI crawler roles](https://developers.openai.com/api/docs/bots) separate search, training and user-initiated retrieval. [Google's control](https://support.google.com/webmasters/answer/16908024), also included in its [21 October documentation update](https://developers.google.com/search/updates#october-2026), is an owner setting separate from training. Nothing here writes those settings or chooses a rights policy.

## Bing Topics Portfolio

`node bin/arwp.mjs bing topics-template --site=https://synthetic.example.test/ --output=/private/bing-input.json`

`node bin/arwp.mjs bing topics-inspect --input=/private/bing-input.json --output=/private/bing-review.json --json`

The scaffold is `not-exported` with no observation time or period. It reviews as `not-measured`; missing data never becomes zero. A genuine unavailable report may be recorded as `insufficient-data` with an actual dated, hash-bound owner capture.

For an available report, preserve the original export or screenshot privately and normalize its exact period, `capturedAt`, `sourceEvidence` (`sourceClass: "owner-normalized"`, `sha256`), opaque topic/query/page IDs, approximate topic counts and opportunity citation ranges. Topics use `topicSizeApprox`, `sitesCitedApprox`, `queriesApprox`, `ownCitations`. Opportunities use `topicId` (or null for cross-topic rows), `citationRange` (null or `lowerBound`/`upperBound`, upper may be null), `relevance` (`unreviewed`, `relevant`, `brand-conflict`, `off-topic`), optional existing `pageId` and `intentMatch` (`confirmed`, `unreviewed`, `mismatch`). Pages map opaque IDs to existing same-property `canonicalUrl` values. Raw labels/query text stay in the original private export, and page URLs are omitted from the derived review.

Only a relevant opportunity with confirmed intent and an existing page can become one next review, in the owner's input order. It is not automatic content editing. No CSV-header contract or authenticated API is invented before seeing a real provider export.

The [13 October Bing announcement](https://blogs.bing.com/webmaster/2026/10/introducing-topics-portfolio-beta-in-ai-performance/) describes AI classification, approximate ecosystem values, range-valued opportunities, possible branded queries and insufficient-data omissions. Keep these limits; do not compute range midpoints or a visibility score.

## Adopt on a site

Copy `templates/adoption/agent-discovery.mjs` to the site's `scripts/`, add its public page manifest at `.arwp/agent-discovery.json`, then set `ARWP_ROOT` and `ARWP_REPORT_DIR` for an operator run. Reports refuse paths inside Git. `bing-template` prepares a private scaffold; `bing-review` reads `BING_TOPICS_INPUT`. Missing owner data blocks only that observation. Site builds need no ARWP package, remote analytics or extra model process.

Focused check: `node scripts/agent-discovery-test.mjs`.

For a running local build, the adoption helper accepts `ARWP_LOCAL_BASE=http://127.0.0.1:PORT/`. It restricts requests to explicit loopback addresses, follows no redirects, bounds each response to two MiB, preserves actual local URLs separately from canonical resolution URLs and emits `captureScope: local-runtime`. The public HTTPS fetcher remains unchanged for network access policy.
