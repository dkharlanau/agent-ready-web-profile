# Goose ARWP self-interview loop — 2026-09-09

Status: product decision record. This is an internal reasoning artifact, not independent user research, market validation or evidence that any proposed feature creates Search/AI gains.

Purpose: stress-test Goose from multiple roles, make the roles disagree explicitly, and convert only convergent findings into roadmap/product changes.

## Round 1 — Architect

**Q: What is the biggest architecture problem now?**

A: Public product structure and internal implementation structure are being conflated. A user should not need to understand Radar, Resolver, BraidGraph, Growth, Evidence Lab, Watch, Project Surfaces and every schema to get value.

**Q: What should be public versus internal?**

A: Public journey: `goal -> inspect -> decide -> change -> prove -> watch/revise`. Internal engines remain composable and inspectable for advanced users.

**Q: What is the canonical evidence chain?**

A: owner-declared context -> public/repository observation -> applicability -> recommendation -> owned source path -> change -> verification -> deployment parity -> provider-native outcome -> review decision.

**Q: What should not be built?**

A: Another top-level module merely to give a name to an existing stage. New architecture needs a demonstrated blocked workflow or a repeated cross-site job.

**Decision:** separate public product journey from internal engines in the product registry and docs. Keep BraidGraph internal-advanced rather than product-facing.

---

## Round 2 — CEO

**Q: What would make Goose credible enough to sell?**

A: Real proof loops on sites, not more capability breadth. A buyer should see what changed, whether it was actually deployed, what provider-native evidence followed, and whether the project kept/revised/stopped the intervention.

**Q: What is the next milestone?**

A: `Proof before more product`: at least three owned sites with explicit experiment state, at least two with real provider-native evidence, and at least one reviewed decision. Neutral/negative outcomes count.

**Q: Who is the likely eventual paying user?**

A: An agency, maintainer or small team responsible for several sites. But multi-site commercial value should be built on a trustworthy single-site evidence loop, not assumed in advance.

**Q: What should be deprioritized?**

A: New protocol breadth, new sub-brands and architecture expansion that do not unblock a real site proof loop.

**Decision:** Proof Board + real longitudinal evidence become P0. Portfolio Watch scale comes after proof.

---

## Round 3 — GEO / Search strategist

**Q: What is the strongest current Search/GEO principle?**

A: Avoid treating GEO as a special-markup contest. Google's current Search guidance says foundational SEO practices remain applicable to AI Overviews and AI Mode and that no additional special AI optimization/markup is required. The useful advantage is unique, non-commodity, well-structured, current content and real value.

**Q: What is Goose already doing correctly?**

A: Site Focus, Intent Ownership, Data Authority, evidence/provenance, page value gates, bounded URL expansion and explicit measurement separation.

**Q: Where should Goose become stricter?**

A: Do not allow URL/content expansion until intent ownership and standalone page value are reviewed. Prefer original data, tools, examples, experiments and first-hand evidence over commodity explanatory text.

**Q: What would be a misleading GEO feature?**

A: A universal “AI-ready” score or a generated collection of AI-specific files presented as ranking/citation requirements.

**Decision:** keep GEO as evidence-backed Search/content operations; do not create a separate GEO scoring subsystem.

---

## Round 4 — AI Search specialist

**Q: Can one AI visibility metric represent Google, Bing and ChatGPT?**

A: No. Provider semantics differ materially.

- Google Search Console generative-AI reporting is exposure/impression oriented, with page/country/device/time dimensions.
- Bing Webmaster Tools AI Performance is citation/grounding oriented; it exposes cited pages and grounding-query relationships, and preview dimensions include Intents, Topics and Citation Share.
- OpenAI Search discovery includes OAI-SearchBot access semantics; that access is distinct from GPTBot training controls and distinct again from observed citations/referrals.

**Q: What is the correct cross-provider model?**

A: A funnel, not a score: `access -> index/eligibility -> exposure -> citation/reference -> brand mention -> visit -> useful action`. Each provider may expose only some stages; missing stages remain unknown.

**Q: What measurement debt remains?**

A: Keep import adapters current with provider-native fields and preserve dimensions without pretending they are comparable percentages/ranks across providers.

**Decision:** provider-native measurement hardening is P0; no composite AI visibility score.

Primary source checks used in this round:
- Google AI features: https://developers.google.com/search/docs/appearance/ai-features
- Google generative AI Search Console reports: https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports
- Bing AI Performance: https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c
- OpenAI Publishers & Developers FAQ: https://help.openai.com/en/articles/12627856

---

## Round 5 — Product Manager

**Q: What does a first-time user need before anything else?**

A: They need a decision, not an architecture tour.

**Q: What should the first-run outcome be?**

A: A concise Get Found Brief: what the site is trying to achieve, biggest current gap, top one to three actions, why they apply, how implementation is verified, what outcome would matter and what remains unknown.

**Q: Is Goose Interview itself the next P0?**

A: No. Owner context is useful, but building a sophisticated intake before proof risks improving onboarding to an unproven loop. Keep #92/#94/#96 as P1 behind Proof Board and real evidence population.

**Q: What should advanced users retain?**

A: Full evidence, Resolver, BraidGraph, receipts and experiment detail remain drill-down surfaces.

**Decision:** first-run simplification is P1; proof instrumentation remains P0.

---

## Round 6 — Site owner

**Q: What do I actually want Goose to answer?**

A:
1. Why am I not being found for the things that matter?
2. What should I do first?
3. Can Goose make or prepare the change safely?
4. Is that exact change live?
5. Did Search/AI visibility or useful traffic change afterwards?

**Q: What is annoying?**

A: Being asked to choose a technical subsystem, seeing dozens of equal-priority recommendations, or being shown a score with no concrete next action.

**Q: What builds trust?**

A: Explicit unknowns, a small actionable set, exact evidence/source links, visible deployment state and retained negative results.

**Decision:** public UX should be problem-first and action-limited; advanced module names become secondary navigation.

---

## Round 7 — Investor / skeptic

**Q: What is the biggest risk?**

A: Goose can look technically sophisticated while still lacking evidence that the full loop improves real acquisition/discovery operations. More modules can make that worse by creating an illusion of maturity.

**Q: What is the strongest moat if it works?**

A: The evidence-to-change history across many sites: source guidance, applicability, exact code/content change, deployment, provider-native outcome and later rule re-review. That is harder to commoditize than a one-time audit score.

**Q: What is missing from the public story?**

A: A Proof Board showing actual site experiment states, including HOLD, unknown, neutral and failed cases.

**Q: What would invalidate the current strategy?**

A: Several well-run site experiments repeatedly show no useful operational benefit and Goose cannot reduce time-to-correct-decision or maintenance effort. In that case scope should contract rather than adding features.

**Decision:** keep #93 P0; use #95 Surface Budget / Retirement Gate to prevent maturity-by-file-count.

---

# Cross-role synthesis

## Converged decisions

1. **Proof before more product.** Real site evidence loops are the immediate bottleneck.
2. **Public journey != internal architecture.** Hide module selection from first-run UX.
3. **Provider-native measurement.** Google exposure, Bing citation/grounding and OpenAI access/referral evidence remain semantically distinct.
4. **No composite Goose/GEO/AI score.** Use a staged evidence funnel.
5. **Intent/value before URL expansion.** More pages are not the objective.
6. **Deployment parity is mandatory before measurement clocks.**
7. **Negative/neutral evidence is product evidence, not failure to be hidden.**
8. **Portfolio scale comes after trustworthy single-site proof.**
9. **Surface/module retirement must be normal.** Goose should shrink/consolidate when a surface has no job.
10. **Resolver/protocol work continues only when it improves decision quality or unblocks a real Goose workflow.**

## Immediate priority order

1. #93 Portfolio Proof Board.
2. #55 / #83 real longitudinal owner-site evidence.
3. Provider-native measurement hardening.
4. Recommendation review/decay from real outcomes.
5. #92 / #94 / #96 first-run/Get Found flow.
6. #95 Surface Budget / Retirement dogfood.
7. Portfolio Watch scale.
8. New protocol/product breadth only when evidence-gated.

## Explicit non-decisions

- No new public sub-brand was introduced.
- No ranking/citation benefit was inferred from Google/Bing/OpenAI documentation.
- No independent market validation is claimed by this self-interview.
- No Ptichi observation clock is started while production parity remains unverified.
- No new URL/content expansion is justified by this document alone.
