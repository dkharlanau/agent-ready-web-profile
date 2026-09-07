---
name: arwp-search-maturity
description: Reverse-engineer observable, evidence-bearing patterns from currently visible Search/AI reference pages, compare them with a target site, and route repeated gaps into evidence-backed experiments without pretending correlations are ranking factors. Use when the goal is competitive/reference analysis, site maturity benchmarking, fast-riser analysis or finding repeatable characteristics of discoverable pages.
license: Apache-2.0
compatibility: Requires a reviewed Search Maturity corpus or enough current evidence to build one. Network access is recommended for fresh visibility observations; owner Search/AI data improves outcome validation.
metadata:
  standard: agent-skills
  arwp-role: search-maturity-reference-benchmark
---

# ARWP Search Maturity

Use this specialist when the Growth Loop needs a **reference cohort**, not another generic checklist.

## Goal

Turn volatile Search/AI observations into an explainable comparison:

`intent → timestamped visible references → observable evidence vector → cohort pattern → target gap → experiment → verify → measure`

The output is a hypothesis generator and prioritization input. It is not a list of secret ranking factors.

## Sources of truth

Read:

- `docs/SEARCH-MATURITY-BENCHMARK.md`;
- `schema/search-maturity-corpus.schema.json`;
- the relevant reviewed corpus under `benchmarks/search-maturity/`;
- current primary platform guidance;
- the target site's actual content, entity, Search Surface and owner evidence where available.

## Workflow

1. **Define the intent family first.** Do not benchmark unrelated high-authority sites merely because they rank for something.
2. **Capture the visibility observation exactly.** Preserve provider/surface, query, locale/device when known and observation time. Store a numeric rank only when separate evidence proves that rank.
3. **Separate ownership.** Independent references can inform the external cohort. ARWP-owned/project-reference sites remain implementation/dogfood evidence.
4. **Review only observable dimensions.** Use the 16 Search Maturity dimensions. Omit anything not actually checked; omission is `unknown`, never failure.
5. **Classify evidence.** Keep `documented-platform`, `observed-correlation`, `experiment` and `unknown` distinct.
6. **Compile the cohort vector.** Prefer repeated patterns and state distributions over a universal score.
7. **Compare the target.** A target gap is interesting only when the reference pattern is sufficiently repeated and the target evidence is real.
8. **Perform applicability review.** Ask whether closing the gap improves the actual user/evidence artifact. Reject cosmetic copying and cargo cult.
9. **Route accepted work through existing ARWP machinery.** Growth hypothesis → Adaptive Upgrade → safe transformation/manual edit → verification receipt.
10. **Measure external outcomes separately.** Search visibility, AI retrieval/citation, referral traffic and business outcomes are different signals.
11. **Preserve negative results.** A change with no effect is useful evidence and should influence future priors.

## Fast-riser handling

A new page observed in retrieval can help study rapid discovery, but do not infer crawl/index/rank history from publication date.

Record:

- publication date if observable;
- observation timestamp;
- `retrievalAgeAtObservation`;
- exact rank only with explicit rank evidence.

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
- Do not optimize the benchmark by selecting only supporting examples.
- Do not collapse unknown into zero.
- Do not hide misses or negative experiments.
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
```

## Done when

- the reference cohort is timestamped and reviewable;
- independent and owner-controlled evidence are separated;
- unmeasured features remain unknown;
- repeated cohort patterns are explainable without a magic score;
- target gaps retain evidence class and uncertainty;
- accepted actions enter existing verification/measurement gates;
- ranking/citation causality is not inferred from correlation;
- negative outcomes remain available for future learning.
