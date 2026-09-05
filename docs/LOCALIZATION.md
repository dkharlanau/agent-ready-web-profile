# Agent-facing localization

ARWP treats localization as a discovery and routing concern before treating it as a new core profile feature.

The project site is currently English-first for humans, while AI agents may begin retrieval in many languages. The practical goal is therefore to let an agent discover an appropriate language-specific routing surface without duplicating or translating every normative technical document.

## Current publication model

The ARWP project publishes:

| Language | Role | Surface |
| --- | --- | --- |
| `en` | canonical | `/llms.txt` |
| `de` | localized agent routing | `/de/llms.txt` |
| `ru` | localized agent routing | `/ru/llms.txt` |

The machine-readable catalog is `/ai/locales.json`.

English remains the normative technical language for ARWP-defined semantics. Localized `llms.txt` files translate descriptions, discovery context and search vocabulary; they do not redefine the profile contract, protocol semantics, field names or commands.

## Why this is not a core ARWP v0.1 field

The v0.1 profile already has a `languages` property and a namespaced `extensions` mechanism. There is not yet independent evidence that ARWP needs a new normative localization object.

For the project itself, localized LLM routing is therefore declared through the namespaced extension:

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

This keeps the experiment inspectable without expanding the core contract prematurely.

## Discovery from HTML

Pages that want to expose these routing surfaces may link them explicitly:

```html
<link rel="describedby" type="text/plain" href="/llms.txt" hreflang="en">
<link rel="describedby" type="text/plain" href="/de/llms.txt" hreflang="de">
<link rel="describedby" type="text/plain" href="/ru/llms.txt" hreflang="ru">
```

The ARWP Pages deployment uses project-relative paths because it is hosted below `/agent-ready-web-profile/`.

`hreflang` here identifies the language of the linked routing representation. The localization manifest remains the explicit project-level source for the supported agent-routing set.

## Selection rule for agents

A client that understands the locale manifest should use this order:

1. If the caller explicitly selected a published locale URL, use it.
2. Otherwise, if the caller has a language preference and that language is listed in `agentRoutingLanguages`, use the matching `llms.txt` surface.
3. Otherwise, use the canonical English `/llms.txt`.
4. When a localized description conflicts with canonical English ARWP technical documentation, use the canonical English documentation for ARWP-defined semantics.

This is deliberately deterministic. An agent does not need to guess whether German or Russian text is a separate specification.

## HTTP language negotiation

The current GitHub Pages deployment does **not** perform `Accept-Language` content negotiation. Each language has an explicit URL. This avoids cache ambiguity and keeps links stable for agents, browsers and citations.

If ARWP is later served by a dynamic origin that negotiates language, the origin should follow normal HTTP semantics: treat `Accept-Language` as a preference rather than authority, send the selected representation's `Content-Language`, and use appropriate cache variation. Explicit locale URLs should remain stable.

References:

- llms.txt specification: <https://llmstxt.org/>
- HTTP semantics / `Accept-Language`: <https://www.rfc-editor.org/rfc/rfc9110.html>

## What is translated

Localized routing surfaces may translate:

- problem statements and summaries;
- user vocabulary and search terms;
- descriptions of repository sections;
- navigation labels;
- product-history summaries.

They should preserve exactly:

- ARWP JSON property names;
- MCP, A2A, OAuth, OpenAPI and other protocol identifiers;
- package names and command names;
- URLs and stable resource identifiers;
- version numbers;
- code samples unless a comment is intentionally localized.

## Adding another language

To add a new agent-facing locale:

1. create `docs/<language>/llms.txt` using a valid BCP 47 language tag for the route declaration;
2. add the locale to `docs/ai/locales.json`;
3. add a language-tagged `describedby` link to the public page;
4. update the self-profile extension and published language list if the new surface is actually deployed;
5. add or update static-site tests;
6. keep English technical documents canonical unless the project explicitly adopts translated normative specifications later.

Do not list a locale merely because automatic translation is possible. Publish it only when the routing surface is reviewed enough to be useful.

## Non-goals

This work does not claim that localized `llms.txt` improves search ranking, model quality or inclusion in any particular AI product. It provides explicit, inspectable multilingual discovery surfaces so clients that care about language do not have to infer them from page text.
