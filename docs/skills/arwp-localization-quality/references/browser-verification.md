# Localization browser verification

Static localization checks are necessary, but they are not browser evidence.

A locale can have complete translation records, valid generated HTML and green CI while still being unusable after rendering. Text can clip, a hidden drawer can remain in the accessibility tree, a translated button can keep an English accessible name, or a 320 px layout can overflow even though source and generated-output checks pass.

## Four evidence levels

Keep these levels separate in reports and release gates:

1. **Source** — locale registry, glossary, translation/content records, stable IDs, placeholders, review state and source freshness.
2. **Generated output** — final built files, routes, metadata, canonical/hreflang, structured data, machine-readable locale surfaces and declared parity.
3. **Rendered browser experience** — post-JavaScript DOM, layout, responsive behavior, runtime states, navigation, overflow, clipping and browser/runtime errors.
4. **Accessibility / machine interpretation** — browser accessibility tree, accessible names and states, focus order, keyboard behavior, language semantics and assistive-technology visibility.

Passing levels 1–2 never implies levels 3–4 passed. A deployed check is a separate evidence boundary from a local rendered check.

## Build the locale × surface matrix

Discover locales from the product's canonical locale registry. Do not hard-code a remembered list.

For each published locale:

- identify page/component archetypes rather than taking thousands of brittle screenshots;
- cover the homepage, navigation-heavy surfaces, indexes, detail pages, search/filter states, long-content pages, forms where present, footer-heavy pages and error/no-result states;
- add outliers selected by text length, unusually long unbroken tokens, component density or known complexity;
- scan the full generated corpus automatically for measurable properties even when screenshots are sampled.

Record the tested locale, route, archetype, viewport and state. A screenshot sample without an explicit coverage ledger is weak evidence.

## Reconcile three browser views

For each representative route/state, reconcile:

1. screenshot — what a person sees;
2. rendered DOM — what the browser actually created after scripts ran;
3. accessibility tree — what assistive technology receives.

Actively search for disagreement, for example:

- correct DOM text that is visually clipped;
- correct visible text with an English `aria-label`, `title`, `placeholder` or status message;
- visually closed navigation that remains exposed or focusable;
- decorative/hidden content appearing in the accessibility tree;
- a visual heading that is not exposed as a heading;
- translated text duplicated with stale hidden source-language text;
- DOM order and focus/reading order that diverge badly.

Do not infer accessibility-tree quality from DOM attributes alone.

## Viewport and long-string stress

The minimum narrow-mobile verification width should include **320 px** unless the product explicitly does not support it. A useful default matrix is:

- 320 × 568;
- about 375 × 667;
- about 430 × 932;
- about 768 px wide;
- about 1280–1440 px wide.

Use real product breakpoints when they expose more meaningful states.

Measure/rank strings by actual component risk: text length, expansion relative to the source locale, longest token, constrained component width and observed wrapping/overflow. Render risky strings in their real components. Where useful, add an expanded pseudo-locale of roughly 30–50% text growth while preserving placeholders, URLs and code.

Do not solve localization failures by globally shrinking typography. Prefer resilient layout, wrapping and component sizing.

## Keyboard and focus are runtime evidence

Keyboard checks must perform real navigation, not merely assert that `:focus` CSS exists.

Exercise as applicable:

- Tab and Shift+Tab;
- Enter and Space;
- Escape;
- arrow keys for patterns that require them.

Verify reachability, logical order, visible focus, absence of traps, hidden-control exclusion, menu/dialog focus management and sensible focus return. Capture representative focused screenshots where this helps diagnosis.

## Context-aware source-language leak detection

Post-render leak scans should inspect visible text, hidden text, accessible names, placeholders, tooltips, image alt, titles, live regions and generated messages.

Do not treat the presence of Latin letters or source-language words as an automatic failure. Classify findings as:

- proper name / brand;
- citation or source title;
- scientific/technical term intentionally preserved;
- code/identifier;
- explicitly marked source-language fallback;
- untranslated visible defect;
- hidden stale UI;
- accessibility-only defect;
- metadata defect.

Heuristic leak detection should normally be advisory until context makes the defect objective.

## Automated browser guards

A maintainable browser gate should prefer deterministic, low-flake checks such as:

- document/root width does not exceed the viewport unexpectedly;
- visible interactive controls remain inside the viewport;
- text is not clipped by unintended `overflow:hidden`/`clip`;
- hidden/`aria-hidden` UI is not focusable;
- document `lang`, canonical and required metadata match the active locale after rendering;
- console exceptions and same-origin failed resources are captured;
- representative accessibility snapshots are stored;
- interactive states update ARIA/state semantics correctly;
- search/filter empty/results states are exercised;
- screenshots, DOM snapshots and accessibility snapshots are retained as bounded evidence.

Intentional horizontal scrollers need an explicit component contract. Do not globally ignore overflow.

## Production verification

Local browser success does not prove deployment parity. After deployment, re-run a bounded representative browser cohort against production and verify:

- the intended source revision is live;
- locale URLs and assets resolve;
- final browser metadata/language semantics remain correct;
- narrow-mobile rendering still passes;
- runtime errors do not appear only under the production base path or CDN/cache behavior.

If the platform does not expose the deployed revision directly, publish a minimal build/deploy revision marker or use another deterministic deployment identity mechanism.

## False-green fault injection

A browser-quality system should prove it can catch realistic failures. Useful fault-injection cases include:

- English accessible name under translated visible text;
- 320 px overflow caused by a long translation;
- visually hidden menu that remains focusable/exposed;
- clipped localized button;
- missing focus indicator or keyboard trap;
- translated text missing from the accessibility tree;
- wrong final canonical after a late post-processor;
- mobile-only untranslated label or empty/no-result message.

When the system finds a real defect, add the smallest stable regression guard for that failure class.

## Quality Debt for browser exceptions

Do not turn difficult browser failures into permanent masks or ignore lists. A justified exception should record:

- locale;
- surface/route/component;
- reason;
- owner/system;
- evidence;
- user/assistive-technology impact;
- temporary mitigation;
- review/removal condition;
- exact next verification step.

Screenshot masks, skipped routes and selector ignore lists are debt unless they represent a documented intentional component contract.

## Evidence boundary

Browser automation improves implementation evidence. It does not prove literary quality, cultural fit, indexing, ranking, AI recommendation, user satisfaction or business impact. Human language/editorial review and external owner/search evidence remain separate requirements.
