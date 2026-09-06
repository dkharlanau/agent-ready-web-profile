# Identity, data and maturity evidence

Use this reference when a publisher asks about trust pages, trademarks, analytics files, entities, datasets, DOI or project maturity.

Read `docs/MATURITY-PROFILE.md` and inspect existing surfaces before adding files. Preserve the actual project stage. Reuse upstream Schema.org entities and canonical identifiers; the optional inventory is not a required discovery protocol.

Implement meaningful missing surfaces and correct actual leaf-page markup. Use `docs/maturity/profile.json` only as a structural example: never copy ARWP identity, data or license claims into another site. Sites without genuine datasets use an empty dataset list. Policy presence is not legal or runtime verification.

Run `node bin/arwp-maturity.mjs check <profile>` and `receipt <profile>` with the appropriate repository root. Use the report's external review items as gates, not completed claims. Include deployed HTTP/crawl checks and owner-side measurement in the Growth Loop. Do not promote local hashes to signed attestations or interpret green checks as proof of maturity.

Keep trademark registration/clearance, DOI reservation/publication, analytics source/runtime reception, and static metadata/outcomes distinct. Do not introduce .zenodo.json over existing CITATION.cff without deliberate review. Preserve unknowns and negative results. The measurement plan's custom events are currently specified, not instrumented.
