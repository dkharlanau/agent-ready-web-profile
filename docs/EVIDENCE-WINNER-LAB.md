# External Evidence + Winner Observatory

Edition 1.0.0 · reviewed 9 September 2026.

Goose should not treat platform documentation, industry studies, expert experiments and pages that currently win in Search as the same kind of evidence.

This lab adds a second research path beside primary-source monitoring:

```text
OFFICIAL PLATFORM GUIDANCE ───────────────┐
INDEPENDENT LARGE-SAMPLE RESEARCH ───────┤
TRANSPARENT EXPERT EXPERIMENTS ──────────┤
ACADEMIC / STANDARDS EVIDENCE ───────────┤
WINNER OBSERVATORY ──────────────────────┤
                                         ↓
                               EVIDENCE TRIAGE
                                         ↓
                                TESTABLE CLAIM
                                         ↓
                              GROWTH HYPOTHESIS
                                         ↓
                          SITE / COHORT EXPERIMENT
                                         ↓
                           KEEP / REVISE / RETIRE
```

The purpose is not to collect more SEO advice. The purpose is to continuously separate:

- provider requirements from provider recommendations;
- measured correlations from causal claims;
- observations from reusable patterns;
- durable mechanisms from short-lived SERP behaviour;
- a page that currently wins from a tactic that caused it to win.

The initial reviewed source set is recorded in `knowledge/research/2026-09-09-external-evidence-winner-loop.json`.

## Evidence classes are about jobs, not prestige

There is no universal source ranking. Use the source that can actually support the claim being made.

| Evidence class | Strongest use | What it does not prove by itself |
| --- | --- | --- |
| Official platform documentation | Eligibility, crawler controls, reporting semantics, supported features and explicit platform guidance | Hidden ranking weights or causal impact |
| Standards / peer-reviewed research | Mechanisms, measurement design, interoperability and reproducible methods | Current provider behaviour unless tested there |
| Independent large-sample study | Prevalence, associations, drift, CTR/citation patterns across a defined sample | Causality or transfer to every site/vertical |
| Transparent individual experiment | Behaviour of a narrowly defined feature under recorded conditions | Generality beyond the experiment |
| Winner observation | What newly successful pages currently have in common | That any observed feature caused the success |
| Opinion / commentary | Candidate hypotheses and useful questions | A recommendation |

A source can be authoritative and still answer the wrong question. Google documentation is the strongest evidence for what Google says is required for Google Search; it is not a public specification of Google's ranking weights. A large correlation study can identify a pattern worth testing; it cannot turn the pattern into a ranking factor.

## Evaluate evidence on separate axes

Do not compress evidence quality into one magic score. Record at least:

1. **Authority** — first party, standards body, research team, vendor study, individual analyst or commentary.
2. **Method transparency** — can another reviewer understand the sample, query set, dates, comparison and limitations?
3. **Sample strength** — single page, case series, thousands of prompts, millions of URLs, etc.
4. **Recency** — was the behaviour measured in the current product generation?
5. **Causal strength** — observation, correlation, quasi-experiment or controlled intervention.
6. **Transferability** — one engine/locale/vertical or repeated across different contexts.
7. **Replicability** — can Goose or a site owner repeat the observation?

Confidence belongs to a **claim in context**, not permanently to a person or domain.

## Current evidence reset: September 2026

Several current sources materially change how Goose should reason about AI-search advice.

### 1. Treat generative Search as Search unless evidence says otherwise

Google's 2026 generative-AI guidance says existing SEO foundations still apply and explicitly rejects several cargo-cult requirements: Google does not require `llms.txt`, special AI markup, artificial content chunking or an AI-specific writing style for visibility in Google Search generative features.

Source: <https://developers.google.com/search/docs/fundamentals/ai-optimization-guide>

**Goose response:** keep provider-specific AI controls, but never promote generic “GEO markup” into a Google requirement without direct current support.

### 2. Separate discovery eligibility from training policy

OpenAI documents `OAI-SearchBot` as the crawler relevant to inclusion of page content in ChatGPT search summaries/snippets. Training controls are separate. Perplexity similarly documents `PerplexityBot` as a search/indexing crawler rather than a foundation-model training crawler.

Sources:

- <https://help.openai.com/en/articles/12627856-publishers-and-developers-faq>
- <https://docs.perplexity.ai/docs/resources/perplexity-crawlers>

**Goose response:** continue to model search/retrieval access independently from training preferences; never collapse crawler policy into one “allow AI” switch.

### 3. Measure citations as their own outcome

Bing Webmaster Tools introduced AI Performance reporting in February 2026, including citation activity and cited URLs across Microsoft AI experiences.

Source: <https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview>

**Goose response:** rankings, citations, brand mentions, referral clicks and conversions stay separate metrics. A citation is not a click and a click is not a recommendation outcome.

### 4. Expect AI citations to drift

SISTRIX analysed 82,619 prompts over 17 weeks and reported substantial weekly source replacement across AI systems. Semrush separately tracked more than 100 million citations over 13 weekly snapshots and observed large source-share changes.

Sources:

- <https://www.sistrix.com/blog/ai-citation-drift-how-stable-are-sources-in-ai-search-results/>
- <https://www.semrush.com/blog/most-cited-domains-ai/>

**Goose response:** a one-time citation screenshot is weak evidence. Repeat the same prompt/query cohort over time and report persistence/drift.

### 5. Traditional organic strength and AI visibility overlap, but not perfectly

Semrush's 2025 AI Mode comparison found strong domain-level association between Google top-10 visibility and AI citations, while URL overlap was much lower. Its January 2026 technical study analysed 5 million cited URLs and explicitly frames the findings as correlations, not causation.

Sources:

- <https://www.semrush.com/blog/ai-mode-comparison-study/>
- <https://www.semrush.com/blog/technical-seo-impact-on-ai-search-study/>

**Goose response:** do not build a separate AI-only content universe. Measure classic Search and AI visibility together, while allowing page-level citation behaviour to differ.

### 6. Content-shape studies are hypothesis generators, not templates

A Semrush study comparing hundreds of thousands of cited and ranking URLs found associations with clarity/summarization, E-E-A-T signals, Q&A format, section structure and structured elements. This is useful evidence, but it is observational and cannot justify mechanically rewriting every page into the same format.

Source: <https://www.semrush.com/blog/content-optimization-ai-search-study/>

**Goose response:** convert such findings into page-type-specific experiments. Preserve counterexamples and reject universal format rules.

### 7. CTR is becoming query- and citation-dependent

Ahrefs and Seer have independently measured major CTR changes around AI Overviews. Their methods, samples and estimates differ; Seer's 2026 update also shows that behaviour changed again in early 2026 rather than continuing a simple downward trend.

Sources:

- <https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/>
- <https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-2026-update>

**Goose response:** never freeze a historical CTR penalty into a permanent rule. Track the actual target query cohort and separate AIO-present, AIO-absent, cited and uncited observations where data allows.

### 8. Citations and brand mentions are different outcomes

Semrush and Kevin Indig's 2026 cross-engine study found many source citations without an explicit brand mention and substantial differences by engine and query type.

Source: <https://www.semrush.com/blog/the-ghost-citations-study/>

**Goose response:** add `citation_presence`, `brand_mention_presence`, `context/sentiment` and referral outcome as distinct observations instead of one AI-visibility number.

## Expert-source policy

Goose may follow individual analysts when they publish inspectable experiments or datasets. It should not maintain a celebrity whitelist.

Initial useful examples include:

- **Brodie Clark** — current, reproducible Google SERP/Search Console experiments; e.g. AI Mode and AI Overview tracking tests: <https://brodieclark.com/ai-mode-google-search-console/>.
- **Kevin Indig / Growth Memo** — large-scale Search/AI analyses with explicit query sets and changing results; e.g. a 2026 listicle analysis over millions of results: <https://www.growth-memo.com/p/what-makes-a-good-listicle>.

The rule is method-first: if the evidence becomes opaque, stale or purely advisory, downgrade it to hypothesis input regardless of reputation.

## Winner Observatory

The Winner Observatory answers a narrower question:

> Which pages newly gained durable organic/Search or AI-citation visibility for a defined query/prompt cohort, and what changed or differs from comparable pages?

It does **not** try to infer a site's entire marketing mix.

### Define a winner before looking for patterns

A project convention can classify a URL as a candidate winner when one of these is observed:

- a new URL enters a defined Google/Bing top-10 cohort and persists in at least two dated snapshots;
- a previously weak URL gains a material rank band and persists;
- a URL becomes a cited source for the same prompt/topic cohort in repeated dated runs;
- a new page receives owner-observed search/citation exposure after publication and comparable pages do not.

These thresholds are research conventions, not provider ranking rules.

### Never claim “no advertising” from public SERP observation

For the user's desired organic-only case studies, record paid acquisition as one of:

- `unknown` — default;
- `none_observed` — no paid placement/referral evidence was observed in the defined check;
- `confirmed_present` — a documented paid channel is present.

`none_observed` does not mean the company spent zero on advertising. Goose should analyse **organic page emergence**, not make unverifiable business-wide claims.

### Snapshot the cohort, not one screenshot

For each cohort preserve:

- engine/surface, locale, device and date;
- exact query or prompt family;
- top results/citations and positions when observable;
- newly entered, dropped and persistent URLs;
- page publication/update dates when reliably exposed;
- title/H1/intent alignment;
- page type and content job;
- unique first-party evidence/data/tool/example;
- cited external/primary sources;
- authorship/accountability;
- internal-link/entity relationships;
- crawl/index/canonical state;
- structured data that matches visible content;
- media and page-experience characteristics when relevant;
- known backlinks/referring domains only when a reliable dataset is available;
- paid-acquisition observation state;
- important changes between snapshots.

Use `templates/growth/winner-observation.md` for a manual record until a dedicated registry/schema is justified by repeated use.

### Compare winners with controls

Do not ask only “what does the winner have?” Compare it with:

1. stable incumbent pages in the same cohort;
2. pages that rank but are not cited;
3. cited pages that rank weakly in classic Search;
4. a relevant page from the target site;
5. where possible, the same URL before/after its meaningful change.

A feature that appears everywhere is not a differentiator. A feature unique to one winner is not automatically causal.

### Extract candidate patterns

Good winner-derived hypotheses look like:

> New comparison pages that expose original test data and a conditional recommendation persist more often in this query cohort than generic summaries. Test that page job on three applicable target pages.

Bad conclusions look like:

> Top pages have 2,137 words, therefore write 2,137 words.

For every candidate pattern record:

- observation;
- plausible mechanism;
- competing explanation;
- falsifier;
- applicable page types/verticals;
- source cohort;
- next test.

## Promotion and retirement rules

External evidence can influence recommendations only through an explicit lifecycle.

```text
OBSERVED
   ↓
CANDIDATE CLAIM
   ↓
HYPOTHESIS
   ↓
REPLICATED / SITE-TESTED
   ↓
ADOPTED PATTERN
   ↓
WATCHED
   ↓
REVISED / RETIRED
```

Recommended defaults:

- one correlational vendor study → hypothesis input, not a universal rule;
- one expert experiment → feature-behaviour evidence for that setup, not a universal rule;
- repeated independent studies with compatible findings → stronger hypothesis/prioritization evidence;
- official provider contradiction → immediately re-review any provider-specific rule;
- current target-site negative experiment → preserve it and lower local priority even if external studies are positive;
- high citation drift or product/UI change → shorten the review window;
- stale advice with no current support → retire or mark review-due rather than silently preserving it.

## Review cadence

Use volatility, not prestige, to decide review frequency. Suggested project defaults:

- fast-moving AI/Search product behaviour: review within 30–60 days;
- current platform documentation: watch continuously and formally review after material change;
- large industry studies: review new releases/replications within 90 days;
- expert experiments: treat as dated snapshots and re-check before reuse after 60–90 days;
- stable standards/academic methods: longer review windows are acceptable unless an implementation dependency changes.

These are Goose maintenance defaults, not external requirements.

## Measurement model

Do not collapse the new evidence into a single “AI SEO score.” Useful longitudinal metrics include:

- organic top-10 entry and persistence;
- rank-band movement;
- AI citation presence and persistence;
- source/citation drift;
- explicit brand mention presence;
- mention context/sentiment where manually reviewed;
- citation → referral click when measurable;
- referral → useful product action/conversion;
- time from publication/update to first observed index/rank/citation;
- query/page cohort delta against unchanged controls.

## Integration with the ARWP Growth Loop

The updated loop should read:

```text
PRIMARY SOURCES + EXTERNAL EVIDENCE + WINNER OBSERVATIONS
                         ↓
                     TRIAGE
                         ↓
                CLAIM / HYPOTHESIS
                         ↓
              SITE-SPECIFIC APPLICABILITY
                         ↓
              IMPLEMENT → VERIFY → MEASURE
                         ↓
                REPLICATE / CHALLENGE
                         ↓
             KEEP / REVISE / RETIRE
                         └──────────────↺
```

External research never bypasses site applicability, safe transformation, verification or owner-side outcome measurement.

## Next engineering slice

After several manual Winner Observatory runs prove the fields are useful, promote the template into:

1. `schema/winner-observation.schema.json`;
2. a small append-only winner registry;
3. a `winner diff` command for entrants/drops/persistence;
4. BraidGraph edges from external claim → hypothesis → target intervention → outcome;
5. a drift job that re-opens dependent recommendations when a source, study or winner pattern materially changes.

Do not automate collection before the observation contract is stable enough to avoid storing noisy SERP snapshots as “evidence.”
