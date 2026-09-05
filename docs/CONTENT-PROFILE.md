# Adaptive Content Profile

The ARWP Adaptive Content Profile is a non-normative content grammar for websites that want editorial pages to stay distinctive while becoming easier to understand, verify, connect and cite.

It is deliberately **not one article template**. A research note should not read like a tutorial; a changelog should not pretend to be an essay; a reference page rarely needs a dramatic introduction. ARWP standardizes the quality signals behind a page, not the prose shape in front of the reader.

Canonical surfaces:

- `schema/content-profile.schema.json` — site-level policy;
- `schema/content-item.schema.json` — optional machine-readable companion for one editorial item;
- `registry/content-archetypes.json` — format-aware semantic archetypes;
- `ai/content-profile.json` — ARWP's own profile;
- `examples/content-item.research.json` — example item;
- `bin/arwp-content.mjs` — planning, validation and audit CLI.

## Principle: content grammar, not template

A useful page normally makes seven things recoverable, but it may express them in very different ways:

1. **Purpose** — what job the page performs.
2. **Contribution** — what exists here that generic synthesis would lose.
3. **Evidence** — what materially factual claims can be checked against.
4. **Boundaries** — where the answer stops, becomes uncertain or stops applying.
5. **Accountability** — who published or reviewed it.
6. **Time** — when it was published, materially changed or reviewed.
7. **Relations** — how it connects to other canonical pages when a real relationship exists.

Everything else is conditional. There is no mandatory word count, keyword density, FAQ, `Problem → Solution → Conclusion` sequence, `Key takeaways` block, or universal footer.

## Supported archetypes

The initial registry contains 12 formats:

| Archetype | Primary job | Core semantic signals |
| --- | --- | --- |
| `answer` | Resolve one recurring question | answer, scope |
| `guide` | Move a reader through a task or decision | scope, steps |
| `tutorial` | Reproduce a concrete outcome | steps, implementation, result |
| `research` | Publish inspectable findings | method, evidence, result, limitations |
| `comparison` | Support a choice | decision criteria, tradeoffs |
| `case-study` | Show what happened in one bounded case | context, implementation, result, limitations |
| `analysis` | Produce a defensible interpretation | original insight, evidence, limitations |
| `opinion` | Make a clear attributable argument | original insight, author context |
| `reference` | Provide a stable fact surface | definition, scope |
| `concept` | Define and bound a term | definition, scope |
| `changelog` | Record a concrete change | update note, result |
| `news-update` | Explain a dated development | context, evidence, update note |

Block IDs describe **meaning**, not visible headings. A research page can satisfy `limitations` with a short note beside a result. A comparison can express `decision-criteria` as table columns. A news page can put `evidence` directly next to the claim it supports.

The registry also records useful optional blocks and things that should not be forced for each format.

## Anti-template guardrails

The site profile explicitly protects against optimization turning into synthetic editorial sameness:

- no forced word count;
- no keyword-density target;
- no mandatory FAQ;
- no generic conclusion requirement;
- no synthetic statistics;
- no invented first-hand experience;
- no factory of near-duplicate pages for query variants;
- no uniform section order across formats;
- evidence before decoration;
- visible content before machine-only metadata;
- no ranking, Discover or AI-citation promise.

The optional style fingerprint lint is **warning-only**. It can flag repeated formulaic phrases in English, Russian and German, but a phrase never invalidates a page mechanically. Context wins. The point is to surface a synthetic pattern, not replace editorial judgment with another phrase blacklist.

## Evidence discipline

Statistics and charts are useful when they answer a real question. They are harmful when inserted only to make a page look authoritative.

For material factual claims, prefer the most inspectable evidence available: primary documentation, datasets, measurements, experiments, releases, documentation, interviews or clearly labelled first-hand observations. Keep source date and scope visible when they change interpretation.

A useful chart or diagram should carry information that would be slower to understand in prose. Essential facts should remain recoverable in nearby HTML text, captions or tables rather than living only in pixels.

## Content graph

ARWP models content as a graph, not as an unordered `Related posts` list. Current relation types are:

- `broader` / `narrower`;
- `prerequisite`;
- `contrasts-with`;
- `applies-to`;
- `evidence-for`;
- `updates`;
- `implements`;
- `example-of`;
- `next-question`.

Links should be contextual and use meaningful anchor text. The default profile asks for one meaningful relation when a real relation exists, but the auditor explicitly warns against adding links only to satisfy a count.

This allows a page ending to adapt to its job. A research note may end with method/evidence and the next research question. A tutorial may end with implementation references. A comparison may point to the next decision. A changelog may point to what it supersedes. None needs a generic `Conclusion` block merely for consistency.

## Search and generative AI

Google documents query fan-out in its generative Search experiences. That does **not** mean publishers should create a thin page for every possible fan-out or query wording. Google's current AI optimization guidance warns against creating separate content for every possible query variation primarily to manipulate rankings or generative responses, and its spam policies cover scaled low-value or unoriginal content regardless of how it was produced.

ARWP therefore prefers one coherent canonical page that covers tightly related subquestions when that improves the reader's understanding. Split content when the user intent, audience, lifecycle, evidence set, canonical entity, task outcome or ownership genuinely changes — not because a keyword tool generated another phrase.

Primary references:

- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
- https://developers.google.com/search/docs/essentials/spam-policies

## Discover-oriented presentation

When a page is a plausible Discover candidate, the profile can declare a large-image policy. Google's current Discover guidance recommends relevant high-quality images that are at least 1200 px wide, exceed 300,000 total pixels, work well in a 16:9 presentation, and are eligible for large previews through `max-image-preview:large` (or AMP). A relevant `og:image` or structured-data image should represent the page rather than serve as generic decoration.

These are presentation recommendations, not a promise that a page will appear in Discover.

Source: https://developers.google.com/search/docs/appearance/google-discover

## Preferred Sources

Google's Preferred Sources publisher integration can be useful near the end of editorial content when the domain is actually selectable in the feature. ARWP models this separately as `active`, `planned`, `disabled` or `not-applicable` so a site does not imply eligibility before verifying it.

The control is an audience-retention/discovery mechanism, not a substitute for useful content and not a ranking guarantee.

Source: https://developers.google.com/search/docs/appearance/preferred-sources

## Structured data

Use `Article`, `BlogPosting`, `NewsArticle`, `TechArticle`, `Dataset`, `DefinedTerm` or another schema type only when it accurately describes the visible page. Machine metadata should mirror visible content rather than create a richer hidden version that readers cannot inspect.

Useful properties often include a canonical URL, headline, real author identity and author URL, `datePublished`, honest `dateModified`, representative images and publisher/entity identity.

## Content Item companion

A site may optionally expose one `Content Item` record per important editorial page. Example:

```json
{
  "itemVersion": "0.1",
  "canonicalUrl": "https://example.com/research/result",
  "archetype": "research",
  "purpose": "Test whether the proposed resolver improves interface selection.",
  "blocks": ["method", "evidence", "result", "limitations"],
  "evidence": [],
  "relations": [],
  "authorship": {
    "authors": [{"name": "Maintainer"}],
    "datePublished": "2026-09-05"
  }
}
```

The companion describes what semantic work the article performs. It does not tell the renderer to print those block names as headings.

## CLI

From this repository:

```bash
node bin/arwp-content.mjs plan research
node bin/arwp-content.mjs plan comparison

node bin/arwp-content.mjs init-profile https://example.com/ \
  --name="Example" --languages=en,de,ru

node bin/arwp-content.mjs init-item https://example.com/research/test \
  --format=research \
  --title="What the benchmark actually measured" \
  --author="Example Research Team"

node bin/arwp-content.mjs validate-item content-item.json
node bin/arwp-content.mjs audit content-item.json \
  --profile=ai/content-profile.json
```

The audit keeps hard schema errors, contextual warnings, optional improvements and style-fingerprint warnings separate. It intentionally does not produce a single content-readiness score: a high score is too easy to game and obscures which missing signal actually matters.

## Publication review

A compact editorial review is more useful than a long universal SEO checklist:

```text
Purpose       Is the page's job clear?
Contribution  What would generic synthesis lose?
Evidence      Are material factual claims supportable?
Boundaries    Are uncertainty and applicability honest?
Composition   Does this format deserve this structure?
Graph         Are real relationships to other pages visible?
Identity      Can a reader tell who published/reviewed it and when?
Visuals       Do they carry information rather than decoration?
Machine layer Does metadata mirror the visible page?
Style         Did automation leave a repetitive synthetic fingerprint?
```

A page does not need every possible block. It needs enough of the **right** signals for its purpose.