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

Canonical skill source: <https://github.com/dkharlanau/agent-ready-web-profile/blob/main/skills/arwp-localization-quality/SKILL.md>

Use this skill when localization is a product surface, not a one-time translation job.

## Workflow

1. Resolve the real locale contract and distinguish full human-interface locales from limited roles such as agent routing.
2. Inventory every localizable surface: UI, runtime states, reusable components, pages, content libraries, taxonomies, accessibility text, Search metadata, structured data and AI/agent surfaces.
3. Build and review a stable-ID glossary before bulk content localization.
4. Localize natural user meaning while preserving stable IDs, evidence boundaries, citations, code, URLs and placeholders.
5. Run an independent source-vs-target reconciliation by stable ID.
6. Verify the built experience across representative desktop/mobile routes, reusable components and runtime states.
7. Verify `html lang`, canonical and reciprocal `hreflang`, sitemap membership, structured-data language semantics and declared AI/agent outputs.
8. Install CI drift protection: exact coverage, source-revision freshness and a localization-impact gate for new strings, routes, components, skills, datasets and machine-readable surfaces.
9. Report surface-by-surface evidence such as `complete`, `partial`, `stale`, `out-of-scope` and `unknown` instead of a synthetic localization score.

The full standard is `/LOCALIZATION.md`. Prompt contracts, CI patterns and machine-readable examples live in the canonical skill directory.

A green localization gate does not prove indexing, ranking, AI citation, recommendation visibility or traffic.
