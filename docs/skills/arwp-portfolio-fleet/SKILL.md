---
name: arwp-portfolio-fleet
description: Inspect and verify multiple local website repositories and their public ARWP profiles from one versioned workspace manifest. Use for portfolio-wide status, drift triage, repeated local checks, bounded live checks, or choosing the next site to improve. Do not use for a single-site implementation or as authorization to commit, push, deploy, or change external services.
license: PolyForm-Strict-1.0.0
---

# ARWP Portfolio Fleet

Use this skill when the unit of work is a portfolio rather than one repository. Keep one workspace manifest outside target repositories when it contains machine-specific checkout paths.

## Workflow

Start with the cheapest current evidence:

1. Run `arwp-portfolio fleet-check <workspace.json>` to validate the manifest.
2. Run `arwp-portfolio fleet-inspect <workspace.json> --json` before opening repositories individually. This observes local Git/profile/discovery state without fetching remotes or changing files.
3. Group the result into missing checkouts, invalid or mismatched profiles, missing discovery files, preserved dirty worktrees, and clean sites.
4. Read a target repository's instructions before changing that site. Use the existing Growth Loop and site-preparation skills for implementation.

Use `fleet-live` when current public availability matters. It performs bounded public HTTPS reads of each canonical homepage and profile, omits bodies from the receipt, and does not prove deployed commit identity, indexing, ranking or AI citation.

Use `fleet-verify` only after reviewing each site's explicit `checks` arrays. Commands run without a shell, sequentially within each checkout and concurrently only across different sites. Dirty worktrees are skipped unless the user specifically includes them; never enable `--allow-dirty` as a convenience. The receipt keeps the executable, argument count and argument hash rather than argument values; output is represented by byte counts and hashes so portfolio receipts do not collect logs or secrets. If a check changes a working tree, report it and preserve the files.

Select the next site from evidence and learning value: protect existing demand and migrations, then repair invalid profiles or broken discovery, then improve a page with a real intent and measurable useful action. Do not turn missing data into zero or apply one generic patch everywhere.

For manifest fields and state meanings, read [references/workspace-contract.md](references/workspace-contract.md). To convert an existing inventory with `sites[].id`, `checkout`, and `site_url`, use `fleet-init`; review the generated profile paths and add only known-safe check argument arrays.
