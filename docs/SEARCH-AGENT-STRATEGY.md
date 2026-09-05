# ARWP Search + Agent Strategy

ARWP should not compete by inventing another universal AI-web manifest or by promising ranking gains. Its advantage is continuous interoperability: track upstream search and agent mechanisms, turn the parts that are testable into conservative checks, preserve evidence and runtime boundaries, and make changes visible to publishers.

## Two North Stars

The Resolver North Star remains:

> **How many external sites can ARWP correctly resolve and route without site-specific integration code?**

The publisher-maintenance North Star is:

> **How reliably can ARWP keep a website discoverable, citable, fresh and agent-operable as upstream search platforms and agent-web mechanisms change?**

These measures are complementary. The first measures interoperability from the consumer side; the second measures durable conformance and evidence from the publisher side.

## Product loop

```text
PRIMARY / UPSTREAM SOURCES
          |
          v
DATED RECOMMENDATIONS REGISTRY
          |
          +--> static audit ----------> publisher fixes
          |
          +--> runtime eval contract -> browser evidence
          |
          +--> visibility contract ---> owner-observed metrics
          |
          v
IMMUTABLE RULESET HISTORY + SOURCE WATCH
          |
          v
REVIEW CHANGE / ADAPTER / TEST / RELEASE
```

The loop deliberately does not infer that ARWP caused a ranking, citation or referral change.

## Implemented in ruleset 2026.09

- source-backed Search + Agent recommendations registry;
- `arwp audit` with separate pass/fail/warn/not-assessed/watch semantics;
- Google Search and generative-search eligibility heuristics;
- OAI-SearchBot access check kept separate from training controls;
- Preferred Sources integration observation;
- deep-link/fragment readiness heuristics;
- sitemap `lastmod` observation;
- IndexNow payload/submission helper with non-causal receipts;
- work-in-progress AIPREF `Content-Usage` observation;
- W3C Introduction Layer watch state;
- visibility snapshot schema and before/after delta comparison;
- browser-agent evaluation receipt schema for UI vs WebMCP task evidence;
- immutable ruleset snapshots;
- scheduled primary-source reachability/review-age watch.

## What remains evidence-gated

### Browser eval runner

The receipt format is implemented, but ARWP should not claim reproducible WebMCP evaluation until a real browser harness executes task fixtures in a supported runtime. The runner must preserve identical task definitions, record errors/retries/interactions/tool calls, and include adversarial/security cases where appropriate.

### Authenticated platform evidence ingestion

The visibility contract is implemented. Importing data from Google Search Console, Bing Webmaster Tools or first-party analytics requires explicit owner authorization/export data. Public crawling must never infer those metrics.

### Upstream adapters

AIPREF and the Introduction Layer stay watch/incubation mechanisms. A Resolver adapter is justified when a concrete upstream discovery contract and independent use case exist. ARWP should not create a competing format first.

## Adoption advantage

The useful publisher promise is operational, not promotional:

> Install a dated ARWP ruleset once, keep the checks running, and get an explicit diff when an upstream requirement, opportunity or protocol changes.

That can reduce the cost of keeping a technical site compatible with several fast-moving ecosystems. Whether that produces more search traffic or AI citations is an external outcome to measure, not an ARWP conformance claim.

## Evidence policy

1. Prefer primary platform, standards-body and protocol sources.
2. Every rule records a review date and upstream status.
3. Experimental mechanisms stay labelled experimental.
4. Static discovery never proves browser or protocol runtime behavior.
5. Authenticated platform metrics stay external owner evidence.
6. Negative benchmark and visibility results remain publishable.
7. Historical rulesets are immutable.
8. No single readiness score hides conflicts, uncertainty or missing evidence.
