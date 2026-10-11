# Goose Applied Research Deep Run — 11 October 2026

**State:** 20 *review candidates*, not 20 shipped features, 20 ranking tricks, or a page-production plan. This pass extends the [34 Search/GEO candidates from 10 October](2026-10-10-search-geo-deep-run.md) without activating them. The canonical machine-readable ledger is [`2026-10-11-applied-deep-run.json`](2026-10-11-applied-deep-run.json).

**Product constraint:** [M1 proof before more product](../../ROADMAP.md) still wins. A small, credible demonstration that improves a real site-owner decision beats one more generalized module. The current Ptichi r2 experiment is not retrospectively altered. This research does not authorize changes to other repositories or production targets.

## What changed in the research

- **24 September 2026:** Google introduced a separate **multimodal search type filter** in ordinary Search and generative AI Search Console performance views. It covers image-led interactions such as Lens and Circle to Search; data appear only when a property receives relevant activity. This is an *owner-side observational input*, not an image-SEO promise. [Google announcement](https://developers.google.com/search/blog/2026/09/web-multimodal-in-sc).
- **May–September 2026:** Chrome documents **task-based WebMCP evals**, deliberate mid-chain failure tests, and explicit tool authorization/consent and trust boundaries. WebMCP remains an **origin-trial experiment**. Evaluate end-user task completion versus ordinary accessible HTML before proposing it for Flow or Goose. [Evals](https://developer.chrome.com/docs/ai/webmcp/evals) · [Security](https://developer.chrome.com/docs/ai/webmcp/secure-tools) · [Trial](https://developer.chrome.com/blog/ai-webmcp-origin-trial).
- **2026 research (preprints, not settled scientific consensus):** GEO is multi-stage, stochastic and only partly observable; single AI-generated citations or rewrites are weak evidence of durable organic growth. Separately, RAG attribution can look better against a compressed summary than against the underlying source text, and architecture comparisons change with corpus/judge. Translate these into checks and small pilots, not numerical uplift promises. [GEO survey](https://arxiv.org/abs/2607.14035) · [RAG robustness](https://arxiv.org/abs/2608.00705) · [Attribution](https://arxiv.org/abs/2609.14245).
- **Existing provider-native baseline:** Google AI-specific Search Console reports and Bing citation/intent/topic/share observations use different populations and definitions. Always keep them separate. [Google](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports) · [Bing](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c).

## Role-based review (six skeptical passes)

1. **Real user / site owner:** Which single action becomes more effective, cheaper or safer after this? If no one uses the result, mark `no-op`.
2. **Research librarian:** Is the cited evidence an official provider contract, observational study or unreviewed preprint? Does it actually support the proposed use?
3. **Technical architect:** Which current Goose subsystem already implements 80% of this? Reuse it; do not invent a new protocol or dashboard.
4. **Experiment designer:** Specify frozen population, alternative explanation, negative control, source location, repeated measures, evaluation disagreement, failure and rollback.
5. **Editor/privacy/security critic:** Can people understand the outcome without fake AI marketing? Is every source/metric permitted and safe to publish?
6. **Skeptical business owner:** Would this alter one real decision? Is the effort justified without assuming Search lift?

## Ranked applicability — not a shipping queue

| Rank | Candidate | Priority | First target | Scope |
| ---: | --- | --- | --- | --- |
| 1 | source span attribution | **P0** | Vedokrok, MHC Corpus | reusable-evaluation |
| 2 | paraphrase stability panel | **P0** | Goose, Ptichi | reusable-evaluation |
| 3 | decision over feature gate | **P0** | Goose | product-method |
| 4 | cohort interference review | **P0** | Goose, Ptichi | experimental-design |
| 5 | human edited claim parity | **P0** | Goose, Vedokrok | editorial-method |
| 6 | multimodal owner baseline | **P0** | Goose, Vedokrok | provider-measurement |
| 7 | bing intent page decision | **P1** | Goose, Bonihua | provider-measurement |
| 8 | one page answer evidence | **P1** | Vedokrok, Ptichi | content-experiment |
| 9 | webmcp task selection eval | **P1** | Flow, Goose | agent-operability |
| 10 | webmcp security negative cases | **P1** | Flow, Goose | security-evaluation |
| 11 | rag triple robustness | **P1** | Vedokrok, MHC Corpus | retrieval-evaluation |
| 12 | extractive context ablation | **P1** | Vedokrok, MHC Corpus | retrieval-evaluation |
| 13 | multilingual parity check | **P1** | Metkagram, Bonihua | reusable-evaluation |
| 14 | failure mode bucketing | **P1** | Goose, Flow | product-method |
| 15 | citation sampling calendar | **P1** | Goose, Ptichi | measurement-method |
| 16 | no op and stop decisions | **P1** | Goose, Flow | product-method |
| 17 | unit cost per reviewed decision | **P1** | Goose, Flow | operations-method |
| 18 | research to pilot transfer receipt | **P1** | Goose, Vedokrok | governance-method |
| 19 | webmcp origin trial watch | **P2** | Flow, Goose | experimental-technology |
| 20 | owner controlled ai inclusion | **P2** | Goose, Vedokrok | rights-governance |

## Decision cards

### 1. source span attribution — P0

**Applies:** Vedokrok, MHC Corpus, Goose. **Maturity:** reuse-or-pilot.

Verify each generated factual claim against the actual original cited passage, not against an intermediate AI summary.

**Reuse / one bounded action:** Use existing reference and editorial-receipt evidence; create a frozen, human-reviewed 20-question pilot, not a new publication surface.

**Evidence to accept:** Report supported/unsupported/ambiguous claims and source mismatch separately; keep source locations and missing evidence.

**Stop or rollback:** Stop if passages or publication rights are not accessible; a model judge alone is not ground truth.

**Sources:** [paperAttribution](https://arxiv.org/abs/2609.14245) · [paperRag](https://arxiv.org/abs/2608.00705).

### 2. paraphrase stability panel — P0

**Applies:** Goose, Ptichi, Bonihua. **Maturity:** reuse-or-pilot.

Test whether a discovery or recommendation observation survives neutral paraphrases, reruns, language, and model-surface drift.

**Reuse / one bounded action:** Extend the existing frozen query/prompt panel with a separately versioned secondary robustness panel; do not retroactively edit Ptichi r2.

**Evidence to accept:** Preserve exact prompts, answer artifacts, query families, repetitions, dates, models and mention/citation/recommendation distinctions.

**Stop or rollback:** Do not pool different engines, post-selected winning prompts or missing runs into one visibility score.

**Sources:** [paperGeo](https://arxiv.org/abs/2607.14035) · [googleGen](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports).

### 3. decision over feature gate — P0

**Applies:** Goose. **Maturity:** reuse-or-pilot.

The next deliverable is one justified owner decision, not an extra protocol, graph, dashboard or count of researched ideas.

**Reuse / one bounded action:** Use Roadmap M1 and issue #148; select a currently blocked, unchanged or low-risk intervention with a real evidence source.

**Evidence to accept:** Record next action/no-op/unknown and how the evidence changed the decision versus generic advice.

**Stop or rollback:** Stop new feature development when no real owner case demonstrates a decision advantage.

**Sources:** [paperGeo](https://arxiv.org/abs/2607.14035) · [googleAi](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).

### 4. cohort interference review — P0

**Applies:** Goose, Ptichi. **Maturity:** reuse-or-pilot.

Audit whether shared navigation, templates, links and later source edits contaminate frozen treatment and control groups.

**Reuse / one bounded action:** Reuse source-drift and treatment-cohort integrity checks from PR #151 on the next actual review window.

**Evidence to accept:** Classify unchanged, exposed-to-shared-change, uncertain, or incompatible controls before interpreting outcomes.

**Stop or rollback:** Do not repair a contaminated cohort by rewriting its historical freeze.

**Sources:** [paperGeo](https://arxiv.org/abs/2607.14035) · [googleGen](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports).

### 5. human edited claim parity — P0

**Applies:** Goose, Vedokrok, Bonihua. **Maturity:** reuse-or-pilot.

Review headings, summaries, alt text, social previews and structured data as claims that must match the underlying page.

**Reuse / one bounded action:** Extend existing editorial parity and original-evidence workflow to a small sampled page cohort; no automatic mass rewrite.

**Evidence to accept:** A human can point to each concrete fact; no empty brand promises, fabricated expertise, or title/body contradictions.

**Stop or rollback:** Do not replace human writing with generic AI-polished claims or publish thin query variants.

**Sources:** [googleContent](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content) · [googleAi](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).

### 6. multimodal owner baseline — P0

**Applies:** Goose, Vedokrok, Ptichi. **Maturity:** reuse-or-pilot.

Google introduced a multimodal Search Console filter on September 24, 2026: useful only where real visual-query observations exist.

**Reuse / one bounded action:** Add an optional read-only owner review step for real Lens/Circle-to-Search and multimodal generative Search observations.

**Evidence to accept:** Keep web, generative-AI and multimodal scopes and export dates explicit, including unavailable/zero-volume cases.

**Stop or rollback:** No images, schema, or tools should be added merely to populate a newly released report.

**Sources:** [googleMulti](https://developers.google.com/search/blog/2026/09/web-multimodal-in-sc) · [googleGen](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports).

### 7. bing intent page decision — P1

**Applies:** Goose, Bonihua, Vedokrok. **Maturity:** conditional-pilot.

Map actual Bing grouped grounding phrases and intent/topic labels to their cited canonical pages before suggesting fresh URLs.

**Reuse / one bounded action:** Reuse existing arwp-bing owner context and query-page mapping without treating sampled phrases as literal user prompts.

**Evidence to accept:** Review one page per supported intent gap; cite the actual provider filter and observation window.

**Stop or rollback:** Skip when Bing data are unavailable or sparse; Citation Share is neither ranking nor clicks.

**Sources:** [bingAi](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c) · [bingNew](https://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/).

### 8. one page answer evidence — P1

**Applies:** Vedokrok, Ptichi, Bonihua. **Maturity:** conditional-pilot.

Test a human-authored answer improvement with a concise original example, reproducible artifact or practical exercise.

**Reuse / one bounded action:** Use existing canonical page and deployment receipt; change one substantive answer, not an entire topic cluster.

**Evidence to accept:** Compare factual clarity and user task success first, then owner-side results in compatible windows.

**Stop or rollback:** Do not make an unmeasured publication count or claim ranking improvement.

**Sources:** [googleContent](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content) · [paperGeo](https://arxiv.org/abs/2607.14035).

### 9. webmcp task selection eval — P1

**Applies:** Flow, Goose. **Maturity:** conditional-pilot.

Measure whether an agent selects the right real tool for a real task and succeeds through a whole journey.

**Reuse / one bounded action:** Use the existing agent-eval tooling on a read-only sandbox; compare semantic HTML baseline with an optional WebMCP prototype.

**Evidence to accept:** Freeze tasks, success rubric, initial state, retries and tool-call trace; include mid-chain failures.

**Stop or rollback:** Do not publish WebMCP as a universal browser feature or SEO ranking signal.

**Sources:** [webmcpEval](https://developer.chrome.com/docs/ai/webmcp/evals) · [webmcpTrial](https://developer.chrome.com/blog/ai-webmcp-origin-trial).

### 10. webmcp security negative cases — P1

**Applies:** Flow, Goose. **Maturity:** conditional-pilot.

Test prompt-injected tool descriptions, cross-origin requests and malicious retrieved output before adding any agent actions.

**Reuse / one bounded action:** Create adversarial fixtures for read-only demonstration; require explicit authorization for irreversible/write operations.

**Evidence to accept:** All off-origin, untrusted-output and unauthorized writes must fail safely; record declined calls.

**Stop or rollback:** Skip production tool exposure without confirmed hosting, session boundaries and owner consent.

**Sources:** [webmcpSecurity](https://developer.chrome.com/docs/ai/webmcp/secure-tools) · [webmcpTrial](https://developer.chrome.com/blog/ai-webmcp-origin-trial).

### 11. rag triple robustness — P1

**Applies:** Vedokrok, MHC Corpus, Metkagram. **Maturity:** conditional-pilot.

Compare retrieval systems while varying corpus split, embedding method and judge; report strata not one pooled winner.

**Reuse / one bounded action:** Run a small held-out fixed question set against existing BM25/simple retrieval and any proposed semantic/graph variant.

**Evidence to accept:** Record retrieval hit, answer fidelity, source-span support and evaluator agreement independently.

**Stop or rollback:** Do not replace working BM25 on evidence from one corpus or one LLM judge.

**Sources:** [paperRag](https://arxiv.org/abs/2608.00705) · [paperAttribution](https://arxiv.org/abs/2609.14245).

### 12. extractive context ablation — P1

**Applies:** Vedokrok, MHC Corpus. **Maturity:** conditional-pilot.

Compare shorter extractive evidence context against abstractive summaries under equal token budgets.

**Reuse / one bounded action:** On the same frozen questions, compare evidence-bearing spans and answer support before and after compression.

**Evidence to accept:** Report exact source matches and token cost; record abstentions and losses.

**Stop or rollback:** Reject compression that makes answers read well but breaks original-source attribution.

**Sources:** [paperAttribution](https://arxiv.org/abs/2609.14245).

### 13. multilingual parity check — P1

**Applies:** Metkagram, Bonihua, Ptichi. **Maturity:** conditional-pilot.

Compare task correctness and evidence fidelity across supported languages without assuming translated prompts are equivalent demand.

**Reuse / one bounded action:** Freeze matched intent families and native-language editorial review; split by locale and audience.

**Evidence to accept:** Track supported claims, task success, bad translations and coverage gaps separately.

**Stop or rollback:** No automatic multilingual programmatic pages to inflate indexable URLs.

**Sources:** [paperGeo](https://arxiv.org/abs/2607.14035) · [googleContent](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content).

### 14. failure mode bucketing — P1

**Applies:** Goose, Flow, Vedokrok. **Maturity:** conditional-pilot.

Classify failed tasks by incorrect selection, bad retrieval, missing evidence, execution failure or evaluation ambiguity.

**Reuse / one bounded action:** Map to existing Search Failure Doctor, Resolver regret and agent-eval receipts instead of creating an opaque success score.

**Evidence to accept:** An owner gets one corrective action at the first evidenced broken stage.

**Stop or rollback:** Do not promote a guessed root cause from a single incomplete observation.

**Sources:** [paperRag](https://arxiv.org/abs/2608.00705) · [webmcpEval](https://developer.chrome.com/docs/ai/webmcp/evals).

### 15. citation sampling calendar — P1

**Applies:** Goose, Ptichi, Bonihua. **Maturity:** conditional-pilot.

Prevent cherry-picked AI-answer screenshots by scheduling fixed-panel repeated samples and preserving missed runs.

**Reuse / one bounded action:** Use current Controlled Cohort timeline and a supplemental prompt-panel log only when outcome access exists.

**Evidence to accept:** Keep chronological coverage, stable families, provider changes, controls and non-results.

**Stop or rollback:** Do not fabricate exact prompts from Bing grouped grounding queries.

**Sources:** [paperGeo](https://arxiv.org/abs/2607.14035) · [bingAi](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c).

### 16. no op and stop decisions — P1

**Applies:** Goose, Flow. **Maturity:** conditional-pilot.

Explicitly recommend doing nothing where there is no evidence-backed next move, instead of scoring every site red.

**Reuse / one bounded action:** Reuse existing one-action Search Failure Doctor and documented no-op/unknown paths.

**Evidence to accept:** A reviewed case can explain what data would reverse a no-op.

**Stop or rollback:** Do not turn absence of provider data into a negative metric or a synthetic uplift estimate.

**Sources:** [paperGeo](https://arxiv.org/abs/2607.14035) · [googleAi](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).

### 17. unit cost per reviewed decision — P1

**Applies:** Goose, Flow. **Maturity:** conditional-pilot.

Watch the cost of retries and CI fan-out per accepted decision rather than minimizing model tokens in isolation.

**Reuse / one bounded action:** Reuse issue #150; audit PR workflow and agent loop duplication with actual run histories, no assumed billing charges.

**Evidence to accept:** Record run count, reviewer time, rework and unique verification coverage before/after.

**Stop or rollback:** Never disable essential checks or block security gates to improve apparent cost.

**Sources:** [webmcpEval](https://developer.chrome.com/docs/ai/webmcp/evals).

### 18. research to pilot transfer receipt — P1

**Applies:** Goose, Vedokrok, Metkagram, Flow. **Maturity:** conditional-pilot.

Make a portable card that says owner question, exact source, what already exists, one test, acceptance and rollback.

**Reuse / one bounded action:** Reuse existing experiment/receipt contracts and this research set; link to existing issues before making new ones.

**Evidence to accept:** A second project can reproduce the method without inventing an independent state machine.

**Stop or rollback:** Do not roll out target-repository changes without separate authorization.

**Sources:** [paperGeo](https://arxiv.org/abs/2607.14035) · [googleAi](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).

### 19. webmcp origin trial watch — P2

**Applies:** Flow, Goose. **Maturity:** watch.

Chrome 149 origin-trial APIs are suitable for task-oriented pilots, not for automatic Search optimization.

**Reuse / one bounded action:** Watch stable rollout and cross-browser compatibility; prototype only with true user-visible read-only capabilities.

**Evidence to accept:** Show task-completion difference against native HTML controls, plus security negative cases.

**Stop or rollback:** No agent-facing mutating tool may infer permission from metadata.

**Sources:** [webmcpTrial](https://developer.chrome.com/blog/ai-webmcp-origin-trial) · [webmcpSecurity](https://developer.chrome.com/docs/ai/webmcp/secure-tools).

### 20. owner controlled ai inclusion — P2

**Applies:** Goose, Vedokrok, Bonihua. **Maturity:** watch.

Google Search Console now offers a generative-AI content inclusion control; this is a rights/business decision, not an optimizer toggle.

**Reuse / one bounded action:** Document where an authorized owner checks it, keeping crawler training controls separate from Search inclusion.

**Evidence to accept:** Record the owner's intentional preference and observed report scope; never infer state from repository code.

**Stop or rollback:** Never silently switch owner preferences or promise ranking changes.

**Sources:** [googleControl](https://support.google.com/webmasters/answer/16908024) · [googleGen](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports).

## Three realistic pilots (only after confirming the owner evidence)

**Pilot A — Goose + Ptichi:** Start with the real frozen cohort and exact post-deployment source-drift receipt. Add a *separately frozen* secondary paraphrase/negative-control observation panel if actually useful. Do not change the 12-treatment/6-control Ptichi cohort or pretend deployment equality measures Search uplift. Exit: a reviewed `keep`, `revise`, `continue-measuring` or `stop` supported by real owner observations.

**Pilot B — Vedokrok / MHC Corpus:** On 20 genuine, permission-safe questions from the existing corpus, compare original-source-span support with answer support assessed only against an intermediate summary. Use a human-reviewed adjudication sample and measure missing citations; reuse existing search/annotation paths. Exit: a decision to keep baseline retrieval, change a narrow extraction step, or reject the new technique. No new external pages.

**Pilot C — Flow:** Freeze 10 read-only user tasks and a minimal agent eval. Compare ordinary accessible HTML to a strictly sandboxed WebMCP test only if the browser supports the trial. Test malicious tool descriptions, off-origin exposure and mid-chain failed calls. Exit: measured task success/failure and explicit `keep / retire`; absolutely no write-capable autonomous tool deployment.

## Copyable Deep Run execution prompt

~~~text
MISSION: Improve Goose ARWP and, where justified, produce reusable evidence-backed methods for Ptichi, Vedokrok, MHC Corpus, Metkagram, Bonihua and Flow. Work autonomously within the authorized current repository session. Do not simulate background execution.

READ FIRST: Resolve live main/ref; read AGENTS.md, REPO_MAP.md, ROADMAP.md, applicable skills and current code/fixtures/issues/PRs. Read the 10 Oct source-backed research and this 11 Oct evidence-to-pilot ledger. Check for existing work and avoid duplicates.

RESEARCH PASS: Prefer recent primary provider specifications, current changes, real owner measurements, independent empirical work and reusable engineering methods. Classify each idea as documented platform requirement/guidance, observed feature/measurement, experimental technique or preprint. Record source URL/date, applicability, existing subsystem, what is unknown and whether the technique transfers to each target project. Never confuse snippets, browser behavior, citations, Search indexing, traffic or useful product outcomes.

ADVERSARIAL ROLE LOOP: In sequence act as user, researcher, technical architect, editor, privacy/security reviewer and skeptical business owner. Each role challenges the preceding conclusion. Eliminate redundant ideas, make critical missing evidence explicit, and identify no-op/negative findings. At least two critique passes for a candidate that reaches implementation.

PRIORITY: P0 = real source/truth/security defect or an active owner-proof blocker; P1 = bounded pilot with explicit owner/user benefit; P2 = watch/experiment with limited or unstable provider support. 'Novel' alone is never a priority. AWRP M1 proof-before-expansion and issue #148 outrank feature quantity.

EXECUTION LOOP: 1) diagnose an existing real problem; 2) select ONE next move; 3) define hypothesis, falsifier, scope and minimal test; 4) implement a narrow safe change in an isolated branch if authorized; 5) run focused tests and CI without disabling unique checks; 6) inspect evidence and reviewer disagreement; 7) record keep/revise/stop with exact references; 8) repeat only if a further action is justified by observed results. Batch changes into one coherent commit when possible to reduce redundant CI fan-out.

TRANSFER GATE: A target-specific change requires its own repository access/authorization, current source-of-truth read, applicable legal/privacy rules and a verified build. Cross-repository plans are NOT deployment receipts. No silent changes to owner crawler preferences, publishing, paid products, credentials or public author identity.

MEASUREMENT: Use original provider scopes and final windows; freeze treatment/control and prompt panel before reviewing outcomes; record repeated runs, locale, paraphrases, evaluator disagreements, exact cited source spans, data gaps and contamination. Preserve neutral/negative cases. Never infer causal ranking/citation/traffic benefit from a metadata diff or green build.

OUTPUT PER CYCLE: a) what was observed with source/date/commit, b) what is actually new versus already implemented, c) accepted/rejected/watch candidates, d) exact changed paths/PR and verification evidence if changes were made, e) one next action and stop criterion. Do not fabricate tests, URLs, GitHub actions or live outcome data.

STOP WHEN: the P0 evidence-backed scope is safely done and verified, the next step requires private owner data, no candidate improves a real decision, the available repository permissions stop deployment, or the iteration starts generating duplicates. Do not continue loops for their own sake.
~~~

## Publication boundary

The above is internal public methodology. It is not a public marketing claim, no new site content is authorized, and the 20 candidates must not automatically enter the active recommendation registry. Private owner exports, credentials, evaluation examples containing real people, and unpublished research remain outside this repository.

## Review dates and source types

- **googleAi** (official): Search foundation and original user value; no special GEO shortcut. [Source](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).
- **googleContent** (official): AI-assisted content still needs original value and factual review. [Source](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content).
- **googleGen** (official): Owner-native Google generative AI exposure reporting. [Source](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports).
- **googleMulti** (official): New September 24 multimodal Search Console filter and export. [Source](https://developers.google.com/search/blog/2026/09/web-multimodal-in-sc).
- **bingAi** (official): Sampled provider-native citations/queries; not traffic or causal impact. [Source](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c).
- **bingNew** (official): Preview Intents, Topics, query-scoped Citation Share and comparison. [Source](https://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/).
- **webmcpEval** (official-experimental): Task-level stochastic agent evaluations for WebMCP. [Source](https://developer.chrome.com/docs/ai/webmcp/evals).
- **webmcpSecurity** (official-experimental): Tool authorization, untrusted output, consent and origin boundaries. [Source](https://developer.chrome.com/docs/ai/webmcp/secure-tools).
- **webmcpTrial** (official-experimental): Chrome-origin-trial status; not a universal interoperable Search switch. [Source](https://developer.chrome.com/blog/ai-webmcp-origin-trial).
- **paperGeo** (preprint): Critical survey of GEO evidence limits and stochastic multi-stage visibility. [Source](https://arxiv.org/abs/2607.14035).
- **paperRag** (preprint): Corpus/embedder/judge robustness in RAG requirements traceability. [Source](https://arxiv.org/abs/2608.00705).
- **paperAttribution** (preprint): Compression versus source-span attribution, with evaluator limitations. [Source](https://arxiv.org/abs/2609.14245).
- **googleControl** (official): Publisher control is a decision; do not silently change owner preferences. [Source](https://support.google.com/webmasters/answer/16908024).
