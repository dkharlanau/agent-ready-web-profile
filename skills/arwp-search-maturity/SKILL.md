---
name: arwp-search-maturity
description: Reverse-engineer observable, evidence-bearing patterns from currently visible Search/AI reference pages, compare them with a target site, and route repeated gaps into evidence-backed experiments without pretending correlations are ranking factors. Use when the goal is competitive/reference analysis, site maturity benchmarking, fast-riser analysis or finding repeatable characteristics of discoverable pages.
license: PolyForm-Strict-1.0.0
metadata:
  compatibility: Requires a reviewed Search Maturity corpus or enough current evidence to build one. Network access is recommended for fresh visibility observations; owner Search/AI data improves outcome validation.
  standard: agent-skills
  arwp-role: search-maturity-reference-benchmark
---

# ARWP Search Maturity

Use this specialist when the Growth Loop needs a **reference cohort**, not another generic checklist.

Use `docs/ANTI-PATTERNS.md` to review fabricated maturity, weak evidence and measurement errors; preserve unknown states and legitimate countercases. Record findings with `templates/growth/anti-pattern-review.md`.

## Goal

Turn volatile Search/AI observations into an explainable comparison:

`intent → timestamped visible references → observable evidence vector → cohort pattern → target gap → experiment → verify → measure`

The output is a hypothesis generator and prioritization input. It is not a list of secret ranking factors.

## Sources of truth

Read:

- `docs/SEARCH-MATURITY-BENCHMARK.md`;
- `docs/INTERNAL-DISCOVERY-EVIDENCE.md` when reviewing `internalTopicalGraph`;
- `docs/INTENT-OWNERSHIP.md` when owner query/grounding evidence may imply a new or competing canonical page;
- `schema/search-maturity-corpus.schema.json`;
- the relevant reviewed corpus under `benchmarks/search-maturity/`;
- current primary platform guidance;
- the target site's actual content, entity, Search Surface and owner evidence where available.

## Workflow

1. **Define the intent family first.** Do not benchmark unrelated high-authority sites merely because they rank for something.
2. **Resolve intent ownership before creating URLs.** When owner Search/AI evidence exists, map the intent family to a reviewed disposition and zero/one/multiple canonical owners with `arwp-intent-ownership`. Strengthen an existing owner first; query or fan-out variation is not a page-creation instruction. Deliberately decline query mismatches instead of turning them into owner gaps.
3. **Capture the visibility observation exactly.** Preserve provider/surface, query, locale/device when known and observation time. Store a numeric rank only when explicit `rankEvidence` independently supports that exact rank.
4. **Separate ownership.** Independent references can inform the external cohort. ARWP-owned/project-reference sites remain implementation/dogfood evidence.
5. **Review only observable dimensions.** Use the 16 Search Maturity dimensions. Omit anything not actually checked; omission is `unknown`, never failure.
6. **Classify evidence.** Keep `documented-platform`, `observed-correlation`, `experiment` and `unknown` distinct.
7. **Compile the cohort vector.** Prefer repeated patterns and state distributions over a universal score.
8. **Compare the target.** A target gap is interesting only when the reference pattern is sufficiently repeated and the target evidence is real.
9. **Perform applicability review.** Ask whether closing the gap improves the actual user/evidence artifact. Reject cosmetic copying and cargo cult.
10. **Route accepted work through existing ARWP machinery.** Growth hypothesis → Adaptive Upgrade → safe transformation/manual edit → verification receipt.
11. **Probe owner production surfaces after source changes.** Capture the bounded HTTP/robots/noindex/canonical observation in a derived ledger. A successful probe means evidence was collected, not that production is ready.
12. **Gate served intent owners separately.** Run the deterministic ownership gate over the observed ledger. A served family must have exactly one currently `indexable` owner; preserve the proof artifact on failure. Reviewed `decline` families are intentionally excluded.
13. **Verify source→production parity separately.** Technical owner eligibility does not identify the deployed commit. Use deployment/change receipts when that distinction matters.
14. **Measure external outcomes separately.** Search visibility, AI retrieval/citation, referral traffic and business outcomes are different signals.
15. **Preserve negative results.** A change with no effect is useful evidence and should influence future priors.

### Intent ownership evidence

When query, grounding or referral observations are being used to decide content architecture:

- declare the bounded intent family before reviewing phrases;
- explicitly decide whether the site should serve or decline that family;
- keep Google, Bing, referral and manual observations provider-scoped;
- treat exactly one indexable reviewed owner as `owned`;
- treat zero owners on a served family as a review gap, not an automatic new-page request;
- treat reviewed query/navigational mismatches as `declined`, with no canonical owner and an explicit reason;
- treat multiple owners as `fragmented`, not automatic proof of cannibalization;
- treat off-owner observations as a routing/relevance review signal, not proof of ranking harm;
- probe the public canonical inventory before claiming current technical eligibility;
- use `gate` on the observed ledger when CI/release policy requires every served family to be owned;
- preserve probe artifacts even when the gate fails so the failure stays inspectable;
- keep deployment commit parity independent from public HTTP eligibility;
- preserve live owner query cohorts in private target evidence rather than public ARWP fixtures.

Use `docs/INTENT-OWNERSHIP.md` for the full contract.

### Internal topical graph evidence

When reviewing `internalTopicalGraph`:

- prefer rendered/runtime or matching build-artifact anchors over repository-source guesses;
- classify redirect-only aliases as URL transitions, not weak content nodes;
- count shared-renderer links in source mode only when route → renderer → visible anchor behavior is deterministic and inspectable;
- keep uncertain renderer/source relationships `unknown` instead of scoring them absent;
- distinguish contextual/hub/action links from global navigation and footer reachability;
- keep canonical owner identity, redirects, sitemap state and link relationships as separate observations.

Use `docs/INTERNAL-DISCOVERY-EVIDENCE.md` for the full contract.

## Fast-riser handling

A new page observed in retrieval can help study rapid discovery, but do not infer crawl/index/rank history from publication date.

Record:

- publication date if observable;
- observation timestamp;
- `retrievalAgeAtObservation`;
- exact rank only with explicit `rankEvidence`.

Never rename `age at observation` to `time to rank`.

## Dimension review

The current dimensions cover:

- retrieval clarity and topical focus;
- answer-first structure;
- evidence density and first-party evidence;
- author/entity identity and site transparency;
- semantic HTML and truthful structured data;
- internal topical graph;
- freshness and URL stability;
- multimodal evidence and external corroboration;
- real utility surfaces;
- browser-agent accessibility.

Do not force all dimensions onto every site type.

## Hard rules

- Do not copy competitor prose, layouts, assets or branding.
- Do not fabricate rank, traffic, citations, backlinks, authorship, dates or evidence.
- Do not encode a cohort feature as a Google/Bing ranking factor unless the platform documents that claim.
- Do not create one page per query variant.
- Do not turn a reviewed query mismatch into a content gap merely because it generated impressions or retrieval.
- Do not infer keyword cannibalization merely because an observed query/grounding phrase lands off the reviewed owner.
- Do not treat successful `probe` execution as proof that served intent owners are ready; use the separate gate.
- Do not treat a passing ownership gate as proof of actual Google indexing, ranking, AI citation or deployed commit identity.
- Do not optimize the benchmark by selecting only supporting examples.
- Do not collapse unknown into zero.
- Do not hide misses or negative experiments.
- Do not score redirect aliases as isolated weak pages or literal source imports as rendered links when the renderer contract is unverified.
- Do not publish confidential algorithms, learned proprietary priors or candidate patent claims merely to document R&D.
- Do not let a single composite score drive changes.

## CLI

```bash
node bin/arwp-search-maturity.mjs check \
  benchmarks/search-maturity/pilot-2026-09-07.json

node bin/arwp-search-maturity.mjs cohort \
  benchmarks/search-maturity/pilot-2026-09-07.json \
  --intent=ai-search-optimization

node bin/arwp-search-maturity.mjs diff \
  benchmarks/search-maturity/pilot-2026-09-07.json \
  target-search-maturity.json \
  --intent=ai-search-optimization

node bin/arwp-intent-ownership.mjs report \
  intent-ownership.json

node bin/arwp-intent-ownership.mjs probe \
  intent-ownership.json \
  --proof-output=surface-proof.json \
  --ledger-output=intent-ownership.observed.json

node bin/arwp-intent-ownership.mjs gate \
  intent-ownership.observed.json
```

## Done when

- the reference cohort is timestamped and reviewable;
- independent and owner-controlled evidence are separated;
- unmeasured features remain unknown;
- query/grounding variation maps to reviewed canonical ownership or explicit decline before any new-page decision;
- repeated cohort patterns are explainable without a magic score;
- target gaps retain evidence class and uncertainty;
- accepted actions enter existing verification/measurement gates;
- current served owner readiness is based on an observed production ledger, not source assumptions;
- production probe, ownership gate and deployment parity remain separate evidence layers;
- ranking/citation causality is not inferred from correlation;
- negative outcomes remain available for future learning.

## Functional emulation and Evidence Relay

When asked to reproduce maturity, find publication venues, connect DOI evidence or redesign growth analytics, read [Evidence Relay](../../docs/EVIDENCE-RELAY.md). Reproduce an observable useful function with the target site's own artifacts; do not imitate history or independent reputation. The venue register contains candidates and eligibility requirements, not completed submissions. Read DOI records for the exact supported claim; identifiers do not confer endorsement.

For a reviewed artifact cohort, run `node skills/arwp-search-maturity/scripts/evidence-relay.mjs <private-ledger.json>` from the ARWP checkout. The script uses existing BraidGraph node references and evidence receipt references; it is not a second graph. It reports monitored yields, unknown coverage, immature assets, independent owner groups and citation support. Keep the synthetic example labeled; first-observed lags are not first-indexing times. Do not turn parallel stage observations into a visitor funnel or causal attribution.
