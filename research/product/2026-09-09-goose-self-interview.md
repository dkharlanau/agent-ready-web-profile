# Goose ARWP self-interview loop — 2026-09-09

Status: product decision record. This is an internal product stress test, not independent user research, market validation or proof that Goose improves Search/AI outcomes.

Purpose: answer one question rigorously: **what would need to be true for a skeptical website owner, expert, partner or buyer to conclude that Goose genuinely helps sites get found?**

Decision principle: **PROOF BEFORE MORE PRODUCT.** Existing architecture earns its place only when it shortens a real path from a site problem to a better decision and measurable evidence.

Evidence classes used below:

- **fact** — directly observed in the repository, a committed experiment artifact, or current provider documentation;
- **hypothesis** — plausible product/market claim that still needs real use evidence;
- **unknown** — something Goose cannot honestly conclude yet.

---

## Round 1 — Architect

**Previous conclusion inspected:** the public journey should be simpler than the internal architecture.

**Assumption challenged:** that every mature internal system deserves a permanent public product surface.

**Single biggest weakness:** Goose has several overlapping evidence/state models, and internal architecture can still become the product. The clearest example is experiment state: the generic Data Authority registry can say a site is `planned` while a canonical Controlled Cohort artifact already says `measurement-hold`.

**Single highest-leverage move:** make one outcome-bearing intervention chain canonical and treat everything else as an adapter or internal index:

`site goal / demand -> observed state -> recommendation -> exact change -> deployment parity -> provider-native outcome -> review decision`.

### KEEP / MERGE / HIDE / RETIRE / BUILD

| Decision | Surface | Why |
| --- | --- | --- |
| KEEP | Site Focus + Intent Ownership | They constrain what the site should own before content/page expansion. |
| KEEP | Growth/Recommendation Registry | Useful as a source-backed candidate engine, not as proof. |
| KEEP | Controlled Cohorts / Growth Experiments | They are the closest existing primitive to outcome evidence. |
| KEEP | Change Receipts + deployment parity | Exact implementation/deployment identity is essential for credible experiments. |
| KEEP | provider-native owner evidence | Search/AI outcomes must remain provider-specific. |
| KEEP | Repository Mapper / transformations | Only when they shorten a real intervention and preserve exact source ownership. |
| KEEP | BraidGraph | As an internal lineage/index layer, not the user-facing product. |
| MERGE | Data Authority experiment status + cohort/experiment status | One experiment must not have conflicting lifecycle truth in multiple registries. |
| MERGE | Evidence Lab + Winner Observatory + future Proof Board presentation | These are views over evidence, not separate proof systems. |
| MERGE | Site Focus + Intent Ownership in first-run UX | One user-facing `goal + demand + page job` step; keep underlying models separate internally if needed. |
| HIDE | Resolver, BraidGraph, Repository Mapper, Change Receipt jargon | Advanced drill-down, not first-run choices. |
| HIDE | Trend/Radar machinery | Recommendation freshness should be visible; the mechanism need not be a primary product destination. |
| HIDE | Project Maturity Surfaces | Governance/trust support, not a discoverability product lane. |
| RETIRE | Resolver-as-primary-product thesis | It conflicts with the current Goose proof-first product thesis. Resolver remains a supporting engine. |
| RETIRE | pattern/source/schema/page counts as evidence of product value | Inventory is not usefulness. |
| BUILD | no new large subsystem | The only justified near-term build is the smallest adapter/rendering needed to complete and expose a real proof loop. |

**Evidence that would prove the move:** one real intervention can be reconstructed from source guidance through exact deployment and reviewed outcome without hand-retyping state in parallel systems.

**Falsifier:** real proof loops repeatedly require a genuinely separate state model that cannot be represented by the existing cohort/experiment/receipt chain.

**Do not build next:** another graph, protocol family, universal dashboard, general-purpose provider abstraction or new public module.

---

## Round 2 — CEO

**Previous conclusion inspected:** architecture should collapse around the outcome-bearing intervention chain.

**Assumption challenged:** that the eventual portfolio/agency buyer is already the best current product wedge.

**Single biggest weakness:** Goose cannot yet point to a completed real-site loop and say, with evidence, “this recommendation was chosen for this reason, this exact version went live, this provider-native outcome followed, and we decided to keep/revise/stop it.”

**Single highest-leverage move:** make the first completed reviewed real-site proof loop the company-level P0. A Proof Board, richer onboarding and portfolio automation are downstream of that evidence, not prerequisites for it.

**Single product thesis:** **Goose helps a website owner choose a small number of evidence-backed discoverability interventions, verify the exact deployment, measure provider-native Search/AI outcomes, and decide what to keep, revise or stop.**

What Goose is selling even while free: **better discoverability decisions with an auditable feedback loop**, not checklists, scores or content volume.

Strongest eventual buyer hypothesis: an agency, maintainer or small team responsible for several sites, because repeated measurement, maintenance and change-impact review create recurring work. This remains a hypothesis until repeat usage exists.

**Evidence that would prove the move:** at least one reviewed intervention, then replication on materially different sites; later, users return because evidence changed or a decision is due, not because Goose generated another checklist.

**Falsifier:** several well-run interventions produce no useful decision advantage and Goose does not reduce wasted work, ambiguity or maintenance effort versus Search Console + a general AI assistant.

---

## Round 3 — GEO / Search Expert

**Previous conclusion inspected:** Goose should sell the intervention/learning loop, not its architecture.

**Assumption challenged:** that a source-backed recommendation is automatically worth implementing.

**Single biggest weakness:** recommendation supply is stronger than demand validation. A technically correct pattern can still be irrelevant if there is no meaningful search intent, no unique page value, or the site cannot realistically own the query/problem.

**Single highest-leverage move:** make **demand / intent / page-value evidence** a gate before content or URL interventions, then measure Search stages separately: eligibility/indexing, exposure/impressions, query coverage, click/referral and useful action.

Current Google guidance supports this restraint: foundational SEO still applies to AI Overviews/AI Mode; there is no special AI markup requirement. Goose therefore has no basis for a separate “GEO magic” layer.

**Evidence that would prove the move:** treatment pages/interventions selected from explicit demand hypotheses gain relevant non-brand impressions/query coverage or useful acquisition without equal movement in comparable controls; negative results remain visible.

**Falsifier:** demand-gated selections perform no better operationally than arbitrary pattern-driven changes across repeated comparable experiments.

Facts vs hypotheses:

- **fact:** Google requires ordinary Search eligibility for AI features and does not require special AI markup;
- **fact:** Goose already has Site Focus, Intent Ownership and a Page Value Gate;
- **hypothesis:** using these gates before intervention will improve decision quality;
- **unknown:** which Goose recommendations materially affect discovery outcomes.

---

## Round 4 — AI Search Specialist

**Previous conclusion inspected:** measurement must follow provider semantics, not a generic “AI visibility” construct.

**Assumption challenged:** that Goose needs a complete cross-provider measurement platform before it can prove value.

**Single biggest weakness:** provider observability is uneven, and broad adapter work can become another infrastructure project before real data arrives.

**Single highest-leverage move:** preserve raw provider-native evidence and implement only the minimal adapter needed by an active proof cohort. Keep the common model as stages, not scores:

`access -> index/eligibility -> exposure -> citation/reference -> brand mention -> visit -> useful action`.

### Google AI Overviews / AI Mode

What can be observed: Search Console now exposes dedicated generative-AI **impressions**, pages, countries, devices and time dimensions. This is exposure evidence, not a citation count or causal effect.

What is inferred: why a page was selected, whether a specific Goose change caused inclusion, and the exact internal query-fan-out path.

### Bing / Copilot

What can be observed: Bing Webmaster Tools AI Performance exposes citations, cited pages, grounding-query/page relationships, trends, and preview dimensions such as Intents, Topics and query-scoped Citation Share.

What is inferred: causality, answer placement/importance and complete prompt-level coverage. Bing explicitly describes the data as aggregated/sampled and not ranking/authority evidence.

### ChatGPT Search

What can be observed: OAI-SearchBot access/eligibility controls and identifiable referrals where analytics capture `chatgpt.com`; individual public answer citations can be observed in bounded tests.

What is inferred: a universal citation rate or owner-native visibility score. GPTBot training controls are a separate mechanism.

### Perplexity / other answer engines

What can be observed from current publisher guidance: crawler/indexing policy and bounded public citations/referrals where they are actually seen.

What remains unknown: a provider-native owner telemetry surface comparable to Bing AI Performance. Goose should not invent one.

**Proprietary longitudinal knowledge hypothesis:** over time Goose can learn which classes of intervention, site context and intent tend to move which provider-native stage — including null and negative outcomes.

**Evidence that would prove the move:** active cohorts can ingest their real Google/Bing/referral evidence without semantic loss, and the same intervention history remains interpretable months later.

**Falsifier:** owner evidence is too sparse or unstable to support useful longitudinal decisions across most target sites.

---

## Round 5 — Product Manager

**Previous conclusion inspected:** provider adapters should follow active proof needs; the user should not see internal machinery.

**Assumption challenged:** that a sophisticated Goose Interview is necessary before first value.

**Single biggest weakness:** first-run still risks asking the user to understand the system before Goose has earned trust.

**Single highest-leverage move:** shortest useful journey:

1. user gives a URL;
2. Goose asks only the 2–4 owner facts that materially change the decision: target audience/problem, desired useful action, market/language if needed, and available owner evidence;
3. Goose inspects the real site;
4. Goose returns **one primary recommendation** (up to three only when independent) with demand/evidence, expected implementation check and outcome plan;
5. after implementation Goose verifies the exact live version;
6. Goose returns only when there is new outcome evidence or a review decision is due.

First useful output: **“Do this first, because of this evidence; here is what would prove it helped and what would falsify it.”**

Internal modules that should never be required in first-run UX: BraidGraph, Resolver, Repository Mapper, Trend Radar, Project Maturity Surfaces, Change Receipt terminology and registry selection.

Why return next week: not for another audit score, but because the experiment/deployment/evidence state changed and a decision is now possible.

**Evidence that would prove the move:** a new owner can act on the output without reading ARWP docs, and later understands whether the intervention is still `hold`, `observing`, `keep`, `revise` or `stop`.

**Falsifier:** users consistently need the advanced architecture first to trust or execute the recommendation.

---

## Round 6 — Website Owner

**Previous conclusion inspected:** Goose should deliver one decision and a measurement path, not an architecture tour.

**Assumption challenged:** that one onboarding/output shape fits every website type.

**Single biggest weakness:** Goose still has more internal vocabulary than owner-facing proof.

**Single highest-leverage move:** preserve one common proof contract while allowing the recommendation and outcome to vary by site type.

### Owner 1 — Solo creator

- **Why I came:** I publish useful material but get little relevant discovery.
- **30 seconds:** I need to understand whether Goose finds the biggest avoidable gap, not whether I passed 219 patterns.
- **Information needed:** audience/problem, target queries/problems, current Search evidence.
- **Output that makes me act:** one concrete page/site change tied to demand and a measurement plan.
- **Unnecessary complexity:** protocols, graphs, maturity surfaces, portfolio governance.
- **Trust:** exact source/evidence, explicit uncertainty, no ranking promise.
- **Return reason:** the page starts/stops gaining relevant impressions or Goose has enough evidence to revise the recommendation.

### Owner 2 — SaaS / product site

- **Why I came:** more qualified product discovery and trials, not more informational traffic.
- **Need:** landing-page intent, product facts, competitor/query context, Search/AI referrals and conversion events.
- **Actionable output:** one high-intent gap or technical eligibility issue with expected acquisition stage.
- **Complexity to remove:** generic editorial checklist items not tied to product acquisition.
- **Trust:** Search Console/Bing evidence + exact deployed change + conversion/referral separation.
- **Return reason:** compare acquired visits/useful actions after the change.

### Owner 3 — Documentation / open-source project

- **Why I came:** make docs/API/project knowledge easier to find and cite.
- **Need:** route/intent ownership, canonical docs, Search demand and actual machine-interface evidence where relevant.
- **Actionable output:** exact repository/source change and verification.
- **Complexity to remove:** consumer-marketing metrics when the real job is documentation retrieval.
- **Trust:** reproducible PR/change receipt and query/page evidence.
- **Return reason:** source guidance changes, docs drift or discovery/citation evidence changes.

### Owner 4 — Content / dataset site

- **Why I came:** make a large corpus discoverable without creating index noise.
- **Need:** entity uniqueness, demand, canonical identity, provenance and query/page fit.
- **Actionable output:** a bounded treatment/control cohort, not “publish more pages.”
- **Complexity to remove:** schema/DOI/graph work presented as ranking tactics.
- **Trust:** frozen cohorts, controls/baselines and retained negative results.
- **Return reason:** decide which entity/page patterns deserve expansion and which should be stopped.

### Owner 5 — Small business

- **Why I came:** more relevant local/commercial leads.
- **Need:** location/service intent, crawl/index basics, Business Profile/site parity where applicable, conversions.
- **Actionable output:** one eligibility/parity/content gap tied to a real lead path.
- **Complexity to remove:** agent protocols and research corpus work unless they directly matter.
- **Trust:** provider-native owner data and lead/referral outcomes.
- **Return reason:** the business profile/site/query/lead evidence changes.

Cross-owner finding: **the common product is not the recommendation catalog; it is the trustworthy intervention decision cycle.**

**Evidence that would prove the move:** materially different site types can use the same proof contract without receiving the same checklist.

**Falsifier:** different verticals require incompatible product semantics rather than adapters around one evidence chain.

---

## Round 7 — Competitor

**Previous conclusion inspected:** the proof contract may generalize across owner types.

**Assumption challenged:** that Goose’s existing technical breadth itself creates a moat.

**Single biggest weakness:** most visible capabilities are copyable and incumbents have much larger distribution/data assets.

**Single highest-leverage move:** stop competing on surfaces competitors already dominate; accumulate intervention/outcome evidence they do not naturally possess.

### If I run an SEO suite

I can copy: technical audits, content recommendations, dashboards, Search Console integrations, issue prioritization and AI visibility views.

I would attack Goose as: “an overengineered open-source checklist with no keyword/backlink/prompt data advantage.”

What would worry me: Goose demonstrates that it can choose fewer changes, bind them to exact deployments and build a cross-site outcome corpus that improves recommendation precision.

### If I run a GEO visibility platform

I can copy: prompt tracking, citations, mentions, competitors, visibility scores and recommendation cards.

I would attack Goose as: “it does not have the response/prompt corpus or monitoring scale.”

What would worry me: Goose learns from owner-native Search/AI evidence and actual interventions instead of only observing answers.

### If I run an AI-search optimization startup

I can copy: crawler checks, llms/robots guidance, structured-content recommendations and generated briefs.

I would attack Goose as: “too conservative and too slow.”

What would worry me: conservative evidence becomes a trust advantage and exposes unsupported optimization claims in the market.

### If I run an agency

I can copy: audits, strategy, implementation and reporting manually.

I would attack Goose as: “expert judgment already does this.”

What would worry me: Goose makes intervention history reproducible across many client sites and lowers the cost of re-review when provider guidance changes.

### Potential moat

Not BraidGraph, schemas or 219 patterns. Those are reproducible. The moat hypothesis is an **accumulating, provenance-rich intervention corpus**:

`site context + demand + recommendation + exact implementation + deployment + provider-native outcome + decision + later rule revision`.

Negative and neutral cases must remain in the corpus or it becomes marketing data instead of learning data.

**Evidence that would prove the moat:** later recommendations become measurably more precise because prior site/intervention outcomes inform applicability, and independent users value the historical evidence.

**Falsifier:** the corpus never changes decisions beyond what public provider guidance + generic LLM reasoning already provides.

---

## Round 8 — Investor

**Previous conclusion inspected:** the only plausible moat is accumulated intervention evidence, not current architecture.

**Assumption challenged:** that Goose is already a product merely because its product architecture is coherent.

**Single biggest weakness:** today Goose is still closer to a technically advanced open-source research/tool system with a product thesis than a proven repeat-use product.

**Single highest-leverage move:** prove repeatable learning on real sites before investing heavily in hosted portfolio features.

- **Painful enough problem?** Yes as a hypothesis: owners do not know which Search/AI advice matters, whether it was really deployed, or whether it helped. Pain is strongest for operators managing multiple sites.
- **Repeatable usage?** Unknown. It becomes repeatable only if evidence changes, recommendations age, deployments drift or new provider guidance creates real decisions.
- **Accumulating advantage?** Possible if intervention evidence is canonical and reused; not if Goose only accumulates patterns/files.
- **Does portfolio evidence create a data moat?** Potentially, but owner-controlled dogfood alone is insufficient external validation.
- **Could this become paid?** Plausibly for maintenance, evidence, governance and multi-site change review; not yet proven.

**Evidence needed before serious expansion:** at least one reviewed real-site loop, replication across contrasting sites, evidence that Goose changes an owner’s decision or saves repeated analysis, and at least one independent consumer/operator willing to use the workflow again.

**Falsifier:** no repeat use, no differentiated decisions, and no external operator willing to provide owner evidence or act on recommendations.

---

## Round 9 — Skeptic / Red Team

**Previous conclusion inspected:** Goose may become commercially meaningful if the intervention corpus compounds.

**Assumption challenged:** that the corpus will necessarily compound into useful knowledge.

**Single biggest weakness:** Search/AI outcomes are noisy, slow, provider-dependent and confounded. Goose risks building impeccable provenance around observations that still cannot support better decisions.

**Single highest-leverage move:** use aggressive falsification: pre-freeze interventions, controls/baselines where practical, exact deployment parity, explicit decision rules, confounders and stop conditions. If the evidence does not improve decisions, shrink the product.

### Why Goose could fail

1. **ChatGPT + Search Console may replace most single-site value.** A competent owner can ask an LLM to analyze pages, use GSC, make a change and compare results.
2. **Recommendations are commoditized.** Public Search guidance, SEO suites and AI-search tools already cover most obvious best practices.
3. **Measurement can be too weak for causal claims.** Rankings/citations change for many reasons; Goose must not smuggle correlation into certainty.
4. **Architecture creates maintenance cost.** Every registry, schema and public page can become another source of stale truth.
5. **Owner data is a dependency.** Without Search Console/Bing/analytics access, many outcome stages remain unknown.
6. **No one may want another workflow.** Agencies and owners may prefer existing tools even if Goose is more rigorous.
7. **A large evidence corpus may not generalize.** Site/context/provider heterogeneity can make cross-site lessons weak.

### What would make current work irrelevant

If providers expose much richer native recommendations + change attribution, or SEO suites combine owner data with trustworthy code-level intervention tracking, Goose’s differentiation narrows sharply.

### What Goose must prove to survive

Not that a page can be audited. It must prove at least one of these repeatedly:

- Goose chooses a materially better next intervention;
- Goose prevents a wrong/unnecessary intervention;
- Goose reduces time/cost to verify deployment and outcome;
- Goose catches drift/re-review work an owner would otherwise miss;
- Goose’s accumulated evidence improves later decisions.

**Evidence that would prove survival:** repeated owner decisions change because of Goose evidence, including decisions to do nothing or retire a tactic.

**Falsifier:** after several well-run loops, Goose mostly reproduces generic advice and adds workflow overhead without improving decisions or outcomes.

---

## Round 10 — Synthesis

### 1. THE PRODUCT THESIS

**Goose helps a website owner choose a small number of evidence-backed discoverability interventions, verify the exact deployment, measure provider-native Search/AI outcomes, and decide what to keep, revise or stop.**

### 2. THE BIGGEST CURRENT BOTTLENECK

**Goose does not yet have one completed, credible real-site chain from recommendation → exact deployed change → provider-native outcome → reviewed decision.**

### 3. THE PRODUCT MOAT HYPOTHESIS

The defensible asset could become a longitudinal intervention corpus linking **site context and demand → recommendation → exact code/content change → deployment → provider-native Search/AI/referral outcome → human decision → later rule revision**, including neutral and negative cases. The architecture is copyable; the accumulated evidence and learned applicability priors may not be.

### 4. TOP 3 ACTIONS

#### #1 — Complete the first real proof loop before building a proof product around it

- **Problem:** current proof infrastructure is ahead of actual outcome evidence.
- **Proposed change:** make the frozen Ptichi `ptichi-da-001-en-work-speaking` cohort the canonical P0. Keep it on HOLD until the exact production ref matches the frozen implementation ref; then use the already frozen query panel, owner Search evidence and 14/28/56-day windows to reach an explicit review decision.
- **Why now:** design, treatment/control assignment and decision rules already exist; creating another cohort would add activity but not information.
- **Evidence required:** verified production parity, provider-native before/after evidence where available, treatment/control observations, confounder notes and a reviewed `keep/revise/continue/revert/retire` decision.
- **Falsifier:** the cohort cannot produce interpretable evidence even after deployment parity and adequate observation, or it exposes a fundamental measurement flaw.
- **Existing components reused:** Controlled Cohort, Growth Experiment/visibility evidence, Change Receipt/deployment gate, Intent Ownership, Data Authority gate.
- **Smallest useful implementation:** no new feature; unblock/verify production parity and preserve/import the first real evidence revision.

#### #2 — Make one canonical intervention/proof state and remove duplicate lifecycle truth

- **Problem:** multiple registries/views can disagree about whether the same site experiment is planned, held, observing or reviewed.
- **Proposed change:** designate Controlled Cohort/Growth Experiment + Change Receipt/outcome evidence as canonical lifecycle truth; generic program registries describe hypotheses/candidates and reference canonical experiment IDs rather than owning runtime status. Evidence Lab, Winner Observatory and Proof Board become views/adapters.
- **Why now:** credibility depends on one answer to “what is actually happening on this site?”
- **Evidence required:** Ptichi status resolves identically through all product surfaces without manually duplicated state; later experiments can be reconstructed from the canonical chain.
- **Falsifier:** real workflows need materially different lifecycle semantics that cannot be represented through adapters/reference edges.
- **Existing components reused:** Controlled Cohorts, Growth Experiments, Change Receipts, BraidGraph, existing registries.
- **Smallest useful implementation:** document the source-of-truth rule, remove the stale Ptichi `planned` interpretation from program-level presentation, and have future proof rendering read canonical artifacts.

#### #3 — After the first reviewed loop, expose one decision-first proof surface and replicate on two contrasting sites

- **Problem:** current public prominence still favors patterns/features, while a buyer needs evidence that Goose changes a real decision.
- **Proposed change:** gate #93/#94/#96 behind the first reviewed loop. Then render a minimal Get Found/Proof card: site goal, one recommendation, demand/evidence, exact deployment state, provider-native outcome, unknowns and decision. Replicate the same contract on two contrasting owned sites before richer portfolio UX.
- **Why now:** evidence should determine the UX, not the other way around; replication tests whether the proof contract generalizes.
- **Evidence required:** three sites can use the same contract, at least two have real owner/provider evidence, and at least one intervention is reviewed; the public surface is generated from committed evidence rather than marketing copy.
- **Falsifier:** the contract cannot generalize across contrasting sites, or owners do not find the decision artifact useful enough to act/return.
- **Existing components reused:** #55, #93, #94, #96, portfolio registry, Site Focus, Intent Ownership, provider evidence adapters.
- **Smallest useful implementation:** one generated proof card from the first reviewed experiment; no dashboard, no aggregate score.

### 5. STOP / DEPRIORITIZE

Until the success gate below is met:

1. **Do not build a portfolio Proof Board as a major P0 product surface before the first reviewed proof loop exists.** A minimal renderer may follow real evidence.
2. **Deprioritize new Resolver/protocol breadth, ARD/MCP/WebMCP/transact/cross-lingual expansion unless it blocks an active proof loop or fixes demonstrated decision-quality failure.**
3. **Deprioritize the 50-site/stratified State of the Agentic Web expansion as product P0.** It is valuable research, but it does not prove Goose helps owners get found.
4. **Deprioritize new Trend/Radar feature breadth.** The existing engine is sufficient; remaining value comes from real measured interventions.
5. **Do not expand transformation-pack coverage without a real blocked target.** Fixture count is not product proof.
6. **Do not create more project-maturity, policy, DOI, visual-asset or AI-specific public surfaces as discoverability work.** Keep genuine governance/research tasks separate from the product P0.
7. **Do not add more indexable site pages or generic Data Authority cohorts merely to increase sample/page count.** Demand/value gates remain binding.
8. **Do not build a universal AI visibility score or compete with prompt-tracking suites on corpus scale.**

### 6. NEXT EXPERIMENT

**PTI-DA-001 / `ptichi-da-001-en-work-speaking` stays the next experiment.** It already freezes 12 treatment entities, 6 controls, a 12-query English observational panel, decision rules and observation windows. The immediate experiment action is not to redesign it: verify that the exact frozen implementation is live. Until production parity is proven, status remains `measurement-hold` and no outcome is attributed to the treatment.

### 7. SUCCESS GATE

Before the next major product expansion, Goose must have:

- **one fully reviewed real-site intervention** with exact deployment parity and provider-native outcome evidence;
- **three owned sites** with canonical experiment/evidence state, without conflicting duplicate status;
- **at least two sites** with real owner/provider-native Search or AI evidence;
- **at least one neutral/negative result retained publicly or in the canonical evidence record**;
- **a minimal proof artifact generated from evidence, not hand-written success claims**;
- **one demonstrated decision advantage**: Goose caused an owner to choose, reject, revise or stop work differently than a generic checklist would have;
- **no new major module justified by feature count, maturity appearance or speculative protocol breadth.**

If these gates cannot be reached after several well-run interventions, contract the product scope instead of adding features.
