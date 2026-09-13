---
name: arwp-localization-quality
description: Design, execute, audit and maintain high-quality multilingual website releases across terminology, UI, structured content, accessibility, Search metadata, AI/agent surfaces, locale/market semantics and bounded exceptions. Use when adding or reviewing a locale, when a localizable surface changes, or when CI must prevent localization drift.
license: PolyForm-Strict-1.0.0
compatibility: Stack-neutral; strongest with versioned locale data, deterministic inventories and CI. The bundled executable checks require Node.js.
metadata:
  standard: agent-skills
  arwp-role: localization-quality
---

# ARWP Localization Quality

Use this skill when localization is a product surface, not a one-time translation job.

Read the target repository's current instructions and localization architecture first. If the ARWP repository-level [`../../LOCALIZATION.md`](../../LOCALIZATION.md) standard is available in the current checkout, read it for the extended guidance; otherwise this skill and its bundled `references/` are self-contained. Do not impose one file layout on every stack.

Localization Quality composes with existing ARWP primitives: Repository Mapper remains source/render ownership authority, BraidGraph remains evidence/change and reverse-impact authority, Change/Evidence Receipts remain verification evidence, and Agent Eval remains runtime task evidence. Do not create a second graph, receipt lifecycle or browser-evaluation format for localization.

## Executable interface

When the target repository has an executable localization profile, use the canonical CLI instead of inventing repository-specific orchestration:

```bash
arwp localization init .arwp/localization.json --site=https://example.com/
arwp localization check .arwp/localization.json --root=. --json
arwp localization impact .arwp/localization.json --root=. --base=origin/main --head=HEAD --json
arwp localization explain report.json --code=LOC_SOURCE_STALE
arwp localization gate .arwp/localization.json --root=. --base=origin/main --head=HEAD
arwp localization receipt report.json --evidence-ref=urn:example:evidence --widget=verification.html
arwp localization pseudo expanded 'Save {count} items'
arwp localization pseudo rtl 'Save {count} items'
```

Use `check` for deterministic implementation state, `impact` for source-change blast radius, `gate` for release/CI enforcement, `explain` for diagnostic evidence, `receipt` for canonical verification projection, and `pseudo` to expose hard-coded strings and layout fragility. Human-readable and JSON output are supported.

## Workflow

1. **Resolve the real locale contract.**
   - Identify the canonical locale, active target locales, fallback rules and release states.
   - Distinguish human-interface localization from routing-only or other limited locale roles.
   - Separate **locale** from **market**. Language does not imply pricing, availability, legal or commercial truth for a country/market.
   - Declare parity deliberately: `exact`, `semantic`, `adapted`, `market-specific` or `routing-only`.
   - Never call a locale complete when required surfaces are only partially implemented.

2. **Build the localization surface ledger.**
   - Inventory interface strings, runtime states, reusable components, pages, content libraries, taxonomies, structured data, accessibility text, Search metadata, sitemaps, language links, AI/agent surfaces, app/platform metadata, policy/docs and text embedded in media.
   - For every enumerable library, compare canonical IDs with localized IDs. Do not sample when exact coverage can be computed.
   - Connect each required representation to its source and deterministic inventory where one exists.
   - Record intentional `out-of-scope`, `not-applicable` or routing-only states instead of silently omitting surfaces.

3. **Build or review the glossary before long-form localization.**
   - Use stable concept IDs.
   - Record preferred terms, allowed aliases, terms to avoid, context and review status.
   - Optimize for natural target-language usage, not canonical-language word order.
   - Keep canonical aliases when they materially help recognition or interoperability.
   - Keep glossary IDs stable across locales even when wording is adapted.

4. **Localize the interface and structured content.**
   - Use the reviewed glossary plus the project's own voice, audience and reading-level rules.
   - Preserve stable IDs, code, field names, citations, external URLs and placeholders unless the architecture explicitly says otherwise.
   - Preserve ICU/message arguments and runtime variables exactly.
   - Adapt examples only when the new example keeps the same practical meaning and evidence boundary.
   - Treat machine-generated copy as `draft` until the locale contract's review requirement is satisfied.

5. **Run an independent reconciliation pass.**
   - Compare source and target by stable ID, not by list position.
   - Find omissions, inventions, stronger claims, stale source revisions, glossary drift, broken placeholders, changed links/citations, duplicate localized slugs and untranslated source-language fragments.
   - Keep language review, semantic review, evidence review and product-task review separate.
   - Generation must not be its own reviewer.

6. **Verify the built experience.**
   - Build/render the target locale.
   - Inspect representative desktop and narrow-mobile routes plus each reusable component family.
   - Include forms, validation, loading/empty/error states, modals, tooltips, search/filter controls, navigation/footer and language switch.
   - Check accessible names, skip links, alt text, long-string wrapping, truncation, focus behavior, overflow and bidirectional text where relevant.
   - Use expanded and RTL pseudo-locales when practical to expose hard-coded strings and fragile layouts.
   - Keep repository evidence, built-artifact evidence, rendered-browser evidence and deployed evidence distinct.

7. **Verify Search and machine-readable parity.**
   - Check `html lang`, self-canonical, reciprocal `hreflang`, declared `x-default`, localized title/description, sitemap membership and language semantics in structured data.
   - Preserve canonical entity identifiers while exposing localized names and aliases.
   - If the product publishes `llms.txt`, locale manifests, localized datasets, Agent Skills or other machine-readable libraries, verify them against the same declared surface contract.
   - A routing-only locale must not silently become a human/Search-published locale.
   - Do not create thin locale placeholders merely to complete a language matrix.

8. **Install drift protection in CI.**
   - Make exact coverage blocking for enumerable surfaces where exact parity is the declared contract.
   - Track source revision, release version or content hash so an existing translation can become `stale` after canonical content changes.
   - Add a localization-impact gate: a pull request that changes a localizable source must update affected active locales or carry an explicit bounded exception.
   - Prefer one generic locale-aware checker over a growing family of orchestration scripts, while preserving stronger domain-specific locale validators.
   - Run build-dependent localization checks in the same runtime, system-dependency and install environment as the production validation/build pipeline; environment drift must not masquerade as a localization failure.
   - See [`references/ci-gates.md`](references/ci-gates.md).

9. **Report evidence, not a synthetic localization score.**
   - Report surface-by-surface states such as `present`, `missing`, `stale`, `incomplete`, `intentionally-excepted`, `not-applicable` or `not-assessed`.
   - Keep active bounded exceptions visible as Quality Debt; an exception does not turn the underlying finding into `pass`.
   - Permanent non-applicability needs explicit justification; expired debt is blocking.
   - A green localization gate proves only the declared implementation observations. It does not prove literary quality, cultural fit, deployment parity, indexing, ranking, AI citation/recommendation, traffic or conversion.

## Executable contract model

The v0.2 localization profile separates language from market and makes parity explicit. Locale roles are `canonical`, `human-interface` and `routing-only`; `agent-routing` may be accepted only as a deprecated migration alias. Market facts remain independent from language facts.

Deterministic checks can cover exact keys/IDs, required fields, duplicate IDs/slugs, placeholders/ICU arguments, source-hash freshness, declared fallback, glossary prohibitions, BCP 47 tags, optional NFC, `html lang`, self-canonical, reciprocal `hreflang`, declared `x-default`, sitemap/locale-manifest agreement, localized metadata, JSON-LD `inLanguage`, canonical entity identity, required AI/agent surfaces, routing-only Search isolation and Quality Debt expiry. Heuristic language detection should not become blocking by default.

## Surface Integrity and canonical primitives

Localization compiles expected representations into the generic Surface Integrity contract. Surface Integrity answers which representations are required and whether they are present, missing, stale, incomplete, intentionally excepted or not assessed; it can also project which declared representations are affected by changed source paths.

It is intentionally smaller than Repository Mapper and BraidGraph. Repository Mapper still owns source/render ownership. BraidGraph still owns stored relationships and reverse impact. Localization findings should attach to those primitives rather than duplicating them.

Locale-aware browser tasks stay in the canonical Agent Eval receipt using optional locale, market, task class, route/surface, expected outcome, side-effect and authorization fields. Runtime task success is not evidence of authorization or trust.

`arwp localization receipt` can project implementation verification into canonical Change Receipt semantics and render a score-less Goose evidence widget with verification date, coverage state and evidence link. The widget is evidence navigation, not certification.

## Prompt sequence

Use separate jobs so generation is not its own reviewer:

1. Glossary Builder.
2. Content Localizer.
3. Localization Reconciler.
4. UI Localization Auditor.

Reusable prompt contracts are in [`references/prompts.md`](references/prompts.md).

## Minimum deterministic contract

For every locale declared complete for a surface, verify as applicable:

- exact canonical/localized key or stable-ID coverage when parity requires it;
- required field/schema parity;
- no duplicate localized IDs or slugs;
- placeholders, ICU variables and runtime arguments preserved;
- source revision/hash is current;
- no undeclared fallback to the canonical language;
- reciprocal language links for real equivalent pages;
- locale registry, sitemap and generated routes agree;
- structured-data language metadata is correct;
- canonical entity identity is reused rather than cloned;
- declared AI/agent surfaces are present and current;
- routing-only surfaces remain isolated from human/Search publication;
- locale-specific and market-specific differences follow their declared parity modes;
- no unresolved localization-impact exception is expired.

Heuristic checks for source-language remnants, suspicious identical text, glossary drift or text expansion can be useful, but they should not reject names, citations, code or other legitimate source-language tokens without context.

## When a new feature is added

A new component, route, content family, skill, taxonomy, dataset label, image with embedded text, or AI/agent surface is not multilingual-ready merely because the canonical version works.

Require the feature change to:

1. register or map its localization surface;
2. expose an exact canonical inventory where practical;
3. declare the appropriate parity mode;
4. update glossary terms when new product/domain vocabulary appears;
5. extend the localization checker or deterministic adapter where needed;
6. localize required active locales or add an explicit time-bounded exception;
7. verify the built human and machine-readable outputs;
8. add or replay a locale-aware Agent Eval task when the feature is interactive and task-critical.

This rule is the main protection against localization quality decaying after a strong first release.

## References

- [`../../LOCALIZATION.md`](../../LOCALIZATION.md) — extended methodology and evidence boundaries.
- [`../../docs/LOCALIZATION-ENGINE.md`](../../docs/LOCALIZATION-ENGINE.md) — executable contracts, CLI, CI, Surface Integrity and Quality Debt integration.
- [`references/prompts.md`](references/prompts.md) — glossary, localization, reconciliation and UI-audit prompt contracts.
- [`references/ci-gates.md`](references/ci-gates.md) — reusable CI design.
- [`references/localization-profile.example.json`](references/localization-profile.example.json) — executable v0.2 surface contract.
- [`references/glossary.example.json`](references/glossary.example.json) — versioned glossary example.
- [`references/cognitive-biases-dogfood.md`](references/cognitive-biases-dogfood.md) — concrete implementation lessons from a multilingual structured-knowledge site, including locale roles, glossary parity, freshness enforcement, impact gates and production-environment parity.

Localization can improve usefulness, retrieval and discovery readiness. It does not guarantee ranking, recommendation or citation outcomes.
