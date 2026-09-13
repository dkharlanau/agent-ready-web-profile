# Executable Localization Quality and Surface Integrity

This is the executable layer behind `arwp-localization-quality`; methodology remains in `LOCALIZATION.md`.

## Canonical ownership

The engine does not introduce another graph or proof lifecycle. Repository Mapper owns source/render ownership. BraidGraph owns persistent evidence/change relations and reverse impact. Change/Evidence Receipts own verification evidence. Agent Eval receipts own runtime/browser task evidence. Localization Quality is a specialist checker. Surface Integrity is only the expected-representation/validation contract that composes those systems.

## CLI

`arwp localization` exposes `init`, `check`, `impact`, `explain`, `receipt`, `gate` and `pseudo`.

`check` emits inspectable states. `impact` maps changed paths to required locale representations. `gate` blocks unresolved required missing/stale/incomplete representations. `receipt` projects the result into canonical Change Receipt verification semantics and can render an accessible evidence widget without a synthetic score.

## Result semantics

States are `pass`, `fail`, `warning`, `stale`, `missing`, `incomplete`, `intentionally-excepted`, `not-applicable`, `not-assessed`. A bounded exception changes disposition, not the underlying diagnostic. Expired exceptions are failures.

## Adapters, parity and markets

Deterministic adapters are `json-key-set`, `json-record-set`, `rendered-page-manifest`, `machine-files` and `manual`. Parity is independent from storage: `exact`, `semantic`, `adapted`, `market-specific`, `routing-only`. Locale and market are separate profile objects. Routing-only locales cannot be silently promoted into Search publication, sitemap membership or human-interface completeness.

Structured records may carry a source hash; a mismatch reports `LOC_SOURCE_STALE`.

## Surface Integrity

`lib/surface-integrity.mjs` evaluates generic expected representations and impact rules. It supports required/optional/not-applicable expectations and present/missing/stale/incomplete/intentionally-excepted observations. Ownership may be supplied by Repository Mapper; absent ownership stays unknown instead of being guessed. Relationship storage/traversal stays in BraidGraph.

## Fault-injection benchmark

`benchmarks/localization-quality/` is shaped like a multilingual structured knowledge site: exact UI dictionaries, stable-ID Decision Skills, adapted rendered pages, market-specific offers and a routing-only machine locale. `scripts/localization-fault-injection-test.mjs` injects required failure classes and asserts diagnostic codes. Neutral adapted/market-specific changes prevent false positives. The fixture is informed by real Cognitive Biases surface classes; it is not a claim that the live Cognitive Biases repository passed this checker.

## Pseudo-locales

`arwp localization pseudo expanded` expands text while preserving placeholders/URLs/code. `rtl` adds directional isolation. These expose localization-hook/layout risks; they do not constitute visual, language or accessibility certification.

## Evidence boundaries

A green repository/build check does not prove deployed parity. Valid `hreflang` does not prove indexing. Metadata does not prove AI citation. Agent task success does not prove authorization safety. A localized page does not prove language quality without review. The widget is evidence display, not a ranking or AI-readiness badge.
