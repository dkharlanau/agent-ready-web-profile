# Goose ARWP — Product Line

Reviewed: **2026-09-09** after the Goose self-interview loop.

> **Get Found.**

**Goose ARWP** is the public product. **Agent-Ready Web Profile (ARWP)** is the technical foundation. Goose is not another AI-visibility score, generic SEO checklist or protocol catalog. Its intended category is **evidence-backed Search & AI discoverability operations**: understand what a site is trying to achieve, inspect what is actually present, decide what applies, implement bounded changes, prove deployment, measure provider-native outcomes and re-review when evidence changes.

## Public product journey

A first-time user should not need to choose between Resolver, BraidGraph, Growth, Site Focus, Evidence Lab, Radar or Watch.

The public journey is:

```text
TELL GOOSE THE GOAL
        ↓
INSPECT
        ↓
DECIDE
        ↓
CHANGE
        ↓
PROVE
        ↓
WATCH / REVISE
```

This is the product experience. Internal modules remain composable engines behind it.

### 1. Tell Goose the goal

Capture only the owner context that materially changes recommendations: audience, problem, useful action, site boundary, relevant vertical, rights/identity constraints, owner-side measurement availability and success definition.

Owner-declared context is not independent evidence. Public observation and owner declaration remain separate when they disagree.

### 2. Inspect

Observe the real site and repository where available:

- crawl/index eligibility and Search foundations;
- Site Focus and route roles;
- Intent Ownership and page/job conflicts;
- entities, structured data and visible fact parity;
- datasets and Data Authority where genuine;
- crawler/access controls;
- Search/AI/agent discovery surfaces;
- repository/source ownership and deployment state;
- project maturity surfaces where applicable.

### 3. Decide

Return the smallest useful set of actions — normally the top 1–3 — with:

- why the action applies;
- evidence/source class;
- expected implementation check;
- what outcome would actually matter;
- explicit unknown/blocked state;
- what the action does **not** prove.

The system should prefer `not-applicable` or `insufficient-evidence` to cargo-cult work.

### 4. Change

Use deterministic, reviewable transformations where source ownership is known. Editorial truth, policy, legal/identity claims, authenticated provider settings and ambiguous repository ownership remain gated.

### 5. Prove

Separate:

- implementation verification;
- deployment parity;
- Search/AI exposure;
- citations/references;
- brand mentions;
- referrals/visits;
- useful actions/conversions.

A successful build or deployment is not Search/AI outcome evidence.

### 6. Watch / revise

Keep source guidance, recommendations, deployments and outcomes under review. Recommendations can become review-due, challenged, contradicted, consolidate-candidate or retired. Negative/neutral outcomes remain visible.

---

# Internal architecture

## Evidence core

The evidence core preserves truth boundaries:

- upstream source guidance vs Goose interpretation;
- owner declaration vs public observation;
- implementation proof vs external outcome;
- owner-controlled dogfood vs independent evidence;
- unknown vs zero;
- current vs superseded/retired evidence.

## BraidGraph

**BraidGraph** is an internal product primitive connecting:

```text
SOURCE / RULE
      ↓
SITE EVIDENCE
      ↓
APPLICABILITY
      ↓
RECOMMENDATION
      ↓
SOURCE / REPO OWNERSHIP
      ↓
CHANGE
      ↓
VERIFICATION / DEPLOYMENT
      ↓
OUTCOME EVIDENCE
```

Its main value is explainability and reverse impact. It is not the user-facing brand and does not infer causality.

## Existing internal engines

| Engine | Job |
| --- | --- |
| Radar / Trend Intelligence | Detect material upstream Search/AI changes. |
| Site Focus | Define problem, audience, outcome and site boundaries. |
| Intent Ownership | Prevent uncontrolled URL/content expansion and map intent families to canonical page jobs. |
| Resolver | Discover and normalize real machine/agent interfaces with provenance. |
| Growth / Adaptive Upgrade | Decide which reviewed recommendations actually apply. |
| Repository Mapper / Transformation Packs | Resolve source ownership and prepare deterministic bounded changes. |
| Evidence / Change Receipts | Preserve observations, mutations, verification and deployment state. |
| Controlled Cohorts / Winner Observatory | Run frozen longitudinal Search/AI experiments. |
| Recommendation Review | Re-review, challenge, revise and retire advice. |
| Project Maturity Surfaces | Keep identity, rights, collaboration and governance inspectable. |
| Portfolio Watch | Compose review/evidence state across multiple sites. |

Do not expose these as required first-run choices.

---

# 2026 market reality

The market already has strong visibility dashboards, GEO/AEO audits, content workflows and agent-readiness scanners. Goose should not try to win by recreating their dashboards or by inventing a more impressive composite score.

The durable differentiation is the chain:

> **what the site is trying to achieve → what is actually present → why a change applies → what exact change happened → whether it is live → what provider-native evidence followed → whether to keep/revise/stop it.**

Current official platform evidence reinforces the need for provider-specific semantics:

- Google says the same foundational SEO practices apply to AI Overviews/AI Mode and no special AI markup is required; Google Search Console now exposes dedicated generative-AI visibility reports.
- Bing Webmaster Tools exposes AI citation/grounding evidence, including page-level citations and grounding-query relationships, with newer intent/topic/citation-share views.
- OpenAI separates OAI-SearchBot Search surfacing from GPTBot training controls; crawler access is eligibility/access evidence, not citation or traffic evidence.

Provider metrics must remain provider-native rather than being flattened into a universal “AI visibility” score.

---

# Product wedge

## Now: proof on real sites

The immediate wedge is not “support every website stack.” It is:

- focused public knowledge/data/product sites;
- owner-controlled sites where Goose can safely dogfood end-to-end;
- Search/AI discoverability problems where deployment and outcome evidence can actually be observed.

Current portfolio examples include Ptichi, Brali, CBT Cards, Cognitive Biases, Metkagram, `dkharlanau.github.io` and the MetalHatsCats public repository surface where applicable.

## Later: portfolio operators

After several real evidence loops exist, the strongest commercial user is likely an agency, maintainer or small team responsible for many sites. Portfolio Watch, policy-as-code, reviewed change waves, source-change blast radius and owner-data connectors become valuable only after the single-site proof chain is trustworthy.

---

# Packaging direction

### Goose Open Core

- inspect and explain;
- Site Focus / Intent Ownership;
- evidence-backed recommendation planning;
- Resolver and technical interoperability;
- deterministic transformations where safe;
- receipts, experiments and open schemas.

### Goose Portfolio / managed layer

Potential hosted value after proof:

- recurring audits/re-review;
- multi-site Proof Board;
- provider-native evidence imports/connectors;
- source/rule change alerts;
- portfolio policy-as-code;
- verified stack transformation packs;
- reviewed remediation waves and audit history.

Do not introduce extra public sub-brands until real usage demonstrates the need.

---

# Current product bets

## P0 — Proof Board + real longitudinal evidence

Make committed experiment/deployment/outcome state visible across the portfolio. A visitor should immediately see what is planned, on hold, observing, reviewed, neutral/negative or stopped.

## P0 — Provider-native measurement hardening

Model Google generative-AI impressions, Bing citation/grounding data, AI referrals and other owner evidence according to provider semantics. No common score.

## P0 — Deployment parity as a hard measurement gate

Never start an observation clock when the intended implementation cannot be independently shown to be live.

## P1 — Simplified first-run journey

Use existing Site Focus, Intent Ownership, Growth and evidence engines behind a URL + owner-context flow. The output should be a concise Get Found Brief rather than a module selector.

## P1 — Surface Budget / Retirement Gate

New pages/modules need a real consumer, page job, verification path, review date and retirement/consolidation condition. Maturity is not file count.

## P1 — Portfolio Watch after proof

Scale only after the evidence chain is demonstrated on multiple sites.

---

# Stop rules

Do not add a new public module, protocol adapter, schema family or indexable content surface merely because it is technically interesting.

New work should normally satisfy at least one of these:

1. it closes a concrete real-site discoverability/evidence gap;
2. it reduces repeated owner work across several sites;
3. it improves measurement truth or prevents a false inference;
4. it fixes a demonstrated interoperability failure;
5. it makes an existing product journey materially simpler.

When the choice is **more product** versus **more trustworthy site evidence**, Goose currently chooses the evidence.
