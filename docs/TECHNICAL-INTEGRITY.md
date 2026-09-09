# Goose Technical Integrity

Status: **report v0.2 · rule pack v0.3 active** · reviewed **2026-09-09**.

Technical Integrity is a bounded, executable Search/AI preflight for real websites. It exists for the period before Search outcome experiments mature: Goose can already catch source-backed technical blockers and risky implementation patterns without pretending those checks prove rankings, citations or traffic.

Run:

```bash
arwp technical-integrity https://example.com/
arwp technical-integrity https://example.com/ --max-pages=20 --max-link-targets=24 --json
```

The audit reuses the existing Site Gate cohort selection, performs a deeper public document/robots review over the same bounded priority URLs, and then probes a capped set of important same-origin internal-link targets without downloading their full bodies.

## Dogfood lesson

The first live Goose run caught an important detector-quality problem: a very large public page exceeded Goose's 512 KiB audit fetch cap and was incorrectly classified as an indexability failure, while directly served Markdown resources were incorrectly asked to carry HTML canonical markup.

v0.2 fixed both model errors:

- **bounded audit failure is not Search failure** — an unknown/oversized fetch becomes `WATCH`, not `FAIL`;
- **non-HTML resources are not forced through HTML-only checks** — Markdown/text resources do not create missing-`<link rel="canonical">` warnings merely because they are not HTML;
- oversized priority documents move to a separate **retrieval-footprint** review signal.

Dogfood then exposed a second practical gap: detecting a crawlable `<a href>` is not enough if the destination itself is broken. Rule pack v0.3 therefore adds bounded internal-link target probing without turning Technical Integrity into a whole-site crawler.

This is intentional dogfood: Goose detectors themselves must remain falsifiable and correctable.

## What it checks now

### P0 — source-backed blockers

- **Google robots fetch state** — distinguishes ordinary robots.txt `4xx` from `429`/`5xx`/network-risk states instead of treating every missing robots file as an unknown crawl block.
- **Priority-URL robots access** — evaluates path-specific `Allow` / `Disallow` rules on the actual sampled URLs, not only whether `/` is allowed.
- **Search indexability** — known non-success priority responses and unintended `noindex`; bounded-audit unknowns remain unknown.
- **Google AI snippet eligibility** — `nosnippet` / `max-snippet:0` on pages intended to remain eligible as supporting links in AI Overviews / AI Mode.
- **Canonical final-URL consistency** — invalid, duplicated, out-of-head, missing or canonical-away declarations on HTML pages are separated into blocker vs review states.
- **Canonical collisions** — multiple sampled priority HTML URLs collapsing to the same canonical are surfaced for explicit consolidation review.

Google's robots interpretation uses the most specific matching path rule; when equally specific rules conflict, the less restrictive `Allow` wins. Technical Integrity models that behavior for the sampled priority URLs.

### P1 — high-value technical review

- **bounded retrieval footprint** — a document exceeding the configured audit budget is surfaced as a retrieval/performance review item, never silently converted into a Search failure;
- **soft-404 suspicion** — a successful response whose title/H1/leading text looks like a missing/error page is flagged for rendered/status review;
- **crawlable internal-link markup** — important discovery paths should expose real `<a href>` targets rather than JavaScript/href-less pseudo-links;
- **bounded internal-link target health** — selects up to 24 frequently referenced same-origin targets by default and probes their HTTP destination state;
- thin raw HTML + script-heavy shell risk for critical textual content;
- hreflang self-reference and reciprocity inside the sampled localization cluster;
- Bing `NOSNIPPET`, `DATA-NOSNIPPET`, `NOARCHIVE`, `NOCACHE` controls that can reduce caption / grounding / citation depth;
- near-duplicate priority pages using bounded five-word-shingle similarity plus repeated HTML-title clusters;
- OAI-SearchBot root **and sampled path policy** kept separate from GPTBot training policy.

### Internal-link target semantics

The link-target probe is deliberately bounded and separate from a full crawler.

Selection is deterministic:

1. crawlable same-origin HTTPS targets from the bounded priority cohort;
2. more distinct source pages first;
3. then more occurrences;
4. then shallower path depth;
5. then URL order;
6. cap before network probes — default `24`, configurable `0–50`.

Interpretation:

- `404`, `410`, `5xx` → `FAIL` for that P1 check;
- redirects, `401`, `403`, `429`, other uncertain `4xx`, or network/probe uncertainty → `WATCH`;
- clean `2xx` without observed redirect → `PASS`.

A redirect is not automatically bad. A sampled pass does not prove unsampled links are healthy. Fixing a broken internal target is a technical correctness improvement, not a ranking guarantee.

## Why these are not a score

A `FAIL` means Goose observed a bounded technical state that directly conflicts with the cited provider requirement/guidance or, for explicitly derived integrity rules, a concrete broken technical target. A `WATCH` means the condition deserves review but cannot safely be called broken from the available evidence alone.

The report deliberately has no combined percentage, grade or AI-readiness number.

```text
FAIL  -> fix/understand a concrete technical blocker
WATCH -> review context, intent, redirects, audit limits or rendered/runtime evidence
PASS  -> no issue was observed by that detector in the bounded sample
```

A pass does **not** prove crawling, indexing, ranking, AI citation or referral success.

## Provider semantics preserved

### Google

Google states that normal Search SEO foundations remain relevant to AI Overviews / AI Mode, with no separate AI markup requirement. Supporting pages must be indexed and eligible to appear with a snippet. Preview controls such as `nosnippet`, `data-nosnippet`, `max-snippet` and `noindex` therefore remain technically relevant.

Google's current robots documentation also makes path-level rule precedence explicit, which is why a root-level robots check alone is insufficient. Crawlable-link and crawling-error guidance supplies the upstream basis for checking important links and broken target responses, while Goose's bounded sampling strategy remains its own derived implementation choice.

Sources:

- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors
- https://developers.google.com/search/docs/crawling-indexing/links-crawlable
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

These checks are deliberately classified as **derived technical integrity**, not provider ranking requirements:

- canonical collisions across the bounded priority HTML cohort;
- bounded retrieval footprint;
- bounded internal-link target selection and probe policy;
- near-duplicate priority-page similarity.

Soft-404 suspicion is source-backed, but the Goose detector remains only a bounded heuristic: Google/owner tooling is still needed to determine whether the provider actually classifies a URL as soft 404.

Derived checks are designed to catch route factories, retrieval-cost outliers, broken important destinations and accidental identity collapse early. They must never be relabeled as ranking factors, spam verdicts or penalties.

## Safety / scope

- public HTTPS only;
- bounded priority cohort, maximum 50 pages;
- bounded internal-link target probes, maximum 50 and default 24;
- target probes do not download response bodies;
- no authenticated owner data;
- no form submission or side-effectful browser actions;
- no claim that the bounded sample represents the entire site;
- no production mutation;
- unknown audit states remain unknown;
- negative and ambiguous evidence remains visible.

Canonical rule metadata lives in `registry/technical-integrity-rules.json`; base detection lives in `lib/technical-integrity.mjs`; bounded link-target probing lives in `lib/internal-link-target-health.mjs`.
