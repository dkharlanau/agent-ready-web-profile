# DOI / Zenodo activation

ARWP is prepared for durable software citation, but **no DOI is currently claimed**.

## Current state

- canonical citation metadata: repository-root `CITATION.cff`;
- latest tagged compatibility release currently referenced by citation metadata: `v0.1.0` / 2026-08-25;
- Zenodo DOI status: `prepared-not-issued`;
- `.zenodo.json` is intentionally not added, so ARWP does not maintain two competing metadata sources. Zenodo can consume `CITATION.cff` when the GitHub repository is enabled in the Zenodo integration.

## One-time external activation

A repository owner must complete the account-level step that cannot be performed by ARWP itself:

1. sign in to Zenodo with GitHub;
2. enable `dkharlanau/agent-ready-web-profile` in the Zenodo GitHub integration;
3. create/publish the intended GitHub Release after citation metadata is reviewed;
4. verify that Zenodo archived the release and actually issued the DOI;
5. only then add the issued DOI to `CITATION.cff`, `trust/trust.json`, press facts and relevant citation pages.

Do not pre-allocate, guess or copy a DOI from another release/project.

## Versioning policy

Prefer a version DOI for a specific archived release when citing reproducible software state. If Zenodo also exposes a concept DOI that resolves to the collection of versions, document both roles explicitly rather than treating them as interchangeable identifiers.

## Why this is external

A DOI is valuable precisely because an external persistent-identifier/archive service issued it. A repository-local string that merely looks like a DOI would add no trust.
