# Goose ARWP Roadmap

Reviewed: **2026-09-09** after the 10-role Goose proof-first stress test.

**Goose ARWP — Get Found.**

Goose helps a website owner choose a small number of evidence-backed discoverability interventions, verify the exact deployment, measure provider-native Search/AI outcomes, and decide what to keep, revise or stop. **Agent-Ready Web Profile (ARWP)** remains the technical foundation.

The product is not the number of patterns, schemas, protocols, pages, graphs or checks. The product is the **quality of the intervention decision and the evidence that follows it**.

## Product North Star

> **How many real sites complete a reviewed chain from goal/demand → observed site state → chosen intervention → exact verified deployment → provider-native outcome → explicit keep/revise/stop decision?**

Track separately:

1. sites with explicit problem/audience/intent boundaries;
2. interventions with a frozen recommendation and measurement plan;
3. interventions with verified production parity;
4. sites with provider-native Search/AI/referral evidence;
5. experiments reaching a reviewed decision;
6. neutral/negative experiments retained;
7. cases where Goose changed a real owner decision or prevented unnecessary work;
8. independent consumers returning to the workflow.

Do **not** collapse these into a Goose score. Feature count, URL count, schema count, GitHub stars, pattern count, Resolver interface count and owner-controlled “wins” are not North Star metrics.

---

# M1 — Proof before more product

**Status: current P0 milestone.**

## The bottleneck

Goose does not yet have one completed, credible real-site chain from:

`recommendation → exact deployed change → provider-native outcome → reviewed decision`.

Until that exists, building richer proof presentation is secondary.

## P0 execution order

### 1. Complete the first real proof loop — #55

Use the existing frozen Ptichi cohort `ptichi-da-001-en-work-speaking` as the canonical first proof.

**Ptichi stays measurement-hold until production parity is independently verified.** Its existing **12 treatment + 6 control** cohort and frozen 12-query observational panel are authoritative. Do not replace them with a larger cohort merely to satisfy an earlier generic 20–50-page planning target.

Immediate sequence:

1. verify that the exact frozen implementation ref is live;
2. only then start the existing observation windows;
3. import/preserve real provider-native evidence where available;
4. keep treatment/control, confounders and missing evidence explicit;
5. reach a reviewed `keep`, `revise`, `continue-measuring`, `revert` or `retire` decision.

No new feature is required to begin this work.

### 2. Make intervention state canonical

One experiment must have one lifecycle truth.

Canonical outcome-bearing state should come from the existing Controlled Cohort / Growth Experiment / Change Receipt / outcome-evidence chain. Program registries such as Data Authority may describe hypotheses, candidate sites and experiment families, but must reference the canonical experiment rather than independently declaring runtime state.

Evidence Lab, Winner Observatory and future Proof Board surfaces are **views/adapters over canonical evidence**, not parallel proof systems.

### 3. Harden measurement only when active evidence requires it — #97

Preserve raw exports and provider semantics. Add or revise adapters when a real active cohort has evidence that cannot be represented safely today.

Do not turn provider hardening into a generalized P0 platform project before real data arrives.

## M1 exit criteria / SUCCESS GATE

Before the next major product expansion:

- **one fully reviewed real-site intervention** has exact deployment parity and real provider-native outcome evidence;
- at least **three owned sites** have canonical experiment/evidence state;
- at least **two sites** have real owner/provider-native Search or AI evidence;
- at least one neutral/negative result is retained in the canonical evidence record;
- at least one case shows a **decision advantage** — Goose caused an owner to choose, reject, revise or stop work differently than a generic checklist would have;
- a minimal public proof artifact can be generated from committed evidence rather than hand-written success claims;
- no new major module is justified by project maturity, feature count or speculative protocol breadth.

If several well-run interventions cannot satisfy these gates, contract the product scope instead of adding features.

---

# M2 — Minimal proof surface, then replication

**Status: gated P1. Starts only after the first reviewed real-site loop.**

## Proof Board — #93

The Proof Board is a **renderer**, not the proof itself.

First version should be one minimal evidence-derived card with:

- site goal / target intent;
- chosen intervention;
- evidence/demand basis;
- implementation ref;
- independently observed production ref / parity state;
- provider-native outcome evidence;
- unknowns/confounders;
- review decision;
- links to canonical committed evidence.

No dashboard, portfolio score or rich analytics layer is justified before this minimal rendering is useful.

## Replicate on two contrasting sites

After the first reviewed Ptichi loop, apply the same proof contract to two materially different owned sites. The purpose is not to maximize cohort count; it is to test whether the same intervention contract generalizes across site types.

Choose sites with actual owner evidence and a narrow, reviewable discoverability problem. Do not manufacture experiments merely to fill the portfolio.

---

# M3 — One obvious first-run journey

**Status: P1 after proof exists.**

The external journey should be:

```text
URL + MINIMAL OWNER CONTEXT
        ↓
INSPECT THE REAL SITE
        ↓
ONE PRIMARY MOVE
        ↓
WHY IT APPLIES / WHAT WOULD FALSIFY IT
        ↓
CHANGE SAFELY
        ↓
VERIFY EXACT DEPLOYMENT
        ↓
MEASURE OUTCOME
        ↓
KEEP / REVISE / STOP
```

Relevant issues:

- #92 — owner context, but keep the interview adaptive and minimal;
- #94 — concise Get Found Brief;
- #96 — first-run journey hiding internal module complexity.

Site Focus and Intent Ownership remain existing truth models; do not create another intake ontology.

First useful output should be understandable without learning Resolver, BraidGraph, Radar, Repository Mapper, Project Maturity Surfaces, Change Receipts or registry names.

---

# M4 — Provider-native Search & AI evidence

**Status: active capability, evidence-gated hardening.**

Use a funnel, not a score:

```text
ACCESS
  ↓
INDEX / ELIGIBILITY
  ↓
EXPOSURE
  ↓
CITATION / REFERENCE
  ↓
BRAND MENTION
  ↓
VISIT
  ↓
USEFUL ACTION
```

A provider may expose only some stages. Missing stages remain unknown.

### Google

Treat Search Console generative-AI reporting as **exposure/impression evidence** with provider-supported page/country/device/time dimensions. Do not relabel it citation, ranking or causal attribution.

### Bing / Microsoft

Treat AI Performance as **citation/grounding evidence**. Keep citations, cited pages, grounding-query/page mappings, Intents, Topics and query-scoped Citation Share in provider-native semantics. Bing’s aggregated/sampled evidence is not a complete answer log or ranking measure.

### OpenAI / ChatGPT

Treat OAI-SearchBot access, public Search eligibility, bounded observed citations and `chatgpt.com` referrals as distinct evidence stages. GPTBot training controls are separate.

### Perplexity / other answer engines

Preserve crawler/indexing policy and bounded observed citations/referrals where real. Do not invent provider-native owner telemetry that the provider does not expose.

## Rule for #97

Add adapter breadth only when an active proof cohort supplies real evidence that the current contract cannot preserve without semantic loss.

---

# M5 — Evidence-backed Search / GEO operations

**Status: active discipline, not a separate product.**

Current Google guidance does not require special AI markup for AI Overviews or AI Mode. Goose treats GEO as evidence-backed Search/content operations, not a special-file contest.

Keep:

- Site Focus — problem/audience/outcome boundaries;
- Intent Ownership — canonical page jobs before URL expansion;
- demand / Page Value Gate — demand + unique value + standalone usefulness + canonical identity;
- Data Authority — genuine original/curated data when it has standalone user value;
- direct useful answers and source/provenance support;
- visible-fact ↔ structured-data parity;
- meaningful freshness/review state;
- original evidence, tools, examples and datasets over commodity text.

Do not recommend a page or content intervention merely because a pattern exists. Source support answers **“is this legitimate?”**; demand/context must still answer **“is this worth doing here?”**

---

# M6 — Portfolio maintenance and commercial scale

**Status: later, after the SUCCESS GATE.**

The strongest eventual paying-user hypothesis remains an agency, maintainer or small team responsible for several sites. That is not yet validated.

Only after single-site proof generalizes should Goose expand:

- multi-site source/rule blast radius;
- scheduled re-review;
- deployment/evidence queues;
- owner-data connectors;
- portfolio policy-as-code;
- verified change waves;
- transformation-pack breadth driven by observed blocked work.

Paid value should be maintenance, evidence, governance and scale — never a ranking/citation guarantee.

---

# Technical foundation — supporting engines

| Engine | Current role | Priority rule |
| --- | --- | --- |
| Site Focus + Intent Ownership | Define problem, audience, demand and route/page boundaries. | Active when it changes intervention choice. |
| Growth / Recommendation Registry | Source-backed candidate recommendations. | Active; candidate supply is not proof. |
| Controlled Cohorts / Growth Experiments | Freeze and review interventions/outcomes. | P0 proof primitive. |
| Evidence / Change Receipts | Preserve observations, exact change and deployment state. | P0 when needed by active proof. |
| provider-native evidence imports | Preserve Search/AI/referral outcome semantics. | P0/P1 only for real active evidence. |
| Repository Mapper / Transformation packs | Resolve source ownership and prepare bounded changes. | Evidence-gated by real target need. |
| BraidGraph | Evidence lineage and reverse impact. | Internal/advanced; no new public product identity. |
| Resolver / protocol adapters | Machine-interface discovery and decision quality. | Supporting P2 unless a real Goose workflow is blocked. |
| Trend Intelligence | Source freshness and candidate-rule lifecycle. | Maintenance P2 until proof gate. |
| Project Maturity Surfaces | Identity/rights/governance support. | Governance, not discoverability P0. |

---

# Stop / deprioritize rules

Until the SUCCESS GATE is met:

1. do not build #93 as a rich portfolio dashboard before the first reviewed proof loop;
2. do not expand Resolver/ARD/MCP/WebMCP/transact/cross-lingual protocol breadth unless an active proof workflow is blocked;
3. do not treat the stratified State of the Agentic Web expansion as product P0;
4. do not add Trend/Radar feature breadth beyond maintenance of current evidence;
5. do not expand stack transformation packs without observed real-site blocked work;
6. do not create AI-specific markup/files merely because a third party calls them GEO;
7. do not expand indexable URL counts before demand/intent/page-value gates;
8. do not use DOI, policy/trust pages, visual assets or project-surface count as evidence that Goose helps discovery;
9. do not treat crawler access as citation evidence;
10. do not treat citation as traffic, conversion or causality;
11. do not hide neutral or negative outcomes;
12. do not introduce a universal Goose/GEO/AI visibility score;
13. do not create another experiment lifecycle registry when an existing canonical artifact can own the state.

Surface lifecycle work in #95 should consolidate or retire low-job/duplicative public surfaces after the first proof loop, not become another P0 subsystem.

---

# Current execution order

1. keep production/CI truth green;
2. keep Ptichi on HOLD until exact production parity is observed;
3. complete the first real proof loop through #55 using the existing Ptichi cohort;
4. make experiment/intervention lifecycle truth canonical and remove conflicting program-level runtime status;
5. harden only the provider evidence adapters required by that real loop (#97);
6. reach and record the first reviewed decision, including neutral/negative outcomes;
7. render one minimal evidence-derived Proof card (#93), not a dashboard;
8. replicate the proof contract on two contrasting owned sites with real owner evidence;
9. then implement the minimal Get Found Brief / first-run flow (#92, #94, #96);
10. only after the SUCCESS GATE increase portfolio Watch/automation scale;
11. continue Resolver/protocol/research breadth only when real evidence demonstrates the need.

# Decision rule

> **When forced to choose between another capability and another trustworthy real-site evidence loop, choose the evidence loop.**
