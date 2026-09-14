# Search 2026 localization contract

This note separates Search requirements, accessibility/semantic requirements, ARWP recommendations, and optional agent interoperability. It is intentionally stricter about source authority than a generic SEO checklist.

## Surface classes

| Class | Meaning | Examples |
| --- | --- | --- |
| `search-required` | Needed when the selected Search publication contract calls for it. Claims must be backed by current Search platform guidance. | crawlable locale URLs, indexability, canonical policy, selected hreflang representation, truthful sitemap membership |
| `accessibility-semantic-web` | Standards/user-agent semantics that remain useful even when Google does not use them for a specific ranking or language-detection purpose. | `html lang`, language-of-parts, semantic links/buttons, accessible names, focus order |
| `optional-agent-interoperability` | Useful only when an agent/service actually consumes the surface. It is not a Google Search requirement. | `llms.txt`, localized agent routing documents |
| `product-specific-machine-contract` | A machine interface the product intentionally promises and therefore must test. | project JSON manifests, Agent Skills, public APIs |
| `experimental-emerging` | A hypothesis or emerging convention. It must not be sold as a Search requirement. | experimental agent metadata or machine graphs without platform backing |

A surface can be valuable without being a Google ranking mechanism. ARWP must preserve that distinction in docs, tests and reports.

## Source-authority classes

Every strong recommendation should be traceable to one of these labels:

- `standards-requirement` — W3C/WAI, Schema.org or another applicable normative/standards source;
- `google-specific-requirement` — current official Google Search/Search Console documentation;
- `arwp-stronger-recommendation` — a deliberate ARWP quality policy that goes beyond the minimum platform rule;
- `product-specific-contract` — a promise made by the target product, independent of Search;
- `experimental-emerging` — an explicitly non-established mechanism or hypothesis.

Do not rewrite an ARWP recommendation as a Google rule.

## `llms.txt` is not a Google Search requirement

Google clarified in June 2026 that `llms.txt` is not needed for Google Search and does not positively or negatively affect Search visibility or rankings. Keep it when another agent/service uses it or when the product intentionally promises it. Test it as an optional agent-interoperability or product-specific machine contract, not as a Search readiness gate.

A project may intentionally fail its overall release because its promised `llms.txt` contract is broken. That is different from saying Google Search needs the file.

## Hreflang has two different validation layers

1. **Generic locale identifier validity** answers whether a language tag is structurally valid BCP 47.
2. **Google Search hreflang eligibility** applies Google's documented language/script/region rules.

Do not use `Intl.Locale` success as proof of the second layer. For example, `es-419` is valid BCP 47 but must not silently pass the Google-specific ARWP validator because Google's documented optional region value is ISO 3166-1 Alpha-2. `x-default` is a special hreflang value, not a generic locale.

`lib/google-hreflang.mjs` and `scripts/google-hreflang-test.mjs` provide the deterministic layer. Keep tests for valid BCP-47 / Search-ineligible fault cases.

## One equivalence graph, intentional representations

Google supports HTML, HTTP-header and sitemap hreflang implementations as alternatives. Using every representation does not add Search benefit and creates more drift paths.

Model one canonical locale-equivalence graph. Then choose which representations to emit because the project needs them. If more than one is emitted, they must compile from the same graph and parity must be tested. Sitemap discovery is still useful; sitemap hreflang annotations are not mandatory merely because HTML hreflang exists.

## Language detection and `html lang`

Google primarily determines page language from visible content. URL tokens, `html lang` and hreflang are not substitutes for a coherent target-language page.

Keep correct `html lang` as an accessibility/browser/standards contract. WAI guidance uses it to make the page language programmatically determinable for assistive technology. Do not describe it as Google's primary language detector.

## Search feature freshness

Search features change. ARWP must not freeze old rich-result or reporting assumptions forever.

`registry/search-guidance-2026.json` records volatile rules with primary sources, verification dates and review dates. `scripts/search-guidance-freshness-test.mjs` protects high-risk assumptions, including:

- `llms.txt` not being a Google Search requirement;
- FAQ rich results being removed from Google Search from 2026-05-07;
- hreflang representation equivalence;
- Search Console Generative AI reporting and inclusion control becoming owner-visible in 2026.

When a platform changes, update the registry and affected code together. Do not weaken the test just to regain green CI.

## Google generative-AI visibility

Do not invent a separate Google AEO/GEO technical stack. Current Google guidance keeps generative-AI eligibility grounded in normal Search fundamentals: useful original content, crawlability, indexability, clear technical structure and page experience.

Search Console owner data is the preferred evidence for Google generative-AI visibility. If owner access is unavailable, record `owner-data-unavailable` with the exact next step. Do not replace it with a third-party AI-visibility score and call that equivalent evidence.

## Agent-friendly web is broader than text files

Browser agents interact with the rendered page, DOM and accessibility semantics. Agent usability therefore includes:

- semantic anchors and buttons rather than click handlers on generic elements;
- usable labels and accessible names;
- logical keyboard focus order;
- deterministic navigation and language switching;
- predictable overlays/modals;
- stable layout and non-hidden critical controls;
- coherent mobile behavior.

`llms.txt` can help a compatible agent discover a text routing surface. It cannot prove the interactive website is agent-usable.

## Release evidence boundary

A green localization engine can prove declared source/build/rendered checks. It cannot by itself prove native language quality, cultural fit, deployed-byte parity, indexing, ranking, AI visibility, traffic, conversion, Core Web Vitals field performance, or Search Console settings. Those remain separate evidence layers.
