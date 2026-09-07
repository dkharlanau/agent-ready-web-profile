# Dataset Publication module

ARWP treats a substantial reusable corpus as a publishable data product, not as a pile of JSON files hidden inside a website repository.

This module applies when a target site genuinely contains reusable structured knowledge, research observations, annotations, evaluation cases, cards, exercises, linguistic patterns or another coherent corpus. It does **not** recommend manufacturing a dataset for an ordinary marketing or documentation site.

## Target state

A mature dataset-bearing site should expose a chain like this:

```text
human pages / product
        ↓
canonical dataset landing page
        ↓
Dataset metadata + methodology + license
        ↓
versioned frozen distributions + checksums
        ↓
external archival release (for example Zenodo)
        ↓
issued DOI
        ↓
DOI linked back from the site, CITATION.cff and Dataset metadata
```

The DOI identifies a citable archived release. It is not a ranking factor, quality badge or endorsement.

## ARWP audit

```bash
node bin/arwp-dataset.mjs https://example.com/
node bin/arwp-dataset.mjs https://example.com/ --json
```

For a dataset-bearing site ARWP checks:

1. canonical Schema.org `Dataset` metadata;
2. explicit dataset version;
3. reuse/license terms;
4. methodology, provenance and limitations;
5. stable downloadable distributions;
6. release integrity/checksum metadata;
7. an externally issued DOI / persistent archive identifier.

A genuine corpus without an observed DOI is reported as `dataset-doi-missing` and produces a P1 recommendation to publish a frozen release through an external archive and expose the issued DOI.

## DOI lifecycle

Do not write a DOI-shaped placeholder into production metadata.

Recommended lifecycle:

```text
candidate corpus
  → define dataset scope
  → clean release boundary
  → version
  → freeze release files
  → document schema/methodology/license/limitations
  → publish release to Zenodo or another appropriate repository
  → receive DOI
  → verify DOI resolution and archived files
  → add DOI to Dataset JSON-LD + CITATION.cff + site citation page
  → preserve old version DOI when a new release is published
```

Where the archive provides both a concept DOI and version DOI, keep the distinction explicit. Cite the version DOI for reproducible data-dependent claims when possible.

## Recommended target-site structure

The structure is intentionally conventional rather than ARWP-specific:

```text
/dataset/                 # human landing page
/data/dataset.jsonld      # Schema.org Dataset metadata
/data/                    # current public distributions
/methodology/             # collection/curation/provenance/limitations
CITATION.cff              # citation metadata
```

An optional release manifest may record exact distributions and digests before archival publication:

```json
{
  "dataset": "example-corpus",
  "version": "1.0.0",
  "doi": null,
  "doiStatus": "not-issued",
  "archive": "zenodo",
  "distributions": [
    {
      "url": "https://example.com/data/corpus.jsonl",
      "mediaType": "application/x-ndjson",
      "sha256": "<release SHA-256>"
    }
  ]
}
```

`doi: null` is correct before issuance. After an external archive issues the DOI, replace the state only after verifying that the archived record represents the intended release.

## Metadata formats

Use the format appropriate to the data rather than duplicating the same facts into invented AI files:

- Schema.org `Dataset` for web semantics and search-facing dataset identity;
- `CITATION.cff` for repository citation metadata;
- Croissant when the asset is ML/dataset-shaped and benefits from machine-actionable field/provenance/policy descriptions;
- DCAT when a site publishes a broader catalog of datasets/distributions/services;
- PROV-O or domain-specific provenance only where the extra graph is useful;
- DOI/DataCite metadata as the externally registered persistent identity.

## What ARWP should enforce

For a target site classified as `research-dataset` or otherwise found to contain a genuine corpus:

- data files alone are insufficient maturity evidence;
- `CITATION.cff` without a DOI is useful preparation, not completion;
- a DOI without version/license/methodology/distributions is incomplete publication hygiene;
- a DOI must never be fabricated merely to make an audit pass;
- archived release identity must stay separate from live mutable site data;
- changes to the live corpus should result in a new release/version when reproducibility matters.

## Portfolio examples

CBT Cards already contains a substantial public corpus including practice data, curated knowledge records, evidence, ontology/relations, translation data and agent evaluation datasets. Metkagram already contains substantial language-learning and annotated-pattern data, including large annotation distributions. These are dataset-publication candidates because the corpus already exists; ARWP should help package and archive it rather than inventing new content.

The next external step for such sites is owner-authorized archival publication. ARWP can prepare the release boundary and metadata in GitHub, but it must not claim an issued DOI until Zenodo or another external repository has actually issued and resolved it.
