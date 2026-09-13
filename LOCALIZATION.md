# Localization Quality Standard

Status: practical ARWP guidance for multilingual websites and agent-readable web surfaces.

Localization is not a translated folder. It is a release contract across every surface where language changes meaning, navigation, discovery, metadata, or machine interpretation.

A locale is ready only when its declared scope is complete and verified. A translated menu with English content, a localized article with English controls, or a localized page without matching Search and AI surfaces is a partial locale and should be labeled that way.

This standard is intentionally stack-neutral. A project may implement it with JSON dictionaries, CMS records, Markdown, database rows, generated pages, framework i18n, or another architecture. The contract matters more than the file layout.

## Core rule

Use this order:

`inventory → glossary → interface → content → reconciliation → built UI → Search/AI surfaces → release gate → drift protection`

Do not start by bulk-translating long content. Establish terminology and scope first.

## 1. Define the locale contract before translating

Create one machine-readable locale registry. For each locale record:

- locale code and human label;
- canonical/source locale;
- release status;
- required surfaces;
- explicit fallback policy;
- localized URL/root when one exists;
- machine-readable discovery surfaces when they exist;
- review state and, where practical, the source revision used for the localization.

Recommended lifecycle:

`missing → draft → localized → reviewed → ui-verified → published`

Do not collapse these states into one `translated: true` flag.

A useful locale can also expose surface-level completeness, for example:

```json
{
  "locale": "fr",
  "status": "reviewed",
  "surfaces": {
    "ui": "complete",
    "content": "complete",
    "contentLibraries": "complete",
    "seo": "complete",
    "ai": "complete",
    "accessibility": "complete",
    "docs": "partial"
  }
}
```

If a surface is intentionally outside the release, mark it `not-applicable` or `out-of-scope`. Do not silently omit it and still call the locale complete.

## 2. Inventory every localization surface

Before writing translated copy, build a surface ledger. Typical website surfaces include:

1. **Interface shell** — navigation, buttons, tabs, breadcrumbs, filters, search controls, pagination, forms and calls to action.
2. **Runtime states** — validation, errors, success messages, loading states, empty states, offline states, confirmation dialogs and notifications.
3. **Reusable components** — cards, badges, tooltips, modals, tables, charts, captions and component-level labels that may not live in page dictionaries.
4. **Primary content** — articles, docs, landing pages, descriptions, examples, FAQs and explanatory text.
5. **Content libraries** — skills, techniques, catalogs, taxonomies, glossaries, datasets, templates, generated entity pages and other enumerable collections.
6. **Discovery and navigation data** — labels used by search, filters, categories, related-content systems and internal recommendation blocks.
7. **SEO/Search surfaces** — title, meta description, canonical URL, reciprocal `hreflang`, `x-default`, robots state, sitemap membership and Search-facing structured data.
8. **Structured semantics** — JSON-LD language fields, stable identifiers, localized names, aliases and canonical entity links.
9. **Accessibility text** — `alt`, `aria-label`, `aria-description`, accessible names, skip links, field instructions and validation announcements.
10. **AI and agent surfaces** — `llms.txt`, locale manifests, machine-readable datasets, Agent Skills, API descriptions, feed labels and other language-dependent routing surfaces.
11. **App/platform metadata** — manifests, install names, shortcuts, PWA labels, social cards and share text where applicable.
12. **Static media containing text** — screenshots, diagrams, illustrations, PDFs and videos whose embedded language is part of the user task.
13. **Documentation and policy** — help, onboarding, contribution guidance, legal/commercial pages when they are inside the locale promise.

The ledger should connect each surface to its canonical source and its deterministic inventory where one exists. If the canonical source has 84 skills, the locale contract should know that 84 localized skills are required instead of relying on a reviewer to remember them.

## 3. Build the glossary first

A glossary is a versioned product artifact, not a translator note.

Create it before long-form localization. Use stable concept IDs so terminology can survive wording changes. Each important entry should support:

- canonical term;
- preferred localized term;
- allowed aliases;
- terms to avoid;
- meaning/context;
- capitalization or grammatical notes where relevant;
- whether the canonical term should remain visible as an alias for recognition;
- example usage;
- review state.

Example:

```json
{
  "conceptId": "decision-skill",
  "source": "Decision Skill",
  "preferred": "Compétence de décision",
  "aliases": ["Decision Skill"],
  "avoid": ["Hack"],
  "note": "Use the French term in UI; keep the English term only where recognition helps.",
  "status": "reviewed"
}
```

The glossary should cover domain terminology, recurring interface nouns and verbs, product concepts, evidence/status words, and any term where a literal translation would sound unnatural or change meaning.

Do not use glossary enforcement to make prose robotic. It should protect meaning and product vocabulary while still allowing natural grammar.

## 4. Localize for the user task, not sentence parity

The target text should read as if the experience was designed in that language.

Preserve meaning, evidence boundaries and user action. Do not preserve English word order merely because it is easier to compare.

A content-localization prompt should receive:

- canonical source text;
- locale and audience;
- project voice/style rules;
- reviewed glossary;
- schema/field contract;
- stable IDs, URLs, citations and code that must not change;
- explicit rules for examples and cultural adaptation;
- required output format.

Important rules:

- preserve canonical identifiers unless the architecture explicitly defines separate localized slugs;
- never translate code, field names, DOI values, citation locators or external URLs by accident;
- keep evidence strength, uncertainty and limitations intact;
- preserve placeholders, variables and ICU/plural/select syntax exactly;
- adapt examples only when the new example is genuinely equivalent and remains factually safe;
- localize search intent and natural query language instead of mechanically translating keywords;
- follow the project's reading level and voice rather than applying one global ARWP writing style.

Machine-generated text is `draft` until the project has completed the review level required by its locale contract.

## 5. Separate translation review from evidence review

A translator or language model can improve language without proving the underlying claim.

Keep these questions separate:

- **Language review:** Is this natural, correct and consistent in the target locale?
- **Semantic review:** Does it mean the same important thing as the canonical source?
- **Evidence review:** Are the claims and citations still supported?
- **Product review:** Does the localized page still help the user complete the task?

Do not upgrade evidence status merely because localized wording sounds more confident.

## 6. Run an independent reconciliation pass

Do not treat the generation step as its own QA.

After localization, compare canonical and localized records using a separate reconciliation prompt or reviewer. Check:

- omitted claims, steps, warnings or examples;
- invented facts or stronger claims;
- glossary violations;
- untranslated source-language fragments;
- changed identifiers, links, citations or placeholders;
- missing fields or collection members;
- inconsistent units, dates, number formats, punctuation or capitalization;
- accidental changes to evidence status;
- duplicated or conflicting localized slugs.

For structured libraries, reconcile by stable ID, not by list position.

## 7. Verify the built interface, not only source files

A source dictionary can be complete while the website is still partly untranslated.

Inspect the built/rendered locale on desktop and narrow mobile widths. Include:

- global navigation and footer;
- home/landing pages;
- representative detail pages;
- every reusable card/template family;
- search and filters;
- forms and validation;
- empty, loading and error states;
- dialogs, tooltips and notifications;
- tables/charts and legends;
- language switch;
- long-string wrapping, truncation and overflow;
- keyboard/focus behavior when layout changes;
- accessible labels and skip links.

Use a pseudo-locale when practical. It is useful for exposing hard-coded strings, fragile layouts and components that never entered the localization system.

Visual checks are evidence about rendering, not a replacement for exact source/data coverage.

## 8. Verify Search and machine-readable parity

For each published human locale, review the surfaces that search engines and AI systems consume.

At minimum, where applicable:

- self-canonical URL;
- reciprocal `hreflang` between real equivalents;
- correct `x-default` policy;
- sitemap entries;
- localized title and description;
- `html lang`;
- structured data `inLanguage` or equivalent language semantics;
- stable canonical entity identifiers;
- localized aliases/names without cloning entity identity;
- locale-aware internal links and language switch;
- localized `llms.txt` or routing surface when the project publishes one;
- locale manifest/dataset coverage counts;
- Agent Skills or other machine-readable libraries when those are part of the product.

Do not publish `hreflang` to placeholder or thin locale pages just to fill a matrix. Only connect genuine equivalents.

A green localization check does not prove Search ranking, indexing, AI citation or recommendation outcomes.

## 9. Make localization completeness deterministic

Anything enumerable should be checked by machine.

Recommended blocking checks:

- exact UI dictionary key parity;
- exact content-library ID/slug coverage;
- no duplicate localized identifiers;
- required fields present;
- placeholders/variables preserved;
- source and target schema parity;
- reciprocal `hreflang` for published equivalents;
- sitemap/locale registry agreement;
- localized structured-data language metadata;
- AI/agent surface coverage where declared required;
- no `TODO`, `TBD` or known placeholder markers;
- no silent source-language fallback for a surface declared `complete`.

Useful advisory checks:

- high-confidence source-language remnant patterns;
- glossary preferred/avoid terms;
- suspiciously identical long source/target text;
- text expansion risk;
- very short localized summaries;
- locale-specific punctuation/format anomalies.

Heuristics should not reject valid names, citations or code merely because they look like the source language.

## 10. Detect stale localization after source changes

Coverage alone is not enough. A translation can exist and still be stale.

For localized records, store one of:

- source content hash;
- source revision/commit;
- canonical release version;
- another deterministic revision marker.

When the canonical source changes, CI should mark dependent localizations stale until they are reconciled. Do not silently keep `reviewed` or `complete` status after a material source edit.

For small interfaces, source-key changes may be enough. For long-form content, record-level hashes or source revision metadata are safer.

## 11. Add a localization impact gate to CI

The most important long-term rule is not “run translations sometimes.” It is:

> A change that adds or materially changes a localizable surface must either update affected locales or record an explicit, time-bounded localization exception.

Treat these changes as localization-impacting by default:

- a new or changed user-visible string;
- a new reusable component with visible copy;
- a new page or route;
- a new content item or content-library member;
- a new Decision Skill, technique, taxonomy item or dataset label;
- changed title/description/structured-data text;
- a new AI/agent-readable language surface;
- a new image/diagram with embedded text;
- changes to canonical content that make localized records stale.

CI should map changed paths to affected localization surfaces. The project can keep a small exception file, but each exception should contain a reason, owner/scope and expiry or review date. Permanent silent exceptions become missing localization by another name.

A robust pull-request gate therefore asks:

1. Did this PR change a localization-impacting source?
2. Which surface inventories changed?
3. Which active locales require parity for those surfaces?
4. Are localized records updated and still schema-valid?
5. Are previously reviewed records now stale?
6. Is an explicit exception present where parity is intentionally deferred?

## 12. Recommended release gate

A locale should not move to `published` or `complete` until all required checks pass:

1. Locale registry and scope are explicit.
2. Glossary is reviewed for important terms.
3. Interface key coverage is exact.
4. Required content and library coverage is exact.
5. Independent semantic reconciliation is complete.
6. Built UI is verified on representative desktop/mobile states.
7. Accessibility-visible language is checked.
8. Search metadata, canonical and reciprocal language links are checked.
9. Machine-readable/AI surfaces match the declared locale scope.
10. Source revision/staleness metadata is current.
11. CI has no undeclared localization-impact debt.
12. Production smoke checks confirm the deployed locale, if deployment evidence is available.

Keep repository/build/deployed evidence separate. A passing source check is not proof that production serves the same artifact.

## 13. What to do when a project adds something new

Localization is a maintenance system, not a launch project.

When adding a new component, content family, library, skill, taxonomy or machine-readable surface:

1. register it in the localization surface ledger if it contains localizable meaning;
2. add a deterministic canonical inventory where possible;
3. define how each active locale represents it;
4. extend the localization checker before or with the feature;
5. update glossary terms if the feature introduces new product/domain vocabulary;
6. localize or record an explicit exception;
7. test the built interface and machine-readable outputs;
8. only then call the feature complete for multilingual releases.

This prevents the common failure where the first localized release is strong but every later feature slowly returns the site to a mixed-language state.

## 14. Prompt sequence for agent-assisted localization

Use four different jobs rather than one mega-prompt:

1. **Glossary Builder** — extracts terminology, proposes natural target terms and marks uncertain choices for review.
2. **Content Localizer** — produces target-language content using the reviewed glossary and the source schema.
3. **Localization Reconciler** — compares source and localized output independently and reports semantic, terminology and structural drift.
4. **UI Localization Auditor** — inventories rendered routes/components/states and finds missed visible or accessibility text.

Reusable prompt contracts are included with the `arwp-localization-quality` Agent Skill.

## 15. Lessons from a knowledge-library rollout

A useful reference pattern is a knowledge site where localization expanded from concepts and UI into techniques, a Decision Skills library, reciprocal language links, sitemap entries, structured data, locale manifests and localized `llms.txt` routing.

The important lesson is not the language used. It is that the late-added library required its own exact canonical-versus-localized coverage check. Without that inventory, a site could look translated while an entire product surface remained missing.

The scalable improvement is to make every locale use the same generic surface contract instead of adding a new `check-<language>` script for each language.

## Related ARWP guidance

- `skills/arwp-localization-quality/SKILL.md` — agent workflow and decision rules.
- `skills/arwp-localization-quality/references/prompts.md` — reusable prompt contracts.
- `skills/arwp-localization-quality/references/ci-gates.md` — CI and pull-request guardrails.
- `skills/arwp-localization-quality/references/localization-profile.example.json` — machine-readable surface contract example.
- `skills/arwp-localization-quality/references/glossary.example.json` — structured glossary example.
- `docs/COMMERCIAL-LOCALIZATION.md` — narrower guidance for names, offers, pricing and regional commercial truth.

Localization quality can improve usefulness and discovery, but it does not guarantee ranking, citation, recommendation or traffic.