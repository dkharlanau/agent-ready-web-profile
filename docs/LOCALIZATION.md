# Localization quality and agent-facing routing

ARWP treats localization as a product-quality system, not as a translated folder.

For a full human-facing locale, use the public guide [`LOCALIZATION-QUALITY.md`](./LOCALIZATION-QUALITY.md), the canonical repository standard [`../LOCALIZATION.md`](../LOCALIZATION.md), and the [`arwp-localization-quality`](./skills/arwp-localization-quality/SKILL.md) Agent Skill.

The core workflow is:

`inventory → glossary → interface → content → reconciliation → built UI → Search/AI surfaces → release gate → drift protection`

The localization contract should explicitly declare each locale's role and required surfaces. A language may be a full `human-interface` locale, a limited documentation locale, or an `agent-routing` locale. Do not call a limited locale complete for surfaces it does not publish.

A full locale should normally cover, where applicable, interface and runtime states, reusable components, primary content, structured content libraries, accessibility text, Search metadata, reciprocal language links, sitemap membership, structured data, and declared AI/agent surfaces.

Build a reviewed glossary before bulk localization. Run an independent reconciliation after generation. Verify the built interface, not only source dictionaries. Track source revision or content hashes so reviewed translations can become stale after canonical changes. Add a localization-impact CI gate so new strings, routes, components, skills, datasets or machine-readable surfaces cannot silently escape localization.

## Agent-facing routing model

ARWP also supports a narrower localization role for machine discovery.

The project site is English-first for humans, while AI agents may begin retrieval in many languages. A limited routing locale can help an agent discover useful target-language descriptions and vocabulary without duplicating or translating every normative technical document.

### Current publication model

| Language | Role | Surface |
| --- | --- | --- |
| `en` | canonical | `/llms.txt` |
| `de` | localized agent routing | `/de/llms.txt` |
| `ru` | localized agent routing | `/ru/llms.txt` |

The machine-readable catalog is `/ai/locales.json`. It can distinguish sets such as `agentRoutingLanguages` from fuller human-interface language sets.

English remains the normative technical language for ARWP-defined semantics. Localized `llms.txt` files may translate descriptions, discovery context and search vocabulary, but they do not redefine profile semantics, JSON property names, commands or protocol identifiers.

### Profile extension

Localized routing is currently declared as an inspectable experiment through a namespaced extension rather than a new ARWP core field:

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

### Discovery from HTML

Pages may expose routing representations explicitly:

```html
<link rel="describedby" type="text/plain" href="/llms.txt" hreflang="en">
<link rel="describedby" type="text/plain" href="/de/llms.txt" hreflang="de">
<link rel="describedby" type="text/plain" href="/ru/llms.txt" hreflang="ru">
```

The locale manifest remains the project-level source for the supported routing set.

### Selection rule for agents

1. If the caller explicitly selected a published locale URL, use it.
2. Otherwise, if the caller has a language preference listed in `agentRoutingLanguages`, use the matching routing surface.
3. Otherwise, use canonical English `/llms.txt`.
4. If localized routing text conflicts with canonical English ARWP technical documentation, use canonical English for ARWP-defined semantics.

This is deliberately deterministic. A client should not need to guess whether a localized routing document is a separate specification.

### HTTP language negotiation

The current GitHub Pages deployment uses explicit locale URLs rather than `Accept-Language` content negotiation. This avoids cache ambiguity and keeps links stable for agents, browsers and citations.

If a future dynamic origin negotiates language, it should treat `Accept-Language` as a preference, return correct language metadata and preserve stable explicit locale URLs.

### What routing localization may translate

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

1. Create the language-specific `llms.txt` route using the project's BCP 47 convention.
2. Add the locale to the locale manifest.
3. Add language-tagged discovery where the site exposes it.
4. Update the self-profile extension and published language set only when the surface is actually deployed.
5. Add or update static checks.
6. Keep English technical documents canonical unless the project explicitly adopts translated normative specifications.

Do not publish a locale merely because automatic translation is possible. Publish it only when the declared surface is reviewed enough to be useful.

## Evidence boundary

Localization implementation evidence and discovery outcomes are different things. A green localization gate does not prove indexing, Search ranking, AI citation, recommendation visibility, model quality or traffic.
