# Dataset publication increment — 7 September 2026

Implemented in the current agent loop:

- standalone dataset-publication audit and CLI;
- explicit detection of dataset-bearing sites versus not-applicable sites;
- P1 failure when a genuine dataset has no observed DOI;
- checks for canonical Dataset metadata, version, license, methodology/provenance, distributions and release integrity;
- dataset-publication Agent Skill and reusable release manifest template;
- owner portfolio classification updated so CBT Cards participates in the research-dataset track;
- CBT Cards and Metkagram reference implementations prepared with Dataset JSON-LD and truthful `doi-not-issued` release manifests;
- external archive activation checklists added to both reference repositories.

Blocked externally: DOI issuance itself requires an owner-authorized persistent archive account. Repository metadata must remain `doi-not-issued` until the archive issues and resolves the identifier.
