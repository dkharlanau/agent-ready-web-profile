# Search Maturity Benchmark

Status: experimental product layer on `main` · reviewed 2026-09-07

The Search Maturity Benchmark reverse-engineers **observable, evidence-bearing patterns** from pages that are currently visible for relevant Search/AI intents, then compares those patterns with a target site.

It is deliberately not a secret ranking-factor list and not a universal SEO score.

The product question is:

> What do currently visible reference pages systematically expose that this target page/site does not, which differences are worth reproducing as real user/evidence improvements, and what happens after we make those changes?

## Why this exists

Current platform guidance converges on several useful foundations without revealing complete ranking systems:

- Google Search still requires ordinary crawl/index/canonical foundations for generative Search and emphasizes unique, useful, first-hand/non-commodity content.
- Bing's current Search/Copilot guidance explicitly discusses crawl efficiency, focused URLs, early key information, clear entities, independently verifiable facts, structured HTML, accurate structured data and freshness.
- Bing AI Performance exposes cited pages, citations and grounding queries as owner-side evidence.
- Current GEO/AISO research suggests discovery, retrieval, citation and answer absorption are separate stages; generic tactics do not transfer uniformly across engines.

ARWP therefore measures **what can actually be observed** and keeps platform documentation, correlation and experiment evidence separate.

## Core model

```text
intent
  ↓
timestamped visibility observation
  ↓
reference page
  ↓
observable feature vector + provenance
  ↓
reference cohort pattern
  ↓
target-vs-reference gap
  ↓
manual applicability review
  ↓
Growth / Upgrade / Transformation pipeline
  ↓
implementation proof
  ↓
Search / AI / business outcome evidence
```

The benchmark never skips from a competitor observation directly to an automated production change.

## Observable dimensions

Version `0.1` uses 16 dimensions:

| Dimension | What is observed |
| --- | --- |
| `retrievalClarity` | How quickly the page makes its subject/purpose explicit and extractable. |
| `topicalFocus` | Whether URL, title, main heading and body stay centered on one coherent intent. |
| `answerFirst` | Whether the primary definition/finding/answer appears before supporting depth. |
| `evidenceDensity` | Inspectable facts, numbers, examples, tables, citations and supporting artifacts. |
| `firstPartyEvidence` | Original research, measurements, examples, datasets, code, tools or first-hand experience. |
| `authorEntityIdentity` | Observable author/contributor identity and relevant context. |
| `siteTransparency` | Publisher/product identity, method, limitations, update context and trust surfaces. |
| `semanticStructure` | Meaningful headings, lists, tables, figures and native document semantics. |
| `structuredDataIntegrity` | Truthful machine-readable entities/relations aligned with visible facts. |
| `internalTopicalGraph` | Useful relationships among canonical pages rather than isolated posts. |
| `freshnessIntegrity` | Honest publication/change signals rather than synthetic date churn. |
| `urlStability` | Stable canonical identity and low duplication/fragmentation. |
| `multimodalEvidence` | Useful diagrams, figures, screenshots, video or other evidence-bearing media. |
| `externalCorroboration` | Independent references or verifiable external sources supporting material claims. |
| `utilitySurface` | Calculators, datasets, downloads, examples, tools or other value beyond commodity prose. |
| `agentAccessibility` | Native interactive semantics and observable role/name/state suitable for browser agents. |

A dimension may be omitted when it was not measured. Omission means **`unknown`**, not `absent`.

## Maturity states

Each measured dimension uses:

- `absent`
- `weak`
- `present`
- `strong`
- `differentiated`
- `unknown`

These states describe an observable property of the reviewed page. They are not points awarded by Google or Bing.

## Evidence classes

Every measured feature is classified independently:

- `documented-platform` — the underlying practice is supported by current platform documentation;
- `observed-correlation` — observed on visible references but not established as a platform ranking factor;
- `experiment` — project hypothesis worth a bounded test;
- `unknown` — evidence is not sufficient.

Correlation is never silently promoted to causality.

## Reference cohort aggregation

The engine intentionally does **not** average dimensions into one pseudo-scientific score.

For each dimension it records:

- known vs unknown observations;
- distribution of maturity states;
- share at `present+`;
- share at `strong+`;
- a cohort floor state;
- evidence-class distribution;
- pattern classification.

Default cohort floor is the strongest state reached by at least 60% of known observations.

Pattern labels:

- `differentiator` — at least three known observations and at least half are `strong+`;
- `consistent` — at least three known observations and at least 75% are `present+`;
- `mixed` — at least two known observations without a stronger pattern;
- `insufficient` — too little measured evidence.

Only `consistent` and `differentiator` patterns can become target gaps automatically. They still require human applicability review.

## Fast-riser observations

A recently published page that appears in a search/retrieval result is useful evidence that a new page can become discoverable quickly. But its publication date plus an observation date does **not** prove:

- when it was crawled;
- when it was indexed;
- when it first ranked;
- what its Google/Bing position was;
- why it became visible.

Therefore the corpus records `retrievalAgeAtObservation`, not `timeToRank`.

A numeric `rank` is allowed only with an explicit `rankEvidence` URL. Generic research-search ordering must not be relabeled as a Google/Bing rank.

## Pilot cohort

The initial reviewed pilot is:

`benchmarks/search-maturity/pilot-2026-09-07.json`

It contains five independent reference pages observed during the 2026-09-07 research pass:

- Promptwatch — AI Search Optimization guide;
- Semrush — AI Search Optimization guide;
- BoostGeo — 2026 AI Website Readiness Study;
- Pepper — Generative Engine Optimization guide;
- Agent Ready — agent-ready website definition/evidence page.

The pilot is intentionally small. It exists to test the methodology and data contract, **not to establish universal Search truths**.

The pages were returned by the research search surface. Exact Google/Bing rank was not measured and is not stored.

## CLI

Validate a corpus:

```bash
node bin/arwp-search-maturity.mjs check \
  benchmarks/search-maturity/pilot-2026-09-07.json
```

Compile a reference cohort:

```bash
node bin/arwp-search-maturity.mjs cohort \
  benchmarks/search-maturity/pilot-2026-09-07.json \
  --intent=ai-search-optimization \
  --output=search-maturity-cohort.json
```

Compare a target profile:

```bash
node bin/arwp-search-maturity.mjs diff \
  benchmarks/search-maturity/pilot-2026-09-07.json \
  target-search-maturity.json \
  --intent=ai-search-optimization \
  --output=search-maturity-diff.json
```

The diff emits review actions. It does not create competitor-copy patches.

## Reference selection rules

A useful cohort should:

1. match a real intent family rather than a random domain category;
2. preserve the exact observation date/time and search/AI surface;
3. separate independent sites from ARWP-controlled reference sites;
4. retain misses and weak pages when they are part of the reviewed sample;
5. avoid selecting only famous domains or only examples that support the hypothesis;
6. include newer visible pages when studying speed-to-discovery, while labeling what was actually observed;
7. use multiple engines/surfaces before claiming a cross-platform pattern;
8. re-review volatile pages instead of treating an old snapshot as permanently current.

## Target-vs-reference diff

A gap means only:

> this target was observed below a sufficiently repeated cohort pattern on this dimension.

Before an accepted gap becomes implementation work, ask:

- Does the dimension improve the user-facing artifact itself?
- Is the target evidence actually complete enough to call the gap?
- Is the cohort appropriate for this site type and intent?
- Is the relationship documented-platform guidance, observed correlation or experiment?
- Can the change be verified without inventing content/evidence?
- What external outcome would falsify the hypothesis?

Accepted work should flow through the existing Adaptive Site Upgrade / Target Transformation / Proof machinery.

## What not to imitate

Do not copy:

- competitor wording, layout or assets;
- page count or keyword variants;
- artificial author profiles;
- fake publication/update dates;
- fake citations or original research;
- decorative structured data;
- backlink/link-scheme patterns;
- prompt injection or crawler manipulation;
- UI complexity that exists only because a visible competitor has it.

The reusable target is the **underlying evidence system**, not the competitor's cosmetics.

## Outcome model

Keep these outcomes separate:

1. crawl/index eligibility;
2. classic Search visibility;
3. AI retrieval / grounding / citation visibility;
4. answer absorption/influence;
5. referral traffic;
6. conversion/business outcome.

A successful implementation check proves only implementation. A visibility observation proves only visibility on that measured surface/time. Neither proves causality by itself.

Longitudinal work should preserve before/after pages and unchanged comparison cohorts where practical.

## Commercial and IP boundary

A useful open-core boundary is:

### Public/open

- observation schema;
- transparent cohort math;
- basic CLI and validators;
- a small reviewed reference fixture;
- evidence boundaries and negative results;
- interoperability with existing ARWP upgrade/proof tooling.

### Hosted/private value

- continuously refreshed multi-engine corpus;
- private competitor cohorts;
- longitudinal Search/AI outcomes;
- owner-data connectors;
- portfolio monitoring;
- learned recommendation priors;
- automated target-specific gap triage and verified transformations;
- governance and team workflows.

### Confidential R&D

If future work produces a genuinely novel technical mechanism that might warrant an IP decision, do not disclose its algorithm/claims in the public repository merely to document progress. Keep the public interface/contract separate until the IP decision is made.

Existing public Apache-2.0 material remains public under its granted terms.

## Validation

```bash
node benchmarks/search-maturity-test.mjs
node --check lib/search-maturity.mjs
node --check bin/arwp-search-maturity.mjs
node bin/arwp-search-maturity.mjs check \
  benchmarks/search-maturity/pilot-2026-09-07.json
```

The dedicated Search Maturity CI runs these checks on every relevant change.

## Product direction

The intended moat is not a secret tag. It is the growing relationship:

```text
intent
→ visible reference cohort
→ observable evidence pattern
→ target gap
→ exact change
→ verification
→ longitudinal Search/AI/business outcome
→ learned prior for similar sites
```

That accumulated evidence can become substantially harder to copy than a static SEO checklist, while keeping the public methodology inspectable.
