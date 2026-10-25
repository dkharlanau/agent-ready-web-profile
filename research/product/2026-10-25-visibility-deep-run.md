# Make the next site change worth doing

Deep Run EXECUTE, 25 October 2026. Starting ARWP revision: `f3026f78e51abc66c5d55b968c1db0f018e55f81`.

Disclosure: public methodology, implementation findings, and a deliberately limited review of already public site surfaces and reports. No raw owner exports, credentials, private query corpus, learned commercial priors or user recordings are included. Suggested pilots below are hypotheses, not released capabilities or measured acquisition results.

## Decision

Goose has enough methods to support a useful intervention. Its next advantage should come from choosing the right existing page, using observations that still describe the site, and completing a useful task for a visitor. Adding another protocol, content taxonomy or dashboard does not resolve the observed gaps.

The current product question remains: can Goose make one justified change, verify the deployed result, and reach an honest decision from subsequent evidence? The existing [product-validation issue #148](https://github.com/dkharlanau/agent-ready-web-profile/issues/148) owns that work. Closing the infrastructure implementation issue #55 did not establish the outcome gate.

This run therefore repairs decisions in the existing Search Failure Doctor and opportunity planner, restores the portfolio inventory, and proposes small applied experiments that use existing Growth/Change Receipt contracts. It does not start a new experiment registry or assert that the portfolio has no users or revenue.

## What the inspected evidence says

| Observation | Evidence | Consequence |
| --- | --- | --- |
| The portfolio registry omitted Vedokrok and Bonihua. | `registry/portfolio-sites.json` at the starting revision contained seven sites and was dated 11 September. | The existing portfolio capture could not inspect those sites. Add their verified identities in observe-only mode. |
| The MetalHatsCats website pointed to its GitHub profile repository. | The declared `metalhatscats/metalhatscats` contains profile files; `metalhatscats/mhc` owns the publisher website. | Correct source routing before proposing website patches. MHC Corpus and its Vedokrok consumer remain separate projects. |
| A legacy registry still described Ptichi as `GSC empty`. | `seo-project-registry.json` versus the public [10 October diagnosis](https://github.com/dkharlanau/ptichi-site/blob/main/reports/search/search-diagnosis-2026-10-10.md). | Replace the stale statement with dated historical context. Do not invent current owner telemetry. |
| Search Doctor accepted a six-year-old failure as today's blocker. | A technical report dated 1 January 2020 selected `review-technical-blocker` when evaluated on 25 October 2026. An old Search window could select `review-query-fit`. | Separate historical observations from evidence eligible for today's action. |
| The opportunity planner could borrow another page's performance. | A declared target with no rows became `review-near-visibility` when another URL had 100 non-brand impressions at position 8. | Use the exact target's non-brand rows for target priority and show the pages actually observed. These numbers are synthetic regression inputs. |
| Saved portfolio implementation observations were old. | The starting `docs/research/portfolio-growth/index.json` referenced September 7 runs. | A current build or fresh report-generation time must not imply fresh Search measurements. |
| The original Ptichi comparison needs a contamination review. | The frozen r2 control includes handoff, tradeoff, bad-news and difficult-conversation pages. Ptichi's later `docs/CURRENT_LOOP.md` records edits to these pages and a bad-news redirect into a treatment owner. | Preserve the frozen assignment; inspect actual source/deployment drift before interpreting treatment/control outcomes. |

The small public GET sample on 25 October found reachable homepages for Ptichi, Vedokrok, Metkagram, Bonihua and MetalHatsCats, with self-canonical declarations and no observed homepage HTTP noindex. This does not establish eligibility for every URL, Googlebot access or indexing. The standard Technical Integrity CLI could not complete direct DNS resolution in this runner; proxy-backed public GETs were used for the limited inspection. No CLI PASS is claimed.

Metkagram exposed a concrete resource-policy conflict: its wildcard robots group disallowed `/assets/`, while its English and Russian pages referenced styles, scripts and icons below that path. Source ownership and the target's normal verification must be checked before releasing a correction. The public response establishes a declared access conflict; its effect on past Search impressions is unmeasured.

### What the historical Ptichi numbers can and cannot explain

The public October 10 report summarizes owner evidence observed on October 9. It records 140 final Web Search property impressions and four clicks for September 9–October 6, plus 78 indexed URLs among the 160 then-current sitemap URLs inspected. Its matched 158-URL comparison rose from 54 to 76 indexed URLs, with no observed losses. These are historical reported observations, not fresh collection during this run.

The evidence supports a narrow interpretation: that period had limited acquisition despite improving observed index coverage. It does not support a claim of a sitewide collapse, a penalty, proven content rejection, or a successful ARWP growth intervention. Query rows covered only part of property impressions; uncovered rows cannot be classified as brand or non-brand by subtraction. Current owner metrics remain unknown here.

## Repairs implemented in this run

### Dated evidence for Search Failure Doctor

The Doctor now records the evaluation time and the age of supplied technical, indexing and Search evidence. Its default reuse limit is 30 days, configurable with `--max-evidence-age-days=1..365`. This is a project scheduling policy, not a claim about how quickly Google crawls or indexes pages.

Old, future-dated or undated observations remain available as historical input but do not establish a current defect. The result separates `observedStages` from operational `stages`. A missing date calls for a new observation; changing the old timestamp is not a refresh. A sample with zero inspected URLs remains unknown and creates no stale-observation debt. A fresh independently justified technical repair can still proceed.

The API and input version remain compatible with old snapshots. Text output includes the evaluation time; legacy reports without freshness are labelled as recorded stages. Existing synthetic-data, publication-policy and local-repair boundaries remain in place.

### Exact page attribution in Search opportunities

`review-queue-v2` uses `targetNonBrandObserved` for the selected page's near-visibility priority. General observations for an intent remain useful context, but cannot supply the chosen URL's position or impressions. Branded overlap stays visible without escalating non-brand acquisition priority.

If the need has evidence while the declared target does not, the queue requests `review-target-coverage`. Reports include bounded alternative-page aggregates and their coverage; ordinary CLI output shows the first three actual URLs. Missing target rows stay unknown, while a measured zero remains zero. No automatic merge, redirect, noindex or new page follows from overlap.

### Correct portfolio membership and source ownership

The canonical registry now includes nine sites. Vedokrok and Bonihua are added as observe-only, and MetalHatsCats uses its actual website repository. Bonihua's canonical URL is `https://www.bonihua.com/`. A Search Console property identifier is a separate owner-data fact; it must not be rewritten merely because a canonical host differs.

The registry still permits no production mutation. Existing target modes are preserved. The legacy Ptichi measurement note now names the historical report and explicitly leaves current metrics uncollected.

Focused verification covers stale/future/undated evidence, empty indexing samples, clock/date boundaries, actual-target attribution, branded overlap, bounded output and missing-versus-zero semantics. The normal repository core suite and portfolio checks are also part of the final verification. These are implementation checks, not Search outcome measurements.

## Mechanisms worth applying next

The Discoverability corpus already contains useful artifacts, shareable input state, original evidence and intent ownership. The opportunity is to make one of these work for a real visitor and learn whether it changes a decision. Calling the same idea a new engine would add maintenance without adding that evidence.

### Vedokrok: one decision, a consequence, and a second attempt

The strongest next product hypothesis is a small One Bad Move experience. A visitor reads one realistic situation, chooses among three plausible moves, sees the consequence and receives a short explanation. A second version changes one constraint and asks the visitor to apply the same principle again.

The shareable result is the scenario and its constraint, not an invented intelligence score. A link can reproduce a reviewed scenario/version without storing private user text or creating an indexable page for every session. The underlying canonical explanation remains useful before interaction.

Start with one situation and one variation. Observe five intended users completing it without coaching. Record where the explanation fails and whether they can transfer the principle to the changed case. Five sessions are a small qualitative budget, not statistical proof. Add a distribution test only after the learning experience works. If nobody brings another participant, retain a useful exercise while marking the sharing hypothesis unproven.

### Bonihua: leave with a usable Chinese business message

Choose one bounded situation, such as a supplier moving a delivery date. A visitor supplies the essential facts and selects a suitable level of formality. The page provides reviewed Chinese wording, a natural Russian explanation, and a short list of facts to confirm before sending.

A few carefully edited templates and deterministic substitutions are enough for a first test. Competent Chinese review is necessary before publication. Personal details can remain local; shared links should point to a public example. Copying text is an intermediate action, not proof that it was used successfully at work.

The initial experiment asks five intended users to complete the same task. Stop expansion if important meaning changes or users still need to rewrite the result completely after one correction. A commercial pack of related situations is a later hypothesis, contingent on useful repeated use.

### Metkagram: use observed mistakes to choose the next edit

Select ten existing items around one B2–C1 distinction. Let a learner attempt a task, see a minimal contrasting example after an error, and try a new equivalent task. A later check uses a different example, so remembering the answer is less likely to masquerade as learning.

Feedback can identify an ambiguous answer, an unnatural example or an explanation the learner did not understand. Keep the item ID and problem type; free text and personal identifiers are not prerequisites. Before adding more sets, inspect recurring failures and improve one explanation.

The outcome is successful transfer to a new example and repeat practice. An increase in cards produced or the number of clicks on Next is not that outcome. Incorrect answer keys and ambiguous tasks require content repair before experimenting with learning effectiveness.

### Ptichi: publish one reproducible original observation

A narrow experiment can give readers something they cannot get from generic advice. For example, if supported by the real product, compare transcription error on a small owner-controlled recording set under one changed recording condition. Publish the method, versions, actual results, variation and a way to repeat the task.

Do not turn transcription accuracy into a claim about confidence, treatment or general speaking quality. Use recordings the owner is allowed to publish. Preserve neutral results. If the effect cannot be reproduced or does not answer a useful user decision, stop expanding it.

This should not silently modify the frozen Ptichi treatment/control surfaces. First reconcile that experiment's current source/deployment state; then choose an isolated scope or conclude the existing review before starting a new intervention.

### One reusable package for one audience

A finished language-practice or decision-training package can travel through a real user's work: a short explanation, a usable exercise, a teacher or self-study sheet, and a link to the interactive check. Reuse existing content and state clear reuse terms.

Test whether two independent intended users can apply the package without the author. The hypothesis fails if the resource remains unusable after a small revision. If intended users never encounter it, the distribution test is incomplete; that is not proof that the material has no value. No outreach, messages or publication to third-party communities are authorized by a registry entry alone.

This is the practical reason to concentrate effort on one topic and one acquisition path for a short period. Other projects can retain necessary maintenance. The experiment should earn its next unit of work through useful outcomes, not a publication quota.

## Keep provider evidence distinct

Current [Google guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) supports distinctive, useful content and ordinary Search fundamentals for generative Search. It does not require special AI schema or query-variant pages; it says Google Search ignores `llms.txt`. Those facts do not establish a numerical uplift for a tool or worked example.

The [Generative AI performance report](https://support.google.com/webmasters/answer/16984139) supplies impressions for AI Overviews and AI Mode. A missing report can reflect insufficient impressions. These are not automatically AI clicks, conversions or a complete record of citations.

[Bing Topics Portfolio](https://blogs.bing.com/webmaster/2026/10/introducing-topics-portfolio-beta-in-ai-performance/) can supply topic and opportunity context from actual grounding activity. Its availability and approximate ranges must be preserved. ARWP already has an owner-evidence adapter; a new scraper or visibility score is unnecessary before real input exists.

[Search Analytics API](https://developers.google.com/webmaster-tools/v1/searchanalytics/query) supports joint dimensions and has row limits. Separate Queries and Pages totals cannot be joined into invented query/page observations. Missing rows remain unknown.

[OpenAI crawler documentation](https://developers.openai.com/api/docs/bots) distinguishes OAI-SearchBot from GPTBot. Search access and training policy are separate choices. [IndexNow](https://www.indexnow.org/faq) notifies participating engines of real URL changes; notification is not proof of indexing or traffic.

## Next decision and stop conditions

First integrate the verified ARWP corrections and the independently reviewed Metkagram resource-policy repair. Then use actual current owner exports from the existing measurement workspace, preserving dates, filters and property scope. Do not construct those exports from remembered numbers.

Review Ptichi's existing cohort drift and make an explicit decision about what can still be learned. Keep the original freeze intact. A neutral or inconclusive reviewed result is more useful than an indefinitely growing list of untested tactics.

For a new visitor-facing experiment, begin with the bounded Vedokrok scenario if target inspection confirms it is not already implemented. Choose Bonihua or Metkagram instead if current user evidence gives one of them a clearer task and audience. A fresh technical blocker, a completed existing pilot, or stronger real demand would reverse the choice.

Do not build all five pilots at once. The next expansion gate is a verified useful user action, interpretable outcome evidence and a deliberate keep/revise/stop decision. Search exposure, user understanding, repeat use and willingness to pay remain separate measurements.
