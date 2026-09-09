# Goose Technical Integrity

Status: **v0.1 active** · reviewed **2026-09-09**.

Technical Integrity is a bounded, executable Search/AI preflight for real websites. It exists for the period before Search outcome experiments mature: Goose can already catch source-backed technical blockers and risky implementation patterns without pretending those checks prove rankings, citations or traffic.

Run:

```bash
node bin/arwp-technical-integrity.mjs https://example.com/
node bin/arwp-technical-integrity.mjs https://example.com/ --max-pages=20 --json
```

The audit reuses the existing Site Gate cohort selection, then performs a deeper public HTML/robots review over the same bounded priority URLs.

## What it checks now

### P0 — source-backed blockers

- **Google robots fetch state** — distinguishes ordinary robots.txt `4xx` from `429`/`5xx`/network-risk states instead of treating every missing robots file as an unknown crawl block.
- **Search indexability** — successful priority responses and unintended `noindex`.
- **Google AI snippet eligibility** — `nosnippet` / `max-snippet:0` on pages intended to remain eligible as supporting links in AI Overviews / AI Mode.
- **Canonical final-URL consistency** — invalid, duplicated, out-of-head, missing or canonical-away declarations are separated into blocker vs review states.
- **Canonical collisions** — multiple sampled priority URLs collapsing to the same canonical are surfaced for explicit consolidation review.

### P1 — high-value technical review

- crawlable internal `<a href>` markup versus href-less / JavaScript pseudo-links;
- thin raw HTML + script-heavy shell risk for critical textual content;
- hreflang self-reference and reciprocity inside the sampled localization cluster;
- Bing `NOSNIPPET`, `DATA-NOSNIPPET`, `NOARCHIVE`, `NOCACHE` controls that can reduce caption / grounding / citation depth;
- near-duplicate priority pages using bounded five-word-shingle similarity plus repeated-title clusters;
- OAI-SearchBot policy kept separate from GPTBot training policy.

## Why these are not a score

A `FAIL` means Goose observed a bounded technical state that directly conflicts with the cited provider requirement/guidance. A `WATCH` means the condition deserves review but cannot safely be called broken from public static evidence alone.

The report deliberately has no combined percentage, grade or AI-readiness number.

```text
FAIL  -> fix/understand a concrete technical blocker
WATCH -> review context, intent or rendered/runtime evidence
PASS  -> no issue was observed by this detector in the bounded sample
```

A pass does **not** prove crawling, indexing, ranking, AI citation or referral success.

## Provider semantics preserved

### Google

Google states that normal Search SEO foundations remain relevant to AI Overviews / AI Mode, with no separate AI markup requirement. Supporting pages must be indexed and eligible to appear with a snippet. Preview controls such as `nosnippet`, `data-nosnippet`, `max-snippet` and `noindex` therefore remain technically relevant.

Sources:

- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- https://developers.google.com/search/docs/specialty/international/localized-versions
- https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics

### Bing / Copilot

Bing's current Webmaster Guidelines explicitly connect crawl/indexing accuracy, URL consolidation, content clarity and reliable rendering with Search and grounding eligibility. Bing also documents preview/usage controls whose semantics differ from Google's.

Sources:

- https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a
- https://www.bing.com/webmasters/help/robots-meta-tags-and-attributes-that-bing-supports-5198d240

### OpenAI / ChatGPT Search

OpenAI documents OAI-SearchBot as relevant to Search summaries/snippets and GPTBot as a separate training control. Goose keeps those policies separate instead of treating “AI crawler access” as one switch.

Source:

- https://help.openai.com/en/articles/12627856

## Derived heuristics

Two v0.1 checks are deliberately classified as **derived technical integrity**, not provider requirements:

- canonical collisions across the bounded priority cohort;
- near-duplicate priority-page similarity.

They are designed to catch route factories and accidental identity collapse early. They must never be relabeled as ranking factors, spam verdicts or penalties.

## Safety / scope

- public HTTPS only;
- bounded cohort, maximum 50 pages;
- no authenticated owner data;
- no form submission or side-effectful browser actions;
- no claim that the bounded sample represents the entire site;
- no production mutation;
- negative and ambiguous evidence remains visible.

Canonical rule metadata lives in `registry/technical-integrity-rules.json`; executable detection lives in `lib/technical-integrity.mjs`.
