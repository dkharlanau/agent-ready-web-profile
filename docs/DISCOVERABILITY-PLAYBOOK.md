# Discoverability as an evidence practice

ARWP helps publishers make useful work easier to find, understand, verify, and use. The goal is relevant discovery followed by a successful reader task. A profile file, a large entity graph, or a passing technical check cannot establish search position or AI recommendation performance.

The [corpus](./knowledge/discoverability-corpus.json) contains **219 distinct patterns in 16 categories**, backed by 118 sources, with implementation steps, observable checks, applicability, effort, anti-patterns, source references, and an outcome metric. Start with a real site problem and choose a small set. The corpus is an operating library, not a demand to apply every pattern to every site.

## Know what the evidence establishes

| Level | What it means | What it does not mean |
| --- | --- | --- |
| `documented` | A primary source directly describes the underlying mechanism or practice. | Proven ranking lift on your site. |
| `inferred` | ARWP proposes an implementation or workflow based on documented principles or observed first-party patterns. | The provider endorses the complete workflow or its impact. |
| `experimental` | A bounded idea needs a client, reader, or external outcome test. | A required search standard or an established ranking signal. |

The 2026-09-08 edition includes **60 documented, 128 inferred, and 17 experimental patterns**. Source notes identify exactly what each reference can support. A technically documented tactic still carries an **impact hypothesis**, not a causal promise. A source's `checked_at` records source review or retrieval; the separate [HTTP reference report](./knowledge/source-link-checks.json) tests reachability and identity only.

Google's current guidance requires ordinary search eligibility for supporting links in its AI features; additional AI files or special schema are unnecessary. Measurement surfaces evolve: use the dated native measurement rules and check the available owner reports before selecting a comparison. These facts do not imply inclusion for a particular site. [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features).

OAI-SearchBot and GPTBot serve different purposes. Choose automatic search access and model-training access separately, and verify the CDN behavior as well as robots rules. [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots).

Bing AI Performance measures citations and cited pages within its supported experiences. Citation counts do not reveal ranking, placement, or universal AI visibility. [Bing AI Performance announcement](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview).

## Keep evidence and versions together

Corpus release **1.7.0** assigns each pattern a stable ID, independent semantic version, lifecycle and review passport. **126 patterns have an agent-assisted source-support and implementation review** with a section locator and a concise support note; **93 explicitly remain individually unreviewed**. An unreviewed date stays null. A source retrieval date never fills it automatically.

Upstream releases are identified where the source publishes a fixed version; living documents retain that distinction. The original 1.1.0 corpus is preserved as an immutable baseline. Exported selections pin the current corpus fingerprint and selected pattern versions. The CLI rejects stale pins before creating a new plan. See [the version contract](./DISCOVERABILITY-VERSIONING.md) for revision rules, review scope and compatibility.

## Fit the native Growth Loop

The [Growth Loop](GROWTH-LOOP.md) remains the operating workflow. Each tactic points to existing hypothesis and recommendation IDs; these are implementation-routing relationships, not new platform rules or proof of impact. Resolve them against the current registries before applying a practice. Use the [site adoption record](SITE-ROLLOUT-PLAYBOOK.md), [Growth experiments](GROWTH-EXPERIMENTS.md) and [change receipts](CHANGE-RECEIPTS.md) for site changes and outcomes. BraidGraph remains the shared provenance system. An exported corpus selection is only a planning aid.

## Run a useful improvement cycle

1. **Record the actual problem.** Name the reader, task, canonical URL, observed failure, and source of the observation. An unavailable metric stays unknown.
2. **Capture a baseline.** Freeze a URL cohort, query or task set, dates, locale, available provider data, and a useful downstream action. Keep local retrieval tests separate from external search results.
3. **Choose a small intervention.** Select applicable tactic IDs and write a falsifiable hypothesis. Prioritize broken access, incomplete answers, unsupported claims, and failed user actions before extra discovery surfaces.
4. **Implement in authoritative sources.** Keep visible text, metadata, graphs, exports, and examples consistent. Assign a maintenance owner.
5. **Verify the work.** Inspect built output and render the actual reader journey. Validate claims and sources, not merely JSON syntax. After authorized publication, fetch the deployed artifacts.
6. **Observe outcomes.** Retain failures and null results. Compare stable segments and any practical holdout. Account for reporting lag, demand changes, and concurrent work.
7. **Keep, revise, or stop.** An inconclusive experiment is a valid result. Record what the evidence supports and what it cannot establish.

Use the [discoverability skill](./skills/arwp-discoverability/SKILL.md), [editorial receipt contract](EDITORIAL-RECEIPTS.md), and [benchmark contract](DISCOVERABILITY-BENCHMARKS.md) for the execution details.

## Write pages around a decision

A strong page has a job beyond attracting a query. Use the shape that suits the reader; avoid mechanically applying one template everywhere.

| Page job | Useful structure | Evidence that makes it original |
| --- | --- | --- |
| Explain a difficult choice | Answer and boundary → decision criteria → worked scenario → alternatives → next action | A concrete scenario, explicit assumptions, and a case where the answer changes. |
| Teach an operation | Intended result → prerequisites → smallest successful path → expected output → failure diagnosis | A verified run with safe inputs and an observable result. |
| Diagnose a failure | Symptom → distinguishing checks → likely causes → bounded remedy → recovery check | Real symptoms and checks that separate plausible causes. |
| Publish research or data | Finding and scope → method → data → uncertainty → reproducible analysis → limitations | Original observations, release IDs, quality checks, and retained null results. |
| Present a service | Concrete deliverable → suitability → sample → real process → terms → next step | Authorized work samples, accurate availability, and an intake path that works. |
| Compare alternatives | Reader decision → relationship disclosure → criteria and method → sourced matrix → fit cases → switching work | Comparable observations, cell-level sources, dates, and candid unknowns. |

Draft the most useful sentence first: what should this reader understand or do, under which conditions? Add the evidence needed to assess it. Cut the introduction if it merely announces that the topic matters. Give technical detail a stable section anchor so a reader can inspect it without losing the primary path.

A useful FAQ addresses unresolved reader questions. Do not build it around a retired search presentation: Google discontinued FAQ rich results starting 2026-05-07. [Google Search documentation updates](https://developers.google.com/search/updates).

## Compare products and services fairly

Choose criteria from the reader's task before reviewing options. For a Chinese-learning service, criteria might include actual lesson format, suitability for the learner's current level, feedback method, schedule compatibility, and total cost under a stated lesson plan. These are a planning example, not factual claims about Bonihua or any competitor.

For software, test the same input, supported versions, machine conditions, and success criteria where possible. Where direct testing is unavailable, use current vendor documentation and label the value **vendor-documented**. Keep **unknown**, **not supported**, **not available**, and **not applicable** distinct.

Every material table cell needs:

- the fact or observed value, with unit and relevant plan/version;
- a source URL and check date;
- whether it is tested, documented by the vendor, inferred, or unknown;
- any qualification that could change the decision.

Show a recommendation by scenario and explain when another option is a better fit. State ownership, sponsorship, or affiliate relationships near the method. Include switching costs and meaningful limits. Do not invent review scores, competitor weaknesses, price histories, customers, or hands-on testing. Google's review guidance supports evidence, relevant measurements, and trade-offs; this exact matrix is ARWP's proposed implementation. [Google: high-quality reviews](https://developers.google.com/search/docs/specialty/ecommerce/write-high-quality-reviews).

See the [working comparison example](./examples/editorial/comparison.html) and its [receipt](./examples/editorial/comparison.receipt.json). It compares publishing approaches using documented behavior and clearly labeled editorial judgments; it does not invent competitor performance data.

## Make an inline claim traceable

Use ordinary readable HTML and real links. A local `data-*` convention can help your own QA associate a paragraph with an evidence record:

```html
<p id="claim-text-access"
   data-claim-id="text-access"
   data-evidence="documented"
   data-evidence-id="claim-text-access"
   data-source-ids="google-ai">
  Keep important content available in textual form.
  <a href="#source-google-ai" aria-label="Source 1: Google Search Central">[1]</a>
</p>
<ol aria-label="Sources">
  <li id="source-google-ai">
    <cite><a href="https://developers.google.com/search/docs/appearance/ai-features">
      AI features and your website
    </a></cite>
    — Google Search Central. Checked <time datetime="2026-09-08">8 September 2026</time>.
    <a href="#claim-text-access" aria-label="Return to the claim">↩</a>
  </li>
</ol>
```

The standard defines `data-*` as private application data; ARWP's attribute names are not a search-engine protocol. The claim and source must remain understandable with scripts disabled. `cite` identifies the referenced work; the anchor supplies the link. [WHATWG HTML](https://html.spec.whatwg.org/multipage/dom.html#embedding-custom-non-visible-data-with-the-data-*-attributes), [MDN cite reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/cite).

Maintain the receipt next to the article. It records the audience, question, direct answer, original contribution, useful action, claims, and precise source support. Machine checks can find broken references and missing fields. A reviewer must still verify that the source supports the statement and that the statement is actually visible.

See the [article example](./examples/editorial/article.html) and [matching receipt](./examples/editorial/article.receipt.json). These examples use `example.com` as a reserved fixture identity and carry `noindex`; replace the identity and review the content before adapting them to a live site.

## Build a small truthful entity graph

Start with the entities the page actually describes. A useful chain is `WebPage → mainEntity → Article → author / publisher / citation`; add a `Dataset` or `Service` when the visible subject warrants it. Use stable IDs and reuse the same ID for the same subject. `sameAs` is for identity equivalence, not similar topics or prestigious references. [JSON-LD 1.1](https://www.w3.org/TR/json-ld11/), [Schema.org sameAs](https://schema.org/sameAs).

The [entity graph fixture](./examples/editorial/entity-graph.jsonld) connects the article's visible title, publisher, main entity, and source relationship. It contains no invented people, reviews, ratings, offices, or awards. A larger graph is justified only by more real, useful relationships.

Validate the vocabulary and graph references, then compare each material property with the rendered page. Structured data must reflect the relevant visible content; valid markup does not guarantee a rich result. [Google structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

## Borrow operational patterns from mature documentation

These observed examples provide concrete editorial ideas. They are evidence of a pattern, not evidence that the pattern caused search success.

| Observed source | Pattern to adapt | Proof required on your site |
| --- | --- | --- |
| [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests) | Executable example beside retry and failure boundaries. | Your operation behaves as documented, including failures. |
| [Stripe upgrades](https://docs.stripe.com/upgrades) | Version-aware change and migration guidance. | The named releases exist and the migration example works. |
| [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/) | Explicit limits with relevant distinctions. | Your stated limits have configuration, documentation, or measured evidence. |
| [MDN ETag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag) | Purpose, syntax, examples, and specification references. | The entry answers the actual reader task and links the correct authority. |
| [GitHub releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) | Prerequisites, alternate execution routes, and release-state distinctions. | The public artifact can actually be obtained and used. |

Maturity comes from working examples, accurate limits, clear ownership, useful documentation, and a functioning correction process. Do not simulate adoption, independent approval, credentials, or outcomes.

## Apply the library across a portfolio

For GitHub documentation sites, begin with useful entry tasks, working examples, released-artifact evidence, canonical discovery paths, and a small entity graph. For a service site, begin with accurate deliverables, fit, availability, process, terms, and a tested inquiry path. Choose site-specific changes only after inspecting the current implementation and evidence.

Keep the portfolio baseline comparable, but retain site-specific outcomes. A dataset download, completed practice exercise, and qualified service inquiry are different actions. Do not combine them into one unexplained score. Cross-link owned projects where doing so advances a reader's task, and retain the shared-ownership context.

An operating report should distinguish **planned → implemented → locally verified → published → live verified → externally observed**. Rankings, recommendations, referrals, and business outcomes belong in the last stage and require their own observations.

## September editorial research edition

Read [Write the page that is worth opening](./EDITORIAL-SEARCH-LAB.md) for the 26 new patterns, provider-specific evidence, article formats, opening and heading examples, voice choices, section graphs and a measurable execution brief. Corpus 1.3.0 preserves the exact 1.2.0 release and its 169 pattern records.

## Functional maturity and distribution

[Evidence Relay](./EVIDENCE-RELAY.md) adds ten patterns in corpus 1.4.0, a reviewed distribution register, DOI reading corpus and coverage-aware local analytics. It preserves all preceding pattern records and keeps self-publication separate from independent adoption.

[Asset workshop](./ASSET-WORKSHOP.md): four delivery patterns, three reusable packs and a question-led gap review.

[Names, locales and offers](./COMMERCIAL-LOCALIZATION.md): ten reviewed practices and commercial/localization review fixtures.

[Catalog review](./CATALOG-REVIEW.md): 23 historical records reviewed, nine source/instruction corrections and explicit remaining review scope.
