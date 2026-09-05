# Search + Agent Recommendations

ARWP maintains a dated, source-backed recommendations registry for websites that want to remain discoverable, citable, fresh and agent-operable as search and browser-agent ecosystems change.

The registry is **not** a ranking algorithm, certification or universal readiness score. It separates:

- required technical eligibility checks;
- optional platform opportunities;
- manual content/evidence review;
- browser-runtime checks;
- authenticated owner analytics;
- upstream mechanisms still in incubation.

Current machine-readable ruleset:

- packaged: `registry/search-agent-recommendations.json`;
- published: `https://dkharlanau.github.io/agent-ready-web-profile/recommendations/registry.json`;
- human guide: `https://dkharlanau.github.io/agent-ready-web-profile/recommendations/`;
- immutable history: `https://dkharlanau.github.io/agent-ready-web-profile/recommendations/history/index.json`.

## Audit a site

```bash
arwp audit https://example.com
arwp audit https://example.com --json
```

The static audit currently checks or observes:

- homepage HTTP/indexability heuristics;
- root Googlebot access;
- snippet-blocking directives relevant to Google generative Search eligibility;
- OAI-SearchBot access separately from training controls;
- Google Preferred Sources integration signals;
- stable heading IDs and obvious fragment/scroll-reset hazards;
- sitemap `lastmod` syntax while leaving semantic accuracy to the publisher;
- draft AIPREF `Content-Usage` signals in HTTP/robots surfaces;
- an adopted ARWP profile's validity.

It deliberately returns `not-assessed` for content originality, Google/Bing owner analytics and WebMCP runtime behavior.

## Freshness contract

ARWP treats freshness as several independent signals rather than one badge:

1. accurate sitemap `lastmod` for significant page changes;
2. explicit RSS/Atom/JSON feeds when the site has a useful update stream;
3. IndexNow notification for participating search engines when configured;
4. product/site history and changelog surfaces when they improve provenance;
5. measured external recrawl/citation results where platform tooling exposes them.

IndexNow helper:

```bash
export INDEXNOW_KEY='...'
arwp-indexnow payload https://example.com --urls-file=changed-urls.txt --key-location=https://example.com/indexnow-key.txt
arwp-indexnow submit https://example.com --urls-file=changed-urls.txt --key-location=https://example.com/indexnow-key.txt --endpoint=https://SEARCH_ENGINE/indexnow
```

A successful IndexNow receipt means only that the endpoint received or accepted the request. It does not prove crawling, indexing, ranking or citation.

## Visibility evidence loop

Owner-observed aggregate metrics can be stored using `schema/visibility-snapshot.schema.json` and compared without causal claims:

```bash
arwp-visibility validate evidence/visibility-2026-08.json
arwp-visibility compare evidence/visibility-2026-08.json evidence/visibility-2026-09.json
```

Supported source labels include Google Search Console generative-AI reporting, Bing Webmaster Tools AI Performance, referral analytics and reviewed manual observations.

The comparison keeps negative deltas and explicitly forbids inference that ARWP caused a movement.

## Browser-agent runtime evidence

`schema/agent-eval-receipt.schema.json` records identical task definitions evaluated through UI and WebMCP variants. This is intentionally separate from the static audit.

```bash
arwp-agent-eval validate evidence/agent-eval.json
arwp-agent-eval show evidence/agent-eval.json
```

The receipt can compare success, interactions, retries, tool calls and duration. Runtime evidence remains scoped to the tested task/browser/environment and is not automatically security trust or universal agent compatibility.

## Living-source maintenance

`.github/workflows/recommendations-watch.yml` runs weekly. It checks source reachability and the age of the last substantive source review and publishes an artifact report.

A successful HTTP response is only a maintenance hint. Source content still requires review before a recommendation changes. Updated rulesets create new historical snapshots instead of silently rewriting prior guidance.

## Current watch items

The 2026.09 ruleset tracks IETF AIPREF `Content-Usage` as an Internet-Draft and the W3C Introduction Layer Community Group as incubation. Neither is promoted to a stable web requirement. If a concrete upstream discovery mechanism matures, ARWP should resolve/adapt it rather than create a competing manifest.
