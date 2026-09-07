# Dataset publication example

Use `templates/growth/dataset-publication.example.json` as a starting point only when repository inspection shows a genuine reusable corpus.

A strong target-site implementation has two identities that remain linked but distinct:

1. the live mutable website/data surface used by people and applications;
2. the frozen versioned dataset release used for reproducible citation.

The external archive DOI belongs to the frozen release. Do not silently make a DOI appear to identify future mutable bytes.

Minimal adoption:

```text
CITATION.cff
/data/dataset.jsonld
/data/dataset-publication.json
/dataset/ or /research/       # human landing/methodology
```

Run:

```bash
node bin/arwp-dataset.mjs https://example.com/ --json
```

If the report is `dataset-doi-missing`, complete metadata/version/license/methodology/integrity work first, publish the exact release with an external archive, verify the DOI, then write the issued identifier back to the canonical surfaces.
