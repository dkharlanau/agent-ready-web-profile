# Write the page that is worth opening

Edition 1.0.0 · researched 8 September 2026 · corpus 1.3.0 · agent-assisted source review.

The strongest working direction is a page that helps someone make a specific decision using evidence they cannot get from an interchangeable summary. This edition adds **26 patterns**, taking the library to **195**. It covers titles, opening paragraphs, voice, original article formats, passage-level semantics and measurement. These are implementation choices with different evidence strengths; no traffic lift was measured for this release.

[Browse the patterns](./discoverability.html) · [Inspect the research record](./knowledge/research/2026-09-08-editorial-expansion.json) · [Use the writing brief](https://github.com/dkharlanau/agent-ready-web-profile/blob/main/templates/growth/editorial-research-brief.md)

## What changed, and what remains a hypothesis

| Reviewed development | What it supports | Useful response to test |
| --- | --- | --- |
| Google announced deeper article suggestions and firsthand-source previews on 6 May 2026 | Additional ways to encounter original analyses and experience | A real field diary or a focused follow-up investigation, with supporting artifacts |
| Google's new AI optimization guide, announced 15 May and currently dated 10 July | Audience value; no mandatory chunk size, AI writing style or special schema | Choose structure by the reader's job; stop adding generic format rules |
| Search Console's generative AI control and reporting carry 31 August rollout notes | Owner-side inclusion and impression evidence | Inspect effective property settings and report coverage before interpreting absence |
| Microsoft guidance from October 2025 and Bing measurement guidance from February 2026 | Clear passages and supported citation-frequency observations | Test whether the extracted answer preserves its conditions; review correctness separately |
| W3C Web Annotation Recommendation, 2017 | Standard passage targeting for annotation clients | An optional evidence-review tool, with no assumed Search consumption |

Sources: [Google exploration announcement](https://blog.google/products-and-platforms/products/search/explore-web-generative-ai-search/), [AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), [property control](https://support.google.com/webmasters/answer/16908024), [report help](https://support.google.com/webmasters/answer/16984139), [Microsoft writing guidance](https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers), [Bing AI Performance](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview), [Web Annotation](https://www.w3.org/TR/annotation-model/).

These sources have different jobs. A product announcement describes an experience; it does not reveal selection weights. A style guide offers writing conventions; it is not a ranking-system specification. A standard defines a representation; it does not demonstrate adoption by search engines. The newness of a library pattern is independent of the age of its source.

## Pick a stronger article before polishing its wording

The following are **project editorial proposals**, not platform-prescribed templates. Each needs real evidence and an audience before publication.

| Article job | Original material to obtain | Opening move | A useful ending |
| --- | --- | --- | --- |
| Diagnose a failure | Reproduction and a discriminating check | Name the symptom and first check | Verify recovery; identify the escalation condition |
| Decide whether to upgrade | Same scenario in two actual versions | State who should act and why | Migration steps or a defensible reason to wait |
| Explain a surprising result | Dated logs, notes or a permitted observation | Show the observation and its context | Explain what another observation would change |
| Resolve conflicting advice | Two primary sources with different assumptions | State the apparent disagreement | Identify the variable that reconciles it, or preserve uncertainty |
| Compare options | Evidence for the few decision-changing criteria | Give a conditional choice | Show the input that would reverse the recommendation |
| Teach a technique | A runnable or inspectable worked example | Show what the learner will be able to do | Give an unfamiliar transfer task |
| Investigate a next question | Additional evidence beyond the parent answer | Explain the unresolved decision | Connect the result back to the reader's original task |

Before commissioning an article, ask: **what will exist after this work that does not exist in the sources we already read?** A new observation, a reproducible example or a careful reconciliation can qualify. Rewording five existing articles does not automatically qualify. The rationale is grounded in [Google's content-quality questions](https://developers.google.com/search/docs/fundamentals/creating-helpful-content); the commissioning test is our own implementation.

For this portfolio, possible briefs are a Bonihua lesson-choice guide grounded in its actual offer, a Ptichi worked product journey grounded in a tested current build, or a GitHub project's measured migration comparison. These are candidate subjects, not assertions about available evidence or completed changes on those sites.

## Use a voice that tells the reader what you know

A useful default is an approachable practitioner: concrete verbs, literal conditions and a visible basis for confidence. Adapt it to the audience. There is no demonstrated universal voice that makes AI recommend a site.

| Role in the passage | Example wording | What must support it |
| --- | --- | --- |
| Firsthand observation | “In this run, the retry produced a second record.” | A genuine run and its scope |
| Instruction | “Check the request identifier before retrying.” | A verified applicable procedure |
| External fact | “The provider documents this limit for the free plan.” | The current provider source |
| Interpretation | “One possible explanation is the cache state.” | A clear distinction from a tested cause |
| Prediction | “We expect this to reduce repeated setup work.” | A hypothesis and a future check |

These are invented wording examples, not reports of actual results. First person is useful when it identifies responsibility for real work. It is misleading when an AI-generated narrator implies experience nobody had. A brand can be playful in the framing while remaining precise in the answer. For technical documentation, [Google's tone guide](https://developers.google.com/style/tone) provides a useful writing reference, not an SEO endorsement.

## Titles, headings and openings that fit their job

A title should make a specific promise. A heading should help someone find the relevant part. Neither needs to repeat every search variant.

- **Upgrade analysis:** “Upgrade to version B? What changes for offline users.” Only use it after checking both versions.
- **Diagnostic:** “Duplicate records after retry: check the request identifier.” Only name that check if it discriminates the failure.
- **Comparison:** “Option A or B for a two-person team: cost and review work.” Keep the scenario visible throughout.
- **Field report:** “The step that broke our import: a reproducible case.” Supply the actual case; do not manufacture a dramatic story.

Avoid unearned superlatives, stale years and long boilerplate shared by every page. A fixed 60-character title limit is not a Google requirement; results may truncate according to available space. Keep the title, prominent H1 and opening consistent in meaning. [Google title-link guidance](https://developers.google.com/search/docs/appearance/title-link).

Use a verb for a task heading, a noun phrase for a concept, and a question for an actual question-and-answer section. Read the outline alone and check that it describes a coherent journey. Sentence case and an orderly hierarchy are useful house conventions; neither is a ranking multiplier. [Heading style guidance](https://developers.google.com/style/headings).

Write the opening after assembling the evidence. A diagnosis may need a test first; a comparison needs a condition; an investigation may begin with a surprising observation. Put the answer near its relevant question, but preserve a narrative when the narrative does real explanatory work. Do not force an exact opening length or turn every paragraph into a FAQ.

## Put the qualifier inside the answer

A useful passage answers a question **and preserves the condition under which the answer holds**. Our proposed review is to show a passage without surrounding prose and ask a reviewer to identify the subject, version, claim, exception and source.

Illustrative rewrite:

> Weak: “This option is faster. See limitations below.”
>
> More testable: “In the published example, option A uses fewer setup steps for a single workspace. The example does not cover team administration; use the team comparison before choosing for multiple workspaces.”

The second passage still needs an actual published example before it can become a factual claim. It demonstrates how to keep scope close to a conclusion, not a prescribed passage length.

Use a held-out question where the choice should reverse. Save the exact prompt, page revision, model or extractor, response and evaluation. A citation with the wrong condition fails the correctness check even though it remains a citation observation. Local retrieval success cannot establish Google, Bing or ChatGPT selection probability. See [benchmark protocol](./DISCOVERABILITY-BENCHMARKS.md).

## Micro-markup: start with the visible passage

Use normal headings, section IDs, source links and accessible footnotes first. `<cite>` identifies a work's title, not a general container for an author's name. An optional `data-claim-id` is an internal editorial convention; it supplies no ranking instruction.

A minimal relationship model is:

```text
WebPage --mainEntity--> Article
Article --author--> actual Person or Organization
Article --hasPart--> meaningful WebPageElement
WebPageElement --citation--> source used in that section
```

Apply section nodes only when a real tool needs them. Give them the same fragment locations the reader can open. Keep the author list consistent with visible bylines. Do not convert every sentence into a `Claim`, annotate a marketing page as a forum, or use `sameAs` for a merely related idea. [Article author guidance](https://developers.google.com/search/docs/appearance/structured-data/article), [WebPageElement](https://schema.org/WebPageElement), [hasPart](https://schema.org/hasPart).

For example, a `hasPart` relation can connect an article to `https://example.com/guide/#limitations`, with the section name and the particular citation used there. It does not make the source independently verified. See the [runnable section-graph demonstration](./examples/editorial/section-graph.html), which is explicitly a noindex example.

If an editorial system needs exact passage targeting, W3C Web Annotation supplies `TextQuoteSelector`: a short exact passage plus prefix/suffix context and a source URL. Keep the reviewed representation identifiable. An absent or ambiguous match needs review. This is a tool-interoperability experiment. Search engines are not documented here as consumers of that annotation.

`speakable` is a separate, restricted voice feature. Its documented beta targets an English news experience with specific availability. Do not deploy it across ordinary articles as a “quote this” command. [Google speakable documentation](https://developers.google.com/search/docs/appearance/structured-data/speakable).

## Measure the result that the change could affect

Start with one page and one meaningful change. Freeze a small query/page cohort and a useful action, then compare complete periods while recording release dates and other changes.

| Evidence | What to record | What it cannot establish alone |
| --- | --- | --- |
| Local output | Built HTML, links, graph parity, tested artifact | Publication or indexing |
| Live release | Actual public bytes and deployment identity | Search exposure |
| Google AI report | Available impressions, exact property and dimensions | AI click-through rate without supported click data |
| Bing AI Performance | Supported citation counts and grounding-query samples | Recommendation correctness or the original user's prompt |
| Manual AI panel | Prompt, surface/model, locale, answer, citations and judgment | A universal provider rank |
| Product outcome | Completed relevant action among measured visits | Causality from an uncontrolled before/after comparison |

Dedicated Google AI impressions overlap overall Search reporting; do not add them to its total. Search and Discover have distinct scopes. A rollout announcement does not establish that a particular property has enough reportable data. [Reporting announcement](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports), [report help](https://support.google.com/webmasters/answer/16984139).

Inspect the effective Search generative AI property control, including parent inheritance, with owner access. Missing access stays unknown. This is a distribution choice, so do not infer permission to change it from a request to rewrite an article. [Control documentation](https://support.google.com/webmasters/answer/16908024).

Keep a correct useful page when short-term exposure is neutral; investigate a comprehension or conversion regression immediately. Expand a format only after several applicable pages support the decision. Preserve failures and counterexamples in the experiment ledger.

## Next execution

Use `arwp discoverability --search="opening" --json` or search the library for `decision-threshold`, `section-graph`, `qualifier-stress-test` or `google-ai-property-control`. Copy only applicable stable IDs into a version-pinned adoption plan. The [content skill](https://github.com/dkharlanau/agent-ready-web-profile/blob/main/skills/arwp-ai-search-content/SKILL.md) and [research brief](https://github.com/dkharlanau/agent-ready-web-profile/blob/main/templates/growth/editorial-research-brief.md) carry these decisions into actual site work.
