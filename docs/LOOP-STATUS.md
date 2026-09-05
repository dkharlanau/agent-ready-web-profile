# ARWP implementation loop status

Started: 2026-08-26

Integrated into: `main`

Last major implementation review: 2026-09-05

## Resolver decision-quality baseline

- froze the current 20-site independent benchmark as the initial dominance gate;
- documented resolver regret and decision-quality rules;
- fixed A2A adaptation so a valid Agent Card contributes callable `supportedInterfaces[]` endpoints while keeping the Agent Card URL as provenance;
- separated discovery normalization from planner policy in `lib/resolver-core.mjs`;
- stopped treating generic OpenAPI descriptions as search evidence;
- added deterministic eligibility-before-ranking policy tests;
- added Resolver-regret, live-capability-drift and ground-truth-review tooling;
- preserved negative/no-gain experiments instead of converting them into marketing claims.

## Search + Agent implementation slice — ruleset 2026.09

Implemented directly in `main`:

- source-backed `registry/search-agent-recommendations.json` with 15 dated Search, AI Search, citation, freshness, agent-web, measurement and governance rules;
- immutable published ruleset history and a weekly primary-source reachability/review-age watcher;
- `arwp audit` with separate `pass`, `fail`, `warn`, `observed`, `not-assessed`, `not-applicable` and `watch` states and no readiness score;
- Google technical/generative-search eligibility heuristics, Preferred Sources observation, deep-link checks and sitemap `lastmod` inspection;
- OAI-SearchBot access checks kept separate from training controls;
- draft AIPREF `Content-Usage` observation without promoting the Internet-Draft to an RFC;
- IndexNow payload/submission tooling with host/key safety and non-causal submission receipts;
- aggregate AI-visibility snapshot/compare tooling for owner-provided Google, Bing and referral evidence;
- browser-agent eval receipt tooling for comparable UI/WebMCP task evidence without treating runtime evidence as security trust;
- reusable scheduled Search + Agent audit Action template;
- public `/recommendations/` human, JSON and agent-routing surfaces;
- product strategy defining a second North Star: durable discoverability, citability, freshness and agent-operability as upstream mechanisms change.

## CI feedback loop completed

The implementation was not accepted on first write. Main CI exposed and the loop fixed:

1. a syntax defect in the new site-audit eligibility branch;
2. an inverted-period validation defect in the visibility evidence layer;
3. a normalized-URL deduplication edge case and async assertion issue in IndexNow tests were corrected before completion.

After those fixes the full ARWP validation, package smoke, official A2A JavaScript/Python interoperability checks, reusable Action exercise, GitHub Pages build/deploy and Scorecard checks completed successfully for the implementation baseline.

## External / evidence-gated next work

- #52 — build a real browser-runtime WebMCP vs UI evaluation runner;
- #53 — ingest explicit owner-provided Google/Bing/referral exports into visibility snapshots;
- #54 — track AIPREF and W3C Introduction Layer changes and add Resolver adapters only when a concrete upstream contract plus independent use case exists;
- continue the existing Resolver decision-quality backlog and independent-site evidence program;
- package/registry publication, public Resolver hosting, persistent identifiers and independent downstream adoption remain external gates.

Repository tests do not prove improved search ranking, crawling, citation frequency, platform adoption or universal agent compatibility. Those outcomes remain external measurements.
