# Goose ARWP — Product Line

Reviewed: **2026-09-09** after the 10-role proof-first stress test.

> **Get Found.**

**Goose ARWP** is the public product. **Agent-Ready Web Profile (ARWP)** is the technical foundation.

Goose is an **evidence-backed Search and AI discoverability operations** product: it helps a website owner choose a small number of interventions worth trying, verify the exact deployment, preserve provider-native outcomes and decide what to keep, revise or stop.

It is not another AI-visibility score, generic SEO checklist, prompt-tracking suite, protocol catalog or content-volume system.

## Public product journey

A first-time user should not need to choose between Resolver, BraidGraph, Growth, Site Focus, Evidence Lab, Radar, Repository Mapper, Project Maturity Surfaces or Watch.

The public journey is:

```text
GOAL / DEMAND
      ↓
INSPECT
      ↓
DECIDE ONE PRIMARY MOVE
      ↓
CHANGE
      ↓
VERIFY EXACT DEPLOYMENT
      ↓
MEASURE PROVIDER-NATIVE OUTCOME
      ↓
KEEP / REVISE / STOP
```

The underlying technical sequence remains compatible with `goal -> inspect -> decide -> change -> prove -> watch`; the user-facing result is a decision cycle, not a module selector.

### Goal / demand

Capture only owner context that materially changes the recommendation: audience/problem, useful action, market/language where relevant and owner-side measurement availability. Combine this with observed demand/intent/page-job evidence.

Owner-declared context is not independent evidence.

### Inspect

Observe the real site/repository and only the evidence needed to decide whether a candidate intervention applies:

- crawl/index eligibility;
- Site Focus and Intent Ownership;
- page/job conflicts and demand hypotheses;
- visible facts, entities and structured-data parity;
- genuine datasets/Data Authority where relevant;
- crawler/access policy;
- Search/AI discovery state;
- source ownership and deployment identity.

### Decide

Return **one primary intervention** when possible, with up to three only when the actions are genuinely independent.

Every action must state:

- why it applies to this site;
- demand/evidence basis;
- source/confidence class;
- exact implementation verification;
- the outcome stage that would matter;
- what would falsify the recommendation;
- what remains unknown;
- what the action does **not** prove.

### Change

Use bounded, reviewable transformations only where source ownership is known. Editorial truth, legal/policy claims, authenticated provider settings and ambiguous ownership remain gated.

### Prove / measure

Keep separate:

- implementation verification;
- production/deployment parity;
- index/eligibility;
- Search/AI exposure;
- citations/references;
- brand mentions;
- visits/referrals;
- useful actions/conversions.

A correct implementation is not outcome evidence.

### Watch / decide

The reason to return is a changed decision state: new provider evidence, a mature observation window, deployment drift, stale guidance or a review-due recommendation. Negative/neutral outcomes remain visible.

---

# Canonical product primitive: the intervention chain

Goose should converge on one outcome-bearing chain:

```text
SITE GOAL / DEMAND
      ↓
OBSERVED STATE
      ↓
APPLICABLE RECOMMENDATION
      ↓
EXACT SOURCE / REPOSITORY CHANGE
      ↓
DEPLOYMENT PARITY
      ↓
PROVIDER-NATIVE OUTCOME
      ↓
REVIEW DECISION
```

Controlled Cohorts / Growth Experiments plus Change Receipts and outcome evidence should own runtime intervention state. Program registries may define hypotheses and candidate sites, but should reference canonical experiment IDs instead of duplicating `planned/hold/observing/reviewed` truth.

Evidence Lab, Winner Observatory and the future Proof Board are views over this evidence, not parallel proof systems.

---

# Internal architecture

## BraidGraph

BraidGraph remains an internal lineage/index primitive connecting source/rule evidence to recommendations, source ownership, changes, verification and outcomes. Its value is traceability and reverse impact. It is not the user-facing product and does not infer causality.

## Supporting engines

| Engine | Product job |
| --- | --- |
| Site Focus + Intent Ownership | Define the problem, demand and canonical page/job boundary. |
| Growth / Recommendation Registry | Supply source-backed candidate interventions. |
| Controlled Cohorts / Growth Experiments | Freeze intervention design and review outcomes. |
| Evidence / Change Receipts | Preserve exact observations, changes and deployment identity. |
| provider-native evidence imports | Preserve Search/AI/referral evidence without flattening semantics. |
| Repository Mapper / Transformation Packs | Map rendered surfaces to exact sources and prepare bounded changes when needed. |
| BraidGraph | Preserve lineage and reverse-impact relationships. |
| Resolver / protocol adapters | Supporting machine-interface discovery and decision-quality work. |
| Trend Intelligence | Keep upstream recommendations current. |
| Project Maturity Surfaces | Project identity/rights/governance support, not discoverability proof. |
| Portfolio Watch | Later multi-site review/maintenance composition. |

Internal engines should not silently become first-run product choices.

---

# Market boundary

By 2026, established SEO/GEO products already provide prompt tracking, citations, mentions, competitors, AI visibility scores and large response/prompt datasets. Goose should not try to win on prompt corpus size or another visibility dashboard.

The plausible differentiation is the intervention history:

> **why this site should try this change → what exact change went live → what provider-native evidence followed → what decision was made → what must be re-reviewed when guidance changes.**

The architecture is copyable. The potential moat is an accumulating, provenance-rich corpus of interventions and outcomes across sites, including null and negative results.

---

# Provider-native evidence

Use a funnel, not a score:

`access -> index/eligibility -> exposure -> citation/reference -> brand mention -> visit -> useful action`.

### Google

Search Console generative-AI reports are exposure/impression evidence with provider-supported page/country/device/time dimensions. Google does not require special AI markup for AI Overviews or AI Mode.

### Bing / Microsoft

Bing AI Performance is citation/grounding evidence: citations, cited pages, grounding-query/page relationships and provider-native intent/topic/query-scoped Citation Share. It is not ranking/authority evidence and is aggregated/sampled.

### OpenAI / ChatGPT

OAI-SearchBot access, public Search eligibility, bounded observed citations and referrals are separate evidence stages. GPTBot training control is separate.

### Perplexity / other answer engines

Keep crawler/indexing policy and bounded observed citations/referrals where real. Do not invent owner telemetry that is not actually exposed.

## Provider-native evidence — active-cohort only

Do not build a generalized provider abstraction ahead of evidence. Preserve raw owner exports and add/harden adapters when an active proof cohort has real data that cannot be represented safely today.

---

# Product wedge

## P0 — First reviewed real-site proof loop

The current product P0 is **not** the Proof Board. It is the first completed chain from recommendation to exact deployed change to provider-native outcome to reviewed decision.

Ptichi’s frozen 12-treatment / 6-control cohort remains the canonical first attempt and stays `measurement-hold` until exact production parity is verified.

No larger replacement cohort should be manufactured for appearance.

## P1 gated — Minimal proof rendering

After one reviewed loop exists, #93 should render one evidence-derived proof card before any portfolio dashboard is built.

The card should show site goal, intervention, evidence/demand basis, exact deployment state, provider-native outcome, unknowns/confounders and the review decision.

## P1 — Replicate the contract

Apply the same proof contract to two contrasting owned sites with real owner evidence. The goal is to test generality, not fill a dashboard.

## P1 — Minimal first-run / Get Found Brief

Then use #92/#94/#96 to expose URL + minimal owner context -> inspect -> one primary recommendation -> proof plan. Site Focus, Intent Ownership, Growth and evidence engines remain underneath.

## Later — Portfolio operator value

After proof generalizes, the strongest paying-user hypothesis is an agency, maintainer or small team responsible for multiple sites. Potential paid value:

- recurring evidence/review;
- multi-site source/rule impact;
- owner-data connectors;
- deployment/evidence queues;
- policy/governance;
- reviewed remediation waves;
- intervention history and learned applicability.

This buyer hypothesis remains unvalidated until independent repeat use exists.

---

# Stop rules

Until the proof success gate is met:

- do not build a rich Proof Board before the first reviewed loop;
- do not add new public modules merely to make the project look mature;
- do not expand Resolver/ARD/MCP/WebMCP/transact/cross-lingual breadth without a blocked real workflow;
- do not treat the stratified agentic-web corpus as product P0;
- do not add Trend/Radar breadth beyond maintenance;
- do not add transformation-pack breadth without observed blocked target work;
- do not add AI-specific files/markup as ranking tactics;
- do not expand URLs before demand/intent/page-value gates;
- do not use DOI/trust/policy/asset/page counts as evidence of discoverability value;
- do not collapse provider evidence into a universal AI score;
- do not create parallel experiment lifecycle truth;
- do not hide neutral or negative outcomes.

# Proof success gate

Before the next major product expansion Goose needs:

1. one fully reviewed real-site intervention with exact deployment parity and provider-native outcome evidence;
2. three owned sites with canonical experiment/evidence state;
3. at least two sites with real provider-native Search/AI evidence;
4. at least one retained neutral/negative result;
5. one minimal proof artifact generated from committed evidence;
6. one demonstrated decision advantage over a generic checklist;
7. no major new capability justified by feature count or speculative maturity.

If repeated well-run interventions cannot reach this gate, Goose should contract its scope rather than add product surface.
