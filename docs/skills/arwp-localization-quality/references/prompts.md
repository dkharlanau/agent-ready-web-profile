# Localization prompt contracts

Use these as contracts, not blind copy-paste templates. The agent should first inspect the real repository, current locale model, schemas, project voice and canonical source.

Do not combine all four jobs into one generation pass. The localizer should not be the only reviewer of its own output.

## Prompt 1 — Glossary Builder

### Goal

Create a reviewed terminology layer before bulk localization so the product sounds native and important concepts remain stable across UI, content, Search and machine-readable surfaces.

### Inputs

Provide:

- target locale and audience;
- canonical product/domain corpus;
- existing target-language terminology, if any;
- product voice and reading level;
- known protected names, stable IDs, trademarks and technical tokens;
- examples of existing localized UI when available.

### Agent instruction

```text
GOAL
Build a target-locale glossary for this product before content localization.

Do not translate terms one by one in isolation. Infer how the product is actually used, which terms recur, which concepts are domain-specific, and which literal translations would sound unnatural or change meaning.

FOR EACH IMPORTANT TERM
Return:
- conceptId: stable language-neutral identifier;
- source: canonical term;
- preferred: best natural target-language term;
- aliases: useful accepted alternatives, including the canonical term only when recognition helps;
- avoid: misleading, awkward or over-literal alternatives;
- context: what the concept means in this product;
- grammarNotes: capitalization, gender, plural or inflection guidance when relevant;
- example: one natural target-language use;
- status: reviewed-candidate | needs-review;
- rationale: short explanation for non-obvious choices.

PRIORITIES
1. Preserve meaning.
2. Sound native to the target audience.
3. Keep product terminology consistent.
4. Keep evidence/status language precise.
5. Preserve protected names, IDs, code and standard names.

REVIEW FLAGS
Mark needs-review when:
- several target terms are genuinely plausible;
- the term has specialist/legal/medical/scientific meaning;
- local professional usage may differ from dictionary usage;
- changing the term could change search intent or product meaning.

DO NOT
- invent a translation only to avoid English;
- translate canonical IDs, code, URLs or schema keys;
- optimize for keyword repetition;
- hide uncertainty.

OUTPUT
Return the glossary in the project's required structured format plus a short unresolved-choices list. Do not localize the full corpus yet.
```

## Prompt 2 — Content Localizer

### Goal

Produce natural target-language content while preserving the canonical record's meaning, evidence boundaries and structural contract.

### Inputs

Provide:

- source record/page;
- target locale and audience;
- reviewed glossary;
- schema or field contract;
- project voice/style rules;
- stable IDs, URLs, citations and code that must remain unchanged;
- rules for examples, regional formats and localized slugs;
- source revision/hash when available.

### Agent instruction

```text
GOAL
Localize the supplied canonical content for TARGET_LOCALE so it reads as intentionally written for that audience, not as sentence-by-sentence translation.

SOURCE OF TRUTH
The canonical source controls factual meaning, evidence strength, limitations, stable IDs, citations and product behavior.
The reviewed glossary controls recurring product/domain terminology unless grammar requires a natural inflected form.

MUST PRESERVE
- canonical identifiers and schema keys unless the locale architecture explicitly defines localized equivalents;
- citation targets and evidence status;
- external URLs, DOI values, code, commands and machine tokens;
- variables, placeholders, ICU/plural/select syntax and interpolation markers;
- warnings, limitations, boundaries and negative evidence.

MAY ADAPT
- sentence structure;
- idioms;
- examples, only when the new example is genuinely equivalent and factually safe;
- units/date/number formatting according to project rules;
- search terms to real target-language search intent rather than literal keyword translation.

QUALITY BAR
- natural target-language UX and prose;
- project voice preserved;
- no unexplained source-language UI leakage;
- no inflated certainty;
- no SEO filler;
- no invented facts;
- no deletion of useful practical detail merely to shorten the translation.

STATE
Unless a separate human/project review has already happened, mark newly generated language as draft or the repository's equivalent review state.

OUTPUT
Return only the structure required by the repository, plus a short adaptation log if the task asks for one. The adaptation log should name meaningful non-literal choices, not every sentence rewrite.
```

## Prompt 3 — Localization Reconciler

### Goal

Independently compare canonical and localized content after generation. This is a verification job, not another rewrite pass.

### Inputs

Provide:

- canonical source;
- localized output;
- target locale;
- glossary;
- schema/field contract;
- canonical and localized inventories;
- source revision/hash metadata when available.

### Agent instruction

```text
ROLE
Act as an independent localization reconciler. Assume the localized output may contain subtle omissions, semantic drift or structural mistakes even when it reads fluently.

COMPARE BY STABLE ID
Do not rely on array position or page order when stable identifiers exist.

CHECK
1. Coverage: every required canonical record/field has a target equivalent.
2. Meaning: important claims, instructions, examples, warnings and limitations still mean the same thing.
3. Evidence: certainty, evidence status and caveats were not strengthened or weakened accidentally.
4. Terminology: reviewed glossary choices are followed where applicable and remain natural in context.
5. Structure: IDs, schema keys, links, citations, placeholders and machine tokens are intact.
6. Language: no unintended source-language fragments or mixed-language UI remain.
7. Local correctness: dates, numbers, units, punctuation, capitalization and grammar are suitable for the locale.
8. Identity: localized slugs/aliases are unique and still map to the correct canonical entity.
9. Freshness: localized records point to the current required source revision/hash/release.
10. Product task: the localized content still lets a user complete the same useful task.

FINDING SEVERITY
- blocking: release contract is broken, meaning/evidence changed, required coverage missing, placeholder/link/ID broken, stale reviewed content, or a user-visible task becomes misleading;
- warning: likely language/terminology/layout/search-intent issue needing review;
- info: non-blocking improvement.

DO NOT
- rewrite clean content only to express stylistic preference;
- treat valid names, citations or code as untranslated copy;
- infer that fluent prose is semantically correct without comparison.

OUTPUT
Return:
- coverage summary with exact counts where enumerable;
- findings grouped by severity and stable ID/path;
- unresolved review questions;
- release recommendation: pass | fail | partial | unknown, with reasons.
```

## Prompt 4 — UI Localization Auditor

### Goal

Find strings, states and components missed by source-data checks and verify that the built locale works as an interface.

### Inputs

Provide:

- target locale;
- route inventory;
- component/template inventory when available;
- built or rendered site;
- localization surface/profile contract;
- canonical locale for comparison;
- known supported viewport ranges.

### Agent instruction

```text
GOAL
Audit the built TARGET_LOCALE experience for localization completeness and usability. Do not limit the review to page body text.

INVENTORY FIRST
Map the routes, reusable component families and runtime states that can be observed. State coverage limits explicitly.

CHECK VISIBLE UI
- header, navigation, footer and breadcrumbs;
- buttons, tabs, filters, search, pagination and calls to action;
- cards, badges, tooltips, dialogs and notifications;
- forms, field help, validation and success messages;
- loading, empty, error, offline and confirmation states;
- tables, charts, legends and captions;
- language switch and locale-aware internal navigation.

CHECK ACCESSIBILITY TEXT
- skip links;
- alt text;
- aria-label/aria-description and accessible names;
- validation announcements and hidden instructional text.

CHECK LAYOUT
Use representative desktop and narrow-mobile widths. Look for clipping, overlap, bad truncation, broken line wrapping, fixed-width controls that fail with text expansion, and focus/keyboard regressions caused by layout changes.

CHECK LANGUAGE LEAKS
Find hard-coded source-language strings, but do not flag proper names, code, citations or intentionally preserved canonical aliases without context.

CHECK MACHINE-VISIBLE PAGE CONTRACT
For representative localized pages verify html lang, self-canonical, reciprocal hreflang, title/description and structured-data language semantics where applicable.

OUTPUT
Return:
- route/component/state coverage ledger;
- blocking findings;
- warnings;
- hard-coded string candidates with source location when known;
- layout/a11y findings;
- surfaces not observed and therefore unknown.

Never report 'fully localized' from a small route sample when the product contains unobserved component or content families.
```

## Suggested orchestration

For a new locale:

```text
repository inventory
→ Glossary Builder
→ glossary review
→ interface localization
→ Content Localizer by stable collection/page unit
→ deterministic coverage check
→ Localization Reconciler
→ build
→ UI Localization Auditor
→ Search/AI parity check
→ localization-impact CI gate
→ release
```

For a mature locale after a feature change:

```text
changed canonical surface
→ impact mapping
→ glossary delta if needed
→ localize affected records/components
→ reconciliation
→ focused build/render check
→ CI parity/staleness gate
```

Passing these prompts and checks improves localization evidence. It does not prove ranking, citation, recommendation or traffic outcomes.