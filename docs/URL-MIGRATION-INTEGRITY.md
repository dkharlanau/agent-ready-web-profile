# URL Migration Integrity

URL Migration Integrity is a bounded Goose ARWP check for URL moves. It verifies implementation evidence for explicit `oldUrl -> newUrl` mappings without claiming that rankings, indexing, traffic, PageRank-like signal transfer or AI visibility will be preserved.

## Use it when

Use this check after URLs are renamed, moved, consolidated or migrated between origins and you need to verify the migration implementation itself.

The migration manifest can be either an array or an object with a `pairs` array:

```json
{
  "pairs": [
    {
      "oldUrl": "https://old.example.com/page",
      "newUrl": "https://www.example.com/page"
    }
  ]
}
```

Both URLs must be absolute credential-free HTTPS URLs. The manifest supports up to 1,000 mappings; a live inspection run is intentionally bounded to at most 100 mappings.

## Inspect

Run through the repository entry point:

```bash
node bin/arwp.mjs url-migration inspect migration.json --output=url-migration-report.json
```

Optional evidence can be supplied separately:

```bash
node bin/arwp.mjs url-migration inspect migration.json \
  --before-state=before.json \
  --after-state=after.json \
  --after-sitemap=sitemap.xml \
  --internal-discovery=internal-discovery.json \
  --output=url-migration-report.json
```

Use `--text` for a compact human-readable result. Network bounds can be adjusted with `--timeout`, `--max-redirects` and `--concurrency` within the CLI safety limits.

## Validate an existing report

```bash
node bin/arwp.mjs url-migration validate url-migration-report.json
```

The report is validated against `schema/url-migration-integrity.schema.json`.

## Evidence boundaries

The check deliberately keeps different evidence types separate:

- live redirect traces observe the public HTTPS behavior of the old URL;
- destination fetches inspect terminal status, explicit `noindex` and HTML canonical metadata without browser rendering;
- Repository Mapper before/after state is repository evidence, not live redirect proof;
- the supplied after-migration sitemap is canonical sitemap evidence only;
- Internal Discovery is a bounded same-origin link cohort, not a whole-site crawl guarantee.

Missing or inapplicable evidence remains `unknown`, `not-provided` or `not-applicable`; it is not converted into a pass. HTML comments are ignored when inspecting canonical and robots meta elements, so commented example markup cannot create false migration findings.

## What a passing run does not prove

A clean bounded report does not prove ranking preservation, recrawl timing, index coverage, traffic recovery, citation/recommendation visibility or business impact. Those outcomes require separate owner-platform and longitudinal evidence.

## Focused verification

```bash
node scripts/public-redirect-trace-test.mjs
node scripts/url-migration-integrity-test.mjs
node bin/arwp.mjs url-migration --help
```
