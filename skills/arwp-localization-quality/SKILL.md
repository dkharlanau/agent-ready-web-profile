---
name: arwp-localization-quality
description: Execute and maintain multilingual website quality contracts across UI, structured content, Search, AI/agent surfaces, locale/market semantics and bounded exceptions. Use automatically when a target repository exposes multiple locales or a change touches a declared localizable surface.
license: PolyForm-Strict-1.0.0
compatibility: Stack-neutral; requires Node.js for the bundled arwp localization CLI.
metadata:
  standard: agent-skills
  arwp-role: localization-quality
---

# ARWP Localization Quality

Localization Quality is an executable specialist contract. It composes with Repository Mapper for ownership, BraidGraph for evidence/change relationships, Change/Evidence Receipts for verification evidence, and Agent Eval for runtime tasks. Do not build a second graph or receipt format here.

## Applicability

Run when repository/site inspection finds a locale registry, translated routes, dictionaries, localized structured records, `hreflang`, language sitemaps, localized machine surfaces, or a change matching `impactRules`. Do not run on a genuinely monolingual site.

Normal ARWP orchestration is `inspect → detect localization applicability → localization check → localization impact → plan/transform → localization gate → receipt`. Missing/stale/incomplete required surfaces block release unless a valid bounded exception applies. The exception remains visible debt and never turns the underlying diagnostic into `pass`.

## Executable interface

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

Use `check` for deterministic contract state, `impact` for source-change blast radius, and `gate` for CI. Human-readable and JSON output are supported.

## Contract model

The profile separates language from market. Locale roles are `canonical`, `human-interface`, and `routing-only`; `agent-routing` is accepted only as a deprecated migration alias. Parity modes are `exact`, `semantic`, `adapted`, `market-specific`, and `routing-only`. Never infer market truth from a language tag.

Deterministic checks can cover exact keys/IDs, required fields, duplicate IDs/slugs, placeholders/ICU arguments, source hash freshness, declared fallback, glossary prohibitions, BCP 47 tags, optional NFC, `html lang`, self-canonical, reciprocal `hreflang`, declared `x-default`, sitemap/locale-manifest agreement, localized metadata, JSON-LD `inLanguage`, canonical entity identity, required AI/agent surfaces, routing-only Search isolation and debt expiry. Heuristic language detection is not blocking by default.

## Surface Integrity and canonical primitives

Localization compiles its expectations into the generic Surface Integrity contract. Surface Integrity answers which representations are expected, missing, stale, intentionally excepted or not applicable and which source changes affect them. Repository Mapper still owns source/render ownership; BraidGraph still owns stored relationships/reverse impact.

Bounded exceptions live in the machine-readable debt ledger. Permanent non-applicability requires explicit justification. Expired debt is blocking.

Locale-aware browser tasks stay in the canonical Agent Eval receipt using optional locale, market, task class, route/surface, expected outcome, side-effect and authorization fields. Runtime success is not trust evidence.

`receipt` projects localization verification into canonical Change Receipt semantics and can render a score-less Goose widget with date, coverage and evidence link. It is not certification and does not prove indexing, ranking, AI citation/recommendation, traffic or conversion.

## References

- [`../../LOCALIZATION.md`](../../LOCALIZATION.md) — methodology and evidence boundaries.
- [`../../docs/LOCALIZATION-ENGINE.md`](../../docs/LOCALIZATION-ENGINE.md) — executable contracts/CLI/CI.
- [`references/localization-profile.example.json`](references/localization-profile.example.json) — executable profile example.
- [`references/glossary.example.json`](references/glossary.example.json) — glossary model.
- [`references/prompts.md`](references/prompts.md) — generation/reconciliation prompt separation.
- [`references/ci-gates.md`](references/ci-gates.md) — CI guidance.
