# Dataset DOI check contract

When ARWP audits a site with a genuine reusable corpus, dataset publication is an explicit maturity track.

P1 completion requires:

- canonical Dataset identity;
- a deliberate release version;
- explicit license;
- methodology/provenance/limitations;
- stable distributions;
- an externally issued persistent identifier, preferably a DOI for the frozen release where the archive supports it.

P2 completion adds release digests/checksums and stronger provenance metadata.

If no genuine corpus exists, this check is not applicable. If a corpus exists but no external DOI has been issued, report `dataset-doi-missing`; never manufacture an identifier to pass the check.
