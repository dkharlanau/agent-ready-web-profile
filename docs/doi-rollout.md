# External DOI activation boundary

ARWP can detect, prepare and verify dataset publication metadata inside GitHub, but DOI issuance remains an external archive action.

For owner-controlled reference sites, complete the repository-side work first and keep `doi-not-issued` truthful. Then use the dataset owner's authorized Zenodo or equivalent archive account to publish the frozen release. After issuance, verify the DOI resolves to the intended version and files before writing it back to repository metadata.

Current prepared reference targets:

- CBT Cards — release version still needs to be chosen before freeze/archive.
- Metkagram — release candidate uses the existing dataset version 1.0.0.

No ARWP workflow should fabricate an identifier or claim archival publication based only on local metadata.
