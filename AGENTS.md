# Agent-Ready Web Profile — agent instructions

ARWP has four connected layers:

1. **Growth Loop — primary operational workflow.** Research current Search/recommendation/AI changes, classify the evidence, turn applicable mechanisms into explicit hypotheses, inspect a target website, implement the highest-confidence changes, verify them and measure owner-side outcomes.
2. **Search Maturity Benchmark — governed reference-comparison workflow.** Observe currently visible independent pages for a real intent, profile only evidence that was actually reviewed, identify repeated cohort patterns and compare those patterns with a target site without relabeling correlations as ranking factors.
3. **Future Search Lab — governed experimental workflow.** After current foundations are healthy, explore truthful open-web semantics, entity/evidence graphs, retrieval feedback and browser-agent operability that may matter to future Search/AI systems even when no current ranking benefit is documented.
4. **Resolver / interoperability foundation.** Discover how a public website can actually be read, searched or operated by agents without requiring universal adoption of an ARWP-specific manifest.

The optional publisher profile, Resolver, scanner, benchmarks, gateways, evidence receipts and protocol work remain supported. The broader Search/Future scope does not license speculative ranking claims or indiscriminate metadata growth.

## Install and verify

```bash
npm ci
npm test
npm run quickstart
node scripts/growth-hypotheses-test.mjs
node bin/arwp-hypotheses.mjs check
node bin/arwp-trends.mjs check
node scripts/future-search-test.mjs
node benchmarks/search-maturity-test.mjs
node bin/arwp-search-maturity.mjs check benchmarks/search-maturity/pilot-2026-09-07.json
node scripts/maturity-profile-test.mjs --site
node bin/arwp-maturity.mjs check docs/maturity/profile.json
```

## Agent Skills routing

- `arwp-growth-loop` — **default for Search growth, Discover/recommendations, generative Search/AI citations, current platform adaptation or ongoing website improvement.**
- `arwp-search-maturity` — competitive/reference reverse-engineering, high-visibility reference cohorts, fast-riser analysis and evidence-bearing target-vs-reference gaps.
- `arwp-prepare-site` — initial technical preparation/adoption of an existing website repository.
- `arwp-adaptive-upgrade` — compile applicable current evidence into target-specific change contracts.
- `arwp-target-transformation` — resolve grounded upgrades to exact target files and reviewable deterministic changes.
- `arwp-ai-search-content` — useful, original, evidence-backed content.
- `arwp-future-search` — governed future-ready semantics, semantic/evidence graphs, retrieval feedback and browser-agent operability beyond today's documented Search feature set.
- `arwp-agent-discovery` — truthful llms.txt, Agent Skills, ARD, OpenAPI/MCP/A2A/WebMCP and ARWP surfaces.
- `arwp-evidence-ci` — assertions, scheduled audits, receipts and drift-safe CI.

When repository edits are possible, do not stop at a recommendation list. Make high-confidence reversible changes, run verification and leave credential-dependent/outcome measurement work as explicit gates.

## Growth Loop rules

1. Prefer current primary-source platform documentation/specifications over secondary GEO/AEO advice.
2. Classify each mechanism as requirement, guidance, feature, measurement or project experiment.
3. Fix eligibility/foundation blockers before optional acquisition tactics, future-search experiments or agent metadata.
4. Use `registry/growth-hypotheses.json` to make the assumption, applicability, checks and success signal explicit.
5. Manual editorial quality stays manual; authenticated metrics stay owner-data; browser/runtime behavior stays runtime evidence.
6. Do not claim an ARWP file/schema/skill is a platform ranking signal unless the platform explicitly says so.
7. Preserve neutral and negative results.
8. A technically correct implementation is not proof of ranking/citation impact.
9. Do not create synthetic freshness, fake authorship, decorative structured data or thin query-variant pages.
10. Respect publisher rights/distribution policy even when more open crawler access could increase reach.

Keep these layers distinct:

- `registry/search-agent-recommendations.json` — dated upstream current rules;
- `registry/trends.json` — WATCH/ADOPT/MEASURED upstream changes;
- `registry/growth-hypotheses.json` — why a current change might matter and how to test it;
- `benchmarks/search-maturity/` — timestamped independent/reference observations and observable feature evidence;
- `registry/future-search-experiments.json` — governed future-ready mechanisms whose value may be interoperability/retrieval rather than a documented ranking feature;
- `lib/growth-profile.mjs` / `lib/growth-plan.mjs` — real-site observations/actions;
- owner-side measurements / ledgers — outcome evidence.

A trend does not automatically become a hypothesis. A hypothesis does not automatically become a site action. A repeated reference-cohort feature does not automatically become a ranking factor. A future-search experiment does not automatically become a requirement. A site action does not automatically become a success claim.

## Search Maturity rules

1. Use `arwp-search-maturity` when the question is what currently visible pages/sites systematically do differently from a target site.
2. Define a real query/intent family before selecting reference pages. Do not build a cohort from unrelated famous domains.
3. Timestamp every visibility observation and record the actual provider/surface. Do not call generic web-search order a Google/Bing rank.
4. A numeric `rank` requires explicit `rankEvidence`. Publication date plus observation time is age-at-retrieval, not time-to-rank/index.
5. Review only observable dimensions. Missing/unreviewed dimensions remain `unknown`; they are not failures or zeros.
6. Keep `documented-platform`, `observed-correlation`, `experiment` and `unknown` separate. Correlation cannot silently become causality.
7. Prefer distributions and repeated patterns over one composite maturity/readiness score.
8. Separate `ownership=independent` references from `ownership=project-reference` dogfood sites.
9. Do not copy competitor prose, design, assets, author constructs, fake freshness, link patterns or page factories. Reproduce only underlying user/evidence value when independently justified.
10. Route accepted target gaps through the normal Growth/Upgrade/Transformation/Proof gates, then measure Search, AI retrieval/citation, referral and business outcomes separately.
11. Preserve misses, counterexamples and negative before/after results; do not curate the corpus only to support a preferred theory.
12. Keep proprietary refreshed cohorts, learned priors and genuinely novel confidential R&D out of the public repo when an explicit commercial/IP boundary requires it.

## Future Search rules

1. Use `arwp-future-search` only after current eligibility/foundation work is healthy.
2. Google rich-result support is not the boundary of useful Schema.org semantics. Applicable open-vocabulary properties may be used for truthful machine interoperability even without a current Google feature.
3. More structured data is not inherently better. Prefer a smaller coherent graph with stable `@id`, correct types and real relations.
4. Treat `mainEntity`, `about`, `mentions`, `isPartOf`, `hasPart`, `subjectOf`, `citation`, `isBasedOn`, `sameAs`, authorship/publisher/provider relations as graph semantics, not keyword stuffing.
5. The optional semantic index generated by `arwp-semantic-index` complements canonical HTML, page-local JSON-LD, sitemap and navigation; it is not a documented discovery/ranking file.
6. Use owner-observed Search Console query+page and Bing grounding/citation data to strengthen canonical answers and evidence paths. Never create a page automatically for each query variant.
7. Prefer native HTML semantics and accurate ARIA role/name/state for interactive surfaces. Static metadata does not prove runtime agent operability or accessibility compliance.
8. Describe structured actions only when the real user-visible capability exists. Static discovery metadata never grants authorization for side effects.
9. Track open-vocabulary evolution such as Schema.org releases/equivalence mappings, but do not duplicate fields across vocabularies without a concrete interoperability reason.
10. Every experiment needs maturity, source review, verification and a rollback/retirement path.

## Maturity, identity and dataset evidence

For trust pages, brand/trademark files, analytics, entities, datasets or DOI work, read `docs/MATURITY-PROFILE.md` and `skills/arwp-growth-loop/references/maturity.md`.

Inspect existing evidence before creating more files. Reuse canonical entities and fix the actual dataset leaf markup; a graph elsewhere is not a substitute. The optional `docs/maturity/profile.json` inventory is an implementation example, not a platform requirement. Sites without genuine datasets use an empty dataset list.

Keep registered/cleared trademarks, reserved/published DOI, instrumentation/runtime collection, and static checks/observed outcomes separate. Do not add `.zenodo.json` over `CITATION.cff` without reviewing the override. Unknown analytics baselines stay null. Public measurement artifacts must be aggregate-only and exclude personal data or user-submitted URLs. The current event contract is specified, not instrumented.

Use `arwp-maturity` through `node bin/arwp-maturity.mjs` for scoped local checks and unsigned hash inventories. It does not verify security, legal clearance, live HTTP, DOI resolution or ranking. External review gates remain open until actual evidence exists.

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

Keep `docs/` synchronized where applicable, especially Growth, Search Maturity, Future Search, Trends, Recommendations, Skills, agent instructions, sitemap, machine-readable product/profile surfaces, Trust and Observatory artifacts. Keep the Maturity evidence pack, DataCatalog and Measurement definitions linked from Trust and their source pages when changed.

Do not add obsolete `<meta name="keywords">`. Do not claim special AI files or the optional semantic index are Google ranking requirements.

## Security and disclosure

Do not bypass access controls or automate side-effectful agent actions from discovery metadata. Do not put credentials, cookies or private URLs in fixtures/receipts. Runtime evidence remains opt-in and scoped.

Before publishing a potentially novel technical mechanism, ask whether the detailed algorithm belongs in open core, hosted/private implementation, confidential R&D or intentional defensive publication. Do not publish candidate patent claims or confidential learned priors just to document progress.

## Implementation practice library

Use `arwp-discoverability` inside the default Growth Loop for concrete editorial, comparison, technical and measurement practices. The library at `discoverability.html` and `knowledge/discoverability-corpus.json` routes to existing hypotheses and rules. Exported selections are plans, not verified changes or outcome receipts. Rebuild with `npm run build:discoverability` after changing the corpus or templates; retain every existing sitemap route.
