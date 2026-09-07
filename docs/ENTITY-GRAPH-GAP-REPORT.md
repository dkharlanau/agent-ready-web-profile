# Entity Graph Gap Report

ARWP's Entity Graph Gap Report is a bounded structural audit for public websites. It answers a narrower and more useful question than a generic "SEO score":

> Which important entities are actually described, visibly grounded, given stable identities, connected to other entities, and represented on useful canonical pages?

The report does **not** estimate ranking, rich-result eligibility, trust, AI citation probability, or business quality.

## Run it

```bash
node bin/arwp-entities.mjs https://example.com
node bin/arwp-entities.mjs https://example.com --max-pages=20 --json
node bin/arwp-entities.mjs https://example.com --output=entity-gap-report.json
```

The crawler is intentionally bounded. It starts from the supplied public HTTPS URL, samples same-site HTML from crawlable internal links and the site's sitemap when available, and never treats pages outside the observed sample as absent from the whole site.

## Entity families

The first implementation detects these structured-data families:

- `Person`
- `Organization` / `LocalBusiness`
- `Product`
- `SoftwareApplication` / `WebApplication`
- `Service`
- `Dataset`
- `Event`-family types including `PublicationEvent`
- `DefinedTerm`
- `Article`-family types including `TechArticle`, `BlogPosting`, `NewsArticle` and `ScholarlyArticle`

The list is a routing scope, not a recommendation that every website needs every type.

## What is checked

For each observed entity ARWP records:

1. whether it has a stable absolute `@id`;
2. where it was observed;
3. whether its primary name is also visible on the page;
4. whether an observed useful page visibly describes the entity;
5. its outgoing and incoming graph relations;
6. family-specific evidence where it matters.

Examples of family-specific gaps:

| Family | Example check |
| --- | --- |
| Service | `provider` |
| Dataset | `creator` or `publisher`, plus `license` |
| Article | `author` |
| Event | `startDate` and `location` / `VirtualLocation` |
| DefinedTerm | `inDefinedTermSet` |
| Software | maintainer / author / provider relationship |

The report never fills missing facts with invented values.

## Priority model

- **P0** — reserved for severe contradictions that make the structured representation actively unsafe or deceptive.
- **P1** — strong structural gap: missing stable identity, machine-only primary name, missing entity page, or important family evidence.
- **P2** — relationship/graph maturity opportunity such as an isolated entity.
- **P3** — optional enrichment only when supported by real first-party facts.

This is backlog priority, **not a search ranking score**.

## Canonical entity pages

An entity does not need a new thin landing page simply because Schema.org exists. An existing product, author, service, dataset, event, glossary, or article page can be the entity page when it has genuine user value and visibly describes the entity.

ARWP therefore treats "create a page" as a last resort after trying to reuse a useful existing route.

## Markdown policy

The Entity Graph Gap Report follows the Page Knowledge Manifest policy:

- HTML is the canonical search surface.
- Selected Markdown files may exist as repository-only source or agent companions.
- ARWP does not generate one public `.md` duplicate for every HTML route.
- Markdown is not treated as a ranking signal.

## Machine output

Schema:

`schema/entity-gap-report.schema.json`

The report preserves:

- pages actually sampled;
- entity families and stable IDs;
- observed relations;
- explicit gaps and evidence URLs;
- JSON-LD parse failures;
- crawl bounds;
- `doesNotProve` limitations.

A future measurement loop may compare a before/after entity-gap report with Search or AI visibility evidence. The structural report itself must never claim that closing a gap caused traffic growth.
