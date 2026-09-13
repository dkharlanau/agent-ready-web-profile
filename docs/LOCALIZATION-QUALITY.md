# Localization quality

ARWP treats localization as a product-quality system, not as a folder of translated strings.

The detailed canonical standard is maintained in [`../LOCALIZATION.md`](../LOCALIZATION.md). The executable workflow is published as the [`arwp-localization-quality`](./skills/arwp-localization-quality/SKILL.md) Agent Skill.

Use this order for a full human-facing locale:

`inventory → glossary → interface → content → reconciliation → built UI → Search/AI surfaces → release gate → drift protection`

A locale is ready only for the surfaces it explicitly declares. A project may have a full human-interface locale, a limited documentation locale, or an agent-routing locale. These roles should not be confused.

## Full-site localization contract

Before translating long content, define a locale contract and surface ledger. Typical surfaces are:

- global navigation, buttons, tabs, filters, forms and calls to action;
- loading, validation, error, empty, confirmation and success states;
- reusable cards, badges, dialogs, tooltips, tables, charts and captions;
- articles, docs, landing pages and FAQs;
- structured libraries such as skills, techniques, taxonomies, datasets and generated entity pages;
- search/filter labels and related-content systems;
- titles, descriptions, canonical URLs, reciprocal `hreflang`, `x-default`, sitemap entries and Search-facing structured data;
- `alt`, `aria-label`, skip links and other accessibility text;
- `llms.txt`, locale manifests, localized datasets, Agent Skills and other AI/agent-readable surfaces;
- screenshots, diagrams, PDFs and other media that contain meaningful embedded text.

If the canonical product has 84 skills, a complete localized skill library should be validated as 84 matching stable IDs. Do not depend on a reviewer remembering each record.

## Glossary first

Build a versioned glossary before bulk content localization.

Important entries should have a stable concept ID, canonical term, preferred target-language term, useful aliases, terms to avoid, context, grammar notes and review status.

The goal is not to eliminate all English words. The goal is to preserve meaning while sounding natural to the target audience. Stable technical identifiers, code, schema keys and protocol names usually remain canonical.

## Content localization

A localization prompt should receive the canonical source, target locale, audience, project voice, reviewed glossary, schema contract, protected IDs/URLs/citations/code, example-adaptation rules and the required output format.

Preserve evidence strength and limitations. Do not make a localized claim more certain because a stronger phrase sounds better. Do not change a citation target, DOI, identifier, placeholder or command by accident.

Machine-generated text should remain `draft` until it meets the project's review contract.

## Independent reconciliation

Generation should not be its own QA.

After localization, compare source and target independently by stable ID. Check exact coverage, omitted warnings or steps, invented claims, evidence drift, glossary violations, source-language leakage, placeholders, links, citations, duplicate localized slugs and stale source revisions.

Keep four questions separate:

1. Is the language natural?
2. Does it preserve the canonical meaning?
3. Are evidence and citations still valid?
4. Does the localized product still let the user complete the same task?

## Verify the built interface

Source dictionaries can be complete while the rendered site is mixed-language.

Inspect representative desktop and narrow-mobile routes, reusable component families, forms, search/filter controls, validation, loading/empty/error states, dialogs, tooltips, navigation/footer, language switch and accessibility text.

A pseudo-locale is useful for exposing hard-coded strings and layouts that fail when text expands.

## Search and machine-readable parity

For published human locales, check the final generated artifact where applicable:

- correct `html lang`;
- self-canonical URL;
- reciprocal `hreflang` only between real equivalents;
- correct `x-default` policy;
- localized title and description;
- sitemap membership;
- structured-data language semantics;
- locale-aware internal navigation;
- localized AI/agent routing and datasets when those surfaces are part of the locale promise.

Keep canonical entity identity stable. Localized names and aliases should not create a second entity by accident.

## Source freshness

A translation can exist and still be stale.

Use a source content hash, source revision, canonical release version or another deterministic marker. If canonical content changes materially, previously reviewed localized records should become stale until reconciled.

Coverage and freshness are different checks.

## Localization-impact CI

A change that adds or materially changes a localizable surface should update affected active locales or record an explicit, temporary localization exception.

Typical localization-impacting changes include:

- a new user-visible string or runtime state;
- a new reusable component;
- a new page or route;
- a new skill, technique, taxonomy item, dataset label or other library member;
- changed canonical long-form content;
- changed Search metadata or structured-data text;
- a new AI/agent-readable language surface;
- a new image or diagram containing important text.

CI should map changed source paths to localization surfaces, resolve which active locales require those surfaces, validate exact coverage and source freshness, then fail on missing parity or expired exceptions.

Prefer one generic locale-aware checker over a growing family of `check-<language>` scripts. Existing strong locale-specific checks can be migrated gradually; do not weaken their assertions just to simplify the abstraction.

## Agent-assisted workflow

The reusable ARWP skill separates four jobs:

1. **Glossary Builder** — creates reviewed terminology before bulk localization.
2. **Content Localizer** — writes natural target-language content under the glossary and schema contract.
3. **Localization Reconciler** — independently compares canonical and localized records.
4. **UI Localization Auditor** — checks rendered routes, components, states, accessibility text and final page language signals.

Prompt contracts and CI patterns live in the canonical skill references.

## Agent-facing routing model

ARWP also uses a narrower localization model for machine discovery. This remains useful even when a project does not publish a full human-interface locale.

The ARWP project site is English-first for humans, while AI agents may begin retrieval in many languages. The practical goal is to let an agent discover an appropriate language-specific routing surface without duplicating or translating every normative technical document.

### Current publication model

The ARWP project publishes:

| Language | Role | Surface |
| --- | --- | --- |
| `en` | canonical | `/llms.txt` |
| `de` | localized agent routing | `/de/llms.txt` |
| `ru` | localized agent routing | `/ru/llms.txt` |

The machine-readable catalog is `/ai/locales.json` and distinguishes roles such as `agentRoutingLanguages` from fuller human-interface locale roles.

English remains the normative technical language for ARWP-defined semantics. Localized `llms.txt` files translate descriptions, discovery context and search vocabulary; they do not redefine profile semantics, field names or commands.

### Why this is not a core ARWP v0.1 field

The v0.1 profile already has a `languages` property and a namespaced `extensions` mechanism. There is not yet independent evidence that ARWP needs a new normative localization object.

For the project itself, localized LLM routing is declared through a namespaced extension:

```json
{
  "extensions": {
    "io.github.dkharlanau/localized-llms": {
      "version": "0.1",
      "status": "experimental",
      "defaultLanguage": "en",
      "fallbackLanguage": "en",
      "manifest": "https://dkharlanau.github.io/agent-ready-web-profile/ai/locales.json"
    }
  }
}
```

This keeps the experiment inspectable without expanding the core profile contract prematurely.

### Discovery from HTML

Pages can expose language-specific routing surfaces explicitly:

```html
<link rel="describedby" type="text/plain" href="/llms.txt" hreflang="en">
<link rel="describedby" type="text/plain" href="/de/llms.txt" hreflang="de">
<link rel="describedby" type="text/plain" href="/ru/llms.txt" hreflang="ru">
```

`hreflang` here identifies the language of the linked routing representation. The locale manifest remains the explicit project-level source for the supported routing set.

### Selection rule for agents

A client that understands the locale manifest should use this order:

1. If the caller explicitly selected a published locale URL, use it.
2. Otherwise, if the caller has a language preference and it is listed in `agentRoutingLanguages`, use the matching routing surface.
3. Otherwise, use canonical English `/llms.txt`.
4. When localized routing text conflicts with canonical English ARWP technical documentation, use the canonical English documentation for ARWP-defined semantics.

This is deterministic. An agent should not have to guess whether a localized routing document is a separate specification.

### HTTP language negotiation

The current GitHub Pages deployment does not perform `Accept-Language` content negotiation. Each language has an explicit URL. This avoids cache ambiguity and keeps links stable for agents, browsers and citations.

If a future dynamic origin negotiates language, it should treat `Accept-Language` as a preference rather than authority, expose the selected representation correctly and keep explicit locale URLs stable.

### What localized routing may translate

It may translate:

- problem statements and summaries;
- user vocabulary and search terms;
- descriptions of repository sections;
- navigation labels;
- product-history summaries.

It should normally preserve exactly:

- ARWP JSON property names;
- MCP, A2A, OAuth, OpenAPI and other protocol identifiers;
- package and command names;
- URLs and stable resource identifiers;
- version numbers;
- code samples unless comments are intentionally localized.

### Adding another routing language

To add a new agent-facing locale:

1. create the language-specific `llms.txt` route using the project's BCP 47 convention;
2. add the locale to the locale manifest;
3. add language-tagged discovery where the site exposes it;
4. update the self-profile extension and published language set only when the surface is deployed;
5. add or update static checks;
6. keep English technical documents canonical unless the project explicitly adopts translated normative specifications.

Do not list a locale merely because automatic translation is possible. Publish it only when the routing surface is reviewed enough to be useful.

## Evidence boundary

A green localization gate proves only the checks that actually ran against the declared surfaces. It does not prove indexing, Search ranking, AI citation, recommendation visibility, model quality or traffic.
