# Maturity evidence pack

Reviewed: 2026-09-09. Status: optional ARWP implementation pattern, not a web standard, legal checklist, Google requirement, ranking factor or maturity certification.

## Purpose and applicability

Make a project's identity, useful data, rights, maintenance, governance and outcome claims inspectable. Reuse existing files and canonical entities; do not manufacture datasets, companies, awards, customers, policies or testimonials to complete a checklist. A service business, author site and research tool need different evidence. `datasets: []` is valid when no real dataset exists.

ARWP's [inventory](maturity/profile.json) is a working example. Its stage stays **pre-stable**. Its two cataloged datasets already existed; the catalog supplies discovery and the dataset leaf markup shares canonical identifiers with the entity graph. Goose also dogfoods the optional Project Surfaces contract through [project/profile.json](project/profile.json).

## Run the static checks

From this repository:

```bash
node scripts/project-surfaces-test.mjs --site
node scripts/maturity-profile-test.mjs --site
node bin/arwp-maturity.mjs check docs/maturity/profile.json
node bin/arwp-maturity.mjs receipt docs/maturity/profile.json > maturity-receipt.json
```

For another site, create an inventory with its own repository-relative paths and canonical identifiers, then run the same CLI with `--root=/absolute/path/to/site-repository`. No npm alias, provider token or network access is required by this CLI. Do not copy ARWP's owner, URLs, licenses, company routes or dataset claims into another site.

The inventory contract uses `schemaVersion: "1.0"`, an HTTPS `site`, actual `stage`, `identity` with `graph`, `subjectId`, `ownerId` and `websiteId`, a `policies` map of local paths, and a `datasets` list. Each dataset supplies `id`, `landingPage`, `distribution`, `license`, `limitations` and `doi`. Optional `projectSurfaces`, `citation` and `analytics` sections identify a project-policy manifest, CFF and measurement-plan files. The self-inventory shows every field in use. These are ARWP-local fields, not upstream Schema.org properties.

Exit codes: 0 means the scoped checks passed, 1 means a declaration failed validation, 2 means usage or file-reading failure. The CLI restricts paths to the supplied repository, including symlink targets, and limits individual files to 5 MB. It does not fetch arbitrary URLs.

## What is verified, and what is not

The checker verifies unique entity IDs and named owner references; local file presence; declared project-policy surfaces when a Project Surfaces manifest is present; dataset graph/landing name, URL, creator, license and typed download parity; explicit DOI states; and defined metric sources, grains and limitations. Dataset landing descriptions must meet Google's documented 50–5000 character range. This is not a complete JSON-LD, Schema.org, legal, privacy, trademark or CFF validator.

The unsigned receipt contains SHA-256 hashes of the observed files and the profile. Preserve the actual source commit and exact files with it. A hash establishes a byte identity, not truth, authorship, historical publication time, legal compliance, security, trademark clearance or successful deployment. `revision` is deliberately null rather than guessed.

After deployment, separately verify HTTP status, content types, actual download bytes, canonical links, crawl access, visible/schema parity and relevant platform validation. Owner-only tools remain necessary for index coverage and outcome measurement. A green static check is not proof of Google Dataset Search inclusion, legal compliance or search performance.

## Entity and page pattern

Use one stable identifier for each real object. A person is a `Person`; use `Organization` only for a real organization. The site is a `WebSite`, code can be `SoftwareSourceCode`, an actual dataset is `Dataset`, and its collection can be `DataCatalog`. Reuse `creator`, `about`, `isPartOf`, `includedInDataCatalog` and `distribution` relationships instead of duplicating identities. `sameAs` must identify the same entity, not a related topic, customer or desired authority.

Publish useful human-readable leaf pages and embed their factual structured data there. A separate graph file does not repair missing required properties on a dataset's actual page. Link the catalog from existing useful pages and include canonical public pages in the sitemap. Do not put JSON artifacts in the sitemap merely to increase URL count. Change `lastmod` only for a meaningful page change, not on every build.

## Project maturity surfaces

For a serious public project, Goose treats the following **semantic jobs** as the default core maturity set when they are relevant to the project itself:

1. **Project identity** — who maintains the project, its canonical name and stage.
2. **Copyright & rights** — distinguish source-code licensing, project-authored content, media/AI reuse and third-party material.
3. **Names & marks** — canonical, short, technical, module and legacy names; affiliation boundaries; actual trademark status.
4. **Partnership & collaboration** — contribution, research, integration and commercial routes with relationship disclosure.
5. **Governance** — who can decide, how changes are accepted, how evidence can revise recommendations and how conflicts are handled.
6. **Contact routing** — send security, corrections, media, technical and commercial requests to the right place.
7. **Security** — a real reporting process for vulnerabilities.
8. **Corrections** — a visible way to repair material factual errors without silently rewriting history.
9. **Change history** — meaningful evolution, current maturity and release state.

These are roles, **not a required number of URLs**. A single substantive Project & Policies page can satisfy several roles when that is clearer. The Project Surfaces manifest intentionally permits repeated local paths for different roles. Do not create thin “enterprise-looking” pages just to increase page count.

Conditional surfaces depend on actual behavior. A privacy/data-use page becomes relevant when analytics, forms, accounts, uploads or personal-data processing exist. Terms can become relevant for accounts, payments, hosted services, submissions or contractual workflows. A status/SLA surface should exist only when an availability/support promise is actually made. A separate accessibility statement should reflect a real legal or organizational commitment, not a copied badge.

`schema/project-surfaces.schema.json` documents the machine-readable shape. `lib/project-surfaces.mjs` checks declared role coverage, local file presence, canonical/meta basics for HTML policy pages, conditional applicability reasons, naming roles and anti-theater guardrails. It does not fetch or certify external company endpoints, test legal compliance or infer ranking benefit.

## Brand, governance and security

`TRADEMARKS.md` records naming and affiliation boundaries. A project may label names as “reserved” for internal project roles without claiming government registration, legal exclusivity or completed clearance. Before committing to a commercial name, document jurisdiction, goods/services, similar names and registry plus broader-use searches. Maintain the distinction between software license, content reuse and third-party marks.

Keep a real security contact/process, corrections ledger and release history. Add compatibility, support, governance or partnership claims only when the maintainer can honor them; avoid copied enterprise promises. An SBOM must describe an actual artifact, and an attestation must be verifiable against the exact released bytes. Do not publish dummy SBOMs or badge-shaped claims.

Commercial relationships are not independent evidence. A customer, contributor or partner logo does not prove ranking, recommendation, adoption or product effectiveness. When a material relationship can affect a comparison, recommendation or research interpretation, disclose it where the affected claim is made.

## Dataset releases and persistent identifiers

A genuine dataset should have a field dictionary, collection and exclusion method, provenance, license, limitations, version and downloadable distributions. Freeze exact data bytes and checksums when publishing a research result. Preserve negative results and prior snapshots. Owner-controlled reference sites are not independent adoption evidence.

Keep software citation and dataset citation separate. ARWP already has `CITATION.cff`; do not add `.zenodo.json` by default because Zenodo ignores CFF when both exist. Only introduce that override deliberately, with synchronized reviewed metadata.

Use `not-issued` with `value: null` until an identifier exists. A reserved DOI is not a published record. For `issued`, the inventory requires syntax plus `recordUrl`, `verifiedAt` and `metadataEvidence`; these fields still need human/external verification. Check issuer metadata, object identity, actual resolution, rights and exact version before publishing a DOI in CFF or Dataset `identifier`. Cite a version-specific DOI for reproducibility; retain the provider's all-versions relationship separately. Do not apply a software DOI to a different dataset.

Croissant is an optional follow-up for suitable structured ML data. Implement it only alongside validated file/record extraction and a tested consumer example; the current pack does not claim Croissant conformance.

## Measurement and growth hypothesis

[Measurement plan](measurement/plan.json) defines three decision metrics: disclosed non-brand search clicks, consented useful-resource intent rate, and verified independent adoption. They are not yet measured here. Custom events are specified, not instrumented, and no additional tracker is installed by this pack.

Keep payloads publisher-controlled and aggregate public reporting. Verify existing provider configuration, consent, withdrawal, retention and actual requests before collecting or claiming results. Never publish visitor-level exports, raw queries, free text or submitted audit URLs. Unknown baselines stay null, and a zero denominator produces no rate.

**Hypothesis:** clearer project identity, rights and data landing metadata can reduce ambiguity for users, collaborators and machine consumers. **Applicability:** real public projects with maintainable policy and evidence surfaces. **Static check:** role/file/identity parity. **External check:** deployed accessibility, user understanding and relevant platform reports. **Outcome:** useful discovery, reuse, collaboration and resource use in comparable complete windows. **Falsification:** no improvement or worsening outcomes remain visible. Policy-page presence alone is not the treatment or proof of a ranking effect.

## Next evidence backlog, not completed work

Prioritize a versioned data dictionary and reproducible release; a real archived record and issued DOI; an independent implementation/case study with dates and denominators; verified event instrumentation and an aggregate baseline; and an actual release compatibility/support matrix when such commitments exist. Prefer these to speculative metadata files, fake statistics or mass-created thin pages.

## Primary sources

- [Google Dataset structured data](https://developers.google.com/search/docs/appearance/structured-data/dataset)
- [Google AI features](https://developers.google.com/search/docs/appearance/ai-features)
- [Schema.org DataCatalog](https://schema.org/DataCatalog)
- [Zenodo CFF vs .zenodo.json](https://help.zenodo.org/docs/github/describe-software/zenodo-json/)
- [Zenodo DOI reservation and publication](https://help.zenodo.org/docs/deposit/describe-records/reserve-doi/)
- [Zenodo record versions](https://help.zenodo.org/docs/deposit/manage-versions/)
- [MLCommons Croissant](https://docs.mlcommons.org/croissant/)
- [USPTO clearance guidance](https://www.uspto.gov/trademarks/search/comprehensive-clearance-search-similar-trademarks)
- [WIPO search coverage](https://www.wipo.int/en/web/global-brand-database)
- [Google Analytics PII prevention](https://support.google.com/analytics/answer/6366371?hl=en)
- [Google consent implementation](https://developers.google.com/tag-platform/security/guides/consent)
