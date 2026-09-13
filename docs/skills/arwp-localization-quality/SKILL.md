---
name: arwp-localization-quality
description: Design, implement, audit and maintain high-quality website localization across terminology, UI, content libraries, accessibility, Search metadata and AI/agent surfaces. Use when adding a locale, reviewing a multilingual release, finding untranslated components, or adding CI that prevents new strings, pages, skills or datasets from escaping localization.
license: Apache-2.0
compatibility: Stack-neutral; strongest with versioned locale data, deterministic inventories and CI.
metadata:
  standard: agent-skills
  arwp-role: localization-quality
---

# ARWP Localization Quality

Use this skill when localization is a product surface, not a one-time translation job.

Read the target repository's current instructions and localization architecture first. If the ARWP repository-level [`../../LOCALIZATION.md`](../../LOCALIZATION.md) standard is available in the current checkout, read it for the extended guidance; otherwise this skill and its bundled `references/` are self-contained. Do not impose one file layout on every stack.

## Workflow

1. **Resolve the real locale contract.**
   - Identify the canonical locale, active target locales, fallback rules and release states.
   - Distinguish human-interface localization from agent-routing-only or other limited locale roles.
   - Never call a locale complete when required surfaces are only partially implemented.

2. **Build the localization surface ledger.**
   - Inventory interface strings, runtime states, reusable components, pages, content libraries, taxonomies, structured data, accessibility text, Search metadata, sitemaps, language links, AI/agent surfaces, and text embedded in media.
   - For every enumerable library, compare canonical IDs with localized IDs. Do not sample when exact coverage can be computed.
   - Record intentional `out-of-scope` and `not-applicable` states instead of silently omitting surfaces.

3. **Build or review the glossary before long-form localization.**
   - Use stable concept IDs.
   - Record preferred terms, allowed aliases, terms to avoid, context and review status.
   - Optimize for natural target-language usage, not English word order.
   - Keep canonical English aliases when they materially help recognition or interoperability.

4. **Localize the interface and structured content.**
   - Use the reviewed glossary plus the project's own voice, audience and reading-level rules.
   - Preserve stable IDs, code, field names, citations, external URLs and placeholders unless the architecture explicitly says otherwise.
   - Adapt examples only when the new example keeps the same practical meaning and evidence boundary.
   - Treat machine-generated copy as `draft` until the locale contract's review requirement is satisfied.

5. **Run an independent reconciliation pass.**
   - Compare source and target by stable ID, not by list position.
   - Find omissions, inventions, stronger claims, stale source revisions, glossary drift, broken placeholders, changed links/citations, duplicate localized slugs and untranslated source-language fragments.
   - Keep language review, semantic review, evidence review and product-task review separate.

6. **Verify the built experience.**
   - Build/render the target locale.
   - Inspect representative desktop and narrow-mobile routes plus each reusable component family.
   - Include forms, validation, loading/empty/error states, modals, tooltips, search/filter controls, navigation/footer and language switch.
   - Check accessible names, skip links, alt text, long-string wrapping and focus behavior.
   - Use a pseudo-locale when practical to expose hard-coded strings and fragile layouts.

7. **Verify Search and machine-readable parity.**
   - Check `html lang`, self-canonical, reciprocal `hreflang`, `x-default` policy, localized title/description, sitemap membership and language semantics in structured data.
   - Preserve canonical entity identifiers while exposing localized names and aliases.
   - If the product publishes `llms.txt`, locale manifests, localized datasets, Agent Skills or other machine-readable libraries, verify them against the same declared surface contract.
   - Do not create thin locale placeholders only to complete a language matrix.

8. **Install drift protection in CI.**
   - Make exact coverage blocking for enumerable surfaces.
   - Track source revision, release version or content hash so an existing translation can become `stale` after canonical content changes.
   - Add a localization-impact gate: a pull request that changes a localizable source must update affected active locales or carry an explicit time-bounded exception.
   - Prefer one generic locale-aware checker over a growing family of `check-<language>` scripts.
   - Run build-dependent localization checks in the same runtime and system-dependency environment as the production build; environment drift should not masquerade as a localization failure.
   - See [`references/ci-gates.md`](references/ci-gates.md).

9. **Report evidence, not a synthetic localization score.**
   - Report surface-by-surface states such as `complete`, `partial`, `stale`, `out-of-scope`, `not-applicable` or `unknown`.
   - Separate repository evidence, built-artifact evidence, rendered-browser evidence and deployed evidence.
   - A green localization gate does not prove Search ranking, indexing, AI citation, recommendation visibility or traffic.

## Prompt sequence

Use separate jobs so generation is not its own reviewer:

1. Glossary Builder.
2. Content Localizer.
3. Localization Reconciler.
4. UI Localization Auditor.

Reusable prompt contracts are in [`references/prompts.md`](references/prompts.md).

## Minimum deterministic contract

For every locale declared complete for a surface, verify as applicable:

- exact canonical/localized key or stable-ID coverage;
- required field/schema parity;
- no duplicate localized IDs or slugs;
- placeholders and variables preserved;
- source revision is current;
- no undeclared fallback to the canonical language;
- reciprocal language links for real equivalent pages;
- locale registry, sitemap and generated routes agree;
- structured-data language metadata is correct;
- declared AI/agent surfaces are present and current;
- no unresolved localization-impact exception is expired.

Heuristic checks for source-language remnants, suspicious identical text, glossary drift or text expansion can be useful, but they should not reject names, citations, code or other legitimate source-language tokens without context.

## When a new feature is added

A new component, route, content family, skill, taxonomy, dataset label, image with embedded text, or AI/agent surface is not multilingual-ready merely because the canonical version works.

Require the feature change to:

1. register or map its localization surface;
2. expose an exact canonical inventory where practical;
3. update glossary terms when new product/domain vocabulary appears;
4. extend the localization checker;
5. localize required active locales or add an explicit temporary exception;
6. verify the built human and machine-readable outputs.

This rule is the main protection against localization quality decaying after a strong first release.

## References

- [`../../LOCALIZATION.md`](../../LOCALIZATION.md) — extended repository-level standard when present.
- [`references/prompts.md`](references/prompts.md) — glossary, localization, reconciliation and UI-audit prompt contracts.
- [`references/ci-gates.md`](references/ci-gates.md) — reusable CI design.
- [`references/localization-profile.example.json`](references/localization-profile.example.json) — example surface contract.
- [`references/glossary.example.json`](references/glossary.example.json) — versioned glossary example.
- [`references/cognitive-biases-dogfood.md`](references/cognitive-biases-dogfood.md) — concrete implementation lessons from a multilingual knowledge site, including locale roles, glossary parity, freshness enforcement, impact gates and production-environment parity.

Localization can improve usefulness, retrieval and discovery readiness. It does not guarantee ranking, recommendation or citation outcomes.