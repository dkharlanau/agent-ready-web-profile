# Localization CI gates

The purpose of localization CI is to stop silent drift. It should answer two different questions:

1. Is each declared locale complete for the surfaces it promises?
2. Did this change create new localization work that the pull request did not handle?

Do not reduce this to one percentage score.

## 1. Keep one locale registry

The repository should have one canonical locale registry or profile. It should declare:

- source locale;
- locale roles and statuses;
- required surfaces per locale;
- fallback policy;
- canonical/localized route relationship;
- source-revision policy;
- explicit exceptions file when used.

A locale that exists only for `llms.txt` routing should not accidentally be tested as a complete human interface. A locale declared as a reviewed human experience should not silently fall back to English on required surfaces.

## 2. Make every enumerable surface machine-countable

Good blocking checks compare sets rather than samples.

Examples:

- source UI key set equals target UI key set;
- canonical skill IDs equal localized skill IDs;
- canonical published article IDs equal localized published article IDs for a full-content locale;
- every localized route maps to one canonical entity and vice versa where parity is required;
- no duplicate localized slug or alias collision;
- every required page appears in the sitemap and locale manifest;
- every declared machine-readable library has the expected localized records.

Keep stable IDs separate from localized labels and slugs.

## 3. Validate placeholders and machine contracts

For localized strings/records, compare source and target placeholder sets exactly.

Cover formats used by the project, for example:

- `{name}` / `${name}`;
- ICU message placeholders and plural/select keys;
- printf-style tokens;
- template variables;
- Markdown/code fences when they are structural;
- URLs, DOI values and citation locators when they are expected to remain unchanged.

A fluent translation with a broken interpolation variable is a blocking defect.

## 4. Detect stale translations

Existence is not freshness.

Choose one deterministic method appropriate to the repository:

- record-level `sourceHash`;
- source commit/revision;
- canonical content release version;
- per-file digest;
- a generated manifest of source record digests.

When canonical content changes, the localized record should become stale until it is reconciled.

For a structured library, a useful model is:

```json
{
  "canonicalId": "example-id",
  "sourceHash": "sha256:...",
  "locale": "fr",
  "reviewState": "reviewed"
}
```

CI should fail if `reviewState` remains `reviewed` while `sourceHash` no longer matches the canonical record required by the release.

A release-wide version is simpler and can be sufficient for small repositories, but record-level hashes detect partial edits more precisely.

## 5. Add a localization-impact gate

This gate runs on pull requests and asks whether changed canonical files imply localization work.

Build a versioned path-to-surface map, for example:

```json
{
  "rules": [
    { "paths": ["src/components/**"], "surface": "ui-components" },
    { "paths": ["content/**"], "surface": "content" },
    { "paths": ["data/skills.json"], "surface": "content-libraries.skills" },
    { "paths": ["data/techniques.json"], "surface": "content-libraries.techniques" },
    { "paths": ["templates/**", "scripts/generate-*.mjs"], "surface": "generated-ui" },
    { "paths": ["ai/**", "skills/**"], "surface": "ai-agent" }
  ]
}
```

For every changed surface:

1. resolve active locales that require this surface;
2. determine whether their localized source/output changed or remains current by hash/inventory;
3. fail if required parity is missing;
4. allow a temporary explicit exception only when the repository policy permits it.

This is stronger than looking only for modified locale files. A canonical change can make an unchanged localization stale.

## 6. Keep exceptions explicit and temporary

A reasonable exception record is:

```json
{
  "id": "loc-exception-2026-09-13-example",
  "surface": "content-libraries.skills",
  "locales": ["fr", "de"],
  "reason": "Feature is behind a locale-specific rollout gate while terminology review is pending.",
  "owner": "project-team",
  "createdAt": "2026-09-13",
  "reviewBy": "2026-09-27"
}
```

CI should reject expired exceptions. Do not permit an empty reason. Prefer a review date over a permanent waiver.

An exception records localization debt; it does not make the missing locale complete.

## 7. Separate blocking and advisory checks

### Blocking

Use for objective contract failures:

- missing required keys/IDs/routes;
- duplicate localized IDs/slugs;
- missing required fields;
- broken placeholders;
- stale reviewed records;
- locale registry/sitemap/manifest disagreement;
- missing reciprocal `hreflang` for declared equivalent pages;
- wrong language metadata on generated pages;
- missing required AI/agent locale output;
- expired or invalid localization exception;
- undeclared fallback on a surface marked complete.

### Advisory

Use for heuristic findings that can have false positives:

- likely source-language remnants;
- preferred/avoid glossary term mismatches;
- suspiciously identical long source/target strings;
- unusual punctuation/number formatting;
- text-expansion risk;
- very short summaries;
- possible hard-coded UI text.

Do not fail solely because a proper name, standard, citation or code token remains in the source language.

## 8. Add pseudo-locale and browser checks where UI matters

Static data parity cannot prove rendered UI quality.

A strong UI pipeline can include:

1. generate a pseudo-locale that expands and visibly marks translatable strings;
2. build the application with that locale;
3. open representative routes and component states in a browser test;
4. detect clipping/overflow and obvious source-language hard-coding;
5. run a smaller target-locale smoke matrix on desktop and narrow mobile widths.

Do not pretend a screenshot sample proves every route is localized. Report the tested route/component/state cohort.

## 9. Verify Search and AI surfaces from the final artifact

Run these checks after the final mutator/generator that can change page metadata.

For required localized pages, verify as applicable:

- `html lang`;
- self canonical;
- reciprocal `hreflang` and `x-default` policy;
- localized title and description;
- sitemap membership;
- structured-data language semantics;
- locale-aware internal language switch;
- localized `llms.txt`, manifest, dataset or Agent Skill routing if declared.

When production checks are available, verify the deployed artifact separately. Repository/build checks do not prove the live response.

## 10. Recommended generic command boundary

Instead of adding a separate checker for every language, expose one locale-aware command, for example:

```bash
npm run check:localization
```

or:

```bash
node scripts/check-localization.mjs --all
node scripts/check-localization.mjs --locale=fr
```

The checker should read the locale registry/profile and discover required surfaces from data, not from hard-coded language names.

A migration from existing locale-specific checks can be incremental:

1. keep the existing checks green;
2. extract shared set/schema/route helpers;
3. add the generic locale registry/profile;
4. run generic and existing checks in parallel;
5. retire locale-specific checks only after the generic checker covers their useful assertions.

Never weaken a strong locale-specific gate merely to make the abstraction cleaner.

## 11. Example GitHub Actions shape

Adapt commands and paths to the project:

```yaml
name: Localization quality

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  localization:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - name: Validate localization source contract
        run: npm run check:localization
      - name: Build final public artifact
        run: npm run build
      - name: Validate localized generated output
        run: npm run check:localization:built
```

Pin or approve action versions according to repository policy. Do not copy the version numbers above over a project's stricter policy without review.

For PR impact analysis, use the repository's trusted base/head diff mechanism. Do not fetch or execute code from an untrusted fork with write credentials.

## 12. Pull-request completion rule

A localization-impacting PR is complete only when one of these is true for every affected required locale:

- localized surface updated and checks pass;
- canonical change is proven non-localizable by the surface contract;
- an allowed, explicit, unexpired exception records why localization is deferred.

This rule should apply when a project adds a new component, page, skill, technique, taxonomy, dataset label or machine-readable language surface. It prevents localization from being remembered only during dedicated translation sprints.

These gates improve implementation evidence. They do not prove Search ranking, AI citation, recommendation visibility or traffic.