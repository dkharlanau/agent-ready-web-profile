# Agent-Ready Web Profile — agent instructions

ARWP has two connected layers:

1. **Growth Loop — primary operational workflow.** Research current Search/recommendation/AI changes, classify the evidence, turn applicable mechanisms into explicit hypotheses, inspect a target website, implement the highest-confidence changes, verify them and measure owner-side outcomes.
2. **Resolver / interoperability foundation.** Discover how a public website can actually be read, searched or operated by agents without requiring universal adoption of an ARWP-specific manifest.

The optional publisher profile, Resolver, scanner, benchmarks, gateways, evidence receipts and protocol work remain supported. The focus change does not license speculative SEO/GEO claims.

## Install and verify

```bash
npm ci
npm test
npm run quickstart
node scripts/growth-hypotheses-test.mjs
node bin/arwp-hypotheses.mjs check
node bin/arwp-trends.mjs check
```

## Agent Skills routing

- `arwp-growth-loop` — **default for Search growth, Discover/recommendations, generative Search/AI citations, current platform adaptation or ongoing website improvement.**
- `arwp-prepare-site` — initial technical preparation/adoption of an existing website repository.
- `arwp-ai-search-content` — useful, original, evidence-backed content.
- `arwp-agent-discovery` — truthful llms.txt, Agent Skills, ARD, OpenAPI/MCP/A2A/WebMCP and ARWP surfaces.
- `arwp-evidence-ci` — assertions, scheduled audits, receipts and drift-safe CI.

When repository edits are possible, do not stop at a recommendation list. Make high-confidence reversible changes, run verification and leave credential-dependent/outcome measurement work as explicit gates.

## Growth Loop rules

1. Prefer current primary-source platform documentation/specifications over secondary GEO/AEO advice.
2. Classify each mechanism as requirement, guidance, feature, measurement or project experiment.
3. Fix eligibility/foundation blockers before optional acquisition tactics or agent metadata.
4. Use `registry/growth-hypotheses.json` to make the assumption, applicability, checks and success signal explicit.
5. Manual editorial quality stays manual; authenticated metrics stay owner-data; browser/runtime behavior stays runtime evidence.
6. Do not claim an ARWP file/schema/skill is a platform ranking signal unless the platform explicitly says so.
7. Preserve neutral and negative results.
8. A technically correct implementation is not proof of ranking/citation impact.
9. Do not create synthetic freshness, fake authorship, decorative structured data or thin query-variant pages.
10. Respect publisher rights/distribution policy even when more open crawler access could increase reach.

Keep these layers distinct:

- `registry/search-agent-recommendations.json` — dated upstream rules;
- `registry/trends.json` — WATCH/ADOPT/MEASURED changes;
- `registry/growth-hypotheses.json` — why a change might matter and how to test it;
- `lib/growth-profile.mjs` / `lib/growth-plan.mjs` — real-site observations/actions;
- owner-side measurements / ledgers — outcome evidence.

A trend does not automatically become a hypothesis. A hypothesis does not automatically become a site action. A site action does not automatically become a success claim.

## Interoperability rules remain

1. Prefer upstream standards over new ARWP-native fields.
2. Keep the publisher profile optional; the Resolver must remain useful for sites with no ARWP profile.
3. Preserve source authority/conflicts instead of collapsing them into a readiness score.
4. Static metadata is evidence of a declaration, not runtime conformance, authorization, security or trust.
5. Do not add hostname-specific exceptions to improve benchmarks.
6. Do not rewrite reviewed ground truth to match Resolver output.
7. Preserve negative results and historical snapshots.
8. Treat drafts/proposals at their actual maturity level.
9. Consume ARD semantics where they solve agentic-resource discovery rather than inventing competing catalog syntax.

## Public surfaces

Keep `docs/` synchronized where applicable, especially Growth, Trends, Recommendations, Skills, agent instructions, sitemap, machine-readable product/profile surfaces, Trust and Observatory artifacts.

Do not add obsolete `<meta name="keywords">`. Do not claim special AI files are Google ranking requirements.

## Security

Do not bypass access controls or automate side-effectful agent actions from discovery metadata. Do not put credentials, cookies or private URLs in fixtures/receipts. Runtime evidence remains opt-in and scoped.
