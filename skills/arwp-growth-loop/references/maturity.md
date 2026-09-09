# Identity, data and maturity evidence

Use this reference when a publisher asks about trust pages, copyright/reuse, trademarks and reserved names, collaboration/partnership, governance, privacy, analytics files, entities, datasets, DOI or project maturity.

Read `docs/MATURITY-PROFILE.md` and inspect existing surfaces before adding files. Preserve the actual project stage. Reuse upstream Schema.org entities and canonical identifiers; the optional maturity inventory and Project Surfaces manifest are Goose/ARWP implementation patterns, not required discovery protocols.

For a serious public project, review these semantic jobs first: project identity; copyright/rights; names/marks; partnership/collaboration; governance; contact routing; security; corrections; and change history. These are roles, not a page-count target. One substantive page may cover several roles. Never manufacture thin policy pages merely to imitate a large company.

Conditional surfaces follow actual behavior: privacy/data use when analytics/forms/accounts/personal data exist; terms when accounts/payments/hosted services/submissions create a contractual workflow; status/SLA only when an availability/support promise exists; an accessibility statement only when the project has a real applicable commitment. Do not copy legal boilerplate from Goose.

Implement meaningful missing surfaces and correct actual leaf-page markup. Use `docs/maturity/profile.json` and `docs/project/profile.json` only as structural examples: never copy ARWP identity, company routes, data, license or trademark claims into another site. Sites without genuine datasets use an empty dataset list. Policy presence is not legal or runtime verification.

Run `node scripts/project-surfaces-test.mjs --site` for Goose dogfood and `node bin/arwp-maturity.mjs check <profile>` / `receipt <profile>` with the appropriate repository root. Use external review items as gates, not completed claims. Include deployed HTTP/crawl checks and owner-side measurement in the Growth Loop. Do not promote local hashes to signed attestations or interpret green checks as proof of maturity.

Keep trademark registration/clearance, project-reserved naming roles, copyright/reuse permission, crawler access, partnership routing, DOI reservation/publication, analytics source/runtime reception, and static metadata/outcomes distinct. A partner logo is not independent evidence. Do not introduce `.zenodo.json` over existing `CITATION.cff` without deliberate review. Preserve unknowns and negative results.
