---
name: arwp-dataset-publication
description: Audit and prepare a genuine website corpus for versioned dataset publication, archival DOI citation, provenance and machine-readable discovery without treating DOI or metadata as ranking factors.
license: Apache-2.0
compatibility: Requires access to the target website corpus or repository. External archive owner access is required only for the final DOI issuance step.
metadata:
  standard: agent-skills
  arwp-role: dataset-publication
---

# ARWP Dataset Publication

Use this skill when a target website contains a substantial reusable corpus: knowledge records, cards, annotations, research observations, evaluation cases, exercises, benchmarks or other structured data with independent reuse value.

Do not activate this workflow merely to create an SEO artifact.

## Outcome

Turn an existing mutable website corpus into a deliberately scoped, versioned, reproducible and externally citable dataset release.

## Workflow

1. Inspect the repository and public site before creating files.
2. Decide whether a genuine reusable dataset exists. If not, mark the module not applicable and stop.
3. Identify the canonical corpus and exclude private, operational, generated-noise and unsafe-to-release files.
4. Run `node bin/arwp-dataset.mjs <canonical-site-url> --json` when the public site is available.
5. Ensure a human dataset/research landing surface exists.
6. Publish canonical Schema.org `Dataset` metadata. Use Croissant/DCAT in addition only when the dataset shape/catalog justifies them.
7. Publish methodology, provenance, limitations, schema/data dictionary and explicit reuse rights.
8. Choose a dataset release version and freeze the distributions intended for citation.
9. Compute SHA-256 checksums for the exact release bytes.
10. Prepare accurate `CITATION.cff` metadata for the dataset release.
11. Publish the frozen release through Zenodo or another appropriate external persistent archive using owner-authorized access.
12. Only after the archive issues the identifier, verify that the DOI resolves to the intended release and then add the exact DOI to Dataset metadata, `CITATION.cff`, the human citation surface and relevant trust metadata.
13. Preserve prior version DOI identity when a later corpus release changes cited bytes.
14. Re-run the ARWP dataset audit and keep missing or externally blocked work explicit.

## Required state model

Before external archival issuance, use an explicit state such as:

```json
{
  "publicationState": "doi-not-issued",
  "persistentIdentifier": {
    "type": "DOI",
    "state": "not-issued",
    "value": null
  }
}
```

Never invent a DOI-shaped placeholder.

## Done when

- a genuine corpus has an explicit release boundary;
- dataset metadata identifies the corpus and its distributions;
- version, license, methodology/provenance and limitations are explicit;
- exact release bytes are frozen with SHA-256 checksums;
- an external archive record exists;
- the DOI resolves to the intended dataset release;
- the DOI is consistently exposed through site metadata and citation surfaces;
- the audit reports the persistent-identifier check as satisfied;
- no documentation claims that DOI publication itself improves Search ranking or guarantees AI citation.

If external archive credentials or owner authorization are unavailable, complete every preparatory step possible, leave `doi-not-issued` truthful, and create a narrowly scoped owner action describing exactly what remains.
